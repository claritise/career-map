import { describe, expect, it } from "vitest";
import { MOCK_TOP_SKILL_MIN } from "./constants";
import { CLUSTERS } from "./mock-data-clusters";

describe("CLUSTERS invariants", () => {
  it("every cluster's id matches its array index", () => {
    expect(CLUSTERS.map((c) => c.id)).toEqual(
      CLUSTERS.map((_, i) => i),
    );
  });

  it("every cluster id is unique", () => {
    const ids = CLUSTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every cluster label is unique", () => {
    const labels = CLUSTERS.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every cluster has at least MOCK_TOP_SKILL_MIN skills (so pickN can sample MIN..MAX)", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.skills.length).toBeGreaterThanOrEqual(MOCK_TOP_SKILL_MIN);
    }
  });

  it("every cluster has at least one title", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.titles.length).toBeGreaterThan(0);
    }
  });

  it("every cluster's jobZoneRange and wageRange are non-empty intervals", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.jobZoneRange[0]).toBeLessThanOrEqual(
        cluster.jobZoneRange[1],
      );
      expect(cluster.wageRange[0]).toBeLessThan(cluster.wageRange[1]);
    }
  });

  it("every cluster's jobZoneRange is within [1, 4] (the Occupation.jobZone union)", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.jobZoneRange[0]).toBeGreaterThanOrEqual(1);
      expect(cluster.jobZoneRange[0]).toBeLessThanOrEqual(4);
      expect(cluster.jobZoneRange[1]).toBeGreaterThanOrEqual(1);
      expect(cluster.jobZoneRange[1]).toBeLessThanOrEqual(4);
    }
  });

  it("every cluster center is inside the layout space (sanity bound 0..1000)", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.cx).toBeGreaterThanOrEqual(0);
      expect(cluster.cx).toBeLessThanOrEqual(1000);
      expect(cluster.cy).toBeGreaterThanOrEqual(0);
      expect(cluster.cy).toBeLessThanOrEqual(1000);
      expect(cluster.spread).toBeGreaterThan(0);
    }
  });
});
