import { BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import { tintForCluster } from "./palette";
import type { JobBubbleNode, Occupation } from "./types";

/**
 * Anchor labels are the labels shown permanently (at low opacity) on the
 * constellation. One label per cluster, placed on the occupation closest to
 * that cluster's centroid — so every named region of the map gets an anchor
 * and labels never stack on top of each other.
 *
 * Excludes the noise cluster (-1) and any cluster too small to be visually
 * coherent (fewer than 4 members).
 */
export function pickAnchorSlugs(occupations: Occupation[]): Set<string> {
  const NOISE = -1;
  const MIN_CLUSTER_SIZE_FOR_ANCHOR = 4;

  // Group by cluster.
  const byCluster = new Map<number, Occupation[]>();
  for (const o of occupations) {
    if (o.clusterId === NOISE) continue;
    const arr = byCluster.get(o.clusterId);
    if (arr) arr.push(o);
    else byCluster.set(o.clusterId, [o]);
  }

  const anchors = new Set<string>();
  for (const members of byCluster.values()) {
    if (members.length < MIN_CLUSTER_SIZE_FOR_ANCHOR) continue;
    // Centroid.
    let cx = 0;
    let cy = 0;
    for (const m of members) {
      cx += m.x;
      cy += m.y;
    }
    cx /= members.length;
    cy /= members.length;
    // Closest member to centroid.
    let best = members[0]!;
    let bestDist = Infinity;
    for (const m of members) {
      const dx = m.x - cx;
      const dy = m.y - cy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    anchors.add(best.slug);
  }
  return anchors;
}

/**
 * Resolve a raw selected slug to one that's known to exist in the dataset.
 * Returns null if the slug is null or doesn't resolve to an occupation,
 * preventing the "every bubble dimmed, no panel" dead state.
 */
export function resolveSelectedSlug(
  rawSlug: string | null,
  occupationsBySlug: Record<string, Occupation>,
): string | null {
  if (!rawSlug) return null;
  return occupationsBySlug[rawSlug] ? rawSlug : null;
}

export type Selection = {
  slug: string;
  neighbourSlugs: Set<string>;
};

export type BuildNodesArgs = {
  occupations: Occupation[];
  selection: Selection | null;
  anchorSlugs: Set<string>;
};

export function buildNodes({
  occupations,
  selection,
  anchorSlugs,
}: BuildNodesArgs): JobBubbleNode[] {
  return occupations.map((o) => {
    const isSelected = selection?.slug === o.slug;
    const dimmed =
      selection !== null &&
      !isSelected &&
      !selection.neighbourSlugs.has(o.slug);

    return {
      id: o.slug,
      type: "jobBubble",
      position: { x: o.x, y: o.y },
      draggable: false,
      selectable: true,
      data: {
        title: o.title,
        radius: BUBBLE_RADIUS,
        brightness: BUBBLE_BRIGHTNESS,
        dimmed,
        selected: isSelected,
        showAnchorLabel: anchorSlugs.has(o.slug),
        tint: tintForCluster(o.clusterId),
      },
    };
  });
}
