from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.engine.events import FillEvent, OrderEvent, SignalEvent
from app.engine.ring_buffer import RingBuffer


@dataclass
class PortfolioManager:
    initial_capital: float
    ring_buffer: RingBuffer
    cash: float = field(init=False)
    positions: dict[str, float] = field(default_factory=dict)
    position_costs: dict[str, float] = field(default_factory=dict)
    current_prices: dict[str, float] = field(default_factory=dict)
    equity_curve: list[dict[str, Any]] = field(default_factory=list)
    trade_log: list[dict[str, Any]] = field(default_factory=list)
    _fills_sequence: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.cash = self.initial_capital

    def update_market_price(self, symbol: str, price: float) -> None:
        self.current_prices[symbol] = price

    def calculate_portfolio_value(self) -> float:
        pos_val = sum(self.positions.get(s, 0.0) * self.current_prices.get(s, 0.0) for s in self.positions)
        return self.cash + pos_val

    def generate_order(self, signal: SignalEvent) -> OrderEvent | None:
        price = self.current_prices.get(signal.symbol) or 1.0
        qty = (self.initial_capital * signal.strength * 0.1) / max(price, 1e-9)
        qty = max(qty, 0.0)
        if signal.signal_type == "LONG":
            direction = "BUY"
        elif signal.signal_type == "SHORT":
            direction = "SELL"
        else:  # EXIT
            held = self.positions.get(signal.symbol, 0.0)
            if abs(held) < 1e-9:
                return None
            direction = "SELL" if held > 0 else "BUY"
            qty = abs(held)
        if qty < 1e-9:
            return None
        return OrderEvent(
            symbol=signal.symbol,
            timestamp=signal.timestamp,
            order_type="MARKET",
            direction=direction,
            quantity=qty,
        )

    def process_fill(self, fill: FillEvent) -> None:
        q = fill.quantity
        px = fill.fill_price
        notional = px * q
        comm = fill.commission
        if fill.direction == "BUY":
            self.cash -= notional + comm
            self.positions[fill.symbol] = self.positions.get(fill.symbol, 0.0) + q
        else:
            self.cash += notional - comm
            self.positions[fill.symbol] = self.positions.get(fill.symbol, 0.0) - q
        self.trade_log.append(
            {
                "timestamp": fill.timestamp.isoformat() if fill.timestamp else None,
                "symbol": fill.symbol,
                "direction": fill.direction,
                "quantity": q,
                "price": px,
                "commission": comm,
                "slippage": fill.slippage,
            }
        )
        self._fills_sequence.append(
            {
                "timestamp": fill.timestamp.isoformat() if fill.timestamp else None,
                "symbol": fill.symbol,
                "direction": fill.direction,
                "quantity": q,
                "price": px,
                "commission": comm,
                "slippage": fill.slippage,
            }
        )

    def record_equity_point(self, timestamp: datetime | None) -> None:
        ts = timestamp.isoformat() if timestamp else None
        pv = self.calculate_portfolio_value()
        pos_val = sum(self.positions.get(s, 0.0) * self.current_prices.get(s, 0.0) for s in self.positions)
        self.equity_curve.append(
            {
                "timestamp": ts,
                "portfolio_value": pv,
                "cash": self.cash,
                "positions_value": pos_val,
            }
        )

    def get_performance_metrics(self) -> dict[str, float]:
        if not self.equity_curve:
            return {
                "total_return": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown": 0.0,
                "win_rate": 0.0,
                "total_trades": 0.0,
                "profit_factor": 0.0,
                "avg_trade_duration": 0.0,
            }
        start = self.initial_capital
        end = self.equity_curve[-1]["portfolio_value"]
        total_return = (end - start) / start if start else 0.0

        rets: list[float] = []
        for i in range(1, len(self.equity_curve)):
            p0 = self.equity_curve[i - 1]["portfolio_value"]
            p1 = self.equity_curve[i]["portfolio_value"]
            if p0 > 0:
                rets.append((p1 - p0) / p0)
        mean_r = sum(rets) / len(rets) if rets else 0.0
        var = sum((r - mean_r) ** 2 for r in rets) / len(rets) if rets else 0.0
        std = math.sqrt(var) if var > 0 else 0.0
        sharpe = (mean_r / std * math.sqrt(252)) if std > 1e-12 else 0.0

        peak = start
        max_dd = 0.0
        for pt in self.equity_curve:
            v = pt["portfolio_value"]
            peak = max(peak, v)
            dd = (v - peak) / peak if peak else 0.0
            max_dd = min(max_dd, dd)

        trades = self._fills_sequence
        total_trades = float(len(trades))

        return {
            "total_return": float(total_return),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "win_rate": 0.0,
            "total_trades": total_trades,
            "profit_factor": 0.0,
            "avg_trade_duration": 0.0,
        }
