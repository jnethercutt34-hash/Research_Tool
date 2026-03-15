# TID Prognostics Platform — Complete Rebuild Plan

## 1. Vision & Purpose

**Project:** Machine Learning Prognostics for COTS Power Management in Space  
**Goal:** Build a comprehensive research platform that helps the user earn a PhD by predicting COTS LDO radiation performance using non-destructive electrical screening and machine learning.

This tool is the central command center for a PhD research program targeting 3 first-author publications (NSREC 2027, IEEE TNS 2028, RADECS/IRPS 2028-29) and a dissertation. It must support the full research lifecycle: literature review, test planning, data collection, simulation, ML analysis, and writing.

**Long-term vision:** Beyond the PhD, this becomes a production tool for space engineers doing radiation hardness assurance on COTS parts at General Dynamics.

---

## 2. Current State

### What Exists Today
- **Backend:** Python FastAPI app (`phase3_app.py`) with SQLite database (`phase4_db.py`)
- **Frontend:** Single monolithic `static/index.html` (3,011 lines) — dark-themed but unmaintainable
- **PDF Pipeline:** `phase1_parse.py` → `phase2_vectorize.py` → LanceDB vector store for RAG queries
- **Database schema** already tracks: components, test runs, DUTs, fingerprint runs (15-point), simulation results, and a repo index
- **API endpoints** already exist for: RAG query, notes, components CRUD, test runs, DUT management, fingerprint data, simulation file parsing, and repo indexing

### Existing Data Assets
The `data/pdfs/` directory contains **1,267 NASA radiation test report PDFs** already organized by component/test type:

```
data/pdfs/pdfs/
├── NASA Reports/
│   ├── ADC/              (64 PDFs)  — AD676, AD9257, LTC1604, etc.
│   ├── DAC/              (27 PDFs)
│   ├── Diode/            (19 PDFs)
│   ├── Driver/           (1 PDF)
│   ├── FPGA/             (48 PDFs)  — SEU testing, Xilinx, Microsemi
│   ├── Image Only/       (330 PDFs) — Scanned reports (need OCR)
│   ├── Inverter/         (2 PDFs)
│   ├── Logic/            (4 PDFs)
│   ├── Memory/           (112 PDFs) — SRAM, Flash, MRAM
│   ├── MOSFET/           (74 PDFs)  — FET radiation characterization
│   ├── Op Amp/           (88 PDFs)  — Analog device radiation data
│   ├── Optocoupler/      (4 PDFs)
│   ├── Processor/        (13 PDFs)
│   ├── Proton Report/    (14 PDFs)
│   ├── Regulator/        (52 PDFs)  — **Directly relevant to LDO research**
│   ├── SEE Report/       (114 PDFs) — Single Event Effects
│   ├── SEL Folder/       (15 PDFs)  — Single Event Latchup
│   ├── Sensor/           (7 PDFs)
│   ├── SET Testing/      (31 PDFs)  — Single Event Transient
│   ├── Switch/           (37 PDFs)
│   ├── TID Report/       (99 PDFs)  — **Directly relevant to TID research**
│   ├── Transceiver/      (10 PDFs)
│   └── Compendium/       (31 PDFs)  — Multi-part summary reports
├── Extracted_Tables_Source/
├── raw data/
└── page-N-* folders (scraped pages)
```

These PDFs include real NASA GSFC and JPL test reports with part numbers, dose levels, failure modes, and parametric data — exactly the kind of historical baselines needed for the research. The **Regulator** (52) and **TID Report** (99) folders are most directly relevant to the LDO/TID focus of the PhD. The existing `phase2_vectorize.py` pipeline has already chunked and embedded these into a LanceDB vector store for semantic search.

---

## 3. Architecture — Complete Overhaul

### Current Architecture
```
static/index.html (3011 lines)  ──▶  FastAPI (phase3_app.py)  ──▶  SQLite + LanceDB
```

