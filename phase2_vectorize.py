"""
Phase 2 — Gemini Embeddings & LanceDB Storage
===============================================
Reads output/chunks.json, generates embeddings via the Gemini
text-embedding-004 model (768 dims), and persists them in a local
LanceDB table at output/lancedb/.

Usage:
    python phase2_vectorize.py

Requirements:
    pip install -r requirements.txt
    Copy .env.example → .env and set GEMINI_API_KEY.

Rate-limit notes:
    Gemini free tier = 10 RPM.  This script enforces a 6-second minimum
    gap between API calls and uses exponential backoff on 429 errors.
    A resume mechanism skips chunks already stored in LanceDB, so you
    can safely restart after an interruption.
"""

import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHUNKS_FILE  = Path("output/chunks.json")
LANCEDB_DIR  = Path("output/lancedb")
TABLE_NAME   = "rad_research"
EMBED_MODEL  = "models/gemini-embedding-001"
EMBED_DIMS   = 3072         # gemini-embedding-001 output dimensions

# Rate-limiting
# Tier 1 key: 1500 RPM → 0.05 s gap (~1200 RPM, safely under limit)
# Free tier key: set to 6.1 s gap (~10 RPM)
MIN_CALL_GAP  = 0.05        # seconds between calls — Tier 1
MAX_RETRIES   = 6           # max attempts per chunk on 429 / transient errors
BACKOFF_BASE  = 2           # seconds — doubles each retry

# Progress reporting
REPORT_EVERY  = 100         # print a summary line every N chunks

# ---------------------------------------------------------------------------
# Env / API key
# ---------------------------------------------------------------------------

def load_env() -> str:
    """Load GEMINI_API_KEY from .env file or environment."""
    env_path = Path(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print(
            "[ERROR] GEMINI_API_KEY not set.\n"
            "  1. Copy .env.example to .env\n"
            "  2. Add:  GEMINI_API_KEY=your_key_here\n"
            "  Get a free key at https://aistudio.google.com/app/apikey"
        )
        sys.exit(1)
    return api_key


# ---------------------------------------------------------------------------
# Rate-limit manager
# ---------------------------------------------------------------------------

class RateLimiter:
    """Enforces a minimum gap between successive API calls."""

    def __init__(self, min_gap: float = MIN_CALL_GAP):
        self._min_gap = min_gap
        self._last_call = 0.0

    def wait(self) -> None:
        elapsed = time.monotonic() - self._last_call
        sleep_for = self._min_gap - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)
        self._last_call = time.monotonic()


# ---------------------------------------------------------------------------
# Embedding with retry / backoff
# ---------------------------------------------------------------------------

def embed_with_retry(
    client,
    text: str,
    rate_limiter: RateLimiter,
    chunk_id: str,
) -> list[float] | None:
    """
    Call the Gemini embedding API with exponential backoff.
    Returns the embedding vector or None if all retries are exhausted.
    """
    for attempt in range(MAX_RETRIES):
        try:
            rate_limiter.wait()
            result = client.models.embed_content(
                model=EMBED_MODEL,
                contents=text,
            )
            return list(result.embeddings[0].values)

        except Exception as exc:
            err_str = str(exc).lower()
            is_rate_limit = "429" in err_str or "quota" in err_str or "rate" in err_str

            wait = BACKOFF_BASE ** (attempt + 1)
            if is_rate_limit:
                print(
                    f"    [rate-limit] {chunk_id} — attempt {attempt + 1}/{MAX_RETRIES}, "
                    f"sleeping {wait}s ..."
                )
            else:
                print(
                    f"    [API error] {chunk_id}: {exc} — "
                    f"attempt {attempt + 1}/{MAX_RETRIES}, sleeping {wait}s ..."
                )
            time.sleep(wait)

    print(f"    [SKIP] {chunk_id} — exhausted retries.")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Phase 2 — Gemini Embeddings & LanceDB Storage")
    print("=" * 60)

    # --- Deps check --------------------------------------------------------
    try:
        from google import genai
    except ImportError:
        print("[ERROR] google-genai not installed.  Run: pip install -r requirements.txt")
        sys.exit(1)

    try:
        import lancedb
        import pyarrow as pa
    except ImportError:
        print("[ERROR] lancedb not installed.  Run: pip install -r requirements.txt")
        sys.exit(1)

    # --- Load chunks -------------------------------------------------------
    if not CHUNKS_FILE.exists():
        print(f"[ERROR] {CHUNKS_FILE} not found.  Run phase1_parse.py first.")
        sys.exit(1)

    chunks = json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))
    print(f"\nLoaded {len(chunks)} chunks from {CHUNKS_FILE}")

    # --- API client --------------------------------------------------------
    api_key = load_env()
    client  = genai.Client(api_key=api_key)

    # --- LanceDB -----------------------------------------------------------
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))

    schema = pa.schema([
        pa.field("chunk_id",     pa.string()),
        pa.field("filename",     pa.string()),
        pa.field("page_number",  pa.int32()),
        pa.field("text_content", pa.string()),
        pa.field("vector",       pa.list_(pa.float32(), EMBED_DIMS)),
    ])

    if TABLE_NAME in db.table_names():
        table = db.open_table(TABLE_NAME)
        existing_ids = set(table.to_arrow().column("chunk_id").to_pylist())
        print(f"Resuming — {len(existing_ids)} chunks already in LanceDB, skipping them.")
    else:
        table = db.create_table(TABLE_NAME, schema=schema)
        existing_ids = set()

    # --- Embedding loop ----------------------------------------------------
    rate_limiter = RateLimiter()

    pending   = [c for c in chunks if c["chunk_id"] not in existing_ids]
    total     = len(pending)
    skipped   = len(chunks) - total
    succeeded = 0
    failed    = 0

    print(f"Chunks to embed: {total}  (skipped {skipped} already stored)\n")

    if total == 0:
        print("Nothing to do — all chunks already embedded.")
    else:
        print(f"Rate limit: 1 call per {MIN_CALL_GAP}s  (~{60/MIN_CALL_GAP:.0f} RPM max)\n")

    batch: list[dict] = []

    for i, chunk in enumerate(pending, start=1):
        chunk_id     = chunk["chunk_id"]
        text_content = chunk["text_content"]
        filename     = chunk["filename"]
        page_number  = int(chunk["page_number"])

        vector = embed_with_retry(client, text_content, rate_limiter, chunk_id)

        if vector is None:
            failed += 1
        else:
            batch.append({
                "chunk_id":     chunk_id,
                "filename":     filename,
                "page_number":  page_number,
                "text_content": text_content,
                "vector":       vector,
            })
            succeeded += 1

            # Flush to disk every 10 records (keeps resume safe on interruption)
            if len(batch) >= 10:
                table.add(batch)
                batch.clear()

        if i % REPORT_EVERY == 0 or i == total:
            pct      = i / total * 100
            eta_secs = (total - i) * MIN_CALL_GAP
            eta_min  = eta_secs / 60
            print(
                f"  [{i}/{total}  {pct:.1f}%]  stored={succeeded}  "
                f"failed={failed}  ETA~{eta_min:.1f} min",
                flush=True,
            )

    # Flush any remaining records
    if batch:
        table.add(batch)

    # --- Summary -----------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"Done.  Embedded: {succeeded}  Failed: {failed}  "
          f"Pre-existing: {skipped}")
    print(f"LanceDB saved to: {LANCEDB_DIR}")
    print(f"Total vectors in table '{TABLE_NAME}': {table.count_rows()}")


if __name__ == "__main__":
    main()
