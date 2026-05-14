from __future__ import annotations

from app.engine.events import EventType, MarketEvent, SignalEvent


class SMACrossoverStrategy:
    """SMA crossover: cross up → LONG; cross down → EXIT (spec SECTION 3)."""

    def __init__(
        self,
        symbol: str,
        ring_buffer,
        short_window: int = 20,
        long_window: int = 50,
    ) -> None:
        if short_window >= long_window:
            raise ValueError("short_window must be < long_window")
        self.symbol = symbol
        self._buf = ring_buffer
        self.short_window = short_window
        self.long_window = long_window
        self._closes: list[float] = []

    def calculate_signals(self, market_event: MarketEvent) -> None:
        if market_event.symbol != self.symbol:
            return
        self._closes.append(float(market_event.close))
        L = len(self._closes)
        if L <= self.long_window:
            return

        c = self._closes
        fast_prev = sum(c[-self.short_window - 1 : -1]) / self.short_window
        slow_prev = sum(c[-self.long_window - 1 : -1]) / self.long_window
        fast_curr = sum(c[-self.short_window :]) / self.short_window
        slow_curr = sum(c[-self.long_window :]) / self.long_window

        ts = market_event.timestamp
        if fast_prev < slow_prev and fast_curr > slow_curr:
            self._buf.put(
                SignalEvent(
                    type=EventType.SIGNAL,
                    symbol=self.symbol,
                    timestamp=ts,
                    signal_type="LONG",
                    strength=1.0,
                )
            )
        elif fast_prev > slow_prev and fast_curr < slow_curr:
            self._buf.put(
                SignalEvent(
                    type=EventType.SIGNAL,
                    symbol=self.symbol,
                    timestamp=ts,
                    signal_type="EXIT",
                    strength=1.0,
                )
            )