### Target Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite + Tailwind)              │
│  ┌──────────┬────────────┬────────────┬───────────────────────┐ │
│  │ Overview  │  Rad Data  │  Test Bed  │  DUT Tracker          │ │
│  │ Dashboard │  Explorer  │  Manager   │  (15-pt Fingerprint)  │ │
│  ├──────────┼────────────┼────────────┼───────────────────────┤ │
│  │ Sim Lab  │  ML Work-  │  Research  │  Research Wiki        │ │
│  │ (LTSpice)│  bench     │  Chat      │  (Papers/Dissertation)│ │
│  └──────────┴────────────┴────────────┴───────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend (Python)                       │
│  ┌──────────┬────────────┬────────────┬───────────────────────┐ │
│  │ RAG      │  Inventory │  DUT/FP    │  Wiki/Notes           │ │
│  │ Pipeline │  CRUD      │  CRUD      │  CRUD                 │ │
│  ├──────────┼────────────┼────────────┼───────────────────────┤ │
│  │ Sim File │  ML Export │  AI Chat   │  Repo Index           │ │
│  │ Parser   │  & Run     │  Proxy     │  Builder              │ │
│  └──────────┴────────────┴────────────┴───────────────────────┘ │
└───────────┬──────────────┬──────────────┬───────────────────────┘
            │              │              │
     ┌──────▼──────┐ ┌────▼────┐ ┌───────▼──────────┐
     │   SQLite    │ │ LanceDB │ │ External AI APIs  │
     │  (testbed   │ │ (vector │ │ (Claude, Gemini)  │
     │   + wiki)   │ │  store) │ │                   │
     └─────────────┘ └─────────┘ └──────────────────┘
