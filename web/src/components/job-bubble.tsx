"use client";

import type { NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { DIMMED_OPACITY, EASE_OUT, TRANSITION_MS } from "~/lib/constants";
import type { JobBubbleNode } from "~/lib/types";

export type { JobBubbleNode };

const TRANSITION = `${TRANSITION_MS}ms ${EASE_OUT}`;

export function JobBubble({ data }: NodeProps<JobBubbleNode>) {
  const { title, radius, brightness, dimmed, selected, showAnchorLabel, tint } =
    data;
  const size = radius * 2;

  // Color-mix lets us scale the tint by `brightness` without parsing rgb(...)
  // strings. `transparent` is the alpha-zero anchor.
  const fill = `color-mix(in oklab, ${tint.resting} ${Math.round(
    brightness * 100,
  )}%, transparent)`;

  // Selection ring uses the saturated cluster color so the chosen bubble
  // gets a definitive identity, not generic cream.
  const ringColor = selected ? tint.saturated : "transparent";

  // Resting label opacity: selected always visible, anchors faintly visible,
  // everything else hidden until hover. Hover override is CSS-only.
  const restingLabelClass = selected
    ? "opacity-100"
    : showAnchorLabel
      ? "opacity-60"
      : "opacity-0";

  return (
    <div
      className="group relative flex cursor-pointer items-center justify-center"
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
          background: fill,
          boxShadow: selected
            ? `0 0 0 1.5px ${ringColor}, 0 0 22px 5px ${tint.glow}, 0 0 56px 14px ${tint.glow}`
            : `0 0 0 1px rgba(var(--color-cream-rgb), 0.04)`,
          transition: `transform ${TRANSITION}, box-shadow ${TRANSITION}, background ${TRANSITION_MS}ms ease`,
        }}
      />

      <div
        className="pointer-events-none absolute rounded-full opacity-0 group-hover:opacity-100"
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 18px 4px ${tint.glow}, 0 0 40px 12px ${tint.glow}`,
          transition: `opacity ${TRANSITION}`,
        }}
      />

      <div
        className={clsx(
          "pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap pt-2 text-[11px] tracking-wide group-hover:opacity-100",
          restingLabelClass,
        )}
        style={{
          color: tint.saturated,
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
