from __future__ import annotations

from app.engine.events import FillEvent, MarketEvent, OrderEvent


class NaiveFillModel:
    """Fill at market_event open, 0.1% commission on notional, zero slippage."""

    def calculate_fill(self, order: OrderEvent, market_event: MarketEvent) -> FillEvent:
        fill_price = float(market_event.open)
        commission = fill_price * order.quantity * 0.001
        return FillEvent(
            symbol=order.symbol,
            timestamp=market_event.timestamp,
            direction=order.direction,
            quantity=order.quantity,
            fill_price=fill_price,
            commission=commission,
            slippage=0.0,
        )


class ProbabilisticFillModel:
    """Bid/ask, participation slippage, partial caps, optional LIMIT touch rules."""

    def __init__(
        self,
        spread_pct: float = 0.001,
        slippage_factor: float = 0.1,
        max_participation_rate: float = 0.05,
    ) -> None:
        self.spread_pct = spread_pct
        self.slippage_factor = slippage_factor
        self.max_participation_rate = max_participation_rate

    def calculate_fill(self, order: OrderEvent, market_event: MarketEvent) -> tuple[FillEvent | None, float]:
        vol = float(market_event.volume) or 1e-9
        if order.order_type == "LIMIT" and order.limit_price is not None:
            if order.direction == "BUY" and float(market_event.low) > order.limit_price:
                return None, order.quantity
            if order.direction == "SELL" and float(market_event.high) < order.limit_price:
                return None, order.quantity

        max_fillable = vol * self.max_participation_rate
        filled_qty = min(order.quantity, max_fillable)
        unfilled = order.quantity - filled_qty
        if filled_qty <= 0:
            return None, order.quantity

        bid = float(market_event.bid)
        ask = float(market_event.ask)
        base = ask if order.direction == "BUY" else bid
        participation_rate = filled_qty / vol
        slippage_pct = self.slippage_factor * participation_rate
        if order.direction == "BUY":
            fill_price = base * (1.0 + slippage_pct)
        else:
            fill_price = base * (1.0 - slippage_pct)

        commission = fill_price * filled_qty * 0.001
        theoretical = base
        slippage = abs(fill_price - theoretical) * filled_qty
        return (
            FillEvent(
                symbol=order.symbol,
                timestamp=market_event.timestamp,
                direction=order.direction,
                quantity=filled_qty,
                fill_price=fill_price,
                commission=commission,
                slippage=slippage,
            ),
            unfilled,
        )
