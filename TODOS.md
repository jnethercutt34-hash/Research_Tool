# TODOS — TID Prognostics Platform

Generated from CEO Plan Review (2026-03-15).

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

---

## P1: Add backend pytest test suite
- **What:** Create `tests/test_db.py` (fingerprint CRUD, Rule-of-5 statistics, CSV export, DUT lifecycle) and `tests/test_api.py` (critical endpoint smoke tests). Add `pytest` to `requirements.txt`.
- **Why:** Research data integrity. One bad schema migration could corrupt fingerprint data that took hours to collect.
- **Effort:** M (3-4 hours)
- **When:** Phase 1 foundation, after git init
- **Depends on:** Git initialized ✅
