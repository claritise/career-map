"use client";

import clsx from "clsx";
import {
  EASE_OUT,
  PANEL_NEIGHBOUR_LIMIT,
  PANEL_TOP_SKILL_LIMIT,
  PANEL_TRANSITION_MS,
} from "~/lib/constants";
import {
  formatInt,
  formatSimilarityPercent,
  formatUsd,
  formatWageDelta,
  wageDeltaTone,
} from "~/lib/format";
import type { Neighbour, Occupation } from "~/lib/types";

const JOB_ZONE_PREP: Record<1 | 2 | 3 | 4, string> = {
  1: "little to no preparation",
  2: "some preparation",
  3: "considerable preparation",
  4: "extensive preparation",
};

const TONE_COLOR: Record<ReturnType<typeof wageDeltaTone>, string> = {
  up: "var(--color-up)",
  down: "var(--color-down)",
  neutral: "var(--color-cream-50)",
};

export type JobPanelProps = {
  occupation: Occupation | undefined;
  neighbours: Neighbour[];
  onSelect: (slug: string) => void;
  onClose: () => void;
};

export function JobPanel({
  occupation,
  neighbours,
  onSelect,
  onClose,
}: JobPanelProps) {
  const open = !!occupation;

  return (
    <aside
      aria-hidden={!open}
      className={clsx(
        "pointer-events-none fixed right-0 top-0 z-40 flex h-full w-105 max-w-[92vw] flex-col border-l backdrop-blur-xl",
        open && "pointer-events-auto",
      )}
      style={{
        background:
          "linear-gradient(180deg, var(--color-canvas-panel) 0%, var(--color-canvas-panel-end) 100%)",
        borderColor: "var(--color-cream-rule)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: `transform ${PANEL_TRANSITION_MS}ms ${EASE_OUT}`,
        boxShadow: open ? "-24px 0 60px -20px rgba(0, 0, 0, 0.6)" : "none",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--color-cream-glow-edge) 50%, transparent 100%)",
        }}
      />

      {occupation && (
        <PanelContent
          key={occupation.slug}
          occupation={occupation}
          neighbours={neighbours}
          onSelect={onSelect}
          onClose={onClose}
        />
      )}
    </aside>
  );
}

function PanelContent({
  occupation,
  neighbours,
  onSelect,
  onClose,
}: {
  occupation: Occupation;
  neighbours: Neighbour[];
  onSelect: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="relative px-8 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div
            className="text-[10px] uppercase tracking-[0.36em]"
            style={{ color: "var(--color-cream-42)" }}
          >
            {occupation.clusterLabel}
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <h1
          className="mt-3 text-[34px] font-light leading-[1.05] tracking-[-0.015em]"
          style={{
            color: "var(--color-cream)",
            fontFamily: "var(--font-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
            fontFeatureSettings: '"ss01"',
          }}
        >
          {occupation.title}
        </h1>

        <p
          className="mt-5 text-[14px] leading-[1.65]"
          style={{ color: "var(--color-cream-62)" }}
        >
          {occupation.description}
        </p>
      </header>

      <div className="mt-7 grid grid-cols-3 gap-px px-8">
        <Stat label="Median wage" value={formatUsd(occupation.wage)} />
        <Stat label="Workforce" value={formatInt(occupation.employment)} />
        <Stat label="Preparation" value={`Zone ${occupation.jobZone}`} />
      </div>
      <div
        className="mx-8 mt-2 text-[11px] leading-relaxed"
        style={{ color: "var(--color-cream-42)" }}
      >
        {JOB_ZONE_PREP[occupation.jobZone]}
      </div>

      <Section title="Top skills" tone="primary">
        <ul className="space-y-2.5">
          {occupation.topSkills.slice(0, PANEL_TOP_SKILL_LIMIT).map((skill) => (
            <li
              key={skill.name}
              className="flex items-center justify-between gap-3"
            >
              <span
                className="text-[13.5px]"
                style={{ color: "var(--color-cream-86)" }}
              >
                {skill.name}
              </span>
              <SkillBar value={skill.importance} />
            </li>
          ))}
        </ul>
      </Section>

      {neighbours.length > 0 && (
        <Section title="Similar careers" tone="secondary">
          <ul className="space-y-1.5">
            {neighbours.slice(0, PANEL_NEIGHBOUR_LIMIT).map((n) => (
              <li key={n.slug}>
                <NeighbourCard neighbour={n} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="h-10" />
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-cream-50 transition-colors hover:text-cream-95"
      aria-label="Close panel"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M2 2 L12 12 M12 2 L2 12" />
      </svg>
    </button>
  );
}

function NeighbourCard({
  neighbour,
  onSelect,
}: {
  neighbour: Neighbour;
  onSelect: (slug: string) => void;
}) {
  const deltaColor = TONE_COLOR[wageDeltaTone(neighbour.wageDelta)];
  return (
    <button
      onClick={() => onSelect(neighbour.slug)}
      className="group/card flex w-full items-baseline justify-between gap-3 rounded-md py-2.5 pl-1 pr-2 text-left transition-colors hover:bg-[rgba(var(--color-cream-rgb),0.025)]"
      style={{ borderTop: "1px solid var(--color-cream-rule-faint)" }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[14px]"
          style={{ color: "var(--color-cream-strong)" }}
        >
          {neighbour.title}
        </div>
        <div
          className="mt-1 flex items-center gap-2 text-[11px]"
          style={{ color: "var(--color-cream-50)" }}
        >
          <span>{formatSimilarityPercent(neighbour.similarity)}% similar</span>
          <span style={{ color: "var(--color-cream-25)" }}>·</span>
          <span style={{ color: deltaColor }}>
            {formatWageDelta(neighbour.wageDelta)}
          </span>
        </div>
      </div>
      <span
        className="shrink-0 -translate-x-1 text-[14px] opacity-0 transition-all group-hover/card:translate-x-0 group-hover/card:opacity-100"
        style={{ color: "var(--color-cream-glow-edge)" }}
        aria-hidden
      >
        →
      </span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <span
        className="text-[9.5px] uppercase tracking-[0.22em]"
        style={{ color: "var(--color-cream-42)" }}
      >
        {label}
      </span>
      <span
        className="text-[15px]"
        style={{
          color: "var(--color-cream-strong)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "primary" | "secondary";
}) {
  return (
    <section className="mt-8 px-8">
      <div
        className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em]"
        style={{
          color:
            tone === "primary"
              ? "var(--color-cream-55)"
              : "var(--color-cream-42)",
        }}
      >
        <span>{title}</span>
        <span
          className="h-px flex-1"
          style={{ background: "var(--color-cream-rule)" }}
        />
      </div>
      {children}
    </section>
  );
}

function SkillBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className="relative h-0.75 w-22 overflow-hidden rounded-full"
      style={{ background: "var(--color-cream-track)" }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${pct * 100}%`,
          background:
            "linear-gradient(90deg, rgba(var(--color-cream-rgb), 0.45) 0%, var(--color-cream-glow) 100%)",
        }}
      />
    </div>
  );
}
