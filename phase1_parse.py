"""
Phase 1 — PDF Ingestion & Chunking
===================================
Scans data/pdfs/ for PDF files, extracts text (with OCR fallback for
scanned pages), chunks the text semantically, and writes output/chunks.json.

Usage:
    python phase1_parse.py

Requirements:
    pip install -r requirements.txt
    Tesseract OCR must be installed separately for the OCR fallback:
      Windows: https://github.com/UB-Mannheim/tesseract/wiki
      macOS:   brew install tesseract
      Linux:   apt-get install tesseract-ocr
"""

import json
import re
import shutil
import sys
import warnings
from pathlib import Path

import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PDF_DIR = Path("data/pdfs")
OUTPUT_DIR = Path("output")
OUTPUT_FILE = OUTPUT_DIR / "chunks.json"

CHUNK_SIZE = 4000       # characters (~600–800 words)
CHUNK_OVERLAP = 600     # characters (~100 words)
SEPARATORS = ["\n\n", "\n", ". ", " ", ""]

OCR_THRESHOLD = 50      # chars: pages with fewer chars trigger OCR fallback


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ensure_dirs() -> None:
    """Create required directories if they don't exist."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def check_tesseract() -> bool:
    """Return True if tesseract binary is on PATH, warn otherwise."""
    if shutil.which("tesseract") is None:
        warnings.warn(
            "\n[WARNING] Tesseract OCR binary not found on PATH.\n"
            "  OCR fallback will be skipped for scanned pages.\n"
            "  Install Tesseract to enable full OCR support:\n"
            "    Windows: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "    macOS:   brew install tesseract\n"
            "    Linux:   apt-get install tesseract-ocr",
            stacklevel=2,
        )
        return False
    return True


def make_chunk_id(stem: str, page_num: int, chunk_idx: int) -> str:
    """
    Build a deterministic chunk ID from the filename stem, page number, and
    chunk index.  Spaces and special characters in the stem are replaced with
    underscores so the ID is safe for downstream use as a dict key or DB id.

    Example: "Annual Report 2023", page 1, chunk 0 → "annual_report_2023_p1_c0"
    """
    safe_stem = re.sub(r"[^a-zA-Z0-9]+", "_", stem).strip("_").lower()
    return f"{safe_stem}_p{page_num}_c{chunk_idx}"


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_page_text_ocr(pdf_path: Path, page_index: int) -> str:
    """
    Render a single PDF page to an image and run Tesseract OCR on it.
    Returns an empty string if pdf2image or pytesseract are unavailable.
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        return ""

    try:
        images = convert_from_path(
            str(pdf_path),
            first_page=page_index + 1,
            last_page=page_index + 1,
            dpi=300,
        )
        if not images:
            return ""
        return pytesseract.image_to_string(images[0])
    except Exception as exc:
        print(f"    [OCR error] page {page_index + 1}: {exc}")
        return ""


def extract_text_from_pdf(pdf_path: Path, tesseract_available: bool) -> list[dict]:
    """
    Extract text from every page of a PDF file.

    Returns a list of dicts:
        {"page_number": int, "text": str}

    Pages that error are skipped with a warning.
    """
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total = len(pdf.pages)
            for idx, page in enumerate(pdf.pages):
                page_num = idx + 1
                try:
                    text = page.extract_text() or ""
                except Exception as exc:
                    print(f"    [pdfplumber error] page {page_num}: {exc}")
                    text = ""

                # OCR fallback for scanned / image-only pages
                if len(text.strip()) < OCR_THRESHOLD:
                    if tesseract_available:
                        print(
                            f"    [OCR fallback] page {page_num} "
                            f"({len(text.strip())} chars from pdfplumber)"
                        )
                        text = extract_page_text_ocr(pdf_path, idx)
                    else:
                        print(
                            f"    [skip OCR] page {page_num} — "
                            "Tesseract not available"
                        )

                if text.strip():
                    pages.append({"page_number": page_num, "text": text})

    except Exception as exc:
        print(f"  [ERROR] Could not open {pdf_path.name}: {exc}")

    return pages


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_pages(
    pages: list[dict],
    filename: str,
    stem: str,
    splitter: RecursiveCharacterTextSplitter,
) -> list[dict]:
    """
    Split each page's text into overlapping chunks and return a flat list of
    chunk records matching the output schema.
    """
    records = []
    for page in pages:
        page_num = page["page_number"]
        chunks = splitter.split_text(page["text"])
        for chunk_idx, chunk_text in enumerate(chunks):
            records.append(
                {
                    "chunk_id": make_chunk_id(stem, page_num, chunk_idx),
                    "filename": filename,
                    "page_number": page_num,
                    "text_content": chunk_text,
                }
            )
    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Phase 1 — PDF Ingestion & Chunking")
    print("=" * 60)

    ensure_dirs()
    tesseract_available = check_tesseract()

    pdf_files = sorted(PDF_DIR.rglob("*.pdf"))
    if not pdf_files:
        print(
            f"\n[INFO] No PDF files found in '{PDF_DIR}'.\n"
            "  Drop your PDF files into that folder and re-run this script."
        )
        sys.exit(0)

    print(f"\nFound {len(pdf_files)} PDF file(s):\n")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=SEPARATORS,
    )

    # Load existing chunks so we can skip already-processed PDFs
    if OUTPUT_FILE.exists():
        existing_chunks: list[dict] = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        already_parsed: set[str] = {c["filename"] for c in existing_chunks}
        print(f"\nResuming — {len(already_parsed)} file(s) already in chunks.json, skipping them.")
    else:
        existing_chunks = []
        already_parsed  = set()

    new_chunks: list[dict] = []
    skipped = 0

    for pdf_path in pdf_files:
        if pdf_path.name in already_parsed:
            skipped += 1
            continue

        print(f"  Processing: {pdf_path.name}")
        pages = extract_text_from_pdf(pdf_path, tesseract_available)

        if not pages:
            print(f"    [WARN] No text extracted from {pdf_path.name} — skipping.")
            continue

        chunks = chunk_pages(
            pages,
            filename=pdf_path.name,
            stem=pdf_path.stem,
            splitter=splitter,
        )
        print(f"    -> {len(pages)} page(s), {len(chunks)} chunk(s)")
        new_chunks.extend(chunks)

    all_chunks = existing_chunks + new_chunks
    print(f"\nNew chunks: {len(new_chunks)}  (skipped {skipped} already-parsed file(s))")
    print(f"Total chunks in output: {len(all_chunks)}")

    OUTPUT_FILE.write_text(
        json.dumps(all_chunks, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Output saved to: {OUTPUT_FILE}")
    print("\nDone.")


if __name__ == "__main__":
    main()
