"""
RAD Research Tool — Phases 3 & 4
==================================
FastAPI backend serving the RAG query pipeline, the frontend UI,
and the Phase 4 test-bed inventory / AI parameter generator.

Usage:
    python phase3_app.py   (or double-click start.bat)

Phase 3 endpoints:
    GET  /                          → frontend
    POST /api/query                 → RAG pipeline
    GET  /api/pdf/{filename}        → serve PDF
    GET  /api/notes                 → load notes
    POST /api/notes                 → save note
    GET  /api/status                → DB health check

Phase 4 endpoints:
    GET  /api/components            → list inventory
    POST /api/components            → add component
    PUT  /api/components/{id}       → update component
    DELETE /api/components/{id}     → delete component
    GET  /api/test-runs             → list test runs
    POST /api/test-runs             → create test run
    GET  /api/test-runs/{id}        → get test run + components
    DELETE /api/test-runs/{id}      → delete test run
    POST /api/test-runs/{id}/components          → add component to run
    DELETE /api/test-runs/{id}/components/{cid}  → remove component from run
    POST /api/test-runs/{id}/generate            → AI parameter plan
    GET  /api/test-runs/{id}/export/md           → download Markdown
    GET  /api/test-runs/{id}/export/pdf          → download PDF
"""

import io
import json
import json as _json
import os
import logging
import sys
import threading
import webbrowser
from logging.handlers import RotatingFileHandler
from pathlib import Path
from threading import Timer
from typing import Optional

import csv
import io as _io
import math
import statistics

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import phase4_db

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

_log_dir = Path("output")
_log_dir.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("rad_research")
logger.setLevel(logging.INFO)

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

_file_handler = RotatingFileHandler(str(_log_dir / "app.log"), maxBytes=5_000_000, backupCount=3, encoding="utf-8")
_file_handler.setFormatter(_fmt)
logger.addHandler(_file_handler)

_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(_fmt)
logger.addHandler(_console_handler)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PDF_DIR     = Path("data/pdfs")
LANCEDB_DIR = Path("output/lancedb")
NOTES_FILE  = Path("output/notes.json")
TABLE_NAME  = "rad_research"
EMBED_MODEL = "models/gemini-embedding-001"
FLASH_MODEL = "gemini-2.5-flash"
TOP_K       = 5
PORT        = 8000


# ---------------------------------------------------------------------------
# Startup: load env & initialise clients
# ---------------------------------------------------------------------------

