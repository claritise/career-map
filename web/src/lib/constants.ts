// Bubble visuals — uniform across all occupations. The cluster layout +
// per-cluster color do the visual work.
export const BUBBLE_RADIUS = 7;
export const BUBBLE_BRIGHTNESS = 0.88;

// HDBSCAN labels unassigned points -1 ("noise"); the pipeline forwards that id
// untouched and the frontend renders those bubbles as plain cream.
export const NOISE_CLUSTER_ID = -1;

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
