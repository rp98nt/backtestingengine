from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.engine.backtesting_engine import BacktestingEngine, build_fill_model
from app.engine.data_handler import HistoricalDataHandler
from app.engine.execution_handler import ExecutionHandler
from app.engine.portfolio import PortfolioManager
from app.engine.ring_buffer import RingBuffer
from app.engine.strategies.sma_crossover import SMACrossoverStrategy
from app.models import BacktestRun
from app.schemas import BacktestRunRequest, BacktestRunResultResponse, BacktestRunStartResponse
from app.services.backtest_bars import load_market_events

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post("/run", response_model=BacktestRunStartResponse)
async def run_backtest(
    body: BacktestRunRequest,
    session: AsyncSession = Depends(get_session),
) -> BacktestRunStartResponse:
    if body.strategy != "sma_crossover":
        raise HTTPException(status_code=400, detail="Only strategy sma_crossover is implemented in Chunk 2.")
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

    run_id = uuid.uuid4()
    config = {
        "strategy": body.strategy,
        "symbols": [sym],
        "start_date": body.start_date,
        "end_date": body.end_date,
        "initial_capital": body.initial_capital,
        "fill_model": body.fill_model,
        "strategy_params": {"short_window": short_w, "long_window": long_w},
    }

    session.add(
        BacktestRun(
            id=run_id,
            status="running",
            strategy=body.strategy,
            symbol_key=sym,
            request_config=config,
            result=None,
            error_message=None,
        )
    )
    await session.commit()

    rb = RingBuffer(4096)
    portfolio = PortfolioManager(initial_capital=body.initial_capital, ring_buffer=rb)
    strategy = SMACrossoverStrategy(sym, rb, short_window=short_w, long_window=long_w)
    exec_handler = ExecutionHandler(build_fill_model(body.fill_model))
    data_handler = HistoricalDataHandler(events)
    engine = BacktestingEngine(data_handler, strategy, portfolio, exec_handler, rb)

    try:
        bt = engine.run()
    except Exception as e:
        await session.execute(
            update(BacktestRun)
            .where(BacktestRun.id == run_id)
            .values(status="failed", error_message=str(e)[:8000])
        )
        await session.commit()
        raise HTTPException(status_code=500, detail=f"Backtest failed: {e}") from e

    result_payload = {
        "performance_metrics": bt.performance_metrics,
        "equity_curve": bt.equity_curve,
        "trade_log": bt.trade_log,
        "engine_metrics": {
            "total_bars_processed": bt.total_bars_processed,
            "total_execution_time_ms": bt.total_execution_time_ms,
            "ring_buffer_avg_latency_ns": bt.ring_buffer_avg_latency_ns,
            "ring_buffer_total_puts": bt.ring_buffer_total_puts,
            "total_events_processed": bt.ring_buffer_total_puts,
        },
    }

    await session.execute(
        update(BacktestRun)
        .where(BacktestRun.id == run_id)
        .values(status="completed", result=result_payload, error_message=None)
    )
    await session.commit()

    return BacktestRunStartResponse(backtest_id=str(run_id), status="completed")


@router.get("/result/{backtest_id}", response_model=BacktestRunResultResponse)
async def get_backtest_result(
    backtest_id: str,
    session: AsyncSession = Depends(get_session),
) -> BacktestRunResultResponse:
    try:
        uid = uuid.UUID(backtest_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid backtest_id") from e

    r = await session.execute(select(BacktestRun).where(BacktestRun.id == uid))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Backtest not found")

    if row.status == "failed":
        return BacktestRunResultResponse(
            backtest_id=str(row.id),
            status="failed",
            config=row.request_config,
            performance_metrics={},
            equity_curve=[],
            trade_log=[],
            engine_metrics={"error": row.error_message or ""},
        )

    if row.status == "running" or row.result is None:
        return BacktestRunResultResponse(
            backtest_id=str(row.id),
            status=row.status,
            config=row.request_config,
            performance_metrics={},
            equity_curve=[],
            trade_log=[],
            engine_metrics={},
        )

    res = row.result
    return BacktestRunResultResponse(
        backtest_id=str(row.id),
        status=row.status,
        config=row.request_config,
        performance_metrics=res.get("performance_metrics", {}),
        equity_curve=res.get("equity_curve", []),
        trade_log=res.get("trade_log", []),
        engine_metrics=res.get("engine_metrics", {}),
    )
