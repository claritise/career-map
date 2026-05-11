import { describe, expect, it } from "vitest";
import {
  LAYOUT_SPACE,
  MOCK_NEIGHBOUR_MAX,
  MOCK_NEIGHBOUR_MIN,
  MOCK_RNG_SEED,
  SIMILARITY_CEILING,
  SIMILARITY_FLOOR,
} from "./constants";
import {
  generateMockDataset,
  layoutBySlug,
  neighboursBySlug,
  occupations,
  occupationsBySlug,
} from "./mock-data";

describe("mock dataset — invariants", () => {
  it("every slug is unique", () => {
    const slugs = occupations.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("occupationsBySlug round-trips every occupation", () => {
    for (const o of occupations) {
      expect(occupationsBySlug[o.slug]).toBe(o);
    }
    expect(Object.keys(occupationsBySlug).length).toBe(occupations.length);
  });

  it("every occupation has a layout entry, with coordinates inside LAYOUT_SPACE bounds", () => {
    for (const o of occupations) {
      const layout = layoutBySlug[o.slug];
      expect(layout).toBeDefined();
      expect(layout!.x).toBeGreaterThanOrEqual(LAYOUT_SPACE.min);
      expect(layout!.x).toBeLessThanOrEqual(LAYOUT_SPACE.max);
      expect(layout!.y).toBeGreaterThanOrEqual(LAYOUT_SPACE.min);
      expect(layout!.y).toBeLessThanOrEqual(LAYOUT_SPACE.max);
    }
  });

  it("every neighbour slug points to an existing occupation", () => {
    for (const [originSlug, ns] of Object.entries(neighboursBySlug)) {
      expect(occupationsBySlug[originSlug]).toBeDefined();
      for (const n of ns) {
        expect(occupationsBySlug[n.slug]).toBeDefined();
        expect(n.slug).not.toBe(originSlug);
      }
    }
  });

  it("neighbour wage and wageDelta are consistent with occupations[]", () => {
    for (const [originSlug, ns] of Object.entries(neighboursBySlug)) {
      const origin = occupationsBySlug[originSlug]!;
      for (const n of ns) {
        const target = occupationsBySlug[n.slug]!;
        expect(n.wage).toBe(target.wage);
        expect(n.wageDelta).toBe(target.wage - origin.wage);
      }
    }
  });

  it("similarity values are in [SIMILARITY_FLOOR, SIMILARITY_CEILING]", () => {
    for (const ns of Object.values(neighboursBySlug)) {
      for (const n of ns) {
        expect(n.similarity).toBeGreaterThanOrEqual(SIMILARITY_FLOOR);
        expect(n.similarity).toBeLessThanOrEqual(SIMILARITY_CEILING);
      }
    }
  });

  it("each origin has between MOCK_NEIGHBOUR_MIN and MOCK_NEIGHBOUR_MAX neighbours", () => {
    for (const ns of Object.values(neighboursBySlug)) {
      expect(ns.length).toBeGreaterThanOrEqual(MOCK_NEIGHBOUR_MIN);
      expect(ns.length).toBeLessThanOrEqual(MOCK_NEIGHBOUR_MAX);
    }
  });

  it("every job zone is in {1, 2, 3, 4}", () => {
    for (const o of occupations) {
      expect([1, 2, 3, 4]).toContain(o.jobZone);
    }
  });

  it("topSkills are non-empty per occupation", () => {
    for (const o of occupations) {
      expect(o.topSkills.length).toBeGreaterThan(0);
    }
  });

  it("Selection.neighbourSlugs (as Constellation builds it) all resolve to real occupations", () => {
    // Mirrors the construction in constellation.tsx: for each origin, build the
    // neighbour slug Set and assert every member exists in occupationsBySlug.
    for (const originSlug of Object.keys(neighboursBySlug)) {
      const neighbourSlugs = new Set(
        (neighboursBySlug[originSlug] ?? []).map((n) => n.slug),
      );
      for (const slug of neighbourSlugs) {
        expect(occupationsBySlug[slug]).toBeDefined();
      }
    }
  });

  it("neighbours are sorted by similarity descending (best first)", () => {
    for (const ns of Object.values(neighboursBySlug)) {
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!.similarity).toBeLessThanOrEqual(ns[i - 1]!.similarity);
      }
    }
  });

  it("no neighbour list contains its own origin", () => {
    for (const [originSlug, ns] of Object.entries(neighboursBySlug)) {
      for (const n of ns) {
        expect(n.slug).not.toBe(originSlug);
      }
    }
  });
});

describe("slug collision suffixing", () => {
  // The generator dedupes colliding slugs with `-2`, `-3`, ... — these tests
  // pin that policy so a future title change doesn't silently break URL shape.
  it("produces unique slugs deterministically across runs with the same seed", () => {
    const a = generateMockDataset(MOCK_RNG_SEED);
    const b = generateMockDataset(MOCK_RNG_SEED);
    expect(a.occupations.map((o) => o.slug)).toEqual(
      b.occupations.map((o) => o.slug),
    );
  });

  it("dedupes colliding titles with -2, -3, ... suffixes (verified against a duplicate-title fixture)", () => {
    // Use a custom cluster set with the same title repeated to force the
    // suffixing branch — the production CLUSTERS have no duplicates so the
    // policy is otherwise untested.
    const duplicateClusters = [
      {
        id: 0,
        label: "Test A",
        cx: 100,
        cy: 100,
        spread: 20,
        jobZoneRange: [2, 3] as [number, number],
        wageRange: [40000, 80000] as [number, number],
        titles: ["Project Manager", "Project Manager", "Project Manager"],
        skills: ["A", "B", "C", "D", "E", "F", "G", "H"],
        blurb: (t: string) => `${t} blurb`,
      },
    ];
    const dataset = generateMockDataset(MOCK_RNG_SEED, duplicateClusters);
    const slugs = dataset.occupations.map((o) => o.slug);
    expect(slugs).toEqual([
      "project-manager",
      "project-manager-2",
      "project-manager-3",
    ]);
    // Suffix policy is deterministic across runs with the same seed.
    const second = generateMockDataset(MOCK_RNG_SEED, duplicateClusters);
    expect(second.occupations.map((o) => o.slug)).toEqual(slugs);
  });
});

describe("generateMockDataset — determinism", () => {
  it("same seed produces identical occupations and neighbours", () => {
    const a = generateMockDataset(MOCK_RNG_SEED);
    const b = generateMockDataset(MOCK_RNG_SEED);
    expect(a.occupations).toEqual(b.occupations);
    expect(a.layoutBySlug).toEqual(b.layoutBySlug);
    expect(a.neighboursBySlug).toEqual(b.neighboursBySlug);
  });

  it("different seeds produce different layouts", () => {
    const a = generateMockDataset(1);
    const b = generateMockDataset(2);
    // At least one occupation should land at a different position.
    const aLayouts = Object.entries(a.layoutBySlug);
    const differs = aLayouts.some(([slug, l]) => {
      const bl = b.layoutBySlug[slug];
      return bl?.x !== l.x || bl?.y !== l.y;
    });
    expect(differs).toBe(true);
  });
});
