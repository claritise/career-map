"use client";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import {
  buildNodes,
  pickAnchorSlugs,
  resolveSelectedSlug,
  type Selection,
} from "~/lib/build-nodes";
import { FIT_VIEW_PADDING, ZOOM_MAX, ZOOM_MIN } from "~/lib/constants";
import { useEscapeKey } from "~/lib/use-escape-key";
import {
  layoutBySlug,
  neighboursBySlug,
  occupations,
  occupationsBySlug,
} from "~/lib/mock-data";
import { JobBubble } from "./job-bubble";
import { JobPanel } from "./job-panel";

const nodeTypes = { jobBubble: JobBubble };

// SAFE while the dataset is a module-load singleton. Once data becomes async,
// move ANCHOR_SLUGS into useMemo([occupations]) inside ConstellationInner.
const ANCHOR_SLUGS = pickAnchorSlugs(occupations);
const EMPTY_EDGES: Edge[] = [];

function ConstellationInner() {
  const [rawSelectedSlug, setRawSelectedSlug] = useState<string | null>(null);

  const selection = useMemo<Selection | null>(() => {
    const slug = resolveSelectedSlug(rawSelectedSlug, occupationsBySlug);
    if (!slug) return null;
    const neighbourSlugs = new Set(
      (neighboursBySlug[slug] ?? []).map((n) => n.slug),
    );
    return { slug, neighbourSlugs };
  }, [rawSelectedSlug]);

  const nodes = useMemo(
    () =>
      buildNodes({
        occupations,
        layoutBySlug,
        selection,
        anchorSlugs: ANCHOR_SLUGS,
      }),
    [selection],
  );

  const onNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setRawSelectedSlug(node.id);
  }, []);

  const onPaneClick = useCallback(() => setRawSelectedSlug(null), []);

  const clearSelection = useCallback(() => setRawSelectedSlug(null), []);
  useEscapeKey(clearSelection);

  const selectedOccupation = selection
    ? occupationsBySlug[selection.slug]
    : undefined;
  const selectedNeighbours = selection
    ? neighboursBySlug[selection.slug] ?? []
    : [];

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "var(--color-canvas)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "var(--gradient-warm-glow)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "var(--gradient-vignette)" }}
      />

      <ReactFlow
        nodes={nodes}
        edges={EMPTY_EDGES}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={ZOOM_MIN}
        maxZoom={ZOOM_MAX}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: FIT_VIEW_PADDING, includeHiddenNodes: false }}
        style={{ background: "transparent" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={36}
          size={1}
          color="var(--color-dot-grid)"
          bgColor="transparent"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute left-8 top-8 z-20 select-none">
        <div
          className="text-[10px] uppercase tracking-[0.32em]"
          style={{ color: "var(--color-cream-42)" }}
        >
          Career Map
        </div>
        <div
          className="mt-2 max-w-[22ch] text-[12px] leading-relaxed"
          style={{ color: "var(--color-cream-55)" }}
        >
          A constellation of work. Bubbles near each other share skills.
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.32em]"
        style={{ color: "var(--color-cream-32)" }}
      >
        scroll to zoom · drag to pan · click a star
      </div>

      <JobPanel
        occupation={selectedOccupation}
        neighbours={selectedNeighbours}
        onSelect={(slug) => setRawSelectedSlug(slug)}
        onClose={() => setRawSelectedSlug(null)}
      />
    </div>
  );
}

export function Constellation() {
  return (
    <ReactFlowProvider>
      <ConstellationInner />
    </ReactFlowProvider>
  );
}