def load_env() -> str:
    env_path = Path(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        logger.error("GEMINI_API_KEY not set in .env")
        sys.exit(1)
    return key


api_key = load_env()
phase4_db.init_db()

from google import genai as _genai
gemini = _genai.Client(api_key=api_key)

import lancedb as _lancedb
_db = _lancedb.connect(str(LANCEDB_DIR))

# Repo-build shared state
_repo_state = {"running": False, "done": 0, "total": 0, "errors": 0}
_repo_lock  = threading.Lock()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def embed(text: str) -> list[float]:
    result = gemini.models.embed_content(model=EMBED_MODEL, contents=text)
    return list(result.embeddings[0].values)


def get_table():
    _tables_result = _db.list_tables()
    _table_names   = getattr(_tables_result, 'tables', None) or list(_tables_result)
    if TABLE_NAME not in _table_names:
        raise HTTPException(
            status_code=503,
            detail="Vector DB not ready — run phase2_vectorize.py first.",
        )
    return _db.open_table(TABLE_NAME)


def find_pdf(filename: str) -> Optional[Path]:
    for p in PDF_DIR.rglob("*.pdf"):
        if p.name == filename:
            return p
    return None


# ---------------------------------------------------------------------------
# Repo helpers
# ---------------------------------------------------------------------------

_VALID_TEST_TYPES = {"SEU", "SEL", "SEFI", "SET", "TID", "Proton", "Other"}
_VALID_PART_TYPES = {
    "FPGA", "Transistor", "ADC", "DAC", "Memory",
    "Microprocessor", "Op-Amp", "Linear IC", "Mixed Signal", "Other",
}

CHUNKS_FILE = Path("output/chunks.json")


def _extract_repo_metadata(chunks: list[dict]) -> dict:
    """Call Gemini Flash to extract structured metadata from the first two chunks."""
    text_parts = []
    for chunk in chunks[:2]:
        text_parts.append(chunk.get("text_content", "")[:1200])
    combined = "\n\n".join(text_parts)

    prompt = (
        "You are a radiation effects data librarian. Extract structured metadata from this "
        "radiation test report excerpt. Return ONLY valid JSON with these exact keys:\n"
        '  "test_type": one of SEU, SEL, SEFI, SET, TID, Proton, Other\n'
        '  "part_type": one of FPGA, Transistor, ADC, DAC, Memory, Microprocessor, Op-Amp, Linear IC, Mixed Signal, Other\n'
        '  "part_numbers": JSON array of part number strings found (e.g. ["AD676","AD676BD"])\n'
        '  "manufacturer": string, the device manufacturer name\n'
        '  "summary": 1-2 sentence plain-text summary of the test and key result\n\n'
        f"Report excerpt:\n{combined}"
    )

    defaults = {
        "test_type": "Other",
        "part_type": "Other",
        "part_numbers": "[]",
        "manufacturer": "",
        "summary": "",
    }
    try:
        from google.genai import types as _gtypes
        response = gemini.models.generate_content(
            model=FLASH_MODEL,
            contents=prompt,
            config=_gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        data = _json.loads(response.text)
        test_type = data.get("test_type", "Other")
        part_type = data.get("part_type", "Other")
        if test_type not in _VALID_TEST_TYPES:
            test_type = "Other"
        if part_type not in _VALID_PART_TYPES:
            part_type = "Other"
        pn = data.get("part_numbers", [])
        part_numbers = _json.dumps(pn if isinstance(pn, list) else [])
        return {
            "test_type": test_type,
            "part_type": part_type,
            "part_numbers": part_numbers,
            "manufacturer": str(data.get("manufacturer", "")),
            "summary": str(data.get("summary", "")),
        }
    except Exception:
        return defaults


def _run_repo_build() -> None:
    """Background thread: reads chunks.json, extracts metadata, populates repo_index."""
    global _repo_state
    try:
        raw = _json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        with _repo_lock:
            _repo_state["running"] = False
            _repo_state["errors"] += 1
        logger.error(f"Failed to load chunks.json: {exc}")
        return

    # Group chunks by filename
    file_chunks: dict[str, list[dict]] = {}
    for chunk in raw:
        fname = chunk.get("filename", "")
        if fname:
            file_chunks.setdefault(fname, []).append(chunk)

    already_indexed = phase4_db.get_indexed_filenames()
    filenames = [f for f in file_chunks.keys() if f not in already_indexed]
    with _repo_lock:
        _repo_state["total"] = len(filenames)
        _repo_state["done"] = 0
        _repo_state["errors"] = 0

    for fname in filenames:
        chunks = file_chunks[fname]
        try:
            meta = _extract_repo_metadata(chunks)
            phase4_db.insert_repo_entry(
                filename=fname,
                test_type=meta["test_type"],
                part_type=meta["part_type"],
                part_numbers=meta["part_numbers"],
                manufacturer=meta["manufacturer"],
                summary=meta["summary"],
            )
        except Exception as exc:
            logger.warning(f"Error indexing {fname}: {exc}")
            with _repo_lock:
                _repo_state["errors"] += 1

        with _repo_lock:
            _repo_state["done"] += 1

    with _repo_lock:
        _repo_state["running"] = False
    logger.info(f"Repo build complete: {_repo_state['done']} files indexed, {_repo_state['errors']} errors.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="RAD Research Tool — Phase 3")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": type(exc).__name__, "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    query: str


class NotePayload(BaseModel):
    id: str
    content: str

# Phase 4 models
class ComponentPayload(BaseModel):
    part_name:        str
    manufacturer:     str = ""
    part_number:      str = ""
    serial_number:    str = ""
    calibration_date: str = ""
    specs:            str = ""

class TestRunPayload(BaseModel):
    name:  str
    notes: str = ""

class RunComponentPayload(BaseModel):
    component_id: int


class DutPayload(BaseModel):
    part_number:   str = "TPS7A53-Q1"
    serial_number: str = ""
    silicon_rev:   str = ""
    board_id:      str = ""
    notes:         str = ""


class FingerprintRunPayload(BaseModel):
    bias_cliff_v:   float | None = None
    rise_time_ms:   float | None = None
    gnd_curr_slope: float | None = None
    overshoot_v:    float | None = None
    thermal_drift:  float | None = None
    vout_accuracy:  float | None = None
    dropout_v:      float | None = None
    line_reg:       float | None = None
    load_reg:       float | None = None
    gnd_curr_nom:   float | None = None
    shutdown_leak:  float | None = None
    en_thresh_v:    float | None = None
    en_hyst_v:      float | None = None
    psrr_db:        float | None = None
    noise_vrms:     float | None = None


class SimSavePayload(BaseModel):
    dut_id:       int | None = None
    filename:     str = ""
    x_col:        str = ""
    y_col:        str = ""
    bias_cliff_v: float | None = None
    notes:        str = ""
    raw_data:     str = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def root():
    return Path("static/index.html").read_text(encoding="utf-8")


@app.get("/api/status")
async def status():
    try:
        table = get_table()
        return {"ready": True, "chunks": table.count_rows()}
    except HTTPException:
        return {"ready": False, "chunks": 0}


@app.post("/api/query")
async def query(body: QueryRequest):
    if not body.query.strip():
        raise HTTPException(400, "Query must not be empty.")

    # 1 — embed the query
    vector = embed(body.query)

    # 2 — semantic search in LanceDB
    table  = get_table()
    rows   = table.search(vector).limit(TOP_K).to_list()

    sources = [
        {
            "chunk_id":    r["chunk_id"],
            "filename":    r["filename"],
            "page_number": r["page_number"],
            "text":        r["text_content"],
            "score":       round(float(r.get("_distance", 0)), 4),
        }
        for r in rows
    ]

    # 3 — build RAG prompt
    ctx_parts = []
    for i, s in enumerate(sources, 1):
        ctx_parts.append(
            f"[Source {i}] Filename: {s['filename']}  Page: {s['page_number']}\n"
            f"{s['text']}"
        )
    context = "\n\n---\n\n".join(ctx_parts)

    prompt = (
        "You are a technical research assistant specialising in radiation effects on electronics.\n"
        "Answer the user's question using ONLY the provided source chunks below.\n"
        "For every claim, cite the source by writing (Filename, p.N) inline.\n"
        "If the answer cannot be found in the sources, say so explicitly.\n\n"
        f"Question: {body.query}\n\n"
        f"Sources:\n{context}"
    )

    # 4 — generate answer with Gemini Flash
    response = gemini.models.generate_content(model=FLASH_MODEL, contents=prompt)
    answer   = response.text

    return {"answer": answer, "sources": sources}


@app.get("/api/pdf/{filename:path}")
async def serve_pdf(filename: str):
    path = find_pdf(Path(filename).name)   # ignore any path prefix, match by name
    if not path:
        raise HTTPException(404, f"PDF not found: {filename}")
    return FileResponse(str(path), media_type="application/pdf")


@app.get("/api/notes")
async def get_notes():
    if NOTES_FILE.exists():
        return json.loads(NOTES_FILE.read_text(encoding="utf-8"))
    return {}


@app.post("/api/notes")
async def save_note(note: NotePayload):
    notes: dict = {}
    if NOTES_FILE.exists():
        notes = json.loads(NOTES_FILE.read_text(encoding="utf-8"))
    if note.content.strip():
        notes[note.id] = note.content
    else:
        notes.pop(note.id, None)
    NOTES_FILE.write_text(
        json.dumps(notes, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Phase 4 — Inventory routes
# ---------------------------------------------------------------------------

@app.get("/api/components")
async def list_components():
    return phase4_db.list_components()


@app.post("/api/components", status_code=201)
async def add_component(body: ComponentPayload):
    cid = phase4_db.add_component(**body.model_dump())
    return {"id": cid}


@app.put("/api/components/{cid}")
async def update_component(cid: int, body: ComponentPayload):
    if not phase4_db.get_component(cid):
        raise HTTPException(404, "Component not found")
    phase4_db.update_component(cid, **body.model_dump())
    return {"ok": True}


@app.delete("/api/components/{cid}")
async def delete_component(cid: int):
    phase4_db.delete_component(cid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Phase 4 — Test Run routes
# ---------------------------------------------------------------------------

@app.get("/api/test-runs")
async def list_test_runs():
    return phase4_db.list_test_runs()


@app.post("/api/test-runs", status_code=201)
async def create_test_run(body: TestRunPayload):
    rid = phase4_db.create_test_run(body.name, body.notes)
    return {"id": rid}


@app.get("/api/test-runs/{rid}")
async def get_test_run(rid: int):
    run = phase4_db.get_test_run(rid)
    if not run:
        raise HTTPException(404, "Test run not found")
    return run


@app.delete("/api/test-runs/{rid}")
async def delete_test_run(rid: int):
    phase4_db.delete_test_run(rid)
    return {"ok": True}


@app.post("/api/test-runs/{rid}/components")
async def add_component_to_run(rid: int, body: RunComponentPayload):
    if not phase4_db.get_test_run(rid):
        raise HTTPException(404, "Test run not found")
    phase4_db.add_component_to_run(rid, body.component_id)
    return {"ok": True}


@app.delete("/api/test-runs/{rid}/components/{cid}")
async def remove_component_from_run(rid: int, cid: int):
    phase4_db.remove_component_from_run(rid, cid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Phase 4 — AI Parameter Generator
# ---------------------------------------------------------------------------

@app.post("/api/test-runs/{rid}/generate")
async def generate_plan(rid: int):
    run = phase4_db.get_test_run(rid)
    if not run:
        raise HTTPException(404, "Test run not found")
    if not run["components"]:
        raise HTTPException(400, "Add at least one component before generating a plan.")

    table = get_table()

    # Build context: for each component, pull top-3 RAG chunks by name
    rag_sections: list[str] = []
    for comp in run["components"]:
        search_query = f"{comp['part_name']} {comp['part_number']} radiation test".strip()
        vector = embed(search_query)
        rows   = table.search(vector).limit(3).to_list()
        if rows:
            snippets = "\n---\n".join(
                f"[{r['filename']}, p.{r['page_number']}]\n{r['text_content'][:500]}"
                for r in rows
            )
            rag_sections.append(
                f"### Historical data for: {comp['part_name']} ({comp['part_number']})\n{snippets}"
            )

    component_block = "\n\n".join(
        f"- **{c['part_name']}** | MFR: {c['manufacturer']} | P/N: {c['part_number']} "
        f"| S/N: {c['serial_number']} | Cal: {c['calibration_date']}\n"
        f"  Specs: {c['specs'] or 'N/A'}"
        for c in run["components"]
    )

    rag_block = "\n\n".join(rag_sections) if rag_sections else "No historical RAD data found."

    prompt = f"""You are a radiation effects test engineer.
Generate a detailed test parameter checklist for the following test run.

## Test Run: {run['name']}
Notes: {run['notes'] or 'None'}

## Components Under Test
{component_block}

## Historical Radiation Performance Data (from PDF library)
{rag_block}

## Your Task
Produce a structured Markdown test plan covering:
1. Recommended radiation source and particle type (TID / SEE / proton / heavy ion)
2. Suggested dose rates and total dose targets per component
3. Bias conditions during irradiation
4. Recommended measurement intervals and functional tests
5. Expected failure modes and threshold estimates (based on historical data)
6. Post-irradiation anneal procedure
7. Pass/fail criteria

Base all recommendations on the historical data provided. Cite sources inline as (Filename, p.N).
"""

    response = gemini.models.generate_content(model=FLASH_MODEL, contents=prompt)
    plan     = response.text
    phase4_db.save_ai_plan(rid, plan)
    return {"plan": plan}


# ---------------------------------------------------------------------------
# Phase 4 — Export
# ---------------------------------------------------------------------------

def _build_markdown(run: dict) -> str:
    comp_lines = "\n".join(
        f"| {c['part_name']} | {c['manufacturer']} | {c['part_number']} "
        f"| {c['serial_number']} | {c['calibration_date']} |"
        for c in run["components"]
    )
    return (
        f"# Test Plan: {run['name']}\n\n"
        f"**Created:** {run['created_at']}  \n"
        f"**Notes:** {run['notes'] or 'N/A'}\n\n"
        f"## Components Under Test\n\n"
        f"| Part Name | Manufacturer | Part No. | Serial No. | Cal. Date |\n"
        f"|-----------|--------------|----------|------------|-----------|\n"
        f"{comp_lines}\n\n"
        f"## AI-Generated Test Parameters\n\n"
        f"{run['ai_plan'] or '_No plan generated yet. Use the Generate button._'}\n"
    )


@app.get("/api/test-runs/{rid}/export/md")
async def export_md(rid: int):
    run = phase4_db.get_test_run(rid)
    if not run:
        raise HTTPException(404, "Test run not found")
    content  = _build_markdown(run)
    filename = f"test_plan_{rid}_{run['name'].replace(' ','_')}.md"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/test-runs/{rid}/export/pdf")
async def export_pdf(rid: int):
    run = phase4_db.get_test_run(rid)
    if not run:
        raise HTTPException(404, "Test run not found")

    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(140, 29, 64)   # ASU Maroon
    pdf.cell(0, 10, f"Test Plan: {run['name']}", ln=True)
    pdf.set_text_color(80, 80, 80)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, f"Created: {run['created_at']}", ln=True)
    if run["notes"]:
        pdf.cell(0, 6, f"Notes: {run['notes']}", ln=True)
    pdf.ln(4)

    # Components table
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, "Components Under Test", ln=True)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(230, 230, 230)
    col_w = [55, 35, 32, 32, 28]
    headers = ["Part Name", "Manufacturer", "Part No.", "Serial No.", "Cal. Date"]
    for w, h in zip(col_w, headers):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8)
    for c in run["components"]:
        vals = [c["part_name"], c["manufacturer"], c["part_number"],
                c["serial_number"], c["calibration_date"]]
        for w, v in zip(col_w, vals):
            pdf.cell(w, 6, str(v)[:30], border=1)
        pdf.ln()
    pdf.ln(6)

    # AI plan
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "AI-Generated Test Parameters", ln=True)
    pdf.set_font("Helvetica", "", 9)
    plan_text = run["ai_plan"] or "No plan generated yet."
    # Strip markdown symbols for plain PDF rendering
    import re
    plain = re.sub(r"#{1,6}\s*", "", plan_text)
    plain = re.sub(r"\*\*(.+?)\*\*", r"\1", plain)
    plain = re.sub(r"\*(.+?)\*",   r"\1", plain)
    plain = re.sub(r"`(.+?)`",     r"\1", plain)
    for line in plain.splitlines():
        pdf.multi_cell(0, 5, line or " ")

    buf = io.BytesIO(pdf.output())
    filename = f"test_plan_{rid}_{run['name'].replace(' ','_')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Repo routes
# ---------------------------------------------------------------------------

@app.post("/api/repo/build", status_code=202)
async def repo_build(force: bool = False):
    with _repo_lock:
        if _repo_state["running"]:
            raise HTTPException(409, "Repo build already running.")
        if not CHUNKS_FILE.exists():
            raise HTTPException(503, "chunks.json not found — run phase2_vectorize.py first.")
        _repo_state["running"] = True
        _repo_state["done"] = 0
        _repo_state["total"] = 0
        _repo_state["errors"] = 0
    if force:
        phase4_db.clear_repo_index()
    t = threading.Thread(target=_run_repo_build, daemon=True)
    t.start()
    return {"started": True}


@app.get("/api/repo/build/status")
async def repo_build_status():
    with _repo_lock:
        return dict(_repo_state)


@app.get("/api/repo/tree")
async def repo_tree():
    count = phase4_db.get_repo_count()
    tree  = phase4_db.get_repo_tree() if count > 0 else {}
    return {"indexed": count > 0, "count": count, "tree": tree}


@app.get("/api/repo/parts")
async def repo_parts(category: str = "", test_type: str = "", part_type: str = ""):
    return phase4_db.get_parts_by_filter(category, test_type, part_type)


@app.get("/api/repo/part/{filename:path}")
async def repo_part_detail(filename: str):
    detail = phase4_db.get_part_detail(Path(filename).name)
    if not detail:
        raise HTTPException(404, f"No repo entry for: {filename}")
    return detail


# ---------------------------------------------------------------------------
# DUT routes
# ---------------------------------------------------------------------------

@app.get("/api/duts")
async def list_duts():
    return phase4_db.list_duts()


@app.post("/api/duts", status_code=201)
async def add_dut(body: DutPayload):
    did = phase4_db.add_dut(**body.model_dump())
    return {"id": did}


@app.delete("/api/duts/{did}")
async def delete_dut(did: int):
    phase4_db.delete_dut(did)
    return {"ok": True}


@app.get("/api/duts/export/csv")
async def export_fingerprints_csv():
    rows = phase4_db.get_all_dut_fingerprints()
    _FP_COLS = [
        "bias_cliff_v", "rise_time_ms", "gnd_curr_slope", "overshoot_v",
        "thermal_drift", "vout_accuracy", "dropout_v", "line_reg", "load_reg",
        "gnd_curr_nom", "shutdown_leak", "en_thresh_v", "en_hyst_v",
        "psrr_db", "noise_vrms",
    ]
    buf = _io.StringIO()
    header = ["serial_number", "part_number", "silicon_rev", "board_id"]
    for col in _FP_COLS:
        header.append(f"mean_{col}")
    for col in _FP_COLS:
        header.append(f"sigma_{col}")
    writer = csv.DictWriter(buf, fieldnames=header, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return Response(
        content=buf.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fingerprints.csv"'},
    )


@app.get("/api/duts/{did}/runs")
async def get_dut_runs(did: int):
    dut = phase4_db.get_dut(did)
    if not dut:
        raise HTTPException(404, "DUT not found")
    runs    = phase4_db.get_fingerprint_runs(did)
    summary = phase4_db.get_fingerprint_summary(did)
    return {"dut": dut, "runs": runs, "summary": summary}


@app.post("/api/duts/{did}/runs/{run_number}")
async def upsert_run(did: int, run_number: int, body: FingerprintRunPayload):
    if not phase4_db.get_dut(did):
        raise HTTPException(404, "DUT not found")
    if not 1 <= run_number <= 5:
        raise HTTPException(400, "run_number must be 1-5")
    phase4_db.upsert_fingerprint_run(did, run_number, body.model_dump())
    return {"ok": True}


# ---------------------------------------------------------------------------
# Simulation routes
# ---------------------------------------------------------------------------

@app.post("/api/sim/parse")
async def parse_sim_file(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8", errors="replace")
    lines   = content.splitlines()
    if not lines:
        raise HTTPException(400, "Empty file")

    # Detect delimiter
    first = lines[0]
    delim = "\t" if first.count("\t") >= first.count(",") else ","

    # Parse header
    headers = [h.strip() for h in first.split(delim)]

    rows: list[list] = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(delim)
        try:
            vals = [float(p.strip()) for p in parts]
            rows.append(vals)
        except ValueError:
            continue

    return {"filename": file.filename, "headers": headers, "rows": rows}


@app.post("/api/sim/results", status_code=201)
async def save_sim_result(body: SimSavePayload):
    sid = phase4_db.save_sim_result(
        dut_id=body.dut_id,
        filename=body.filename,
        x_col=body.x_col,
        y_col=body.y_col,
        bias_cliff_v=body.bias_cliff_v,
        notes=body.notes,
        raw_data_json=body.raw_data,
    )
    return {"id": sid}


@app.get("/api/sim/results")
async def list_sim_results():
    return phase4_db.list_sim_results()


@app.get("/api/sim/results/{sid}")
async def get_sim_result(sid: int):
    result = phase4_db.get_sim_result(sid)
    if not result:
        raise HTTPException(404, "Sim result not found")
    return result


@app.delete("/api/sim/results/{sid}")
async def delete_sim_result(sid: int):
    phase4_db.delete_sim_result(sid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    def open_browser():
        webbrowser.open(f"http://localhost:{PORT}")

    Timer(1.5, open_browser).start()
    logger.info(f"RAD Research Tool -> http://localhost:{PORT}")
    uvicorn.run("phase3_app:app", host="0.0.0.0", port=PORT, reload=False)
