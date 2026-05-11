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
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  buildNodes,
  pickAnchorSlugs,
  resolveSelectedSlug,
  type Selection,
} from "~/lib/build-nodes";
import { FIT_VIEW_PADDING, ZOOM_MAX, ZOOM_MIN } from "~/lib/constants";
import { useEscapeKey } from "~/lib/use-escape-key";
import type { Occupation } from "~/lib/types";
import { JobBubble } from "./job-bubble";

const nodeTypes = { jobBubble: JobBubble };
const EMPTY_EDGES: Edge[] = [];

/**
 * Read selected slug from the URL: `/job/{slug}` → `{slug}`, else null.
 */
function readSelectedSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = /^\/job\/([^/]+)\/?$/.exec(pathname);
  return match ? match[1]! : null;
}

export type ConstellationProps = {
  atlas: Occupation[];
  /** Slug → neighbour slugs, precomputed at build time. */
  neighbourSlugsBySlug: Record<string, string[]>;
};

function ConstellationInner({ atlas, neighbourSlugsBySlug }: ConstellationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const occupationsBySlug = useMemo(
    () => Object.fromEntries(atlas.map((o) => [o.slug, o])),
    [atlas],
  );

  const anchorSlugs = useMemo(() => pickAnchorSlugs(atlas), [atlas]);

  const rawSelectedSlug = readSelectedSlug(pathname);
  const selectedSlug = resolveSelectedSlug(rawSelectedSlug, occupationsBySlug);

  const selection = useMemo<Selection | null>(() => {
    if (!selectedSlug) return null;
    const neighbours = neighbourSlugsBySlug[selectedSlug] ?? [];
    return { slug: selectedSlug, neighbourSlugs: new Set(neighbours) };
  }, [selectedSlug, neighbourSlugsBySlug]);

  const nodes = useMemo(
    () =>
      buildNodes({
        occupations: atlas,
        selection,
        anchorSlugs,
      }),
    [atlas, selection, anchorSlugs],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      router.push(`/job/${node.id}`, { scroll: false });
    },
    [router],
  );

  const goHome = useCallback(() => {
    router.push("/", { scroll: false });
  }, [router]);

  useEscapeKey(goHome);

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
        onPaneClick={goHome}
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
    </div>
  );
}

export function Constellation(props: ConstellationProps) {
  return (
    <ReactFlowProvider>
      <ConstellationInner {...props} />
    </ReactFlowProvider>
  );
}
