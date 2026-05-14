// AlphaTest native MVP: power-of-two ring buffer + bounded deque baseline,
// single-thread burst workload (SECTION 0.B — Contribution 1 microbench).

#include <pybind11/pybind11.h>
#include <chrono>
#include <cstdint>
#include <deque>
#include <stdexcept>
#include <string>
#include <vector>

namespace py = pybind11;

struct EventPod {
  int kind{0};
  double payload{0.0};
};

class NativeRingBuffer {
  int capacity_{};
  int mask_{};
  std::vector<EventPod> buf_;
  int64_t head_{0};
  int64_t tail_{0};

 public:
  int64_t total_puts{0};
  int64_t total_gets{0};
  int64_t total_get_ns{0};

  explicit NativeRingBuffer(int capacity) : capacity_(capacity) {
    if (capacity < 2 || (capacity & (capacity - 1)))
      throw std::invalid_argument("capacity must be a power of 2 >= 2");
    mask_ = capacity - 1;
    buf_.assign(static_cast<size_t>(capacity), EventPod{});
  }

  [[nodiscard]] bool is_empty() const { return head_ == tail_; }
  [[nodiscard]] bool is_full() const { return (head_ - tail_) >= capacity_; }

  void put(const EventPod& e) {
    if (is_full()) throw std::runtime_error("ring buffer full");
    buf_[static_cast<size_t>(head_ & mask_)] = e;
    ++head_;
    ++total_puts;
  }

  bool try_get(EventPod& out) {
    if (is_empty()) return false;
    const auto t0 = std::chrono::steady_clock::now();
    const size_t idx = static_cast<size_t>(tail_ & mask_);
    out = buf_[idx];
    buf_[idx] = EventPod{};
    ++tail_;
    ++total_gets;
    const auto t1 = std::chrono::steady_clock::now();
    total_get_ns += std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
    return true;
  }

  [[nodiscard]] double average_latency_ns() const {
    if (total_gets <= 0) return 0.0;
    return static_cast<double>(total_get_ns) / static_cast<double>(total_gets);
  }
};

class BoundedDequeQueue {
  int cap_{};
  std::deque<EventPod> dq_{};

 public:
  int64_t total_puts{0};
  int64_t total_gets{0};
  int64_t total_get_ns{0};

  explicit BoundedDequeQueue(int cap) : cap_(cap) {}

  [[nodiscard]] bool is_full() const { return static_cast<int>(dq_.size()) >= cap_; }
  [[nodiscard]] bool is_empty() const { return dq_.empty(); }

  void put(const EventPod& e) {
    if (is_full()) throw std::runtime_error("queue full");
    dq_.push_back(e);
    ++total_puts;
  }

  bool try_get(EventPod& out) {
    if (is_empty()) return false;
    const auto t0 = std::chrono::steady_clock::now();
    out = dq_.front();
    dq_.pop_front();
    ++total_gets;
    const auto t1 = std::chrono::steady_clock::now();
    total_get_ns += std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
    return true;
  }

  [[nodiscard]] double average_latency_ns() const {
    if (total_gets <= 0) return 0.0;
    return static_cast<double>(total_get_ns) / static_cast<double>(total_gets);
  }
};

struct BenchMetrics {
  double avg_latency_ns{0};
  double total_time_ms{0};
  double throughput_events_per_sec{0};
  int64_t total_puts{0};
  int64_t total_gets{0};
};

static void run_burst_workload(NativeRingBuffer& rb, int bursts, int burst_size) {
  EventPod ev{1, 0.0};
  for (int b = 0; b < bursts; ++b) {
    for (int i = 0; i < burst_size; ++i) {
      ev.payload = static_cast<double>(b) * 1e9 + static_cast<double>(i);
      rb.put(ev);
    }
    EventPod out{};
    while (rb.try_get(out)) {
    }
  }
}

