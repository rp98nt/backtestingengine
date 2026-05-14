from typing import Any

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


class BacktestRunRequest(BaseModel):
    strategy: str = Field(default="sma_crossover")
    symbols: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None
    initial_capital: float = Field(default=1_000_000.0, gt=0)
    fill_model: str = Field(default="naive")
    strategy_params: dict = Field(default_factory=dict)


class BacktestRunStartResponse(BaseModel):
    backtest_id: str
    status: str


class BacktestRunResultResponse(BaseModel):
    backtest_id: str
    status: str
    config: dict
    performance_metrics: dict[str, Any]
    equity_curve: list[dict]
    trade_log: list[dict]
    engine_metrics: dict[str, Any]


class BacktestCompareRequest(BaseModel):
    strategy: str = Field(default="sma_crossover")
    symbols: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None
    initial_capital: float = Field(default=1_000_000.0, gt=0)
    strategy_params: dict = Field(default_factory=dict)


class BacktestCompareResponse(BaseModel):
    comparison_group_id: str
    naive_backtest_id: str
    probabilistic_backtest_id: str
    naive_result: dict[str, Any]
    probabilistic_result: dict[str, Any]
    comparison: dict[str, float]


class BenchmarkRunResponse(BaseModel):
    ring_buffer: dict[str, float]
    standard_queue: dict[str, float]
    speedup_factor: float
    latency_reduction_pct: float
