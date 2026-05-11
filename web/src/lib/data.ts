import type { ClusterLabels, Details, Neighbour, Occupation } from "./types";

/**
 * Data fetchers. The atlas + per-occupation files live in `public/data/` and
 * are static — no API, no DB. Functions here transparently read from the
 * filesystem when called server-side (during `next build` and inside Server
 * Components) and via fetch() when called from the browser.
 *
 * The contract is the same in both worlds: typed promises that resolve to
 * the shape exported from `./types`.
 */

const PUBLIC_DATA_PREFIX = "/data";

/** True when running in a Node context (Server Component, build step). */
const isServer = typeof window === "undefined";

async function readJson<T>(relativePath: string): Promise<T> {
  if (isServer) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      relativePath,
    );
    const buf = await fs.readFile(filePath, "utf8");
    return JSON.parse(buf) as T;
  }
  const res = await fetch(`${PUBLIC_DATA_PREFIX}/${relativePath}`);
  if (!res.ok) {
    throw new Error(
      `Failed to load /data/${relativePath} (${res.status} ${res.statusText})`,
    );
  }
  return (await res.json()) as T;
}

export function getAtlas(): Promise<Occupation[]> {
  return readJson<Occupation[]>("atlas.json");
}

export function getClusterLabels(): Promise<ClusterLabels> {
  return readJson<ClusterLabels>("clusters.json");
}

export function getDetails(slug: string): Promise<Details> {
  return readJson<Details>(`details/${slug}.json`);
}

export function getNeighbours(slug: string): Promise<Neighbour[]> {
  return readJson<Neighbour[]>(`neighbours/${slug}.json`);
}

/** All slugs in the dataset — used by `generateStaticParams`. */
export async function getAllSlugs(): Promise<string[]> {
  const atlas = await getAtlas();
  return atlas.map((o) => o.slug);
}

/**
 * Map every origin slug to its precomputed neighbour slugs (just the slug
 * strings — not the full Neighbour objects). Read once at build time and
 * passed down to the Constellation so it knows which bubbles to keep bright
 * for any selection. Server-only.
 */
export async function getNeighbourSlugsBySlug(): Promise<
  Record<string, string[]>
> {
  if (!isServer) {
    throw new Error(
      "getNeighbourSlugsBySlug is server-only — too large for client fetch",
    );
  }
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "data", "neighbours");
  const files = await fs.readdir(dir);
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (filename) => {
        const slug = filename.replace(/\.json$/, "");
        const raw = await fs.readFile(path.join(dir, filename), "utf8");
        const ns = JSON.parse(raw) as { slug: string }[];
        return [slug, ns.map((n) => n.slug)] as const;
      }),
  );
  return Object.fromEntries(entries);
}
