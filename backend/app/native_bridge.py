"""Optional C++ Contribution-1 MVP (`engine_native` pybind11 module)."""

from __future__ import annotations

import os
from typing import Any


def use_native_engine() -> bool:
    v = os.environ.get("USE_NATIVE_ENGINE", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def is_native_extension_loaded() -> bool:
    try:
        import engine_native  # noqa: F401

        return True
    except Exception:
        return False


def run_cpp_burst_benchmark(bursts: int, burst_size: int, capacity: int = 4096) -> dict[str, Any]:
    import engine_native

    return dict(engine_native.burst_benchmark_pair(bursts, burst_size, capacity))


def derive_cpp_burst_params(total_puts: int, num_bars: int) -> tuple[int, int]:
    """Scale synthetic burst workload from observed Python engine event volume."""
    tp = max(int(total_puts), max(int(num_bars) * 4, 100))
    burst_size = min(1024, max(8, min(128, tp // 2000 + 8)))
    bursts = max(50, min(8000, tp // max(burst_size, 1)))
    return bursts, burst_size
