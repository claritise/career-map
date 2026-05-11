const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const INT = new Intl.NumberFormat("en-US");

/** Placeholder when wage/employment data is missing from BLS. */
export const UNKNOWN = "—";

export function formatUsd(amount: number): string {
  return USD.format(amount);
}

export function formatInt(value: number): string {
  return INT.format(value);
}

/** Null-tolerant wage formatter — renders the en-dash placeholder for null. */
export function formatUsdOrUnknown(amount: number | null): string {
  return amount === null ? UNKNOWN : USD.format(amount);
}

/** Null-tolerant integer formatter. */
export function formatIntOrUnknown(value: number | null): string {
  return value === null ? UNKNOWN : INT.format(value);
}

/**
 * Format a wage delta with an explicit `+` sign for positive values.
 * Treats `-0` as `0` so the rendered string ("$0") agrees with `wageDeltaTone(-0) === "neutral"`.
 * Returns UNKNOWN for null (origin or neighbour wage missing).
 */
export function formatWageDelta(delta: number | null): string {
  if (delta === null) return UNKNOWN;
  if (delta === 0) return USD.format(0);
  return delta > 0 ? `+${USD.format(delta)}` : USD.format(delta);
}

/** Convert a 0..1 similarity score to an integer percentage (0..100). */
export function formatSimilarityPercent(similarity: number): number {
  return Math.round(similarity * 100);
}

export type WageDeltaTone = "up" | "down" | "neutral";

/** Null delta → 'neutral'; matches what formatWageDelta does for null (UNKNOWN). */
export function wageDeltaTone(delta: number | null): WageDeltaTone {
  if (delta === null) return "neutral";
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}
