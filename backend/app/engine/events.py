from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class EventType(str, Enum):
    MARKET = "MARKET"
    SIGNAL = "SIGNAL"
    ORDER = "ORDER"
    FILL = "FILL"


@dataclass
class MarketEvent:
    type: EventType = EventType.MARKET
    symbol: str = ""
    timestamp: datetime | None = None
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: float = 0.0
    bid: float = 0.0
    ask: float = 0.0


@dataclass
class SignalEvent:
    type: EventType = EventType.SIGNAL
    symbol: str = ""
    timestamp: datetime | None = None
    signal_type: str = ""  # LONG, SHORT, EXIT
    strength: float = 0.0


@dataclass
class OrderEvent:
    type: EventType = EventType.ORDER
    symbol: str = ""
    timestamp: datetime | None = None
    order_type: str = "MARKET"
    direction: str = ""  # BUY, SELL
    quantity: float = 0.0
    limit_price: float | None = None


@dataclass
class FillEvent:
    type: EventType = EventType.FILL
    symbol: str = ""
    timestamp: datetime | None = None
    direction: str = ""
    quantity: float = 0.0
    fill_price: float = 0.0
    commission: float = 0.0
    slippage: float = 0.0
