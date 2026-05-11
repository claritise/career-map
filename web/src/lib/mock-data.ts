import {
  CLUSTER_SPREAD_SCALE,
  EMPLOYMENT_LOG_MAX,
  EMPLOYMENT_LOG_MIN,
  LAYOUT_SPACE,
  MOCK_GAP_SKILL_LIMIT,
  MOCK_NEIGHBOUR_MAX,
  MOCK_NEIGHBOUR_MIN,
  MOCK_RNG_SEED,
  MOCK_TOP_SKILL_MAX,
  MOCK_TOP_SKILL_MIN,
  NEIGHBOUR_DISTANCE_NOISE,
  NEIGHBOUR_SAME_CLUSTER_BOOST,
  SIMILARITY_CEILING,
  SIMILARITY_FLOOR,
  WAGE_SKEW,
} from "./constants";
import { CLUSTERS, type ClusterDef } from "./mock-data-clusters";
import type {
  Dataset,
  Neighbour,
  Occupation,
  OccupationLayout,
} from "./types";

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function pickN<T>(arr: T[], n: number, rand: Rng): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rand() * copy.length);
    const [item] = copy.splice(idx, 1);
    if (item !== undefined) out.push(item);
  }
  return out;
}

function randInt(rand: Rng, minInclusive: number, maxInclusive: number) {
  return (
    minInclusive +
    Math.floor(rand() * (maxInclusive - minInclusive + 1))
  );
}

// Decorrelates the neighbour-scoring stream from the occupation-generation
// stream so tweaking neighbour params doesn't reshuffle every occupation.
const NEIGHBOUR_SEED_XOR = 0x9e3779b9;

const SIMILARITY_SPAN = SIMILARITY_CEILING - SIMILARITY_FLOOR;

export function generateMockDataset(
  seed: number = MOCK_RNG_SEED,
  clusters: ClusterDef[] = CLUSTERS,
): Dataset {
  const rand = mulberry32(seed);

  const occupations: Occupation[] = [];
  const layouts: OccupationLayout[] = [];
  const usedSlugs = new Set<string>();

  for (const cluster of clusters) {
    for (const title of cluster.titles) {
      let slug = slugify(title);
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${slugify(title)}-${suffix++}`;
      usedSlugs.add(slug);

      const spread = cluster.spread * CLUSTER_SPREAD_SCALE;
      const x = clamp(
        cluster.cx + gaussian(rand) * spread,
        LAYOUT_SPACE.min,
        LAYOUT_SPACE.max,
      );
      const y = clamp(
        cluster.cy + gaussian(rand) * spread,
        LAYOUT_SPACE.min,
        LAYOUT_SPACE.max,
      );

      const rawZone = Math.round(
        lerp(cluster.jobZoneRange[0], cluster.jobZoneRange[1], rand()),
      );
      const jobZone = clamp(rawZone, 1, 4) as 1 | 2 | 3 | 4;

      const wage =
        Math.round(
          lerp(
            cluster.wageRange[0],
            cluster.wageRange[1],
            Math.pow(rand(), WAGE_SKEW),
          ) / 1000,
        ) * 1000;

      const employment = Math.round(
        Math.exp(lerp(EMPLOYMENT_LOG_MIN, EMPLOYMENT_LOG_MAX, rand())),
      );

      const skillSample = pickN(
        cluster.skills,
        randInt(rand, MOCK_TOP_SKILL_MIN, MOCK_TOP_SKILL_MAX),
        rand,
      );
      const topSkills = skillSample.map((name, i) => ({
        name,
        importance:
          Math.round((0.95 - i * 0.06 + (rand() - 0.5) * 0.05) * 100) / 100,
      }));

      occupations.push({
        slug,
        title,
        wage,
        employment,
        jobZone,
        clusterId: cluster.id,
        clusterLabel: cluster.label,
        topSkills,
        description: cluster.blurb(title),
      });
      layouts.push({ slug, x, y });
    }
  }

  const occupationsBySlug = Object.fromEntries(
    occupations.map((o) => [o.slug, o]),
  );
  const layoutBySlug = Object.fromEntries(layouts.map((l) => [l.slug, l]));

  const neighboursBySlug: Record<string, Neighbour[]> = {};
  const neighbourRand = mulberry32(seed ^ NEIGHBOUR_SEED_XOR);

  for (const origin of occupations) {
    const originLayout = layoutBySlug[origin.slug]!;

    const scored = occupations
      .filter((o) => o.slug !== origin.slug)
      .map((o) => {
        const oLayout = layoutBySlug[o.slug]!;
        const dx = oLayout.x - originLayout.x;
        const dy = oLayout.y - originLayout.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const sameClusterBoost =
          o.clusterId === origin.clusterId
            ? NEIGHBOUR_SAME_CLUSTER_BOOST
            : 0;
        const noise = (neighbourRand() - 0.5) * NEIGHBOUR_DISTANCE_NOISE;
        const score = -dist + sameClusterBoost + noise;
        return { o, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(
        0,
        randInt(neighbourRand, MOCK_NEIGHBOUR_MIN, MOCK_NEIGHBOUR_MAX),
      );

    // scored is guaranteed non-empty here: every cluster contributes ≥11 titles,
    // so any origin has ≥1 candidate neighbour and `slice(0, MIN..MAX)` returns
    // at least MOCK_NEIGHBOUR_MIN entries.
    const maxScore = scored[0]!.score;
    const minScore = scored[scored.length - 1]!.score;
    const range = Math.max(maxScore - minScore, 1e-6);

    neighboursBySlug[origin.slug] = scored.map(({ o, score }) => {
      const similarity =
        Math.round(
          (SIMILARITY_FLOOR + SIMILARITY_SPAN * ((score - minScore) / range)) *
            100,
        ) / 100;
      const originSkillNames = origin.topSkills.map((s) => s.name);
      const neighbourSkillNames = o.topSkills.map((s) => s.name);
      const sharedSkills = originSkillNames.filter((s) =>
        neighbourSkillNames.includes(s),
      );
      const gapSkills = neighbourSkillNames
        .filter((s) => !originSkillNames.includes(s))
        .slice(0, MOCK_GAP_SKILL_LIMIT);

      return {
        slug: o.slug,
        title: o.title,
        similarity,
        sharedSkills,
        gapSkills,
        wage: o.wage,
        wageDelta: o.wage - origin.wage,
      };
    });
  }

  return { occupations, layoutBySlug, occupationsBySlug, neighboursBySlug };
}

const dataset = generateMockDataset();

export const occupations = dataset.occupations;
export const layoutBySlug = dataset.layoutBySlug;
export const occupationsBySlug = dataset.occupationsBySlug;
export const neighboursBySlug = dataset.neighboursBySlug;
