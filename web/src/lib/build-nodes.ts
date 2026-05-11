import { ANCHOR_COUNT, BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import type { JobBubbleNode, Occupation } from "./types";

export function pickAnchorSlugs(
  occupations: Occupation[],
  count: number = ANCHOR_COUNT,
): Set<string> {
  // Anchor labels are shown on the first N occupations in the dataset.
  // Real-data ordering is whatever the pipeline emits (currently sorted by
  // cluster id); v1 polish can curate editorial anchors via a separate file.
  return new Set(occupations.slice(0, count).map((o) => o.slug));
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
      },
    };
  });
}
