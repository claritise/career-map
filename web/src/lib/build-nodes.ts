import { ANCHOR_COUNT, BUBBLE_BRIGHTNESS, BUBBLE_RADIUS } from "./constants";
import type { JobBubbleNode, Occupation, OccupationLayout } from "./types";

export function pickAnchorSlugs(
  occupations: Occupation[],
  count: number = ANCHOR_COUNT,
): Set<string> {
  // Anchor labels are shown on the first N occupations in the dataset. With
  // uniform bubble sizing there's no "biggest" anchor anymore — order-based
  // selection keeps the choice deterministic and v1-friendly (real datasets
  // can pre-sort by editorial priority).
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
  layoutBySlug: Record<string, OccupationLayout>;
  selection: Selection | null;
  anchorSlugs: Set<string>;
};

export function buildNodes({
  occupations,
  layoutBySlug,
  selection,
  anchorSlugs,
}: BuildNodesArgs): JobBubbleNode[] {
  return occupations.map((o) => {
    const layout = layoutBySlug[o.slug];
    const isSelected = selection?.slug === o.slug;
    const dimmed =
      selection !== null &&
      !isSelected &&
      !selection.neighbourSlugs.has(o.slug);

    return {
      id: o.slug,
      type: "jobBubble",
      position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
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
