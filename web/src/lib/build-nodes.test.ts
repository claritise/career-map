import { describe, expect, it } from "vitest";
import { BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import { buildNodes, resolveSelectedSlug } from "./build-nodes";
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

  it("with no selection, no node is dimmed and none are selected", () => {
    const nodes = buildNodes({ occupations: occs, selection: null });
    for (const n of nodes) {
      expect(n.data.dimmed).toBe(false);
      expect(n.data.selected).toBe(false);
    }
  });

  it("selected node has selected=true and dimmed=false", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
    });
    const sel = nodes.find((n) => n.id === "b");
    expect(sel?.data.selected).toBe(true);
    expect(sel?.data.dimmed).toBe(false);
  });

  it("neighbours of the selection are not dimmed", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
    });
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(false);
    expect(nodes.find((n) => n.id === "c")?.data.selected).toBe(false);
  });

  it("non-neighbours are dimmed", () => {
    const nodes = buildNodes({
      occupations: occs,
      selection: { slug: "b", neighbourSlugs: new Set(["c"]) },
    });
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "d")?.data.dimmed).toBe(true);
  });

  it("position is read directly from the occupation", () => {
    const nodes = buildNodes({ occupations: occs, selection: null });
    expect(nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 0 });
    expect(nodes.find((n) => n.id === "c")?.position).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("every node uses BUBBLE_RADIUS and BUBBLE_BRIGHTNESS (uniform visuals)", () => {
    const nodes = buildNodes({ occupations: occs, selection: null });
    for (const n of nodes) {
      expect(n.data.radius).toBe(BUBBLE_RADIUS);
      expect(n.data.brightness).toBe(BUBBLE_BRIGHTNESS);
    }
  });

  it("every node carries a tint (saturated / resting / glow strings)", () => {
    const nodes = buildNodes({ occupations: occs, selection: null });
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
    });
    expect(nodes.find((n) => n.id === "b")?.data.selected).toBe(true);
    expect(nodes.find((n) => n.id === "a")?.data.dimmed).toBe(true);
    expect(nodes.find((n) => n.id === "c")?.data.dimmed).toBe(true);
  });
});
