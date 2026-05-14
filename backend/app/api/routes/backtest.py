from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.engine.ring_buffer import RingBuffer
from app.models import BacktestRun
from app.schemas import (
    BacktestCompareRequest,
    BacktestCompareResponse,
    BacktestRunRequest,
    BacktestRunResultResponse,
    BacktestRunsListResponse,
    BacktestRunStartResponse,
    BacktestRunSummary,
)
from app.services.backtest_bars import load_market_events
from app.services.backtest_runner import (
    backtest_result_payload,
    compare_fill_metrics,
    full_run_view,
    run_sma_crossover,
)

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post("/run", response_model=BacktestRunStartResponse)
async def run_backtest(
    body: BacktestRunRequest,
    session: AsyncSession = Depends(get_session),
) -> BacktestRunStartResponse:
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

    try:
        bt = run_sma_crossover(
            events,
            sym,
            body.initial_capital,
            short_w,
            long_w,
            body.fill_model,
            RingBuffer(4096),
        )
    except Exception as e:
        await session.execute(
            update(BacktestRun)
            .where(BacktestRun.id == run_id)
            .values(status="failed", error_message=str(e)[:8000])
        )
        await session.commit()
        raise HTTPException(status_code=500, detail=f"Backtest failed: {e}") from e

    result_payload = backtest_result_payload(bt)

    await session.execute(
        update(BacktestRun)
        .where(BacktestRun.id == run_id)
        .values(status="completed", result=result_payload, error_message=None)
    )
    await session.commit()

    return BacktestRunStartResponse(backtest_id=str(run_id), status="completed")


@router.post("/compare-fills", response_model=BacktestCompareResponse)
async def compare_fills(
    body: BacktestCompareRequest,
    session: AsyncSession = Depends(get_session),
) -> BacktestCompareResponse:
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

    group_id = str(uuid.uuid4())
    naive_id = uuid.uuid4()
    prob_id = uuid.uuid4()

    base_cfg = {
        "strategy": body.strategy,
        "symbols": [sym],
        "start_date": body.start_date,
        "end_date": body.end_date,
        "initial_capital": body.initial_capital,
        "strategy_params": {"short_window": short_w, "long_window": long_w},
        "comparison_group_id": group_id,
    }

    cfg_naive = {**base_cfg, "fill_model": "naive", "compare_role": "naive"}
    cfg_prob = {**base_cfg, "fill_model": "probabilistic", "compare_role": "probabilistic"}

    session.add_all(
        [
            BacktestRun(
                id=naive_id,
                status="running",
                strategy=body.strategy,
                symbol_key=sym,
                request_config=cfg_naive,
                result=None,
                error_message=None,
            ),
            BacktestRun(
                id=prob_id,
                status="running",
                strategy=body.strategy,
                symbol_key=sym,
                request_config=cfg_prob,
                result=None,
                error_message=None,
            ),
        ]
    )
    await session.commit()

    try:
        naive_bt = run_sma_crossover(
            events, sym, body.initial_capital, short_w, long_w, "naive", RingBuffer(4096)
        )
        prob_bt = run_sma_crossover(
            events, sym, body.initial_capital, short_w, long_w, "probabilistic", RingBuffer(4096)
        )
    except Exception as e:
        await session.execute(
            update(BacktestRun)
            .where(BacktestRun.id.in_([naive_id, prob_id]))
            .values(status="failed", error_message=str(e)[:8000])
        )
        await session.commit()
        raise HTTPException(status_code=500, detail=f"Compare backtest failed: {e}") from e

    naive_payload = backtest_result_payload(naive_bt)
    prob_payload = backtest_result_payload(prob_bt)
    cmp_metrics = compare_fill_metrics(naive_bt, prob_bt)

    await session.execute(
        update(BacktestRun)
        .where(BacktestRun.id == naive_id)
        .values(status="completed", result=naive_payload, error_message=None)
    )
    await session.execute(
        update(BacktestRun)
        .where(BacktestRun.id == prob_id)
        .values(status="completed", result=prob_payload, error_message=None)
    )
    await session.commit()

    naive_view = full_run_view(str(naive_id), "completed", cfg_naive, naive_payload)
    prob_view = full_run_view(str(prob_id), "completed", cfg_prob, prob_payload)

    return BacktestCompareResponse(
        comparison_group_id=group_id,
        naive_backtest_id=str(naive_id),
        probabilistic_backtest_id=str(prob_id),
        naive_result=naive_view,
        probabilistic_result=prob_view,
        comparison=cmp_metrics,
    )


@router.get("/runs", response_model=BacktestRunsListResponse)
async def list_backtest_runs(
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
) -> BacktestRunsListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)

    count_q = select(func.count()).select_from(BacktestRun)
    total = int((await session.execute(count_q)).scalar_one())

    q = (
        select(BacktestRun)
        .order_by(BacktestRun.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(q)).scalars().all()

    out: list[BacktestRunSummary] = []
    for row in rows:
        cfg = row.request_config or {}
        fill_model = cfg.get("fill_model")
        if isinstance(fill_model, str):
            fm: str | None = fill_model
        else:
            fm = None
        compare_role = cfg.get("compare_role")
        cr = compare_role if isinstance(compare_role, str) else None
        total_ret: float | None = None
        if row.result and isinstance(row.result, dict):
            pm = row.result.get("performance_metrics")
            if isinstance(pm, dict):
                tr = pm.get("total_return")
                if isinstance(tr, (int, float)):
                    total_ret = float(tr)
        out.append(
            BacktestRunSummary(
                backtest_id=str(row.id),
                status=row.status,
                strategy=row.strategy,
                symbol_key=row.symbol_key,
                created_at=row.created_at.isoformat() if row.created_at else "",
                fill_model=fm,
                total_return=total_ret,
                compare_role=cr,
            )
        )

    return BacktestRunsListResponse(runs=out, total_count=total)


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
