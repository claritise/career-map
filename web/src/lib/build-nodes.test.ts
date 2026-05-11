import { describe, expect, it } from "vitest";
import { BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import {
  buildNodes,
  pickAnchorSlugs,
  resolveSelectedSlug,
} from "./build-nodes";
import type { Occupation, OccupationLayout } from "./types";

function occ(slug: string, overrides: Partial<Occupation> = {}): Occupation {
  return {
    slug,
    title: slug,
    wage: 60000,
    employment: 10000,
    jobZone: 2,
    clusterId: 0,
    clusterLabel: "Test",
    topSkills: [],
    description: "",
    ...overrides,
  };
}

function layout(slug: string, x = 100, y = 100): OccupationLayout {
  return { slug, x, y };
}

describe("pickAnchorSlugs", () => {
  it("returns the first N slugs in input order", () => {
    const occs = [occ("a"), occ("b"), occ("c"), occ("d")];
    const anchors = pickAnchorSlugs(occs, 2);
    expect(anchors.has("a")).toBe(true);
    expect(anchors.has("b")).toBe(true);
    expect(anchors.has("c")).toBe(false);
    expect(anchors.has("d")).toBe(false);
    expect(anchors.size).toBe(2);
  });

  it("does not mutate the input array", () => {
    const occs = [occ("a"), occ("b")];
    const before = occs.map((o) => o.slug);
    pickAnchorSlugs(occs, 2);
    expect(occs.map((o) => o.slug)).toEqual(before);
  });

  it("returns at most occupations.length slugs when count exceeds the dataset", () => {
    const occs = [occ("a"), occ("b")];
    const anchors = pickAnchorSlugs(occs, 99);
    expect(anchors.size).toBe(2);
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
  const occs = [occ("a"), occ("b"), occ("c"), occ("d")];
  const layouts = Object.fromEntries(
    occs.map((o, i) => [o.slug, layout(o.slug, i * 50, i * 50)]),
  );
  const anchors = new Set<string>();

  it("with no selection, no node is dimmed and none are selected", () => {
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: layouts,
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
      layoutBySlug: layouts,
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
      layoutBySlug: layouts,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(false);
    expect(nodes.find((n) => n.id === "c")?.data.selected).toBe(false);
  });

  it("non-neighbours are dimmed", () => {
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: layouts,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "d")?.data.dimmed).toBe(true);
  });

  it("anchor slugs flow to showAnchorLabel", () => {
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: layouts,
      selection: null,
      anchorSlugs: new Set(["a", "d"]),
    });
    expect(nodes.find((n) => n.id === "a")?.data.showAnchorLabel).toBe(true);
    expect(nodes.find((n) => n.id === "b")?.data.showAnchorLabel).toBe(false);
    expect(nodes.find((n) => n.id === "d")?.data.showAnchorLabel).toBe(true);
  });

  it("missing layout falls back to (0, 0) without throwing", () => {
    const partialLayouts = { a: layout("a", 50, 50) };
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: partialLayouts,
      selection: null,
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "b")?.position).toEqual({ x: 0, y: 0 });
    expect(nodes.find((n) => n.id === "a")?.position).toEqual({
      x: 50,
      y: 50,
    });
  });

  it("every node uses BUBBLE_RADIUS and BUBBLE_BRIGHTNESS (uniform visuals)", () => {
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: layouts,
      selection: null,
      anchorSlugs: anchors,
    });
    for (const n of nodes) {
      expect(n.data.radius).toBe(BUBBLE_RADIUS);
      expect(n.data.brightness).toBe(BUBBLE_BRIGHTNESS);
    }
  });

  it("selection with no neighbours dims everything else (production code routes through resolveSelectedSlug first)", () => {
    const nodes = buildNodes({
      occupations: occs,
      layoutBySlug: layouts,
      selection: { slug: "b", neighbourSlugs: new Set() },
      anchorSlugs: anchors,
    });
    expect(nodes.find((n) => n.id === "b")?.data.selected).toBe(true);
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(true);
  });
});
