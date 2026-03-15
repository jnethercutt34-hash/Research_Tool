"""
Phase 4 — SQLite helpers for test-bed inventory & test runs.
Imported by phase3_app.py; can also be run standalone to initialise the DB.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path("output/testbed.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS components (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    part_name        TEXT    NOT NULL,
    manufacturer     TEXT    NOT NULL DEFAULT '',
    part_number      TEXT    NOT NULL DEFAULT '',
    serial_number    TEXT    NOT NULL DEFAULT '',
    calibration_date TEXT    NOT NULL DEFAULT '',
    specs            TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS test_runs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    notes      TEXT    NOT NULL DEFAULT '',
    ai_plan    TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS test_run_components (
    test_run_id  INTEGER NOT NULL REFERENCES test_runs(id)  ON DELETE CASCADE,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    PRIMARY KEY (test_run_id, component_id)
);

CREATE TABLE IF NOT EXISTS repo_index (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    filename     TEXT    NOT NULL UNIQUE,
    category     TEXT    NOT NULL DEFAULT '',
    test_type    TEXT    NOT NULL DEFAULT '',
    part_type    TEXT    NOT NULL DEFAULT '',
    part_numbers TEXT    NOT NULL DEFAULT '',
    manufacturer TEXT    NOT NULL DEFAULT '',
    summary      TEXT    NOT NULL DEFAULT '',
    indexed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_repo_category  ON repo_index(category);
CREATE INDEX IF NOT EXISTS idx_repo_test_type ON repo_index(test_type);
CREATE INDEX IF NOT EXISTS idx_repo_part_type ON repo_index(part_type);

CREATE TABLE IF NOT EXISTS duts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number   TEXT NOT NULL DEFAULT 'TPS7A53-Q1',
    serial_number TEXT NOT NULL DEFAULT '',
    silicon_rev   TEXT NOT NULL DEFAULT '',
    board_id      TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fingerprint_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    dut_id         INTEGER NOT NULL REFERENCES duts(id) ON DELETE CASCADE,
    run_number     INTEGER NOT NULL CHECK(run_number BETWEEN 1 AND 5),
    bias_cliff_v   REAL,
    rise_time_ms   REAL,
    gnd_curr_slope REAL,
    overshoot_v    REAL,
    thermal_drift  REAL,
    vout_accuracy  REAL,
    dropout_v      REAL,
    line_reg       REAL,
    load_reg       REAL,
    gnd_curr_nom   REAL,
    shutdown_leak  REAL,
    en_thresh_v    REAL,
    en_hyst_v      REAL,
    psrr_db        REAL,
    noise_vrms     REAL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dut_id, run_number)
);

CREATE TABLE IF NOT EXISTS sim_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    dut_id       INTEGER REFERENCES duts(id) ON DELETE SET NULL,
    filename     TEXT NOT NULL DEFAULT '',
    x_col        TEXT NOT NULL DEFAULT '',
    y_col        TEXT NOT NULL DEFAULT '',
    bias_cliff_v REAL,
    notes        TEXT NOT NULL DEFAULT '',
    raw_data     TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(_SCHEMA)


# ---------------------------------------------------------------------------
# Component CRUD
# ---------------------------------------------------------------------------

def list_components() -> list[dict]:
    with get_conn() as conn:
        return [dict(r) for r in
                conn.execute("SELECT * FROM components ORDER BY part_name")]


def get_component(cid: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM components WHERE id=?", (cid,)).fetchone()
        return dict(row) if row else None


def add_component(part_name: str, manufacturer: str = "", part_number: str = "",
                  serial_number: str = "", calibration_date: str = "",
                  specs: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO components "
            "(part_name, manufacturer, part_number, serial_number, calibration_date, specs) "
            "VALUES (?,?,?,?,?,?)",
            (part_name, manufacturer, part_number, serial_number, calibration_date, specs),
        )
        return cur.lastrowid


def update_component(cid: int, part_name: str, manufacturer: str, part_number: str,
                     serial_number: str, calibration_date: str, specs: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE components SET part_name=?, manufacturer=?, part_number=?, "
            "serial_number=?, calibration_date=?, specs=? WHERE id=?",
            (part_name, manufacturer, part_number, serial_number, calibration_date, specs, cid),
        )


def delete_component(cid: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM components WHERE id=?", (cid,))


# ---------------------------------------------------------------------------
# Test Run CRUD
# ---------------------------------------------------------------------------

def list_test_runs() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM test_runs ORDER BY created_at DESC"
        ).fetchall()
        result = []
        for r in rows:
            run = dict(r)
            run["component_count"] = conn.execute(
                "SELECT COUNT(*) FROM test_run_components WHERE test_run_id=?",
                (run["id"],),
            ).fetchone()[0]
            result.append(run)
        return result


def get_test_run(rid: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM test_runs WHERE id=?", (rid,)).fetchone()
        if not row:
            return None
        run = dict(row)
        run["components"] = [
            dict(r) for r in conn.execute(
                "SELECT c.* FROM components c "
                "JOIN test_run_components trc ON trc.component_id = c.id "
                "WHERE trc.test_run_id=? ORDER BY c.part_name",
                (rid,),
            )
        ]
        return run


def create_test_run(name: str, notes: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO test_runs (name, notes) VALUES (?,?)", (name, notes)
        )
        return cur.lastrowid


def update_test_run(rid: int, name: str, notes: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE test_runs SET name=?, notes=? WHERE id=?", (name, notes, rid)
        )


def save_ai_plan(rid: int, ai_plan: str) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE test_runs SET ai_plan=? WHERE id=?", (ai_plan, rid))


def delete_test_run(rid: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM test_runs WHERE id=?", (rid,))


def add_component_to_run(rid: int, cid: int) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO test_run_components (test_run_id, component_id) VALUES (?,?)",
            (rid, cid),
        )


def remove_component_from_run(rid: int, cid: int) -> None:
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM test_run_components WHERE test_run_id=? AND component_id=?",
            (rid, cid),
        )


# ---------------------------------------------------------------------------
# Repo Index CRUD
# ---------------------------------------------------------------------------

def _derive_category(test_type: str) -> str:
    see_types = {"SEU", "SEL", "SEFI", "SET"}
    if test_type in see_types:
        return "SEE"
    if test_type == "TID":
        return "TID"
    if test_type == "Proton":
        return "Proton"
    return "Other"


def insert_repo_entry(filename: str, test_type: str, part_type: str,
                      part_numbers: str, manufacturer: str, summary: str) -> None:
    category = _derive_category(test_type)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO repo_index (filename, category, test_type, part_type, part_numbers, manufacturer, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                category=excluded.category,
                test_type=excluded.test_type,
                part_type=excluded.part_type,
                part_numbers=excluded.part_numbers,
                manufacturer=excluded.manufacturer,
                summary=excluded.summary,
                indexed_at=datetime('now')
            """,
            (filename, category, test_type, part_type, part_numbers, manufacturer, summary),
        )


