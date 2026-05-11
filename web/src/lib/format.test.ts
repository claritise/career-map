import { describe, expect, it } from "vitest";
import {
  formatInt,
  formatSimilarityPercent,
  formatUsd,
  formatWageDelta,
  wageDeltaTone,
} from "./format";

describe("formatUsd", () => {
  it("formats a positive integer as USD with no decimals", () => {
    expect(formatUsd(60000)).toBe("$60,000");
  });

  it("formats zero", () => {
    expect(formatUsd(0)).toBe("$0");
  });

  it("formats negative values with a minus sign", () => {
    expect(formatUsd(-12000)).toBe("-$12,000");
  });
});

describe("formatInt", () => {
  it("inserts comma separators for thousands", () => {
    expect(formatInt(1234567)).toBe("1,234,567");
  });

  it("handles zero", () => {
    expect(formatInt(0)).toBe("0");
  });
});

describe("formatWageDelta", () => {
  it("prefixes a `+` for positive deltas", () => {
    expect(formatWageDelta(15000)).toBe("+$15,000");
  });

  it("returns plain $0 for a zero delta (no sign)", () => {
    expect(formatWageDelta(0)).toBe("$0");
  });

  it("keeps Intl's `-` for negative deltas (no extra prefix)", () => {
    expect(formatWageDelta(-8000)).toBe("-$8,000");
  });
});

describe("formatSimilarityPercent", () => {
  it("maps 0.6 -> 60", () => {
    expect(formatSimilarityPercent(0.6)).toBe(60);
  });

  it("maps 0.95 -> 95", () => {
    expect(formatSimilarityPercent(0.95)).toBe(95);
  });

  it("rounds 0.876 -> 88", () => {
    expect(formatSimilarityPercent(0.876)).toBe(88);
  });

  it("rounds 0 -> 0 and 1 -> 100", () => {
    expect(formatSimilarityPercent(0)).toBe(0);
    expect(formatSimilarityPercent(1)).toBe(100);
  });
});

describe("wageDeltaTone", () => {
  it("returns 'up' for positive", () => {
    expect(wageDeltaTone(1)).toBe("up");
    expect(wageDeltaTone(100000)).toBe("up");
  });

  it("returns 'down' for negative", () => {
    expect(wageDeltaTone(-1)).toBe("down");
    expect(wageDeltaTone(-50000)).toBe("down");
  });

  it("returns 'neutral' for exactly zero", () => {
    expect(wageDeltaTone(0)).toBe("neutral");
  });

  it("returns 'neutral' for -0 (avoids a sign-only mismatch with formatWageDelta)", () => {
    expect(wageDeltaTone(-0)).toBe("neutral");
  });

  it("returns 'neutral' for NaN (neither >0 nor <0)", () => {
    expect(wageDeltaTone(NaN)).toBe("neutral");
  });
});

describe("formatWageDelta — sign agreement with wageDeltaTone", () => {
  it("renders -0 as $0 (no minus sign), matching the 'neutral' tone", () => {
    expect(formatWageDelta(-0)).toBe("$0");
  });

  it("renders 0 as $0 (no plus sign)", () => {
    expect(formatWageDelta(0)).toBe("$0");
  });
});

describe("format helpers — degenerate inputs", () => {
  // These are not expected runtime values, but documenting current behavior
  // so any future "guard at the boundary" decision is intentional rather than drift.
  it("formatUsd(NaN) returns '$NaN'", () => {
    expect(formatUsd(NaN)).toBe("$NaN");
  });

  it("formatWageDelta(NaN) returns '$NaN'", () => {
    expect(formatWageDelta(NaN)).toBe("$NaN");
  });

  it("formatSimilarityPercent(NaN) returns NaN", () => {
    expect(Number.isNaN(formatSimilarityPercent(NaN))).toBe(true);
  });
});
