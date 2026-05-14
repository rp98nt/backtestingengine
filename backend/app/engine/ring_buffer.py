from __future__ import annotations

import time
from typing import Any

from app.engine.events import MarketEvent, OrderEvent, SignalEvent


class BufferFullError(Exception):
    pass


class RingBuffer:
    """Pre-allocated ring buffer (thesis contribution 1)."""

    def __init__(self, capacity: int = 4096) -> None:
        if capacity < 2 or (capacity & (capacity - 1)) != 0:
            raise ValueError("capacity must be a power of 2 >= 2")
        self._capacity = capacity
        self._mask = capacity - 1
        self._buf: list[Any] = [None] * capacity
        self._head = 0
        self._tail = 0
        self.total_puts = 0
        self.total_gets = 0
        self.total_processing_time_ns = 0

    @property
    def capacity(self) -> int:
        return self._capacity

    @property
    def size(self) -> int:
        return self._head - self._tail

    def is_empty(self) -> bool:
        return self._head == self._tail

    def is_full(self) -> bool:
        return self._head - self._tail >= self._capacity

    def put(self, event: MarketEvent | SignalEvent | OrderEvent | Any) -> None:
        if self.is_full():
            raise BufferFullError("ring buffer full")
        idx = self._head & self._mask
        self._buf[idx] = event
        self._head += 1
        self.total_puts += 1

    def get(self) -> Any:
        if self.is_empty():
            return None
        t0 = time.perf_counter_ns()
        idx = self._tail & self._mask
        ev = self._buf[idx]
        self._buf[idx] = None
        self._tail += 1
        self.total_gets += 1
        self.total_processing_time_ns += time.perf_counter_ns() - t0
        return ev

    @property
    def average_latency_ns(self) -> float:
        if self.total_gets <= 0:
            return 0.0
        return self.total_processing_time_ns / self.total_gets


class StandardQueueWrapper:
    """Baseline queue.Queue with RingBuffer-like interface + latency metrics."""

    def __init__(self, capacity: int = 4096) -> None:
        import queue

        self._q: queue.Queue = queue.Queue(maxsize=capacity)
        self._capacity = capacity
        self.total_puts = 0
        self.total_gets = 0
        self.total_processing_time_ns = 0

    @property
    def capacity(self) -> int:
        return self._capacity

    @property
    def size(self) -> int:
        return self._q.qsize()

    def is_empty(self) -> bool:
        return self._q.empty()

    def is_full(self) -> bool:
        return self._q.full()

    def put(self, event: Any) -> None:
        self._q.put(event, block=True)
        self.total_puts += 1

    def get(self) -> Any:
        t0 = time.perf_counter_ns()
        try:
            ev = self._q.get(block=False)
        except Exception:
            return None
        self.total_gets += 1
        self.total_processing_time_ns += time.perf_counter_ns() - t0
        return ev

    @property
    def average_latency_ns(self) -> float:
        if self.total_gets <= 0:
            return 0.0
        return self.total_processing_time_ns / self.total_gets
