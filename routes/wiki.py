"""
Wiki routes — interconnected knowledge base with FTS5 search.

Endpoints:
    GET    /api/wiki/pages          — list all pages (with tag filter)
    POST   /api/wiki/pages          — create page
    GET    /api/wiki/pages/{slug}   — get page content + backlinks
    PUT    /api/wiki/pages/{slug}   — update page
    DELETE /api/wiki/pages/{slug}   — delete page
    GET    /api/wiki/tags           — list all tags with counts
    GET    /api/wiki/search?q=      — FTS5 full-text search
    GET    /api/wiki/export?tag=    — export pages by tag as combined markdown

Link extraction protocol:
    - On save: regex extract [[Page Name]] patterns
    - Resolve to slug (lowercase, spaces → hyphens)
    - DELETE old wiki_links for this source, INSERT new links (same transaction)
    - Dead links (target page doesn't exist) render as "create page" links
    - Skip [[links]] inside fenced code blocks (``` ... ```)
    - Page rename: update wiki_links + search-replace [[Old Name]] in all sources
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/wiki", tags=["wiki"])


# TODO: Implement in Phase 3
