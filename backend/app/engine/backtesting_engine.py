from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from app.engine.data_handler import HistoricalDataHandler
from app.engine.events import EventType, FillEvent, MarketEvent, OrderEvent, SignalEvent
from app.engine.execution_handler import ExecutionHandler
from app.engine.fill_models import NaiveFillModel, ProbabilisticFillModel
from app.engine.portfolio import PortfolioManager
from app.engine.ring_buffer import RingBuffer


@dataclass
class BacktestResult:
    equity_curve: list[dict[str, Any]]
    trade_log: list[dict[str, Any]]
    performance_metrics: dict[str, float]
    ring_buffer_avg_latency_ns: float
    ring_buffer_total_puts: int
    total_bars_processed: int
    total_execution_time_ms: float


class BacktestingEngine:
    def __init__(
        self,
        data_handler: HistoricalDataHandler,
        strategy: Any,
        portfolio: PortfolioManager,
        execution_handler: ExecutionHandler,
        ring_buffer: RingBuffer,
    ) -> None:
        self.data_handler = data_handler
        self.strategy = strategy
        self.portfolio = portfolio
        self.execution_handler = execution_handler
        self.ring_buffer = ring_buffer
        self._last_market: dict[str, MarketEvent] = {}

    def run(self) -> BacktestResult:
        t0 = time.perf_counter()
        bars = 0
        while self.data_handler.has_more_data():
            self.data_handler.update_bars(self.ring_buffer)
            bars += 1
            while not self.ring_buffer.is_empty():
                ev = self.ring_buffer.get()
                if ev is None:
                    break
                et = ev.type if hasattr(ev, "type") else None
                if et == EventType.MARKET:
                    assert isinstance(ev, MarketEvent)
                    self._last_market[ev.symbol] = ev
                    self.portfolio.update_market_price(ev.symbol, float(ev.close))
                    self.strategy.calculate_signals(ev)
                elif et == EventType.SIGNAL:
                    assert isinstance(ev, SignalEvent)
                    order = self.portfolio.generate_order(ev)
                    if order is not None:
                        self.ring_buffer.put(order)
                elif et == EventType.ORDER:
                    assert isinstance(ev, OrderEvent)
                    mkt = self._last_market.get(ev.symbol)
                    if mkt is None:
                        continue
                    fill = self.execution_handler.execute_order(ev, mkt)
                    if fill is not None:
                        self.ring_buffer.put(fill)
                elif et == EventType.FILL:
                    assert isinstance(ev, FillEvent)
                    self.portfolio.process_fill(ev)

            last = self._last_market.get(self.strategy.symbol)
            self.portfolio.record_equity_point(last.timestamp if last else None)

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return BacktestResult(
            equity_curve=list(self.portfolio.equity_curve),
            trade_log=list(self.portfolio.trade_log),
            performance_metrics=self.portfolio.get_performance_metrics(),
            ring_buffer_avg_latency_ns=float(self.ring_buffer.average_latency_ns),
            ring_buffer_total_puts=int(self.ring_buffer.total_puts),
            total_bars_processed=bars,
            total_execution_time_ms=float(elapsed_ms),
        )


def build_fill_model(name: str) -> NaiveFillModel | ProbabilisticFillModel:
    n = (name or "naive").lower().strip()
    if n == "probabilistic":
        return ProbabilisticFillModel()
    return NaiveFillModel()
