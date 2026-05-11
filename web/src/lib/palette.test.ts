import { describe, expect, it } from "vitest";
import { NOISE_CLUSTER_ID } from "./constants";
import { CREAM_TINT, tintForCluster } from "./palette";

describe("tintForCluster", () => {
  it("returns the cream tint for the noise cluster", () => {
    expect(tintForCluster(NOISE_CLUSTER_ID)).toBe(CREAM_TINT);
  });

  it("returns the same tint for the same cluster id (deterministic)", () => {
    const a = tintForCluster(7);
    const b = tintForCluster(7);
    expect(a).toEqual(b);
  });

  it("returns the same tint for cluster ids that map to the same palette slot", () => {
    // The palette has 16 slots; ids 16 apart land on the same slot.
    const a = tintForCluster(3);
    const b = tintForCluster(3 + 16);
    expect(a.saturated).toBe(b.saturated);
  });

  it("returns non-adjacent palette slots for adjacent cluster ids", () => {
    // Mapping is id * 7 mod 16, so adjacent ids are 7 slots apart — never
    // adjacent in the palette ring.
    const a = tintForCluster(5);
    const b = tintForCluster(6);
    expect(a.saturated).not.toBe(b.saturated);
  });

  it("every tint emits valid rgb()/rgba() strings", () => {
    for (let i = 0; i < 20; i++) {
      const tint = tintForCluster(i);
      expect(/^rgb\(\d+, \d+, \d+\)$/.test(tint.saturated)).toBe(true);
      expect(/^rgb\(\d+, \d+, \d+\)$/.test(tint.resting)).toBe(true);
      expect(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/.test(tint.glow)).toBe(true);
    }
  });
});
