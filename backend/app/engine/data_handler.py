from __future__ import annotations

from datetime import datetime

from app.engine.events import EventType, MarketEvent


class HistoricalDataHandler:
    """Feeds one `MarketEvent` per `update_bars()` call from a preloaded list."""

    def __init__(self, events: list[MarketEvent]) -> None:
        self._events = events
        self._index = 0

    def has_more_data(self) -> bool:
        return self._index < len(self._events)

    def update_bars(self, ring_buffer) -> None:
        if not self.has_more_data():
            return
        ev = self._events[self._index]
        self._index += 1
        ev.type = EventType.MARKET
        ring_buffer.put(ev)
