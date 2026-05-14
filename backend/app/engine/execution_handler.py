from __future__ import annotations

from app.engine.events import FillEvent, MarketEvent, OrderEvent
from app.engine.fill_models import NaiveFillModel, ProbabilisticFillModel


class ExecutionHandler:
    def __init__(self, fill_model: NaiveFillModel | ProbabilisticFillModel) -> None:
        self.fill_model = fill_model

    def execute_order(self, order: OrderEvent, market_event: MarketEvent) -> FillEvent | None:
        if isinstance(self.fill_model, NaiveFillModel):
            return self.fill_model.calculate_fill(order, market_event)
        fill, unfilled = self.fill_model.calculate_fill(order, market_event)
        if fill is None:
            return None
        # MVP: ignore partial unfilled remainder for portfolio accounting
        return fill
