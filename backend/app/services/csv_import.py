from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from typing import Any

import pandas as pd


def _strip_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _parse_indian_number(val: Any) -> float:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return float("nan")
    s = str(val).strip()
    if not s or s == "-":
        return float("nan")
    s = re.sub(r",", "", s)
    return float(s)


def _detect_format(df: pd.DataFrame) -> str:
    cols = set(df.columns)
    if "Close Price" in cols and "Open Price" in cols:
        return "nse_equity"
    if "Close" in cols and "Shares Traded" in cols:
        return "nse_index"
    if all(c in cols for c in ("Open", "High", "Low", "Close")) and "Date" in cols:
        return "nse_index"
    raise ValueError(
        "Unrecognized CSV layout. Expected NSE equity (Open Price, Close Price, …) "
        "or index (Date, Open, High, Low, Close, Shares Traded)."
    )


def parse_ohlcv_csv(content: bytes) -> pd.DataFrame:
    """Return DataFrame columns: bar_at (UTC tz-aware), open, high, low, close, volume."""
    raw = pd.read_csv(io.BytesIO(content))
    df = _strip_cols(raw)
    fmt = _detect_format(df)

    if fmt == "nse_equity":
        date_col = "Date" if "Date" in df.columns else None
        if date_col is None:
            raise ValueError("Equity CSV missing Date column")
        out = pd.DataFrame(
            {
                "bar_at": pd.to_datetime(df[date_col], format="mixed", dayfirst=True, utc=True),
                "open": df["Open Price"].map(_parse_indian_number),
                "high": df["High Price"].map(_parse_indian_number),
                "low": df["Low Price"].map(_parse_indian_number),
                "close": df["Close Price"].map(_parse_indian_number),
                "volume": df["Total Traded Quantity"].map(_parse_indian_number),
            }
        )
    else:
        date_col = "Date"
        out = pd.DataFrame(
            {
                "bar_at": pd.to_datetime(df[date_col], format="mixed", dayfirst=True, utc=True),
                "open": df["Open"].map(_parse_indian_number),
                "high": df["High"].map(_parse_indian_number),
                "low": df["Low"].map(_parse_indian_number),
                "close": df["Close"].map(_parse_indian_number),
                "volume": df["Shares Traded"].map(_parse_indian_number),
            }
        )

    out = out.dropna(subset=["bar_at", "open", "high", "low", "close"])
    out = out.sort_values("bar_at")
    out["volume"] = out["volume"].fillna(0)
    return out


def bars_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for _, r in df.iterrows():
        ts: pd.Timestamp = r["bar_at"]
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        else:
            ts = ts.tz_convert("UTC")
        bar_at = datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc)
        rows.append(
            {
                "bar_at": bar_at,
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": float(r["volume"]),
            }
        )
    return rows
