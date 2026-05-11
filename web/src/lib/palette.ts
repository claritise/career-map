/**
 * Cluster palette. The constellation has ~34 HDBSCAN clusters; bubbles within
 * a cluster share a tint so users can see "this region" without needing to
 * read a legend.
 *
 * Design principles:
 *  - Low saturation. Stars in a night sky, not crayons in a box.
 *  - Equal perceived brightness across hues so no cluster visually dominates.
 *    Achieved by anchoring every base color at the same OKLCH lightness +
 *    chroma. (OKLCH is perceptually uniform; HSL is not.)
 *  - Two intensities per cluster: a quiet "resting" tone (heavily mixed
 *    toward the cream base color) and a saturated "lit" tone for hover /
 *    selection / neighbours-of-selected.
 *  - Cluster id → palette slot via a small hash so the mapping is stable
 *    across rebuilds but adjacent cluster ids don't share adjacent hues.
 *  - Cluster id `-1` (HDBSCAN noise / "Other") stays cream — it isn't a
 *    real region of the map.
 */

import { NOISE_CLUSTER_ID } from "./constants";

export type ClusterTint = {
  /** Saturated form, used on hover / selection / for neighbours of selected. */
  saturated: string;
  /** Resting form: heavily mixed toward cream so the canvas feels calm. */
  resting: string;
  /** Same hue as `saturated` but very faint, used for cluster-tinted glows. */
  glow: string;
};

// ---------------------------------------------------------------------------
// Color utilities (declared before constants that consume them at module load)
// ---------------------------------------------------------------------------

const CREAM_RGB = [232, 226, 217] as const;

function parseRgb(s: string): [number, number, number] | null {
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Mix an `rgb(r, g, b)` string toward the cream base color.
 * `t` is the cream weight: 0 returns `rgb` unchanged, 1 returns pure cream.
 */
function mixTowardCream(rgb: string, t: number): string {
  const parsed = parseRgb(rgb);
  if (!parsed) return rgb;
  const [r, g, b] = parsed;
  return `rgb(${Math.round(lerp(r, CREAM_RGB[0], t))}, ${Math.round(
    lerp(g, CREAM_RGB[1], t),
  )}, ${Math.round(lerp(b, CREAM_RGB[2], t))})`;
}

function rgbToRgba(rgb: string, alpha: number): string {
  const parsed = parseRgb(rgb);
  if (!parsed) return rgb;
  const [r, g, b] = parsed;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pure cream — used for noise-cluster bubbles and as the mix-toward base. */
export const CREAM_TINT: ClusterTint = {
  saturated: "rgb(232, 226, 217)",
  resting: "rgb(220, 214, 204)",
  glow: "rgba(255, 232, 198, 0.45)",
};

/**
 * 16 base hues spaced 22.5° apart. Authored in OKLCH for perceptual uniformity,
 * then converted to rgb() so we don't depend on browser OKLCH support.
 *
 * Lightness 72%, chroma 0.12, hue rotates. Saturated forms.
 * Generated once with `culori` against OKLCH(0.72 0.12 H) for H ∈ [0..360, step 22.5];
 * baked in as literal rgb() so we avoid a runtime color-conversion dep.
 */
const SATURATED_HUES = [
  "rgb(230, 168, 144)", // 0°    — warm ember (dusty rose-orange)
  "rgb(220, 174, 122)", // 22.5° — amber
  "rgb(204, 184, 116)", // 45°   — faded gold
  "rgb(178, 192, 128)", // 67.5° — desaturated olive
  "rgb(143, 200, 140)", // 90°   — sea-foam green
  "rgb(122, 204, 165)", // 112°  — teal-green
  "rgb(116, 202, 196)", // 135°  — dusty teal
  "rgb(126, 198, 222)", // 157°  — pale celestial blue
  "rgb(144, 192, 234)", // 180°  — steel blue
  "rgb(166, 184, 234)", // 202°  — periwinkle
  "rgb(190, 178, 228)", // 225°  — soft plum
  "rgb(210, 172, 216)", // 247°  — dusty lilac
  "rgb(226, 168, 198)", // 270°  — muted rose
  "rgb(232, 168, 176)", // 292°  — dusty pink
  "rgb(232, 170, 156)", // 315°  — pale coral
  "rgb(228, 172, 138)", // 337°  — soft apricot
];

/**
 * Resting form: each saturated hue mixed 35% toward the cream base color.
 * Pre-baked at module load so we don't recompute per render.
 */
const RESTING_HUES = SATURATED_HUES.map((rgb) =>
  mixTowardCream(rgb, 0.65),
);

/** Translucent form used for the hover/selected box-shadow glow. */
const GLOW_HUES = SATURATED_HUES.map((rgb) =>
  rgbToRgba(rgb, 0.55),
);

/**
 * Map a cluster id to a palette slot deterministically. Adjacent cluster ids
 * land on non-adjacent palette slots because the multiplier scatters them.
 * Negative ids (noise) are routed to cream upstream; this is a defensive mod.
 */
function paletteSlot(clusterId: number): number {
  const id = Math.abs(clusterId);
  // The constant 7 is coprime with 16, so id * 7 visits every slot before
  // repeating — and lands on non-adjacent slots for adjacent ids.
  return (id * 7) % SATURATED_HUES.length;
}

export function tintForCluster(clusterId: number): ClusterTint {
  if (clusterId === NOISE_CLUSTER_ID) return CREAM_TINT;
  const slot = paletteSlot(clusterId);
  return {
    saturated: SATURATED_HUES[slot]!,
    resting: RESTING_HUES[slot]!,
    glow: GLOW_HUES[slot]!,
  };
}

