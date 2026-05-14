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
