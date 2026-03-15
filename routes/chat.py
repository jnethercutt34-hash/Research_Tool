"""
Chat routes — dual-provider AI chat with SSE streaming.

Endpoints:
    GET  /api/chat/conversations              — list conversations
    POST /api/chat/conversations              — create conversation
    DELETE /api/chat/conversations/{id}        — delete conversation
    GET  /api/chat/conversations/{id}/messages — get messages
    POST /api/chat/conversations/{id}/messages — send message (SSE stream)
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("rad_research")

router = APIRouter(prefix="/api/chat", tags=["chat"])


# TODO: Implement in Phase 3
