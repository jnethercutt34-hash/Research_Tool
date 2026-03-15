# Phase 3: Workspace UI & RAG Querying

## Goal
Build a local web interface where the user can ask natural language questions about their radiation data, retrieve the exact PDF sources, and get an AI-synthesized answer. The app must be easily launchable via a script.

## Tech Stack Requirements
* **Backend API:** FastAPI (Python)
* **Frontend:** HTML/CSS/JS (Vanilla or React/Vite - whichever produces the cleanest local build)
* **LLM:** Gemini 2.5 Flash (via API)

## UI/UX Design Specifications
* **Theme:** Strict Dark Mode. Do not use bright white backgrounds. Use deep charcoal (`#121212` or `#1E1E1E`) for main backgrounds and slightly lighter dark grays for surface containers.
* **Color Palette (ASU Theme):** * Primary Accent (Headers, primary borders): ASU Maroon (`#8C1D40`)
  * Secondary Accent (Buttons, highlights, active links): ASU Gold (`#FFC627`)
  * Text: Off-white/light gray (`#E0E0E0`) for high readability without eye strain.

## Core Features to Implement
1. **Search Dashboard:** A search bar for natural language queries centered in the dark UI.
2. **The RAG Pipeline:** * Take the user's query and embed it using `text-embedding-004`.
   * Search ChromaDB for the top 5 most relevant text chunks.
   * Send the query PLUS the 5 retrieved chunks to Gemini 2.5 Flash.
   * Prompt: "Answer the user's question using ONLY the provided text chunks. Cite the filename and page number."
3. **Results View:** Display the AI answer at the top, followed by source text snippets and links to the original PDFs below it. Use the ASU Gold to highlight the specific search terms within the snippets.
4. **Note-Taking:** A side-panel for Markdown notes, linked to specific search results.
5. **Startup Script:** Write a `start.bat` (Windows) and `start.sh` (Mac/Linux) script that automatically activates the Python environment, launches the FastAPI backend, and opens the user's default web browser to `http://localhost:8000`.