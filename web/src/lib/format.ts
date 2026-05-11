const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const INT = new Intl.NumberFormat("en-US");

export function formatUsd(amount: number): string {
  return USD.format(amount);
}

export function formatInt(value: number): string {
  return INT.format(value);
}

/**
 * Format a wage delta with an explicit `+` sign for positive values.
 * Treats `-0` as `0` so the rendered string ("$0") agrees with `wageDeltaTone(-0) === "neutral"`.
 */
export function formatWageDelta(delta: number): string {
  if (delta === 0) return USD.format(0);
  return delta > 0 ? `+${USD.format(delta)}` : USD.format(delta);
}

/** Convert a 0..1 similarity score to an integer percentage (0..100). */
export function formatSimilarityPercent(similarity: number): number {
  return Math.round(similarity * 100);
}

export type WageDeltaTone = "up" | "down" | "neutral";

export function wageDeltaTone(delta: number): WageDeltaTone {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}
