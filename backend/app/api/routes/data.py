from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Instrument, OHLCVBar
from app.schemas import ImportResponse, OHLCVResponse, OHLCVRow, TableResponse
from app.services.csv_import import bars_to_records, parse_ohlcv_csv

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/instruments")
async def list_instruments(session: AsyncSession = Depends(get_session)) -> list[dict]:
    result = await session.execute(select(Instrument).order_by(Instrument.symbol_key))
    instruments = result.scalars().all()
    out: list[dict] = []
    for inst in instruments:
        out.append(
            {
                "symbol": inst.symbol_key,
                "name": inst.display_name or inst.symbol_key,
                "start_date": inst.first_bar_at.date().isoformat() if inst.first_bar_at else None,
                "end_date": inst.last_bar_at.date().isoformat() if inst.last_bar_at else None,
                "total_bars": inst.bar_count,
            }
        )
    return out


@router.post("/import-csv", response_model=ImportResponse)
async def import_csv(
    session: AsyncSession = Depends(get_session),
    file: UploadFile = File(...),
    symbol_key: str = Form(...),
    display_name: str | None = Form(None),
) -> ImportResponse:
    symbol_key = symbol_key.strip().upper()
    if not symbol_key:
        raise HTTPException(status_code=400, detail="symbol_key is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        df = parse_ohlcv_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {e}") from e

    records = bars_to_records(df)
    if not records:
        raise HTTPException(status_code=400, detail="No valid OHLCV rows after parse")

    existing = await session.execute(select(Instrument).where(Instrument.symbol_key == symbol_key))
    inst = existing.scalar_one_or_none()
    if inst:
        await session.delete(inst)
        await session.flush()

    inst = Instrument(
        id=uuid.uuid4(),
        symbol_key=symbol_key,
        display_name=display_name or symbol_key,
        source="csv_import",
        bar_count=len(records),
        first_bar_at=records[0]["bar_at"],
        last_bar_at=records[-1]["bar_at"],
    )
    session.add(inst)
    await session.flush()

    for row in records:
        session.add(
            OHLCVBar(
                id=uuid.uuid4(),
                instrument_id=inst.id,
                bar_at=row["bar_at"],
                open=row["open"],
                high=row["high"],
                low=row["low"],
                close=row["close"],
                volume=row["volume"],
            )
        )

    await session.commit()
    return ImportResponse(status="success", symbol=symbol_key, bars_imported=len(records))


@router.get("/ohlcv/{symbol}", response_model=OHLCVResponse)
async def get_ohlcv(
    symbol: str,
    session: AsyncSession = Depends(get_session),
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 500,
) -> OHLCVResponse:
    symbol = symbol.strip().upper()
    inst = await _get_instrument(session, symbol)

    q = (
        select(OHLCVBar)
        .where(OHLCVBar.instrument_id == inst.id)
        .order_by(OHLCVBar.bar_at.desc())
        .limit(min(limit, 5000))
    )
    bars = (await session.execute(q)).scalars().all()
    bars = list(reversed(bars))

    data = [
        OHLCVRow(
            timestamp=b.bar_at.isoformat(),
            open=float(b.open),
            high=float(b.high),
            low=float(b.low),
            close=float(b.close),
            volume=float(b.volume),
        )
        for b in bars
    ]
    return OHLCVResponse(symbol=symbol, data=data)


@router.get("/ohlcv/{symbol}/table", response_model=TableResponse)
async def get_ohlcv_table(
    symbol: str,
    session: AsyncSession = Depends(get_session),
    limit: int = 100,
    offset: int = 0,
) -> TableResponse:
    symbol = symbol.strip().upper()
    inst = await _get_instrument(session, symbol)

    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    count_q = select(func.count()).select_from(OHLCVBar).where(OHLCVBar.instrument_id == inst.id)
    total = int((await session.execute(count_q)).scalar_one())

    q = (
        select(OHLCVBar)
        .where(OHLCVBar.instrument_id == inst.id)
        .order_by(OHLCVBar.bar_at.asc())
        .offset(offset)
        .limit(limit)
    )
    bars = (await session.execute(q)).scalars().all()

    rows = [
        OHLCVRow(
            timestamp=b.bar_at.isoformat(),
            open=float(b.open),
            high=float(b.high),
            low=float(b.low),
            close=float(b.close),
            volume=float(b.volume),
        )
        for b in bars
    ]
    return TableResponse(symbol=symbol, rows=rows, total_count=total)


async def _get_instrument(session: AsyncSession, symbol: str) -> Instrument:
    r = await session.execute(select(Instrument).where(Instrument.symbol_key == symbol))
    inst = r.scalar_one_or_none()
    if not inst:
        raise HTTPException(
            status_code=404,
            detail=f"No data available for symbol {symbol}. Import CSV first.",
        )
    return inst
