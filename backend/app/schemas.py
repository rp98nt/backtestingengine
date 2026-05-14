from pydantic import BaseModel, Field


class OHLCVRow(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class OHLCVResponse(BaseModel):
    symbol: str
    data: list[OHLCVRow]


class TableResponse(BaseModel):
    symbol: str
    rows: list[OHLCVRow]
    total_count: int


class ImportResponse(BaseModel):
    status: str
    symbol: str
    bars_imported: int
