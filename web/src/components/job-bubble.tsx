"use client";

import type { NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { DIMMED_OPACITY, EASE_OUT, TRANSITION_MS } from "~/lib/constants";
import type { JobBubbleNode } from "~/lib/types";

export type { JobBubbleNode };

const TRANSITION = `${TRANSITION_MS}ms ${EASE_OUT}`;

export function JobBubble({ data }: NodeProps<JobBubbleNode>) {
  const { title, radius, brightness, dimmed, selected, showAnchorLabel } = data;
  const size = radius * 2;
  const cream = `rgba(var(--color-cream-rgb), ${brightness})`;

  // Resting label opacity: selected always visible, anchors faintly visible,
  // everything else hidden until hover. Hover override is CSS-only.
  const restingLabelClass = selected
    ? "opacity-100"
    : showAnchorLabel
      ? "opacity-50"
      : "opacity-0";

  return (
    <div
      className="group relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        opacity: dimmed ? DIMMED_OPACITY : 1,
        transition: `opacity ${TRANSITION}`,
      }}
    >
      <div
        className={clsx(
          "rounded-full will-change-transform",
          selected && "scale-110",
        )}
        style={{
          width: size,
          height: size,
          background: cream,
          boxShadow: selected
            ? "0 0 0 1.5px var(--color-cream-95), 0 0 22px 4px var(--color-cream-glow), 0 0 48px 12px var(--color-cream-glow-soft)"
            : "0 0 0 1px rgba(var(--color-cream-rgb), 0.04)",
          transition: `transform ${TRANSITION}, box-shadow ${TRANSITION}, background ${TRANSITION_MS}ms ease`,
        }}
      />

      <div
        className="pointer-events-none absolute rounded-full opacity-0 group-hover:opacity-100"
        style={{
          width: size,
          height: size,
          boxShadow:
            "0 0 18px 3px var(--color-cream-glow), 0 0 36px 10px var(--color-cream-glow-soft)",
          transition: `opacity ${TRANSITION}`,
        }}
      />

      <div
        className={clsx(
          "pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap pt-2 text-[11px] tracking-wide group-hover:opacity-100",
          restingLabelClass,
        )}
        style={{
          color: "var(--color-cream-86)",
          textShadow: "0 1px 8px rgba(0, 0, 0, 0.85)",
          letterSpacing: "0.02em",
          transition: `opacity ${TRANSITION}`,
        }}
      >
        {title}
      </div>
    </div>
  );
}
