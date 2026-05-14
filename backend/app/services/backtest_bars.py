from __future__ import annotations

from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.events import MarketEvent
from app.models import Instrument, OHLCVBar


def _parse_day(d: str | None) -> date | None:
    if not d or not str(d).strip():
        return None
    return date.fromisoformat(str(d).strip())


def _day_start_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _day_end_utc(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=timezone.utc)


async def load_market_events(
    session: AsyncSession,
    symbol_key: str,
    start_date: str | None = None,
    end_date: str | None = None,
    spread_half_pct: float = 0.0005,
) -> tuple[list[MarketEvent], str]:
    """Load ascending OHLCV from Neon as `MarketEvent` rows (bid/ask from close for fills)."""
    symbol_key = symbol_key.strip().upper()
    r = await session.execute(select(Instrument).where(Instrument.symbol_key == symbol_key))
    inst = r.scalar_one_or_none()
    if not inst:
        raise ValueError(f"No instrument {symbol_key}")

    q = select(OHLCVBar).where(OHLCVBar.instrument_id == inst.id)
    sd, ed = _parse_day(start_date), _parse_day(end_date)
    if sd is not None:
        q = q.where(OHLCVBar.bar_at >= _day_start_utc(sd))
    if ed is not None:
        q = q.where(OHLCVBar.bar_at <= _day_end_utc(ed))
    q = q.order_by(OHLCVBar.bar_at.asc())

    bars = (await session.execute(q)).scalars().all()
    out: list[MarketEvent] = []
    sh = spread_half_pct
    for b in bars:
        c = float(b.close)
        bid = c * (1.0 - sh)
        ask = c * (1.0 + sh)
        out.append(
            MarketEvent(
                symbol=symbol_key,
                timestamp=b.bar_at,
                open=float(b.open),
                high=float(b.high),
                low=float(b.low),
                close=c,
                volume=float(b.volume),
                bid=bid,
                ask=ask,
            )
        )
    return out, symbol_key
