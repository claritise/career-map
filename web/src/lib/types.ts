import type { Node } from "@xyflow/react";

/** Atlas-minimal occupation entry — one row in atlas.json. */
export type Occupation = {
  soc: string;
  slug: string;
  title: string;
  x: number;
  y: number;
  wage: number | null;
  employment: number | null;
  jobZone: 1 | 2 | 3 | 4 | 5 | null;
  clusterId: number;
};

/** Verbose per-occupation data — one file per occupation in details/. */
export type Details = {
  soc: string;
  slug: string;
  title: string;
  description: string;
  topSkills: { name: string; importance: number }[];
  wage: number | null;
  employment: number | null;
  jobZone: 1 | 2 | 3 | 4 | 5 | null;
  clusterId: number;
  clusterLabel: string;
};

/** One neighbour entry — array members in neighbours/{slug}.json. */
export type Neighbour = {
  soc: string;
  slug: string;
  title: string;
  similarity: number;
  sharedSkills: string[];
  gapSkills: string[];
  surplusSkills: string[];
  wage: number | null;
  wageDelta: number | null;
};

/** Cluster id → human-readable label. */
export type ClusterLabels = Record<string, string>;

/** Layout-only view of an occupation, useful when only x/y are needed. */
export type OccupationLayout = {
  slug: string;
  x: number;
  y: number;
};

export type JobBubbleData = {
  title: string;
  radius: number;
  brightness: number;
  dimmed: boolean;
  selected: boolean;
  showAnchorLabel: boolean;
};

export type JobBubbleNode = Node<JobBubbleData, "jobBubble">;
