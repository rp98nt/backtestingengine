from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.engine.ring_buffer import RingBuffer, StandardQueueWrapper
from app.schemas import BacktestRunRequest, BenchmarkRunResponse
from app.services.backtest_bars import load_market_events
from app.services.backtest_runner import run_sma_crossover

router = APIRouter(prefix="/benchmark", tags=["benchmark"])


@router.post("/run", response_model=BenchmarkRunResponse)
async def benchmark_run(
    body: BacktestRunRequest,
    session: AsyncSession = Depends(get_session),
) -> BenchmarkRunResponse:
    if body.strategy != "sma_crossover":
        raise HTTPException(status_code=400, detail="Only strategy sma_crossover is implemented.")
    if not body.symbols:
        raise HTTPException(status_code=400, detail="symbols must include at least one instrument key.")
    symbol = body.symbols[0].strip().upper()

    try:
        events, sym = await load_market_events(session, symbol, body.start_date, body.end_date)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    if not events:
        raise HTTPException(status_code=400, detail="No OHLCV bars in range for this symbol.")

    params = body.strategy_params or {}
    short_w = int(params.get("short_window", 20))
    long_w = int(params.get("long_window", 50))
    fill = body.fill_model

    rb = RingBuffer(4096)
    res_rb = run_sma_crossover(events, sym, body.initial_capital, short_w, long_w, fill, rb)

    sq = StandardQueueWrapper(65536)
    res_sq = run_sma_crossover(events, sym, body.initial_capital, short_w, long_w, fill, sq)

    ring = {
        "avg_latency_ns": float(res_rb.ring_buffer_avg_latency_ns),
        "total_time_ms": float(res_rb.total_execution_time_ms),
        "throughput_events_per_sec": (
            (res_rb.ring_buffer_total_puts / (res_rb.total_execution_time_ms / 1000.0))
            if res_rb.total_execution_time_ms > 0
            else 0.0
        ),
        "total_events": float(res_rb.ring_buffer_total_puts),
    }
    std = {
        "avg_latency_ns": float(res_sq.ring_buffer_avg_latency_ns),
        "total_time_ms": float(res_sq.total_execution_time_ms),
        "throughput_events_per_sec": (
            (res_sq.ring_buffer_total_puts / (res_sq.total_execution_time_ms / 1000.0))
            if res_sq.total_execution_time_ms > 0
            else 0.0
        ),
        "total_events": float(res_sq.ring_buffer_total_puts),
    }

    r_lat = ring["avg_latency_ns"]
    s_lat = std["avg_latency_ns"]
    speedup = (s_lat / r_lat) if r_lat > 1e-9 else 1.0
    lat_red_pct = ((s_lat - r_lat) / s_lat * 100.0) if s_lat > 1e-9 else 0.0

    return BenchmarkRunResponse(
        ring_buffer=ring,
        standard_queue=std,
        speedup_factor=float(speedup),
        latency_reduction_pct=float(lat_red_pct),
    )
