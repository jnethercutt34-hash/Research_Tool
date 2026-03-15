# Phase 4: Test Bed Organization & AI Parameter Planning

## Goal
Add a module to track physical hardware components and use the Gemini API to draft testing procedures based on the historical RAG data.

## Tech Stack Requirements
* **Database:** SQLite (for relational hardware tracking)
* **LLM:** Gemini 2.5 Flash

## Core Features to Implement
1. **Inventory Schema:** Create an SQLite database to track physical test bed equipment (id, part_name, serial_number, calibration_date, specs).
2. **Test Run Creator:** A UI section to group hardware together into a "Test Run."
3. **AI Parameter Generator:** A button that pulls the stored specifications for a selected hardware component, queries ChromaDB for its historical radiation performance, and asks Gemini to generate a proposed testing parameter checklist (e.g., suggested dose rates, duration, expected failure points).
4. **Export:** Allow the generated test plan to be exported as a PDF or Markdown file for use at the physical test bench.