"use client";

import type { NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { DIMMED_OPACITY, EASE_OUT, TRANSITION_MS } from "~/lib/constants";
import type { JobBubbleNode } from "~/lib/types";

export type { JobBubbleNode };

const TRANSITION = `${TRANSITION_MS}ms ${EASE_OUT}`;

export function JobBubble({ data }: NodeProps<JobBubbleNode>) {
  const { title, radius, brightness, dimmed, selected, tint } = data;
  const size = radius * 2;

  // Color-mix lets us scale the tint by `brightness` without parsing rgb(...)
  // strings. `transparent` is the alpha-zero anchor.
  const fill = `color-mix(in oklab, ${tint.resting} ${Math.round(
    brightness * 100,
  )}%, transparent)`;

  // Selection ring uses the saturated cluster color so the chosen bubble
  // gets a definitive identity.
  const ringColor = selected ? tint.saturated : "transparent";

  // Labels: hidden at rest, visible on hover OR when selected. Selected
  // wins via the `force-label-visible` class set on the wrapper so even
  // off-hover it stays up.
  const wrapperClass = clsx(
    "group relative flex cursor-pointer items-center justify-center",
    selected && "force-label-visible",
  );

  return (
    <div
      className={wrapperClass}
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

      {/* Label: hidden by default. .force-label-visible (set when selected) or
          hover make it appear. Pill background gives clean contrast against
          the constellation. */}
      <div
        className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 whitespace-nowrap pt-2.5 opacity-0 group-hover:opacity-100 group-[.force-label-visible]:opacity-100"
        style={{ transition: `opacity ${TRANSITION}` }}
      >
        <span
          className="inline-block rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{
            color: tint.saturated,
            background: "rgba(10, 9, 8, 0.78)",
            border: `1px solid ${tint.glow}`,
            backdropFilter: "blur(8px)",
            letterSpacing: "0.005em",
            lineHeight: 1,
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
