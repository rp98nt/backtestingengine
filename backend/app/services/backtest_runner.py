from __future__ import annotations

from typing import Any

from app.engine.backtesting_engine import BacktestingEngine, BacktestResult, build_fill_model
from app.engine.data_handler import HistoricalDataHandler
from app.engine.events import MarketEvent
from app.engine.execution_handler import ExecutionHandler
from app.engine.portfolio import PortfolioManager
from app.engine.ring_buffer import RingBuffer, StandardQueueWrapper
from app.engine.strategies.sma_crossover import SMACrossoverStrategy


def run_sma_crossover(
    events: list[MarketEvent],
    symbol: str,
    initial_capital: float,
    short_window: int,
    long_window: int,
    fill_model_name: str,
    event_queue: RingBuffer | StandardQueueWrapper,
) -> BacktestResult:
    """Run one SMA crossover backtest on a fresh copy of `events`."""
    portfolio = PortfolioManager(initial_capital=initial_capital, ring_buffer=event_queue)
    strategy = SMACrossoverStrategy(symbol, event_queue, short_window=short_window, long_window=long_window)
    exec_handler = ExecutionHandler(build_fill_model(fill_model_name))
    data_handler = HistoricalDataHandler(list(events))
    engine = BacktestingEngine(data_handler, strategy, portfolio, exec_handler, event_queue)
    return engine.run()


def backtest_result_payload(bt: BacktestResult) -> dict[str, Any]:
    return {
        "performance_metrics": bt.performance_metrics,
        "equity_curve": bt.equity_curve,
        "trade_log": bt.trade_log,
        "engine_metrics": {
            "total_bars_processed": bt.total_bars_processed,
            "total_execution_time_ms": bt.total_execution_time_ms,
            "ring_buffer_avg_latency_ns": bt.ring_buffer_avg_latency_ns,
            "ring_buffer_total_puts": bt.ring_buffer_total_puts,
            "total_events_processed": bt.ring_buffer_total_puts,
            "throughput_events_per_sec": (
                (bt.ring_buffer_total_puts / (bt.total_execution_time_ms / 1000.0))
                if bt.total_execution_time_ms > 0
                else 0.0
            ),
        },
    }


def full_run_view(backtest_id: str, status: str, config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "backtest_id": backtest_id,
        "status": status,
        "config": config,
        "performance_metrics": payload.get("performance_metrics", {}),
        "equity_curve": payload.get("equity_curve", []),
        "trade_log": payload.get("trade_log", []),
        "engine_metrics": payload.get("engine_metrics", {}),
    }


def compare_fill_metrics(naive: BacktestResult, prob: BacktestResult) -> dict[str, float]:
    """Side-by-side stats for naive vs probabilistic fills (spec SECTION 4)."""
    nm = naive.performance_metrics
    pm = prob.performance_metrics
    naive_ret = float(nm.get("total_return", 0) or 0)
    prob_ret = float(pm.get("total_return", 0) or 0)
    naive_sharpe = float(nm.get("sharpe_ratio", 0) or 0)
    prob_sharpe = float(pm.get("sharpe_ratio", 0) or 0)

    n_comm = sum(float(t.get("commission", 0) or 0) for t in naive.trade_log)
    p_comm = sum(float(t.get("commission", 0) or 0) for t in prob.trade_log)
    p_slip = sum(float(t.get("slippage", 0) or 0) for t in prob.trade_log)
    pt = len(prob.trade_log)
    avg_slip = p_slip / pt if pt else 0.0
    extra_comm = max(0.0, p_comm - n_comm)
    return {
        "return_difference": naive_ret - prob_ret,
        "sharpe_difference": naive_sharpe - prob_sharpe,
        "phantom_gains_pct": naive_ret - prob_ret,
        "avg_slippage_per_trade": avg_slip,
        "total_extra_cost_probabilistic": p_slip + extra_comm,
    }
