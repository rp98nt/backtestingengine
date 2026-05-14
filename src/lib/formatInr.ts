/** Primary monetary display for defence checklist (SECTION 0.A — ₹ formatting). */

export function formatInr(amount: number, fractionDigits = 0): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(fractionDigits)}`;
  }
}

/** Compare-fills API: some fields are currency, others are ratios. */
export function formatComparisonMetric(key: string, value: number): string {
  if (
    key === "avg_slippage_per_trade" ||
    key === "total_extra_cost_probabilistic"
  ) {
    return formatInr(value, 2);
  }
  return value.toFixed(6);
}