static void run_burst_workload(BoundedDequeQueue& q, int bursts, int burst_size) {
  EventPod ev{1, 0.0};
  for (int b = 0; b < bursts; ++b) {
    for (int i = 0; i < burst_size; ++i) {
      ev.payload = static_cast<double>(b) * 1e9 + static_cast<double>(i);
      q.put(ev);
    }
    EventPod out{};
    while (q.try_get(out)) {
    }
  }
}

static BenchMetrics measure_ring(int bursts, int burst_size, int capacity) {
  NativeRingBuffer rb(capacity);
  const auto w0 = std::chrono::steady_clock::now();
  run_burst_workload(rb, bursts, burst_size);
  const auto w1 = std::chrono::steady_clock::now();
  const double wall_ms =
      std::chrono::duration<double, std::milli>(w1 - w0).count();
  BenchMetrics m;
  m.avg_latency_ns = rb.average_latency_ns();
  m.total_time_ms = wall_ms;
  m.total_puts = rb.total_puts;
  m.total_gets = rb.total_gets;
  m.throughput_events_per_sec =
      (wall_ms > 1e-9) ? (static_cast<double>(rb.total_puts) / (wall_ms / 1000.0)) : 0.0;
  return m;
}

static BenchMetrics measure_queue(int bursts, int burst_size, int capacity) {
  BoundedDequeQueue q(capacity);
  const auto w0 = std::chrono::steady_clock::now();
  run_burst_workload(q, bursts, burst_size);
  const auto w1 = std::chrono::steady_clock::now();
  const double wall_ms =
      std::chrono::duration<double, std::milli>(w1 - w0).count();
  BenchMetrics m;
  m.avg_latency_ns = q.average_latency_ns();
  m.total_time_ms = wall_ms;
  m.total_puts = q.total_puts;
  m.total_gets = q.total_gets;
  m.throughput_events_per_sec =
      (wall_ms > 1e-9) ? (static_cast<double>(q.total_puts) / (wall_ms / 1000.0)) : 0.0;
  return m;
}

static py::dict metrics_to_dict(const BenchMetrics& m) {
  py::dict d;
  d["avg_latency_ns"] = m.avg_latency_ns;
  d["total_time_ms"] = m.total_time_ms;
  d["throughput_events_per_sec"] = m.throughput_events_per_sec;
  d["total_puts"] = static_cast<double>(m.total_puts);
  d["total_gets"] = static_cast<double>(m.total_gets);
  return d;
}

static py::dict burst_benchmark_pair(int bursts, int burst_size, int capacity) {
  if (capacity < 2 || (capacity & (capacity - 1)))
    throw std::invalid_argument("capacity must be a power of 2 >= 2");
  if (bursts < 1) bursts = 1;
  if (burst_size < 1) burst_size = 1;
  if (burst_size > capacity) burst_size = capacity;

  const BenchMetrics ring = measure_ring(bursts, burst_size, capacity);
  const BenchMetrics que = measure_queue(bursts, burst_size, capacity);

  py::dict out;
  out["ring"] = metrics_to_dict(ring);
  out["queue"] = metrics_to_dict(que);
  out["capacity"] = capacity;
  out["bursts"] = bursts;
  out["burst_size"] = burst_size;
  const double r_lat = ring.avg_latency_ns;
  const double q_lat = que.avg_latency_ns;
  out["speedup_factor"] = (r_lat > 1e-9) ? (q_lat / r_lat) : 1.0;
  out["latency_reduction_pct"] =
      (q_lat > 1e-9) ? ((q_lat - r_lat) / q_lat * 100.0) : 0.0;
  out["implementation"] = std::string("cpp_mvp_engine_native");
  return out;
}

PYBIND11_MODULE(engine_native, m) {
  m.doc() = "AlphaTest native Contribution-1 MVP (ring + bounded deque microbench).";
  m.def("burst_benchmark_pair", &burst_benchmark_pair,
        py::arg("bursts"), py::arg("burst_size"), py::arg("capacity") = 4096);
  m.def("version", [] { return std::string("0.1.0-mvp"); });
}
