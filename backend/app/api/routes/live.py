"""Live simulation: prepare replay from Neon + WebSocket equity stream (MVP)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import LiveStartRequest, LiveStartResponse, LiveStatusResponse
from app.services.live_replay import prepare_live_replay

router = APIRouter(prefix="/live", tags=["live"])

# In-process only; lost on API restart and not shared across workers.
_sessions: dict[str, dict[str, Any]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/start", response_model=LiveStartResponse)
async def live_start(
    body: LiveStartRequest,
    session: AsyncSession = Depends(get_session),
) -> LiveStartResponse:
    if body.strategy != "sma_crossover":
        raise HTTPException(
            status_code=400,
            detail="Only strategy sma_crossover is supported for live replay.",
        )
    if not body.symbols:
        raise HTTPException(status_code=400, detail="symbols must include at least one key.")

    try:
        payload = await prepare_live_replay(session, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "status": "ready",
        "created_at": _utcnow().isoformat(),
        "request": body.model_dump(),
        "replay_points": payload["replay_points"],
        "symbol": payload["symbol"],
        "raw_equity_points": payload["raw_equity_points"],
        "stream_points": payload["stream_points"],
        "total_bars": payload["total_bars"],
        "performance_metrics": payload["performance_metrics"],
        "speed_multiplier": float(body.speed_multiplier or 1.0),
        "ws_active": False,
    }
    return LiveStartResponse(session_id=sid, status="ready")


@router.get("/status/{session_id}", response_model=LiveStatusResponse)
async def live_status(session_id: str) -> LiveStatusResponse:
    row = _sessions.get(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    st = str(row.get("status", "unknown"))
    if st == "stopped":
        detail = "Session stopped."
    elif st == "streaming":
        detail = "WebSocket stream in progress."
    elif st == "ready":
        detail = (
            f"Replay prepared ({row.get('stream_points')} equity points from "
            f"{row.get('raw_equity_points')} engine samples). "
            f"Connect WebSocket to `/api/live/ws/{session_id}`."
        )
    elif st == "completed":
        detail = "Replay finished. Start a new session or reconnect is not supported."
    else:
        detail = row.get("last_error") or "Unknown session state."
    return LiveStatusResponse(session_id=session_id, status=st, detail=detail)


@router.post("/stop/{session_id}", response_model=LiveStatusResponse)
async def live_stop(session_id: str) -> LiveStatusResponse:
    row = _sessions.get(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    row["status"] = "stopped"
    return LiveStatusResponse(
        session_id=session_id,
        status="stopped",
        detail="Stop requested; streaming loop will exit if running.",
    )


@router.websocket("/ws/{session_id}")
async def live_ws(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    row = _sessions.get(session_id)
    if not row:
        await websocket.close(code=4404)
        return
    if row.get("status") == "stopped":
        await websocket.send_json({"type": "error", "detail": "session stopped"})
        await websocket.close(code=4404)
        return
    if row.get("status") == "completed":
        row["status"] = "ready"
    if row.get("ws_active"):
        await websocket.send_json({"type": "error", "detail": "another client is streaming"})
        await websocket.close(code=4409)
        return

    points: list[dict[str, Any]] = row.get("replay_points") or []
    if not points:
        await websocket.send_json({"type": "error", "detail": "no replay points"})
        await websocket.close(code=1011)
        return

    row["ws_active"] = True
    row["status"] = "streaming"
    speed = max(0.05, float(row.get("speed_multiplier", 1.0) or 1.0))
    base_delay = max(0.015, 0.12 / speed)
    n = len(points)
    try:
        await websocket.send_json(
            {
                "type": "hello",
                "session_id": session_id,
                "symbol": row.get("symbol"),
                "total_ticks": n,
                "speed_multiplier": speed,
            },
        )
        for i, pt in enumerate(points):
            if _sessions.get(session_id, {}).get("status") == "stopped":
                await websocket.send_json({"type": "stopped", "index": i})
                break
            await websocket.send_json(
                {
                    "type": "tick",
                    "index": i,
                    "total": n,
                    "portfolio_value": pt.get("portfolio_value"),
                    "cash": pt.get("cash"),
                    "positions_value": pt.get("positions_value"),
                    "timestamp": pt.get("timestamp"),
                    "pct": round(100.0 * (i + 1) / n, 2) if n else 0.0,
                },
            )
            await asyncio.sleep(base_delay)
        else:
            row["status"] = "completed"
            await websocket.send_json({"type": "complete", "total": n})
    except WebSocketDisconnect:
        pass
    except Exception as e:  # pragma: no cover
        row["last_error"] = str(e)
        try:
            await websocket.send_json({"type": "error", "detail": str(e)})
        except Exception:
            pass
    finally:
        row["ws_active"] = False
        if row.get("status") == "streaming":
            row["status"] = "ready"
        try:
            await websocket.close()
        except Exception:
            pass
