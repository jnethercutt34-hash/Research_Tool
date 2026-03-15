"""
ML Workbench routes — results storage, correlation analysis, dataset export.

Endpoints:
    GET  /api/ml/results      — list saved ML results
    POST /api/ml/results      — save ML result
    DELETE /api/ml/results/{id} — delete ML result
    GET  /api/ml/correlation   — compute correlation matrix from fingerprint data
    GET  /api/ml/dataset       — get formatted ML dataset (JSON)

Dashboard:
    GET  /api/dashboard/stats  — aggregated counts for homepage
"""

import json
import math
import logging
import statistics
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import phase4_db

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/ml", tags=["ml"])
dash_router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class MlResultCreate(BaseModel):
    name: str
    model_type: str = ""           # e.g., "random_forest", "xgboost", "neural_net"
    parameters: dict = {}
    metrics: dict = {}             # e.g., {"accuracy": 0.94, "r2": 0.87}
    feature_importance: dict = {}  # e.g., {"Iq": 0.32, "Vdo": 0.18, ...}
    notes: str = ""


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    return phase4_db.get_conn()


# ---------------------------------------------------------------------------
# ML Results CRUD
# ---------------------------------------------------------------------------

@router.get("/results")
async def list_results():
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ml_results ORDER BY created_at DESC"
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            # Parse JSON fields
            for field in ('parameters', 'metrics', 'feature_importance'):
                if d.get(field):
                    try:
                        d[field] = json.loads(d[field])
                    except (json.JSONDecodeError, TypeError):
                        pass
            results.append(d)
        return results


@router.post("/results", status_code=201)
async def save_result(body: MlResultCreate):
    with _get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO ml_results (name, model_type, parameters, metrics, feature_importance, notes) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                body.name,
                body.model_type,
                json.dumps(body.parameters),
                json.dumps(body.metrics),
                json.dumps(body.feature_importance),
                body.notes,
            )
        )
        return {"id": cur.lastrowid, "name": body.name}


@router.delete("/results/{result_id}")
async def delete_result(result_id: int):
    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM ml_results WHERE id = ?", (result_id,)).fetchone()
        if not row:
            raise HTTPException(404, "ML result not found")
        conn.execute("DELETE FROM ml_results WHERE id = ?", (result_id,))
        return {"ok": True}


# ---------------------------------------------------------------------------
# Correlation matrix from fingerprint data
# ---------------------------------------------------------------------------

def _pearson(x: list, y: list) -> Optional[float]:
    """Pearson correlation between two equal-length numeric lists."""
    pairs = [(a, b) for a, b in zip(x, y) if a is not None and b is not None]
    if len(pairs) < 3:
        return None
    xs, ys = zip(*pairs)
    n = len(xs)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = math.sqrt(sum((xi - mx) ** 2 for xi in xs) / (n - 1)) if n > 1 else 0
    sy = math.sqrt(sum((yi - my) ** 2 for yi in ys) / (n - 1)) if n > 1 else 0
    if sx == 0 or sy == 0:
        return None
    cov = sum((xi - mx) * (yi - my) for xi, yi in zip(xs, ys)) / (n - 1)
    return round(cov / (sx * sy), 4)


@router.get("/correlation")
async def correlation_matrix():
    """Compute correlation matrix across all DUT fingerprint averages."""
    fp_cols = list(phase4_db._FP_COLS)
    
    with _get_conn() as conn:
        duts = conn.execute("SELECT id FROM duts").fetchall()
        if not duts:
            return {"columns": fp_cols, "matrix": [], "n_duts": 0}

        # Gather average fingerprint per DUT
        dut_avgs = {}  # dut_id -> {col: avg_value}
        for dut in duts:
            runs = conn.execute(
                "SELECT * FROM fingerprint_runs WHERE dut_id = ? ORDER BY run_number",
                (dut["id"],)
            ).fetchall()
            if not runs:
                continue
            avgs = {}
            for col in fp_cols:
                vals = [r[col] for r in runs if r[col] is not None]
                avgs[col] = statistics.mean(vals) if vals else None
            dut_avgs[dut["id"]] = avgs

    if not dut_avgs:
        return {"columns": fp_cols, "matrix": [], "n_duts": 0}

    # Build column vectors
    vectors = {}
    for col in fp_cols:
        vectors[col] = [dut_avgs[did].get(col) for did in dut_avgs]

    # Compute correlation matrix
    matrix = []
    for col_a in fp_cols:
        row = []
        for col_b in fp_cols:
            row.append(_pearson(vectors[col_a], vectors[col_b]))
        matrix.append(row)

    return {
        "columns": fp_cols,
        "matrix": matrix,
        "n_duts": len(dut_avgs),
    }


