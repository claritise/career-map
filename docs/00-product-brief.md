# Career Map — v0 build brief

## What we're building

A static interactive visualisation called Career Map. The landing page shows ~900 jobs as a constellation of bubbles, where physically-near bubbles represent jobs with similar skill profiles. Click a bubble → a panel slides in showing that job's details and its top similar jobs. Goal of v0 is to validate the visual + interaction with mock data; real O*NET data comes later.

## Stack (already set up in this T3 repo)

- Next.js App Router (latest, with async params)
- TypeScript
- Tailwind CSS
- The repo already has the T3 scaffolding — preserve existing structure, only add what's needed

## Additional dependencies to install

- `@xyflow/react` — for the constellation rendering (NOT `reactflow`, the old package)
- `clsx` — for conditional classnames (likely already installed)

## Architecture for v0

- Single page at `/` for now. We'll add `/job/[slug]` and intercepting routes in v1; not v0's job.
- Mock data generated inline in a TypeScript file — NO real O*NET, NO Python. Just hardcoded fake data with realistic-looking properties.
- Two main components:
  - **Constellation** — the React Flow map (Client Component, `'use client'`)
  - **JobPanel** — the slide-in panel (Client Component)
- Click handler in Constellation sets local state for selected job, panel reads from same state. No URL routing in v0.

## File structure to create

```
src/
├── app/
│   └── page.tsx                    — Server Component, renders <Constellation />
├── components/
│   ├── constellation.tsx           — 'use client', the React Flow map
│   ├── job-panel.tsx               — 'use client', the slide-in panel
│   └── job-bubble.tsx              — custom React Flow node component
├── lib/
│   ├── mock-data.ts                — generates ~150 fake occupations
│   └── types.ts                    — TS types for Occupation, Neighbour
```

## Type shapes

```ts
// lib/types.ts
export type Occupation = {
  slug: string;          // e.g. 'software-developers'
  title: string;         // 'Software Developers'
  x: number;             // 0–1000
  y: number;             // 0–1000
  wage: number;          // USD median annual
  employment: number;    // count
  jobZone: 1 | 2 | 3 | 4; // 1=entry, 4=most prep
  clusterId: number;     // 0–9 for ~10 fake clusters
  clusterLabel: string;  // 'Healthcare', 'Skilled Trades', etc.
  topSkills: { name: string; importance: number }[]; // top 5–10
  description: string;   // short blurb
};

export type Neighbour = {
  slug: string;
  title: string;
  similarity: number;    // 0–1
  sharedSkills: string[];
  gapSkills: string[];
  wage: number;
  wageDelta: number;     // neighbour wage minus origin wage
};
```

## Mock data requirements

- ~150 occupations is enough for v0 (no need for full 900)
- Group them into ~8–10 clusters with realistic-feeling labels (Healthcare, Knowledge Work, Skilled Trades, Care Work, Creative, Sales/Service, Operations, Engineering, Education, Hospitality)
- Within each cluster, jobs should be spatially close (cluster around a center point with small gaussian jitter)
- Across clusters, jobs should be far apart
- Realistic-ish job titles per cluster (don't worry about being comprehensive, just plausible)
- Wages should vary realistically (entry-level $30k → senior specialist $200k)
- Each occupation gets 5–8 mock neighbours, mostly within its own cluster, with similarity scores 0.6–0.95

A simple way: define cluster centers, generate jobs by sampling around centers, compute pseudo-similarity from spatial distance for the neighbour data.

## Visual aesthetic

This is the part that matters most. The look should feel calm, dark, considered — not the rainbow Plotly-default look.

**Background:** very deep near-black, e.g. `#0a0a0a` or `bg-neutral-950`. Not pure black — a touch of warmth.

**Bubbles:**

- Filled circles, no individual gradients (keep them simple)
- Size mapped to employment count (sqrt scale, range 4px–24px radius)
- Colour: monochromatic. All bubbles a slightly off-white (`#e8e6e3` or similar warm-cream tone), with luminosity varying subtly by jobZone (zone 1 dimmer, zone 4 brighter). Avoid loud colour-coded clusters — let the spatial layout do the cluster work.
- Hover state: brighten + soft box-shadow glow (warm cream tint)
- Selected state: brighten more, surrounding non-neighbour bubbles dim to ~30% opacity, neighbour bubbles stay at full opacity
- Smooth transitions on opacity and shadow (200ms)

**Labels:** None on bubbles by default. Show label only on hover (small floating label near cursor). Show label permanently for the largest 10–15 bubbles at low opacity (~50%) as anchor points so the user can orient.

**Panel:**

- Slides in from the right, ~400px wide
- Same near-black background, with a subtle top border or shadow separating it from the constellation
- Contains: job title (large), wage, employment, description (paragraph), top skills (small list), then a section "Similar careers" listing the top 5 neighbours as small cards (clickable — clicking a neighbour switches the panel to that job)
- Smooth slide-in transition (300ms ease-out)

**Typography:** Use whatever's already configured in the T3 repo. If nothing is set, use a clean sans-serif, slightly tighter letter-spacing on headings. Body text in `neutral-300` (slightly muted) on near-black, never pure white.

## Interaction behaviour

- Pan and zoom: enabled (React Flow's defaults are fine; constrain zoom to 0.5x – 4x)
- Click a bubble → panel opens with that job's data
- Click another bubble → panel updates with new job (no transition needed, just swap content)
- Click a neighbour card in the panel → panel updates to show that neighbour
- Click outside the panel (on the constellation) → panel closes
- Esc key → panel closes

## React Flow specifics

- Use a custom node type for the bubbles (`job-bubble.tsx`) — don't use the default node
- Disable edges entirely (no connecting lines in the constellation)
- Use `onlyRenderVisibleElements` for performance (even though 150 nodes is fine, build the habit for v1's 900)
- Use the React Flow `Background` component with a very subtle dot or grid pattern, or omit entirely for the cleanest look
- No minimap or controls UI (we want a clean canvas — controls add clutter)

## What v0 explicitly does NOT include

- Real O*NET data — mock only
- Per-job pages or routes — single page
- Intercepting routes / URL state — local state only
- OG images — not yet
- Search bar — not yet
- Cluster labels on the canvas — not yet
- About page, header, footer — not yet
- Mobile-specific tuning — desktop-first; don't break on mobile but don't optimise either

## Definition of done for v0

I should be able to:

- Run the dev server and see ~150 bubbles arranged in spatial clusters on a dark canvas
- Pan and zoom smoothly
- Hover a bubble and see it brighten with a label
- Click a bubble and see a panel slide in with the job's info
- See the top 5 neighbours in the panel; clicking one switches the panel to that job
- Close the panel by clicking outside or pressing Esc
- The whole thing feels calm and considered, not loud or busy

Build this in the order: types → mock data → constellation skeleton → bubble styling → panel → interactions. Get it visible early, polish iteratively.

Don't overthink the mock data generator — a deterministic generator with hardcoded cluster centers and a seeded random for jitter is fine. Quality of data isn't the v0 success criterion; quality of interaction and visual is.
