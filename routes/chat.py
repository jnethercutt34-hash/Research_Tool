"""
Chat routes — dual-provider AI chat with SSE streaming.

Endpoints:
    GET  /api/chat/conversations              — list conversations
    POST /api/chat/conversations              — create conversation
    DELETE /api/chat/conversations/{id}        — delete conversation
    GET  /api/chat/conversations/{id}/messages — get messages
    POST /api/chat/conversations/{id}/messages — send message (SSE stream)
"""

import json
import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import phase4_db

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# System prompt for the research assistant
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a radiation effects research assistant specializing in Total Ionizing Dose (TID) 
testing of COTS Low-Dropout (LDO) voltage regulators. You help with:
- Interpreting TID test data and fingerprint measurements
- Explaining radiation effects mechanisms (threshold voltage shifts, leakage current increases)
- Analyzing bias cliff phenomena in LDO regulators  
- Discussing ELDRS, dose rate effects, and part-to-part variability
- Reviewing test protocols (MIL-STD-883 TM1019, ESCC 22900)
- Statistical analysis of screening data

Be precise, cite relevant standards when applicable, and flag uncertainties.
Keep responses focused and technical."""


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    title: str = "New Conversation"

class MessageSend(BaseModel):
    content: str
    provider: str = "gemini"  # "gemini" or "claude"


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    return phase4_db.get_conn()


# ---------------------------------------------------------------------------
# Conversation CRUD
# ---------------------------------------------------------------------------

@router.get("/conversations")
async def list_conversations():
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT c.*, "
            "(SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count "
            "FROM chat_conversations c ORDER BY c.updated_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


@router.post("/conversations", status_code=201)
async def create_conversation(body: ConversationCreate):
    with _get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO chat_conversations (title) VALUES (?)",
            (body.title,)
        )
        return {"id": cur.lastrowid, "title": body.title}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: int):
    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM chat_conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Conversation not found")
        conn.execute("DELETE FROM chat_messages WHERE conversation_id = ?", (conv_id,))
        conn.execute("DELETE FROM chat_conversations WHERE id = ?", (conv_id,))
        return {"ok": True}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: int):
    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM chat_conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Conversation not found")
        msgs = conn.execute(
            "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,)
        ).fetchall()
        return [dict(m) for m in msgs]


# ---------------------------------------------------------------------------
# SSE streaming message
# ---------------------------------------------------------------------------

def _build_history(conn, conv_id: int, limit: int = 20) -> list[dict]:
    """Build message history for the AI provider."""
    msgs = conn.execute(
        "SELECT role, content FROM chat_messages WHERE conversation_id = ? "
        "ORDER BY created_at DESC LIMIT ?",
        (conv_id, limit)
    ).fetchall()
    # Reverse to chronological order
    return [{"role": m["role"], "content": m["content"]} for m in reversed(msgs)]


async def _stream_gemini(history: list[dict], user_msg: str):
    """Stream from Gemini API."""
    try:
        from google import genai
        from google.genai import types

        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            yield f"data: {json.dumps({'type': 'error', 'content': 'GEMINI_API_KEY not configured'})}\n\n"
            return

        client = genai.Client(api_key=api_key)

        # Build contents for Gemini
        contents = []
        for m in history:
            role = "user" if m["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=user_msg)]))

        response = client.models.generate_content_stream(
            model="gemini-2.0-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
                max_output_tokens=2048,
            ),
        )

        full_text = ""
        for chunk in response:
            if chunk.text:
                full_text += chunk.text
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.text})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'content': full_text})}\n\n"

    except ImportError:
        yield f"data: {json.dumps({'type': 'error', 'content': 'google-genai package not installed'})}\n\n"
    except Exception as e:
        logger.error(f"Gemini streaming error: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"


async def _stream_claude(history: list[dict], user_msg: str):
    """Stream from Claude API."""
    try:
        import anthropic

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            yield f"data: {json.dumps({'type': 'error', 'content': 'ANTHROPIC_API_KEY not configured'})}\n\n"
            return

        client = anthropic.Anthropic(api_key=api_key)

        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        messages.append({"role": "user", "content": user_msg})

        full_text = ""
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                full_text += text
                yield f"data: {json.dumps({'type': 'chunk', 'content': text})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'content': full_text})}\n\n"

    except ImportError:
        yield f"data: {json.dumps({'type': 'error', 'content': 'anthropic package not installed. Run: pip install anthropic'})}\n\n"
    except Exception as e:
        logger.error(f"Claude streaming error: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: MessageSend):
    if not body.content.strip():
        raise HTTPException(400, "Message content cannot be empty")

    with _get_conn() as conn:
        row = conn.execute("SELECT id FROM chat_conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Conversation not found")

        # Save user message
        conn.execute(
            "INSERT INTO chat_messages (conversation_id, role, content, provider) VALUES (?, 'user', ?, ?)",
            (conv_id, body.content, body.provider)
        )
        conn.execute("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?", (conv_id,))

        # Get history
        history = _build_history(conn, conv_id)

    # Choose provider
    if body.provider == "claude":
        streamer = _stream_claude(history, body.content)
    else:
        streamer = _stream_gemini(history, body.content)

    async def event_generator():
        full_response = ""
        async for event in _wrap_sync_generator(streamer):
            yield event
            # Parse for done event to save
            try:
                if event.startswith("data: "):
                    data = json.loads(event[6:].strip())
                    if data.get("type") == "done":
                        full_response = data["content"]
            except Exception:
                pass

        # Save assistant response
        if full_response:
            with _get_conn() as conn:
                conn.execute(
                    "INSERT INTO chat_messages (conversation_id, role, content, provider) VALUES (?, 'assistant', ?, ?)",
                    (conv_id, full_response, body.provider)
                )

    # Handle sync generators from the AI SDKs
    async def _wrap_sync_generator(gen):
        """Yield from a sync or async generator."""
        if hasattr(gen, '__aiter__'):
            async for item in gen:
                yield item
        else:
            for item in gen:
                yield item

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
