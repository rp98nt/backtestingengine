"""Prepare historical replay payload for live WebSocket demo (SECTION 0.A C3)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import LiveStartRequest
from app.engine.ring_buffer import RingBuffer
from app.services.backtest_bars import load_market_events
from app.services.backtest_runner import run_sma_crossover


def subsample_equity_curve(curve: list[dict[str, Any]], max_points: int = 500) -> list[dict[str, Any]]:
    """Keep replay responsive: cap WebSocket ticks while preserving shape."""
    if len(curve) <= max_points:
        return list(curve)
    step = max(1, len(curve) // max_points)
    out = curve[::step]
    if curve and out[-1] is not curve[-1]:
        out = [*out, curve[-1]]
    return out


async def prepare_live_replay(session: AsyncSession, body: LiveStartRequest) -> dict[str, Any]:
    if not body.symbols:
        raise ValueError("symbols must include at least one instrument key.")
    symbol = body.symbols[0].strip().upper()
    events, sym = await load_market_events(
        session,
        symbol,
        body.replay_start_date,
        body.replay_end_date,
    )
    if not events:
        raise ValueError("No OHLCV bars in range for this symbol.")
    params = body.strategy_params or {}
    short_w = int(params.get("short_window", 20))
    long_w = int(params.get("long_window", 50))
    rb = RingBuffer(4096)
    bt = run_sma_crossover(
        events,
        sym,
        body.initial_capital,
        short_w,
        long_w,
        "naive",
        rb,
    )
    curve = subsample_equity_curve(list(bt.equity_curve))
    return {
        "symbol": sym,
        "replay_points": curve,
        "raw_equity_points": len(bt.equity_curve),
        "stream_points": len(curve),
        "total_bars": len(events),
        "performance_metrics": {k: float(v) for k, v in bt.performance_metrics.items()},
    }
