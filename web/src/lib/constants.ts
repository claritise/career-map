// Bubble visuals — uniform across all occupations. The cluster layout does the
// visual work; size/brightness variance was distracting and made the map
// feel like a stats chart rather than a constellation.
export const BUBBLE_RADIUS = 7;
export const BUBBLE_BRIGHTNESS = 0.88;

// Visual layout space the mock generator scatters into.
export const LAYOUT_SPACE = { min: 20, max: 980, size: 1000 } as const;

// Anchor labels: shown permanently on the largest N bubbles by employment.
export const ANCHOR_COUNT = 14;

// React Flow viewport
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const FIT_VIEW_PADDING = 0.18;

// Selection / dim state
export const DIMMED_OPACITY = 0.18;

// Motion
export const TRANSITION_MS = 220;
export const PANEL_TRANSITION_MS = 320;
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

// Panel layout
export const PANEL_TOP_SKILL_LIMIT = 7;
export const PANEL_NEIGHBOUR_LIMIT = 5;

// Mock generator
export const MOCK_RNG_SEED = 20260509;
export const MOCK_NEIGHBOUR_MIN = 6;
export const MOCK_NEIGHBOUR_MAX = 8;
export const MOCK_GAP_SKILL_LIMIT = 4;
export const SIMILARITY_FLOOR = 0.6;
export const SIMILARITY_CEILING = 0.95;

// Per-occupation employment is exp(lerp(EMPLOYMENT_LOG_MIN, EMPLOYMENT_LOG_MAX, rand))
// → ~3K to ~1.2M employees.
export const EMPLOYMENT_LOG_MIN = 8;
export const EMPLOYMENT_LOG_MAX = 14;

// Wage skewed toward the lower end of each cluster's range.
export const WAGE_SKEW = 1.6;

// Each occupation gets MOCK_TOP_SKILL_MIN..MOCK_TOP_SKILL_MAX entries.
export const MOCK_TOP_SKILL_MIN = 6;
export const MOCK_TOP_SKILL_MAX = 8;

// Neighbour scoring: -distance + sameClusterBoost*[0|1] + uniform(-noise/2, +noise/2).
export const NEIGHBOUR_SAME_CLUSTER_BOOST = 60;
export const NEIGHBOUR_DISTANCE_NOISE = 30;

// Multiplier applied to each cluster's `spread` to pack jobs more tightly around
// their cluster centers. 1.0 = as-defined; smaller = tighter clusters.
export const CLUSTER_SPREAD_SCALE = 0.5;
