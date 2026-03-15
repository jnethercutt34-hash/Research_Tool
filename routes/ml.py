"""
ML Workbench routes — results storage and correlation analysis.

Endpoints:
    GET  /api/ml/results      — list saved ML results
    POST /api/ml/results      — save ML result
    GET  /api/ml/correlation   — compute correlation matrix from fingerprint data
    GET  /api/ml/dataset       — get formatted ML dataset (enhanced CSV export)

Dashboard:
    GET  /api/dashboard/stats  — aggregated counts (single compound SQL query)
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/ml", tags=["ml"])


# TODO: Implement in Phase 3
