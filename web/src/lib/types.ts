export type Occupation = {
  slug: string;
  title: string;
  wage: number;
  employment: number;
  jobZone: 1 | 2 | 3 | 4;
  clusterId: number;
  clusterLabel: string;
  topSkills: { name: string; importance: number }[];
  description: string;
};

export type OccupationLayout = {
  slug: string;
  x: number;
  y: number;
};

export type Neighbour = {
  slug: string;
  title: string;
  similarity: number;
  sharedSkills: string[];
  gapSkills: string[];
  wage: number;
  wageDelta: number;
};

import type { Node } from "@xyflow/react";

export type Dataset = {
  occupations: Occupation[];
  layoutBySlug: Record<string, OccupationLayout>;
  occupationsBySlug: Record<string, Occupation>;
  neighboursBySlug: Record<string, Neighbour[]>;
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
