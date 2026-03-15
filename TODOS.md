# TODOS — TID Prognostics Platform

Generated from CEO Plan Review (2026-03-15) and Eng Plan Review (2026-03-15).

---

## P1: Add backend pytest test suite
- **What:** Create `tests/test_db.py` (fingerprint CRUD, Rule-of-5 statistics, CSV export, DUT lifecycle) and `tests/test_api.py` (critical endpoint smoke tests). Add `pytest` to `requirements.txt`.
- **Why:** Research data integrity. One bad schema migration could corrupt fingerprint data that took hours to collect.
- **Effort:** M (3-4 hours)
- **When:** Phase 1 foundation
- **Depends on:** Git initialized ✅

---

## P1: Add tests/test_wiki_links.py and tests/test_ml_correlation.py
- **What:** Two focused test files: (1) Wiki link extraction covering 8+ edge cases (basic, multiple, nested brackets, empty, code blocks, non-existent pages, circular, rename). (2) ML correlation with synthetic datasets (perfect correlation, uncorrelated, edge cases like σ=0 and <2 data points).
- **Why:** Highest-risk new codepaths — wiki link bugs silently corrupt backlinks, correlation bugs produce wrong research conclusions about the Bias Cliff hypothesis.
- **Effort:** S-M (~1.5 hours combined)
- **When:** Phase 3 (when Wiki and ML features are implemented)
- **Depends on:** Wiki and ML feature implementation

---

## P1: Add SSE protocol specification to plan
- **What:** Append "Chat SSE Protocol" subsection to PLAN.md specifying: POST body `{"content": "...", "provider": "claude"|"gemini"}`, SSE event format `data: {"token": "..."}` per chunk + `data: {"done": true, "message_id": N}` on completion, cancellation via AbortController/asyncio.CancelledError, partial response persistence.
- **Why:** Without this, the implementer makes 4+ ad-hoc protocol decisions during Chat implementation.
- **Effort:** XS (10 min)
- **When:** Before Phase 3 Chat implementation
- **Depends on:** Nothing

---

## P1: Add wiki link extraction specification to plan
- **What:** Append "Wiki Link Protocol" subsection to PLAN.md specifying: extract-on-save, regex pattern `\[\[([^\]]+)\]\]`, slug resolution, transactional wiki_links update, dead links render as "create page" links, page rename propagates to all sources, skip `[[link]]` inside code blocks.
- **Why:** Link extraction touches 3 tables in a single transaction. Without a spec, edge cases will be handled inconsistently.
- **Effort:** XS (10 min)
- **When:** Before Phase 3 Wiki implementation
- **Depends on:** Nothing

---

## P2: Create routes/ directory for new API routers
- **What:** Create `routes/__init__.py`, `routes/chat.py`, `routes/wiki.py`, `routes/ml.py` with FastAPI APIRouter stubs. Add `app.include_router()` calls in `phase3_app.py`.
- **Why:** Prevents phase3_app.py from growing to 1,400+ lines with Chat, Wiki, ML, and Dashboard routes.
- **Effort:** XS (20 min boilerplate)
- **When:** Phase 3 setup (before implementing new features)
- **Depends on:** Nothing

---

## P2: Deduplicate `_FP_COLS` constant
- **What:** Remove the duplicated `_FP_COLS` list in `phase3_app.py:735` — import from `phase4_db.py` instead. When the React frontend is built, expose via an API endpoint or shared config so the frontend also uses a single source of truth.
- **Why:** DRY violation. If a fingerprint metric is added/renamed, forgetting to update one copy causes silent CSV export corruption.
- **Effort:** XS (10 min)
- **When:** Phase 2 (porting existing features)
- **Depends on:** Nothing

---

## P2: Add bearer token authentication
- **What:** Add `API_TOKEN` to `.env`. Create FastAPI `Depends` middleware checking `Authorization: Bearer <token>`. Exempt static file serving.
- **Why:** Every endpoint is open. Low risk on localhost, but becomes critical if accessed from lab equipment or if this moves toward GD production use.
- **Effort:** S (30 min)
- **When:** Phase 1 or Phase 3 (when adding new endpoints)
- **Depends on:** Nothing
