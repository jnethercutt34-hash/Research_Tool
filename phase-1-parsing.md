# Phase 1: Local PDF Ingestion & Chunking

## Goal
Create a local Python backend that scans a directory of historical radiation data PDFs, extracts the text, and breaks it down into small, digestible chunks so it doesn't overwhelm the API context window later.

## Tech Stack Requirements
* **Backend:** Python
* **PDF Extraction:** `PyMuPDF` (fitz) or `pdfplumber` 
* **OCR Fallback:** `pytesseract` (for scanned image PDFs)
* **Chunking:** LangChain's `RecursiveCharacterTextSplitter` (or a custom Python chunker)

## Core Features to Implement
1. **Directory Scanner:** Recursively scan the local `/data/pdfs/` folder.
2. **Text Extraction Engine:** Attempt digital text extraction first; fall back to Tesseract OCR if the page is a scanned image.
3. **Semantic Chunking:** Break the extracted text into chunks of roughly 500-1000 words. Ensure chunks have some overlap (e.g., 100 words) so context isn't lost if a sentence about a component's degradation is split in half.
4. **Data Structuring:** Save the output as a local JSON file containing: `chunk_id`, `filename`, `page_number`, and `text_content`.