"""
Wiki routes — interconnected knowledge base with FTS5 search.
"""

import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

import phase4_db

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/wiki", tags=["wiki"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class WikiPageCreate(BaseModel):
    title: str
    content: str = ""
    tags: list[str] = []

class WikiPageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Link extraction
# ---------------------------------------------------------------------------

_LINK_RE = re.compile(r'\[\[([^\]]+)\]\]')
_CODE_FENCE_RE = re.compile(r'```[\s\S]*?```', re.DOTALL)

def slugify(title: str) -> str:
    slug = title.strip().lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    return slug.strip('-')

def extract_links(content: str) -> list[str]:
    """Extract [[Page Name]] links, skipping code blocks."""
    # Remove code fences first
    clean = _CODE_FENCE_RE.sub('', content)
    return [m.group(1).strip() for m in _LINK_RE.finditer(clean)]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    return phase4_db.get_conn()

def _update_links(conn, page_id: int, content: str):
    """Extract links from content and update wiki_links table."""
    conn.execute("DELETE FROM wiki_links WHERE source_id = ?", (page_id,))
    link_titles = extract_links(content)
    for title in link_titles:
        slug = slugify(title)
        target = conn.execute("SELECT id FROM wiki_pages WHERE slug = ?", (slug,)).fetchone()
        if target:
            conn.execute(
                "INSERT OR IGNORE INTO wiki_links (source_id, target_id) VALUES (?, ?)",
                (page_id, target["id"])
            )

def _sync_tags(conn, page_id: int, tags: list[str]):
    conn.execute("DELETE FROM wiki_tags WHERE page_id = ?", (page_id,))
    for tag in tags:
        tag = tag.strip().lower()
        if tag:
            conn.execute("INSERT INTO wiki_tags (page_id, tag) VALUES (?, ?)", (page_id, tag))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/pages")
async def list_pages(tag: Optional[str] = None):
    with _get_conn() as conn:
        if tag:
            rows = conn.execute(
                "SELECT wp.* FROM wiki_pages wp "
                "JOIN wiki_tags wt ON wt.page_id = wp.id "
                "WHERE wt.tag = ? ORDER BY wp.updated_at DESC",
                (tag.lower(),)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM wiki_pages ORDER BY updated_at DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = [t["tag"] for t in conn.execute(
                "SELECT tag FROM wiki_tags WHERE page_id = ?", (d["id"],)
            ).fetchall()]
            result.append(d)
        return result


@router.post("/pages", status_code=201)
async def create_page(body: WikiPageCreate):
    slug = slugify(body.title)
    if not slug:
        raise HTTPException(400, "Title produces empty slug")
    with _get_conn() as conn:
        existing = conn.execute("SELECT id FROM wiki_pages WHERE slug = ?", (slug,)).fetchone()
        if existing:
            raise HTTPException(409, f"Page with slug '{slug}' already exists")
        cur = conn.execute(
            "INSERT INTO wiki_pages (slug, title, content) VALUES (?, ?, ?)",
            (slug, body.title, body.content)
        )
        page_id = cur.lastrowid
        _update_links(conn, page_id, body.content)
        _sync_tags(conn, page_id, body.tags)
        return {"id": page_id, "slug": slug}


@router.get("/pages/{slug}")
async def get_page(slug: str):
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM wiki_pages WHERE slug = ?", (slug,)).fetchone()
        if not row:
            raise HTTPException(404, f"Page not found: {slug}")
        page = dict(row)
        page["tags"] = [t["tag"] for t in conn.execute(
            "SELECT tag FROM wiki_tags WHERE page_id = ?", (page["id"],)
        ).fetchall()]
        # Backlinks
        backlinks = conn.execute(
            "SELECT wp.slug, wp.title FROM wiki_pages wp "
            "JOIN wiki_links wl ON wl.source_id = wp.id "
            "WHERE wl.target_id = ?",
            (page["id"],)
        ).fetchall()
        page["backlinks"] = [{"slug": b["slug"], "title": b["title"]} for b in backlinks]
        return page


@router.put("/pages/{slug}")
async def update_page(slug: str, body: WikiPageUpdate):
    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM wiki_pages WHERE slug = ?", (slug,)).fetchone()
        if not row:
            raise HTTPException(404, f"Page not found: {slug}")
        page_id = row["id"]
        if body.title is not None:
            new_slug = slugify(body.title)
            conn.execute("UPDATE wiki_pages SET title = ?, slug = ?, updated_at = datetime('now') WHERE id = ?",
                         (body.title, new_slug, page_id))
        if body.content is not None:
            conn.execute("UPDATE wiki_pages SET content = ?, updated_at = datetime('now') WHERE id = ?",
                         (body.content, page_id))
            _update_links(conn, page_id, body.content)
        if body.tags is not None:
            _sync_tags(conn, page_id, body.tags)
        return {"ok": True}


@router.delete("/pages/{slug}")
async def delete_page(slug: str):
    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM wiki_pages WHERE slug = ?", (slug,)).fetchone()
        if not row:
            raise HTTPException(404, f"Page not found: {slug}")
        conn.execute("DELETE FROM wiki_pages WHERE id = ?", (row["id"],))
        return {"ok": True}


@router.get("/tags")
async def list_tags():
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT tag, COUNT(*) as count FROM wiki_tags GROUP BY tag ORDER BY count DESC"
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/search")
async def search_pages(q: str = ""):
    if not q.strip():
        return []
    with _get_conn() as conn:
        # Simple LIKE search (FTS5 can be added later with virtual table)
        pattern = f"%{q}%"
        rows = conn.execute(
            "SELECT id, slug, title, "
            "substr(content, max(1, instr(lower(content), lower(?)) - 40), 120) as snippet "
            "FROM wiki_pages WHERE title LIKE ? OR content LIKE ? "
            "ORDER BY updated_at DESC LIMIT 20",
            (q, pattern, pattern)
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/export")
async def export_by_tag(tag: str = ""):
    if not tag.strip():
        raise HTTPException(400, "Tag parameter required")
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT wp.title, wp.content FROM wiki_pages wp "
            "JOIN wiki_tags wt ON wt.page_id = wp.id "
            "WHERE wt.tag = ? ORDER BY wp.title",
            (tag.lower(),)
        ).fetchall()
    if not rows:
        raise HTTPException(404, f"No pages with tag: {tag}")
    parts = []
    for r in rows:
        parts.append(f"# {r['title']}\n\n{r['content']}")
    from fastapi.responses import Response
    combined = "\n\n---\n\n".join(parts)
    return Response(
        content=combined.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="wiki-export-{tag}.md"'},
    )