```

### Frontend Stack (matching GMDS Hardware Assistant)
- **React 18** + **React Router** for SPA routing
- **Vite** for build tooling
- **Tailwind CSS** for styling (dark theme matching GMDS aesthetic)
- **shadcn/ui** components (Card, Button, etc.)
- **Lucide React** icons
- **Chart.js** or **Recharts** for data visualization
- **Marked.js** or **react-markdown** for markdown rendering in wiki

### Backend Stack (keep & extend)
- **FastAPI** (Python) — keep existing, add new endpoints
- **SQLite** — extend schema for wiki pages and chat history
- **LanceDB** — keep for RAG vector search
- **Gemini API** — keep for RAG answers + add as chat provider
- **Claude API** (Anthropic SDK) — add as second chat provider

---

## 4. Module Specifications

### Module 1: Overview Dashboard
**Route:** `/`  
**Inspired by:** GMDS Hardware Assistant `Home.jsx`

The landing page that gives an at-a-glance view of research progress.

**Layout:**
- Hero section with project title and tagline
- Research flow pipeline (visual steps: Literature → Test Setup → Data Collection → ML Analysis → Papers)
- Module cards (8 cards in a 2-column grid, each with icon, step number, title, description, and bullet features — exactly like GMDS)
- Quick stats bar: DUT count, fingerprint runs completed, PDFs indexed, wiki pages, papers drafted
- Getting Started section with 4-column tips

**Design:** Dark background, ASU maroon/gold accent colors, card-based layout with hover effects.

---

### Module 2: Radiation Data Explorer
**Route:** `/rad-explorer`

Surfaces the **1,267 existing NASA radiation test report PDFs** in `data/pdfs/` with powerful browsing and search.

**Features:**
- **Repo browser:** Tree view organized by category (TID, SEE, Proton) → test type → part type → individual reports. The folder structure already exists (ADC, DAC, FPGA, Memory, MOSFET, Op Amp, Regulator, etc.)
- **RAG search:** Natural language queries against the vector store (already built). "What TID levels do NMOS regulators fail at?" → returns cited answers from the PDF corpus
- **Filtering:** Filter by test type (TID/SEU/SEL/SEFI/SET/Proton), part type (FPGA/Transistor/ADC/Regulator/etc.), manufacturer
- **Part detail view:** For each indexed PDF — AI-extracted summary, part numbers, test type, manufacturer, link to original PDF viewer
- **Cross-reference panel:** When viewing a historical report, show related reports for the same part family and link to any matching DUTs in the tracker
- **Build/re-index button:** Trigger the background repo indexing job (already implemented)
- **Stats dashboard:** Count by category, pie chart of test types, timeline of report dates

**Existing backend:** Endpoints already exist (`/api/repo/*`, `/api/query`, `/api/pdf/*`). May need minor extensions for cross-referencing.

---

### Module 3: Test Bed Manager
**Route:** `/testbed`

Manages the physical test equipment inventory and test run planning.

**Features:**
- **Equipment inventory:** CRUD for test equipment (Keithley 4200-SCS, Keysight B1505A, GaN FETs, carrier boards, connectors, etc.)
- **Test run builder:** Create named test runs, attach equipment, add notes
- **AI test plan generator:** Uses RAG context to generate radiation test parameters (already implemented)
- **Export:** Download test plans as Markdown or PDF (already implemented)
- **Budget tracker:** Track BOM costs against the ~$3,200 budget from the research plan

**Existing backend:** Fully implemented (`/api/components/*`, `/api/test-runs/*`).

---

### Module 4: DUT Tracker
**Route:** `/duts`

Registry for all 100 DUT units across the 4 test groups, with the 15-Point Fingerprint data collection system.

**Features:**
- **DUT registry:** Add/manage DUTs with part number, serial number, silicon rev, board ID, group assignment (A/B/C/D)
- **Fingerprint data entry:** 5-run data entry grid for each of the 15 metrics per DUT (Rule of 5)
- **Auto-statistics:** Mean and Sigma computed from runs 2-5 (run 1 discarded per protocol)
- **Bulk CSV export:** Export all fingerprint data formatted for XGBoost/ML ingestion (already implemented)
- **Visual indicators:** Color-coded health status per DUT (complete/partial/missing data)
- **Group comparison:** Side-by-side view of Group A (TPS7A53) vs B (LT3071) vs C (TPS7A54) vs D (TPS7B7701)

**Existing backend:** Fully implemented (`/api/duts/*`, fingerprint runs, CSV export).

---

### Module 5: Simulation Lab
**Route:** `/sim-lab`

Import and visualize LTSpice simulation outputs.

**Features:**
- **File import:** Upload `.csv` or `.txt` exports from LTSpice (tab or comma delimited). Parser already exists.
- **Waveform viewer:** Interactive chart (Chart.js/Recharts) with zoom, pan, cursors
- **Column selector:** Pick X and Y axes from parsed headers
- **Annotation:** Add notes, mark Bias Cliff voltage on the waveform
- **DUT linking:** Optionally link a simulation result to a specific DUT
- **Result archive:** Save and browse previous simulation results

**Existing backend:** Endpoints exist (`/api/sim/*`).

---

### Module 6: ML Workbench
**Route:** `/ml`

Prepare data for and visualize machine learning results.

**Features:**
- **Data preview:** View the fingerprint dataset (mean/sigma for all DUTs) in a sortable table
- **Export controls:** Download CSV formatted for XGBoost, Random Forest, etc.
- **Feature importance chart:** Upload or display ML results showing which of the 15 metrics best predicts TID failure
- **Correlation matrix:** Heatmap showing correlations between metrics (especially Bias Cliff vs 1/f Noise — the core hypothesis)
- **Prediction scatter:** Plot predicted vs actual failure dose
- **Model comparison:** Compare XGBoost vs Random Forest performance metrics (R², RMSE)

**Existing backend:** CSV export exists. Will need new endpoints for ML result storage.

---

### Module 7: Research Chat
**Route:** `/chat`

Dual-provider AI chat for deep-diving into LDO topics, radiation physics, circuit elements.

**Features:**
- **Provider selector:** Toggle between Claude (Anthropic API) and Gemini (Google API)
- **Conversation management:** Create, name, and archive conversations
- **Topic suggestions:** Quick-start prompts for common research topics:
  - "Explain NMOS pass element physics in LDOs"
  - "How do charge pumps degrade under TID?"
  - "Error amplifier bandwidth vs radiation dose"
  - "Compare NMOS vs PMOS LDO architectures for radiation"
- **Markdown rendering:** Responses rendered with proper math/code formatting
- **Save to wiki:** One-click save interesting responses to the Research Wiki
- **Context injection:** Optionally include fingerprint data or RAG sources as context

**New backend needed:** Chat proxy endpoints, conversation storage in SQLite.

---

### Module 8: Research Wiki
**Route:** `/wiki`

Wiki-style interconnected knowledge base for building papers and dissertation.

**Features:**
- **Page creation:** Rich Markdown editor with live preview
- **Wiki linking:** `[[Page Name]]` syntax to link between pages, auto-creates backlinks
- **Tagging:** Tag pages by topic (NMOS, Error Amp, Charge Pump, Bias Cliff, PSRR, etc.) and by publication target (Paper 1, Paper 2, Paper 3, Dissertation Ch.1-N)
- **Search:** Full-text search across all wiki pages
- **Backlinks panel:** See all pages that link to the current page
- **Export:** Export tagged pages as a combined Markdown document (e.g., "Export all Paper 1 pages")
- **Templates:** Pre-built page templates for:
  - Literature review entry
  - Experiment observation
  - Meeting notes (advisor meetings)
  - Paper section draft
- **Graph view:** Visual network of how pages connect to each other

**New backend needed:** Wiki pages table, tags table, link extraction, full-text search.

---

## 5. Research Flow Pipeline

The Overview Dashboard will display this pipeline, showing progress through each phase:

```
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ 1. Study │    │ 2. Setup │    │ 3. Collect│    │ 4. Analyze│   │ 5. Publish│
  │Literature│───▶│ Test Bed │───▶│   Data    │───▶│   ML     │───▶│  Papers  │
  │          │    │          │    │          │    │          │    │          │
  │ Rad Data │    │ Test Bed │    │ DUT      │    │ ML Work- │    │ Research │
  │ Explorer │    │ Manager  │    │ Tracker  │    │ bench    │    │ Wiki     │
  │ Res.Chat │    │ Sim Lab  │    │ Sim Lab  │    │ Sim Lab  │    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 6. Database Schema Extensions

### New Tables (added to existing `phase4_db.py`)

```sql
-- Wiki pages
CREATE TABLE wiki_pages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT    NOT NULL UNIQUE,
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Wiki tags
CREATE TABLE wiki_tags (
    page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    tag     TEXT    NOT NULL,
    PRIMARY KEY (page_id, tag)
);
CREATE INDEX idx_wiki_tags_tag ON wiki_tags(tag);

-- Wiki links (for backlinks)
CREATE TABLE wiki_links (
    source_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    PRIMARY KEY (source_id, target_id)
);

-- Chat conversations
CREATE TABLE chat_conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    provider   TEXT    NOT NULL DEFAULT 'gemini',  -- 'gemini' or 'claude'
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Chat messages
CREATE TABLE chat_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL,  -- 'user' or 'assistant'
    content         TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ML results
CREATE TABLE ml_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_type      TEXT    NOT NULL DEFAULT 'xgboost',
    r_squared       REAL,
    rmse            REAL,
    feature_importance TEXT NOT NULL DEFAULT '{}',  -- JSON
    predictions     TEXT    NOT NULL DEFAULT '[]',  -- JSON
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## 7. New API Endpoints

### Chat (`/api/chat/*`)
- `GET /api/chat/conversations` — list conversations
- `POST /api/chat/conversations` — create conversation
- `DELETE /api/chat/conversations/{id}` — delete conversation
- `GET /api/chat/conversations/{id}/messages` — get messages
- `POST /api/chat/conversations/{id}/messages` — send message (proxies to Claude or Gemini)

### Wiki (`/api/wiki/*`)
- `GET /api/wiki/pages` — list all pages (with tag filter)
- `POST /api/wiki/pages` — create page
- `GET /api/wiki/pages/{slug}` — get page content + backlinks
- `PUT /api/wiki/pages/{slug}` — update page
- `DELETE /api/wiki/pages/{slug}` — delete page
- `GET /api/wiki/tags` — list all tags with counts
- `GET /api/wiki/search?q=` — full-text search
- `GET /api/wiki/graph` — page link graph data
- `GET /api/wiki/export?tag=` — export pages by tag as combined markdown

### ML (`/api/ml/*`)
- `GET /api/ml/results` — list saved ML results
- `POST /api/ml/results` — save ML result
- `GET /api/ml/correlation` — compute correlation matrix from fingerprint data
- `GET /api/ml/dataset` — get formatted ML dataset (enhanced CSV export)

### Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` — aggregated counts (DUTs, runs, pages, PDFs, etc.)

---

## 8. Frontend File Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx
│   ├── index.css
│   ├── App.jsx                    (Router + Navbar + Routes)
│   ├── lib/
│   │   ├── api.js                 (fetch wrapper for all API calls)
│   │   └── utils.js               (cn() helper, formatters)
│   ├── components/
│   │   ├── ui/                    (shadcn primitives: card, button, input, etc.)
│   │   ├── Navbar.jsx
│   │   ├── StatsCard.jsx
│   │   ├── FlowPipeline.jsx
│   │   ├── ModuleCard.jsx
│   │   ├── MarkdownRenderer.jsx
│   │   ├── WaveformChart.jsx
│   │   └── WikiEditor.jsx
│   └── pages/
│       ├── Home.jsx               (Overview Dashboard)
│       ├── RadExplorer.jsx        (Radiation Data Explorer)
│       ├── TestBed.jsx            (Test Bed Manager)
│       ├── DutTracker.jsx         (DUT Tracker + Fingerprint)
│       ├── SimLab.jsx             (Simulation Lab)
│       ├── MlWorkbench.jsx        (ML Workbench)
│       ├── Chat.jsx               (Research Chat)
│       └── Wiki.jsx               (Research Wiki)
```

---

## 9. Implementation Phases

### Phase 1: Foundation (React scaffold + Overview)
- Initialize React/Vite/Tailwind project in `frontend/`
- Set up shadcn/ui components
- Build Navbar and routing
- Build Overview Dashboard (Home.jsx) matching GMDS style
- Configure Vite proxy to FastAPI backend
- Verify existing API endpoints work from React

### Phase 2: Port Existing Features
- Radiation Data Explorer (port repo browser + RAG search)
- Test Bed Manager (port inventory + test runs)
- DUT Tracker (port DUT registry + fingerprint entry)
- Simulation Lab (port sim file viewer)

### Phase 3: New Features
- Research Wiki (new backend + frontend)
- Research Chat (new backend + frontend)
- ML Workbench (new backend + frontend)

### Phase 4: Polish
- Overview Dashboard stats integration
- Cross-module linking (e.g., DUT → Sim → Wiki)
- Export workflows
- Mobile responsiveness

---

## 10. Environment & Configuration

### Required API Keys (`.env`)
```
GEMINI_API_KEY=...          # Existing — for RAG + Gemini chat
ANTHROPIC_API_KEY=...       # New — for Claude chat
```

### New Dependencies
**Frontend:**
```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "lucide-react": "latest",
  "recharts": "^2",
  "react-markdown": "^9",
  "class-variance-authority": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest"
}
```

**Backend (additions to requirements.txt):**
```
anthropic          # Claude API
```

---

## 11. Design Language

Matching the GMDS Hardware Assistant:
- **Background:** `#09090b` (near-black)
- **Surface/Cards:** `#1c1c1e` with `border-border` subtle borders
- **Primary accent:** ASU Maroon `#8C1D40` (or configurable)
- **Secondary accent:** ASU Gold `#FFC627`
- **Text:** White/gray hierarchy
- **Cards:** Rounded corners, subtle hover glow, icon + step number + title + description + bullet features
- **Typography:** Inter/system font stack, heading hierarchy
- **Icons:** Lucide React icon set

---

## 12. Plan Amendments (CEO Review — 2026-03-15)

The following amendments were approved during the HOLD SCOPE CEO plan review:

### Architecture
1. **State Management:** Add `@tanstack/react-query` for server state caching. Wrap app in `QueryClientProvider`. Create query hooks in `src/lib/queries.js`.
2. **Chat Streaming:** Use Server-Sent Events (SSE) via FastAPI `StreamingResponse`. Frontend uses `fetch` + `ReadableStream` for token-by-token rendering.
3. **Production Serving:** `npm run build` outputs to `static/dist/`. FastAPI serves the built SPA with a catch-all route. Single-process deployment via `start.bat`.

### Error Handling & Security
4. **Global Exception Handler:** ✅ DONE — `@app.exception_handler(Exception)` returns structured JSON `{"error": str, "detail": str}`. All errors logged.
5. **Bearer Token Auth:** Add `API_TOKEN` to `.env`, FastAPI middleware checks `Authorization: Bearer <token>`. (Tracked in TODOS.md)
6. **Wiki XSS Prevention:** Add `rehype-sanitize` plugin to `react-markdown` for wiki content rendering.

### Data Quality & Performance
7. **Fingerprint Validation:** Add physics-based input bounds for all 15 metrics (e.g., Bias Cliff 0-6V, PSRR 0-100dB). Warn on out-of-range, block on impossible values.
8. **N+1 Query Fix:** ✅ DONE — `list_duts()`, `list_test_runs()`, `get_all_dut_fingerprints()` rewritten with JOINs. 600 queries → 2 queries.
9. **Wiki Full-Text Search:** Use SQLite FTS5 virtual table with sync triggers instead of LIKE queries.

### Infrastructure
10. **Git Repository:** ✅ DONE — `git init` with `.gitignore`. Initial commit preserves pre-rewrite baseline.
11. **Logging:** ✅ DONE — Python `logging` module with `RotatingFileHandler` to `output/app.log`. All `print()` calls replaced.
12. **Backend Tests:** Add `pytest` test suite for data layer (fingerprint CRUD, statistics, CSV export). (Tracked in TODOS.md)

### Scope Changes
13. **Wiki Graph View:** Deferred to Phase 4 Polish. Backlinks panel covers navigation needs.

### Updated Frontend Dependencies
```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "lucide-react": "latest",
  "recharts": "^2",
  "react-markdown": "^9",
  "rehype-sanitize": "^6",
  "@tanstack/react-query": "^5",
  "class-variance-authority": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest"
}
```

---

## 13. Implementation Specifications (Eng Review — 2026-03-15)

### 13.1 Chat SSE Protocol

**Request:**
```
POST /api/chat/conversations/{id}/messages
Content-Type: application/json
Authorization: Bearer <token>

{"content": "Explain NMOS pass element physics", "provider": "claude"|"gemini"}
```

**Response:** `text/event-stream`
```
data: {"token": "The"}
data: {"token": " NMOS"}
data: {"token": " pass"}
...
data: {"done": true, "message_id": 42}
```

**Error event:**
```
data: {"error": "Rate limit exceeded", "code": 429}
```

**Persistence:** Full response saved to `chat_messages` after stream completes. If stream is interrupted (client disconnect), save partial response with `[interrupted]` suffix.

**Cancellation:** Frontend uses `AbortController.abort()`. Backend catches `asyncio.CancelledError`, saves partial response, closes stream cleanly.

**Provider routing:**
- `"gemini"` → `google.genai` streaming via `generate_content(stream=True)`
- `"claude"` → `anthropic.messages.stream()` with async iteration
- If provider API key is missing → immediate `data: {"error": "...", "code": 503}` event

---

### 13.2 Wiki Link Protocol

**Syntax:** `[[Page Name]]` anywhere in Markdown content.

**Extraction regex:** `\[\[([^\]]+)\]\]` (non-greedy, no nested brackets)

**Slug resolution:** `Page Name` → `page-name` (lowercase, spaces → hyphens, strip non-alphanumeric except hyphens)

**On page save (single transaction):**
1. Parse content for `[[...]]` patterns
2. Skip any `[[...]]` inside fenced code blocks (between ``` markers)
3. Resolve each link text to a target slug
4. `DELETE FROM wiki_links WHERE source_id = ?`
5. For each resolved target slug:
   - Look up `wiki_pages.id` by slug
   - If exists: `INSERT INTO wiki_links (source_id, target_id)`
   - If not exists: skip (dead link — rendered as "create page" link in frontend)
6. Update FTS5 index via trigger (automatic)

**Dead links:** Frontend renders `[[Nonexistent Page]]` as a clickable link that navigates to `/wiki/create?title=Nonexistent+Page`.

**Page rename:**
1. Update `wiki_pages.slug` and `wiki_pages.title`
2. Find all pages linking to old slug: `SELECT source_id FROM wiki_links WHERE target_id = ?`
3. In each source page content: replace `[[Old Name]]` with `[[New Name]]`
4. Re-run link extraction on each modified source page

---

### 13.3 Vite Proxy Configuration

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
    }
  }
})
```

### 13.4 SPA Catch-All Route

```python
# In phase3_app.py — MUST be registered LAST (after all /api/* routes)
@app.get("/{path:path}")
async def spa_catchall(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, f"API route not found: /{path}")
    dist = Path("static/dist/index.html")
    if dist.exists():
        return FileResponse(str(dist))
    # Fallback to old index.html during development
    return FileResponse("static/index.html")
```