# ---------------------------------------------------------------------------
# ML Dataset export
# ---------------------------------------------------------------------------

@router.get("/dataset")
async def get_dataset():
    """Export fingerprint data as structured JSON for ML pipelines."""
    fp_cols = list(phase4_db._FP_COLS)

    with _get_conn() as conn:
        duts = conn.execute("SELECT * FROM duts ORDER BY part_number, id").fetchall()
        records = []
        for dut in duts:
            runs = conn.execute(
                "SELECT * FROM fingerprint_runs WHERE dut_id = ? ORDER BY run_number",
                (dut["id"],)
            ).fetchall()
            if not runs:
                continue
            # Average fingerprint
            avgs = {}
            for col in fp_cols:
                vals = [r[col] for r in runs if r[col] is not None]
                avgs[col] = round(statistics.mean(vals), 6) if vals else None

            records.append({
                "dut_id": dut["id"],
                "part_number": dut["part_number"],
                "manufacturer": dut.get("manufacturer", ""),
                "group": dut.get("group_name", ""),
                "lot_code": dut.get("lot_code", ""),
                "n_runs": len(runs),
                "fingerprint": avgs,
            })

    return {
        "columns": fp_cols,
        "n_records": len(records),
        "records": records,
    }


# ---------------------------------------------------------------------------
# Dashboard stats (mounted separately)
# ---------------------------------------------------------------------------

@dash_router.get("/stats")
async def dashboard_stats():
    """Aggregate counts for the homepage dashboard."""
    with _get_conn() as conn:
        stats = {}

        # DUT count
        r = conn.execute("SELECT COUNT(*) as n FROM duts").fetchone()
        stats["dut_count"] = r["n"] if r else 0

        # Fingerprint run count
        r = conn.execute("SELECT COUNT(*) as n FROM fingerprint_runs").fetchone()
        stats["run_count"] = r["n"] if r else 0

        # Test run count
        r = conn.execute("SELECT COUNT(*) as n FROM test_runs").fetchone()
        stats["test_run_count"] = r["n"] if r else 0

        # Component count
        r = conn.execute("SELECT COUNT(*) as n FROM components").fetchone()
        stats["component_count"] = r["n"] if r else 0

        # Wiki page count
        try:
            r = conn.execute("SELECT COUNT(*) as n FROM wiki_pages").fetchone()
            stats["wiki_page_count"] = r["n"] if r else 0
        except Exception:
            stats["wiki_page_count"] = 0

        # Chat conversation count
        try:
            r = conn.execute("SELECT COUNT(*) as n FROM chat_conversations").fetchone()
            stats["conversation_count"] = r["n"] if r else 0
        except Exception:
            stats["conversation_count"] = 0

        # ML result count
        try:
            r = conn.execute("SELECT COUNT(*) as n FROM ml_results").fetchone()
            stats["ml_result_count"] = r["n"] if r else 0
        except Exception:
            stats["ml_result_count"] = 0

        # DUTs by group
        try:
            groups = conn.execute(
                "SELECT group_name, COUNT(*) as n FROM duts WHERE group_name IS NOT NULL GROUP BY group_name"
            ).fetchall()
            stats["groups"] = {g["group_name"]: g["n"] for g in groups}
        except Exception:
            stats["groups"] = {}

        return stats
