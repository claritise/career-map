import { describe, expect, it } from "vitest";
import { BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import {
  buildNodes,
  pickAnchorSlugs,
  resolveSelectedSlug,
} from "./build-nodes";
import type { Occupation } from "./types";

function occ(slug: string, overrides: Partial<Occupation> = {}): Occupation {
  return {
    soc: `00-${slug}.00`,
    slug,
    title: slug,
    x: 100,
    y: 100,
    wage: 60000,
    employment: 10000,
    jobZone: 2,
    clusterId: 0,
    ...overrides,
  };
}

describe("pickAnchorSlugs", () => {
  it("picks one anchor per cluster (the member closest to centroid)", () => {
    // Two clusters of 4 each, placed far apart.
    const occs = [
      // Cluster 0: centroid is (120,120), so a3 wins.
      occ("a1", { clusterId: 0, x: 100, y: 100 }),
      occ("a2", { clusterId: 0, x: 110, y: 110 }),
      occ("a3", { clusterId: 0, x: 120, y: 120 }),
      occ("a4", { clusterId: 0, x: 150, y: 150 }),
      // Cluster 1: centroid is (840,840), so b3 wins.
      occ("b1", { clusterId: 1, x: 800, y: 800 }),
      occ("b2", { clusterId: 1, x: 810, y: 810 }),
      occ("b3", { clusterId: 1, x: 850, y: 850 }),
      occ("b4", { clusterId: 1, x: 900, y: 900 }),
    ];
    const anchors = pickAnchorSlugs(occs);
    expect(anchors.size).toBe(2);
    expect(anchors.has("a3")).toBe(true);
    expect(anchors.has("b3")).toBe(true);
  });

  it("excludes the noise cluster (-1)", () => {
    const occs = [
      occ("real-1", { clusterId: 0, x: 100, y: 100 }),
      occ("real-2", { clusterId: 0, x: 110, y: 110 }),
      occ("real-3", { clusterId: 0, x: 120, y: 120 }),
      occ("real-4", { clusterId: 0, x: 130, y: 130 }),
      occ("noise-1", { clusterId: -1, x: 500, y: 500 }),
      occ("noise-2", { clusterId: -1, x: 510, y: 510 }),
      occ("noise-3", { clusterId: -1, x: 520, y: 520 }),
      occ("noise-4", { clusterId: -1, x: 530, y: 530 }),
    ];
    const anchors = pickAnchorSlugs(occs);
    expect(anchors.size).toBe(1);
    expect([...anchors].some((s) => s.startsWith("noise"))).toBe(false);
  });

  it("skips clusters smaller than 4 members", () => {
    const occs = [
      occ("big-1", { clusterId: 0, x: 100, y: 100 }),
      occ("big-2", { clusterId: 0, x: 110, y: 110 }),
      occ("big-3", { clusterId: 0, x: 120, y: 120 }),
      occ("big-4", { clusterId: 0, x: 130, y: 130 }),
      occ("small-1", { clusterId: 1, x: 500, y: 500 }),
      occ("small-2", { clusterId: 1, x: 510, y: 510 }),
    ];
    const anchors = pickAnchorSlugs(occs);
    expect(anchors.size).toBe(1);
    expect([...anchors].some((s) => s.startsWith("small"))).toBe(false);
  });

  it("does not mutate the input array", () => {
    const occs = [
      occ("a", { clusterId: 0 }),
      occ("b", { clusterId: 0 }),
      occ("c", { clusterId: 0 }),
      occ("d", { clusterId: 0 }),
    ];
    const before = occs.map((o) => o.slug);
    pickAnchorSlugs(occs);
    expect(occs.map((o) => o.slug)).toEqual(before);
  });
});

describe("resolveSelectedSlug", () => {
  const known = { a: occ("a"), b: occ("b") };

  it("returns null for null input", () => {
    expect(resolveSelectedSlug(null, known)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveSelectedSlug("", known)).toBeNull();
  });

  it("returns null for an unknown slug (the dead-state guard)", () => {
    expect(resolveSelectedSlug("ghost", known)).toBeNull();
  });

  it("returns the slug when it resolves to a known occupation", () => {
    expect(resolveSelectedSlug("a", known)).toBe("a");
  });
});

describe("buildNodes — selection / dim invariants", () => {
  const occs = [
    occ("a", { x: 0, y: 0 }),
    occ("b", { x: 50, y: 50 }),
    occ("c", { x: 100, y: 100 }),
    occ("d", { x: 150, y: 150 }),
  ];
  const anchors = new Set<string>();

  it("with no selection, no node is dimmed and none are selected", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: null,
      anchorSlugs: anchors,
    });
    for (const n of nodes) {
      expect(n.data.dimmed).toBe(false);
      expect(n.data.selected).toBe(false);
    }
  });

  it("selected node has selected=true and dimmed=false", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
      anchorSlugs: anchors,
    });
    const sel = nodes.find((n) => n.id === "b");
    expect(sel?.data.selected).toBe(true);
    expect(sel?.data.dimmed).toBe(false);
  });

  it("neighbours of the selection are not dimmed", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(false);
    expect(nodes.find((n) => n.id === "c")?.data.selected).toBe(false);
  });

  it("non-neighbours are dimmed", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "d")?.data.dimmed).toBe(true);
  });

  it("anchor slugs flow to showAnchorLabel", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: null,
      anchorSlugs: new Set(["a", "d"]),
    });
    expect(nodes.find((n) => n.id === "a")?.data.showAnchorLabel).toBe(true);
    expect(nodes.find((n) => n.id === "b")?.data.showAnchorLabel).toBe(false);
    expect(nodes.find((n) => n.id === "d")?.data.showAnchorLabel).toBe(true);
  });

  it("position is read directly from the occupation", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: null,
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 0 });
    expect(nodes.find((n) => n.id === "c")?.position).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("every node uses BUBBLE_RADIUS and BUBBLE_BRIGHTNESS (uniform visuals)", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: null,
      anchorSlugs: anchors,
    });
    for (const n of nodes) {
      expect(n.data.radius).toBe(BUBBLE_RADIUS);
      expect(n.data.brightness).toBe(BUBBLE_BRIGHTNESS);
    }
  });

  it("every node carries a tint (saturated / resting / glow strings)", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: null,
      anchorSlugs: anchors,
    });
    for (const n of nodes) {
      expect(typeof n.data.tint.saturated).toBe("string");
      expect(typeof n.data.tint.resting).toBe("string");
      expect(typeof n.data.tint.glow).toBe("string");
    }
  });

  it("selection with no neighbours dims everything else (production code routes through resolveSelectedSlug first)", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set() },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "b")?.data.selected).toBe(true);
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(true);
  });
});
