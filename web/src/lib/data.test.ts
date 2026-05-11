import { describe, expect, it } from "vitest";
import atlasFixture from "./__fixtures__/atlas.json";
import detailsFixture from "./__fixtures__/details-software-developers.json";
import neighboursFixture from "./__fixtures__/neighbours-software-developers.json";
import type { Details, Neighbour, Occupation } from "./types";

/**
 * The fetchers themselves are thin wrappers around fs.readFile / fetch and
 * not worth heavy testing in isolation — but the SHAPE contract is critical.
 * These tests pin that the data shipped by the pipeline matches the types the
 * frontend assumes. Snapshot fixtures live in __fixtures__/.
 */

describe("atlas shape (fixture matches Occupation type)", () => {
  it("every entry has the required fields with correct types", () => {
    const atlas = atlasFixture as Occupation[];
    expect(atlas.length).toBeGreaterThan(0);
    for (const o of atlas) {
      expect(typeof o.soc).toBe("string");
      expect(typeof o.slug).toBe("string");
      expect(typeof o.title).toBe("string");
      expect(typeof o.x).toBe("number");
      expect(typeof o.y).toBe("number");
      expect(typeof o.clusterId).toBe("number");
      // wage / employment may be null
      expect(o.wage === null || typeof o.wage === "number").toBe(true);
      expect(o.employment === null || typeof o.employment === "number").toBe(
        true,
      );
      // jobZone is 1..5 or null
      expect(o.jobZone === null || [1, 2, 3, 4, 5].includes(o.jobZone)).toBe(
        true,
      );
    }
  });

  it("layout coordinates are within the expected viewport (0..1000)", () => {
    const atlas = atlasFixture as Occupation[];
    for (const o of atlas) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThanOrEqual(1000);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeLessThanOrEqual(1000);
    }
  });
});

describe("details shape (fixture matches Details type)", () => {
  const details = detailsFixture as Details;

  it("has all required fields", () => {
    expect(details.soc).toBeTruthy();
    expect(details.slug).toBeTruthy();
    expect(details.title).toBeTruthy();
    expect(details.description).toBeTruthy();
    expect(details.clusterLabel).toBeTruthy();
    expect(Array.isArray(details.topSkills)).toBe(true);
  });

  it("topSkills entries have {name, importance} with importance on 1..5 scale", () => {
    for (const skill of details.topSkills) {
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.importance).toBe("number");
      expect(skill.importance).toBeGreaterThanOrEqual(0);
      expect(skill.importance).toBeLessThanOrEqual(5);
    }
  });
});

describe("neighbours shape (fixture matches Neighbour[] type)", () => {
  const neighbours = neighboursFixture as Neighbour[];

  it("every entry has the required fields with correct types", () => {
    expect(neighbours.length).toBeGreaterThan(0);
    for (const n of neighbours) {
      expect(typeof n.soc).toBe("string");
      expect(typeof n.slug).toBe("string");
      expect(typeof n.title).toBe("string");
      expect(typeof n.similarity).toBe("number");
      expect(n.similarity).toBeGreaterThanOrEqual(0);
      expect(n.similarity).toBeLessThanOrEqual(1);
      expect(Array.isArray(n.sharedSkills)).toBe(true);
      expect(Array.isArray(n.gapSkills)).toBe(true);
      expect(Array.isArray(n.surplusSkills)).toBe(true);
      expect(n.wage === null || typeof n.wage === "number").toBe(true);
      expect(n.wageDelta === null || typeof n.wageDelta === "number").toBe(
        true,
      );
    }
  });

  it("neighbours are sorted by similarity descending", () => {
    const neighbours = neighboursFixture as Neighbour[];
    for (let i = 1; i < neighbours.length; i++) {
      expect(neighbours[i]!.similarity).toBeLessThanOrEqual(
        neighbours[i - 1]!.similarity,
      );
    }
  });
});