def get_repo_count() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM repo_index").fetchone()[0]


def get_indexed_filenames() -> set[str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT filename FROM repo_index").fetchall()
        return {r["filename"] for r in rows}


def clear_repo_index() -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM repo_index")


def get_repo_tree() -> dict:
    tree: dict = {}
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT category, test_type, part_type, filename FROM repo_index ORDER BY filename"
        ).fetchall()
    for row in rows:
        cat, ttype, ptype, fname = row["category"], row["test_type"], row["part_type"], row["filename"]
        tree.setdefault(cat, {}).setdefault(ttype, {}).setdefault(ptype, []).append(fname)
    return tree


def get_parts_by_filter(category: str = "", test_type: str = "", part_type: str = "") -> list[dict]:
    clauses = []
    params: list = []
    if category:
        clauses.append("category=?")
        params.append(category)
    if test_type:
        clauses.append("test_type=?")
        params.append(test_type)
    if part_type:
        clauses.append("part_type=?")
        params.append(part_type)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM repo_index {where} ORDER BY filename", params
        ).fetchall()
    return [dict(r) for r in rows]


def get_part_detail(filename: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM repo_index WHERE filename=?", (filename,)
        ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# DUT CRUD
# ---------------------------------------------------------------------------

_FP_COLS = [
    "bias_cliff_v", "rise_time_ms", "gnd_curr_slope", "overshoot_v",
    "thermal_drift", "vout_accuracy", "dropout_v", "line_reg", "load_reg",
    "gnd_curr_nom", "shutdown_leak", "en_thresh_v", "en_hyst_v",
    "psrr_db", "noise_vrms",
]


def add_dut(part_number: str = "TPS7A53-Q1", serial_number: str = "",
            silicon_rev: str = "", board_id: str = "", notes: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO duts (part_number, serial_number, silicon_rev, board_id, notes) "
            "VALUES (?,?,?,?,?)",
            (part_number, serial_number, silicon_rev, board_id, notes),
        )
        return cur.lastrowid


def list_duts() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM duts ORDER BY created_at DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["run_count"] = conn.execute(
                "SELECT COUNT(*) FROM fingerprint_runs WHERE dut_id=?", (d["id"],)
            ).fetchone()[0]
            result.append(d)
        return result


def get_dut(did: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM duts WHERE id=?", (did,)).fetchone()
        return dict(row) if row else None


def delete_dut(did: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM duts WHERE id=?", (did,))


# ---------------------------------------------------------------------------
# Fingerprint CRUD
# ---------------------------------------------------------------------------

def upsert_fingerprint_run(dut_id: int, run_number: int, data: dict) -> None:
    set_clause = ", ".join(f"{col}=excluded.{col}" for col in _FP_COLS)
    col_list   = ", ".join(_FP_COLS)
    val_ph     = ", ".join("?" for _ in _FP_COLS)
    values     = [data.get(col) for col in _FP_COLS]
    with get_conn() as conn:
        conn.execute(
            f"""
            INSERT INTO fingerprint_runs (dut_id, run_number, {col_list})
            VALUES (?, ?, {val_ph})
            ON CONFLICT(dut_id, run_number) DO UPDATE SET {set_clause}
            """,
            [dut_id, run_number] + values,
        )


def get_fingerprint_runs(dut_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM fingerprint_runs WHERE dut_id=? ORDER BY run_number",
            (dut_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_fingerprint_summary(dut_id: int) -> dict:
    import math, statistics as _stats
    runs = get_fingerprint_runs(dut_id)
    valid = [r for r in runs if r["run_number"] in (2, 3, 4, 5)]
    mean_d: dict = {}
    sigma_d: dict = {}
    for col in _FP_COLS:
        vals = [r[col] for r in valid if r[col] is not None]
        if vals:
            mean_d[col]  = sum(vals) / len(vals)
            sigma_d[col] = _stats.stdev(vals) if len(vals) > 1 else 0.0
        else:
            mean_d[col]  = None
            sigma_d[col] = None
    return {"mean": mean_d, "sigma": sigma_d}


def get_all_dut_fingerprints() -> list[dict]:
    import statistics as _stats
    duts = list_duts()
    result = []
    for dut in duts:
        runs = get_fingerprint_runs(dut["id"])
        valid = [r for r in runs if r["run_number"] in (2, 3, 4, 5)]
        row: dict = {
            "serial_number": dut["serial_number"],
            "part_number":   dut["part_number"],
            "silicon_rev":   dut["silicon_rev"],
            "board_id":      dut["board_id"],
        }
        for col in _FP_COLS:
            vals = [r[col] for r in valid if r[col] is not None]
            if vals:
                row[f"mean_{col}"]  = sum(vals) / len(vals)
                row[f"sigma_{col}"] = _stats.stdev(vals) if len(vals) > 1 else 0.0
            else:
                row[f"mean_{col}"]  = None
                row[f"sigma_{col}"] = None
        result.append(row)
    return result


# ---------------------------------------------------------------------------
# Simulation Result CRUD
# ---------------------------------------------------------------------------

def save_sim_result(dut_id, filename: str, x_col: str, y_col: str,
                    bias_cliff_v, notes: str, raw_data_json: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO sim_results (dut_id, filename, x_col, y_col, bias_cliff_v, notes, raw_data) "
            "VALUES (?,?,?,?,?,?,?)",
            (dut_id, filename, x_col, y_col, bias_cliff_v, notes, raw_data_json),
        )
        return cur.lastrowid


def list_sim_results() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, dut_id, filename, x_col, y_col, bias_cliff_v, notes, created_at "
            "FROM sim_results ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_sim_result(sid: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sim_results WHERE id=?", (sid,)).fetchone()
        return dict(row) if row else None


def delete_sim_result(sid: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sim_results WHERE id=?", (sid,))


if __name__ == "__main__":
    init_db()
    print(f"Database initialised at {DB_PATH}")
