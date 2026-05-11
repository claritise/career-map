import { BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import { tintForCluster } from "./palette";
import type { JobBubbleNode, Occupation } from "./types";

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
};

export function buildNodes({
  occupations,
  selection,
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
        tint: tintForCluster(o.clusterId),
      },
    };
  });
}
