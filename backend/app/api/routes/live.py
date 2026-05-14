"""Live simulation routes — MVP stub (no WebSocket, no engine replay yet)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas import LiveStartRequest, LiveStartResponse, LiveStatusResponse

router = APIRouter(prefix="/live", tags=["live"])

# In-process only; lost on API restart and not shared across workers.
_sessions: dict[str, dict[str, Any]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/start", response_model=LiveStartResponse)
async def live_start(body: LiveStartRequest) -> LiveStartResponse:
    if body.strategy != "sma_crossover":
        raise HTTPException(
            status_code=400,
            detail="Only strategy sma_crossover is supported for live stub.",
        )
    if not body.symbols:
        raise HTTPException(status_code=400, detail="symbols must include at least one key.")

    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "status": "stub",
        "created_at": _utcnow().isoformat(),
        "request": body.model_dump(),
    }
    return LiveStartResponse(session_id=sid, status="started")


@router.get("/status/{session_id}", response_model=LiveStatusResponse)
async def live_status(session_id: str) -> LiveStatusResponse:
    row = _sessions.get(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    st = row.get("status", "unknown")
    if st == "stopped":
        detail = "Session stopped. WebSocket replay not implemented in this build."
    else:
        detail = (
            "Stub session: no bars streamed yet. "
            "Implement LiveDataHandler + /ws/live per doc/ALPHA_TEST_SPECIFICATION.md."
        )
    return LiveStatusResponse(session_id=session_id, status=str(st), detail=detail)


@router.post("/stop/{session_id}", response_model=LiveStatusResponse)
async def live_stop(session_id: str) -> LiveStatusResponse:
    row = _sessions.get(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    row["status"] = "stopped"
    return LiveStatusResponse(
        session_id=session_id,
        status="stopped",
        detail="Session marked stopped (in-memory only).",
    )
