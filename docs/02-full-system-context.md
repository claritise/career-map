# Career Map — Full System Context

## What it is

A free, fast, beautifully-designed interactive map of the US labour market. ~900 occupations from the US Department of Labor's O*NET database are arranged spatially by skill similarity. Users explore the constellation, click a job to see a panel with details and similar careers, and can share specific jobs via per-occupation URLs with custom social preview cards.

The product surface is small: one constellation page, ~900 statically generated per-job pages, panels that overlay the constellation, a few static info pages. No accounts, no backend, no database, no subscriptions. Free forever, hosted entirely as static files on a CDN.

The goal is twofold: genuinely useful for people exploring career transitions, and a beautiful artefact that demonstrates the design and engineering sensibilities of the team that built it.

## Conceptual model

Each occupation is a feature vector in ~120-dimensional space. The dimensions are the union of all O*NET Skills, Knowledge, and Abilities elements; each cell is the importance score (1–5) of that element for that occupation.

Once jobs are vectors, three things follow:

- **Similarity** between two jobs = cosine similarity of their vectors
- **Spatial layout** for visualisation = UMAP projection of the 120D space into 2D
- **Career transitions** = nearest neighbours in the original 120D space

The 2D coordinates are *only* for visual layout. All similarity rankings and skill diffs use the full-dimensional vectors, which preserve more information. The renderer plots dumb pre-computed coordinates; the intelligence is in the build pipeline.

## Architecture overview

```
                ┌─────────────────────┐
                │  O*NET TSVs + BLS   │
                │  (downloaded once)  │
                └─────────┬───────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   Python build       │
              │   pipeline           │
              │   (run locally)      │
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │   /public/data/      │
              │   atlas.json         │
              │   details/*.json     │
              │   neighbours/*.json  │
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │   next build         │
              │   ─ SSG 900 routes   │
              │   ─ Gen 900 OG imgs  │
              │   ─ Copy /public     │
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │   Vercel CDN edge    │
              │   (every URL static) │
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │   Browser            │
              │   ─ Load atlas       │
              │   ─ Render React Flow│
              │   ─ Lazy-load on tap │
              └──────────────────────┘
```

No part of this system runs in response to a user request. Every URL is a static file at the edge.

## Stack

- **Next.js App Router** (latest) — static site generation, routing, file conventions
- **TypeScript** — type safety across the codebase
- **Tailwind CSS** — styling, design tokens
- **React Flow** (`@xyflow/react`) — constellation rendering with built-in pan/zoom/hover/click
- **shadcn/ui** — accessible primitives for panel, dialogs, buttons (copy-and-modify, not a library dependency)
- **Vercel** — hosting and CDN
- **Python** with `pandas`, `numpy`, `scikit-learn`, `umap-learn`, `hdbscan`, `openpyxl` — build pipeline only, runs locally

No backend framework, no database, no tRPC, no API routes, no serverless functions.

## Data pipeline (Python, build time)

Runs once when O*NET releases a new version (~yearly) or when BLS releases new wage data. Produces the static JSON files the frontend consumes. Committed to the repo so deploys don't need Python.

### Inputs

- **O*NET database** (free, US Department of Labor) — zip of TSVs from onetcenter.org/database.html. Files used: `Skills.txt`, `Knowledge.txt`, `Abilities.txt`, `Occupation Data.txt`, `Job Zones.txt`. Each describes ~900 occupations.
- **BLS Occupational Employment Statistics** (free) — `oesm[YY]nat.xlsx` from bls.gov/oes/oes_dl.htm. Columns used: `OCC_CODE`, `A_MEDIAN`, `TOT_EMP`.

### Pipeline steps

**1. Load and pivot O*NET descriptors.** Each TSV is in long format (one row per occupation × element × scale). Filter to `Scale ID == 'IM'` (Importance), pivot to wide: rows = SOC codes, columns = element names, values = importance scores.

**2. Concatenate** the three wide tables horizontally → one matrix of ~900 occupations × ~120 features.

**3. Normalize** with z-score per column (subtract mean, divide by std). Without this, universally-important skills like Active Listening dominate the similarity math and clusters become mushy.

**4. Compute cosine similarity** between every pair of occupations → symmetric 900×900 matrix.

**5. UMAP** to 2D coordinates. Parameters: `n_neighbors=20`, `min_dist=0.15`, `metric='cosine'`, `random_state=42` (pin the seed so layouts are stable across rebuilds). Rescale to a 0–1000 coordinate space for the frontend.

**6. HDBSCAN cluster** the 2D coordinates (not the 120D vectors — clustering on the projection means visual and data clusters match). `min_cluster_size=8`. Expect 15–30 clusters; some occupations end up as noise (-1), treat them as "Other."

**7. Label clusters** by computing the top-importance skills across each cluster's members. Name by hand (~30 minutes for ~25 clusters) or via LLM with the top skills as input.

**8. Join BLS wage data** on SOC code. Strip the `.00` suffix from O*NET codes to match BLS format. Fall back to parent SOC code where O*NET is more granular than BLS, otherwise emit null.

**9. Generate slugs** from titles ("Software Developers" → `software-developers`). Handle collisions by appending the last 4 digits of the SOC code.

**10. Compute top-25 neighbours per occupation** from the similarity matrix. For each pair, compute:

- `similarity`: the cosine score
- `sharedSkills`: skills both score above threshold (3.5 on the 1–5 scale)
- `gapSkills`: skills the neighbour has that the origin doesn't (what the user would need to learn)
- `surplusSkills`: skills the origin has that the neighbour doesn't
- `wageDelta`: neighbour wage minus origin wage

**11. Extract top-10 skills per occupation** for panel display.

**12. Write output files** to `public/data/`:

- `atlas.json` — array of all occupations with minimal render data
- `details/{slug}.json` — verbose data per occupation
- `neighbours/{slug}.json` — top-25 neighbours per occupation
- `clusters.json` — cluster ID → label mapping

### Output shapes

```ts
// atlas.json: Occupation[]
type Occupation = {
  soc: string;            // "15-1252.00"
  slug: string;           // "software-developers"
  title: string;          // "Software Developers"
  x: number;              // 0–1000
  y: number;              // 0–1000
  wage: number | null;    // USD median annual
  employment: number | null;
  jobZone: 1 | 2 | 3 | 4;
  clusterId: number;
};

// details/{slug}.json: Details
type Details = {
  soc: string;
  slug: string;
  title: string;
  description: string;
  topSkills: { name: string; importance: number }[];
  wage: number | null;
  employment: number | null;
  jobZone: 1 | 2 | 3 | 4;
  clusterId: number;
};

// neighbours/{slug}.json: Neighbour[]
type Neighbour = {
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
```

### Output size

Total disk: ~5MB raw, ~1–1.5MB gzipped. `atlas.json` alone is ~150KB raw, ~30KB gzipped. CDN-cacheable.

## Frontend architecture

### Routing

```
app/
├── layout.tsx                          — root layout with @panel slot
├── page.tsx                            — landing constellation
├── @panel/
│   ├── default.tsx                     — null when no panel
│   ├── loading.tsx                     — null
│   ├── error.tsx                       — null
│   └── (.)job/
│       └── [slug]/
│           └── page.tsx                — panel version (intercepted)
├── job/
│   └── [slug]/
│       ├── page.tsx                    — full-page version
│       └── opengraph-image.tsx         — per-job OG image
├── about/
│   └── page.tsx                        — about page
└── components/
    ├── constellation.tsx               — 'use client', React Flow map
    ├── job-bubble.tsx                  — custom React Flow node
    ├── job-content.tsx                 — shared content for panel and full page
    ├── job-panel.tsx                   — panel wrapper
    └── search-bar.tsx                  — 'use client', autocomplete search
```

**Why this structure:** Same job content lives in one component (`job-content.tsx`). Two route files import it with different chrome — one wraps it as a panel, one as a full page. Next's intercepting routes feature (`(.)`) handles "click from constellation → render as panel" while preserving "direct visit / refresh / share → render as full page."

**`@panel` is a parallel route slot** in the layout — a named hole in the JSX where the panel renders when intercepted, otherwise empty. **`(.)`** prefix on `job/[slug]` means "when navigating to this URL from the same level, render this version instead of the full one."

### Static generation

Every route in the app is statically pre-rendered:

- `/` → static, single HTML file
- `/about` → static
- `/job/[slug]` → SSG via `generateStaticParams` listing all 900 slugs → 900 HTML files
- `/@panel/(.)job/[slug]` → SSG, same 900 slugs → 900 HTML files
- `/job/[slug]/opengraph-image` → SSG via `generateImageMetadata` → 900 PNG files

Build output looks like:

```
Route (app)                    Size     First Load JS
┌ ○ /                          1.2 kB   95 kB
├ ○ /about                     0.4 kB   80 kB
├ ● /job/[slug]                2.1 kB   110 kB
├   ├ /job/software-developers
├   ├ /job/registered-nurses
├   └ [+898 more paths]
```

`○` = static, `●` = SSG with params. Both are CDN-served. Zero serverless functions invoked at runtime.

### Data fetching

Static JSON files in `/public/data/` are served as static assets by Vercel's CDN with automatic gzip/brotli compression. The browser fetches them directly — no API routes, no Server Components fetching at request time.

**Two layers of fetching:**

```ts
// lib/data.ts — typed fetcher wrappers

export async function getAtlas(): Promise<Occupation[]> {
  const res = await fetch('/data/atlas.json');
  if (!res.ok) throw new Error('Failed to load atlas');
  return res.json();
}

export async function getDetails(slug: string): Promise<Details> {
  const res = await fetch(`/data/details/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to load details for ${slug}`);
  return res.json();
}

export async function getNeighbours(slug: string): Promise<Neighbour[]> {
  const res = await fetch(`/data/neighbours/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to load neighbours for ${slug}`);
  return res.json();
}
```

**Build-time fetching for SSG pages.** The same fetchers work from both server context (during `next build`) and client context (at runtime). When the page builds:

```ts
// app/job/[slug]/page.tsx — Server Component
import { getDetails, getNeighbours, getAllSlugs } from '@/lib/data';

export async function generateStaticParams() {
  const slugs = await getAllSlugs();  // reads atlas.json from disk at build time
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const details = await getDetails(slug);
  return {
    title: `${details.title} — Career Map`,
    description: details.description.slice(0, 160),
    openGraph: { images: [`/og/${slug}.png`] },
  };
}

export default async function JobPage({ params }) {
  const { slug } = await params;
  const details = await getDetails(slug);
  const neighbours = await getNeighbours(slug);
  return (
    <main className="full-page-layout">
      <JobContent details={details} neighbours={neighbours} />
    </main>
  );
}
```

At build time, `getDetails` reads the JSON files from `/public/data/` and embeds the data into the pre-rendered HTML. The page ships as a complete static HTML file with the job data inlined.

**Client-side fetching for the constellation.** The atlas is too large to embed in HTML (would inflate every page load), so the Client Component fetches it after mount:

```tsx
// components/constellation.tsx
'use client';
import { useState, useEffect } from 'react';
import { getAtlas } from '@/lib/data';

export function Constellation() {
  const [atlas, setAtlas] = useState<Occupation[] | null>(null);

  useEffect(() => {
    getAtlas().then(setAtlas);
  }, []);

  if (!atlas) return <ConstellationSkeleton />;
  return <ReactFlowMap atlas={atlas} />;
}
```

The atlas JSON (gzipped ~30KB) loads from the CDN edge in under 100ms. The user sees a loading state briefly, then the constellation renders.

**Click handlers fetch neighbours on demand:**

```tsx
const handleNodeClick = async (slug: string) => {
  router.push(`/job/${slug}`, { scroll: false });
  // Intercepting route loads — neighbours fetched inside JobContent
};
```

Inside `JobContent` (or whatever panel content component), neighbours load via the same fetcher:

```tsx
function JobContent({ slug }: { slug: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [neighbours, setNeighbours] = useState<Neighbour[] | null>(null);

  useEffect(() => {
    Promise.all([
      getDetails(slug),
      getNeighbours(slug),
    ]).then(([d, n]) => {
      setDetails(d);
      setNeighbours(n);
    });
  }, [slug]);

  if (!details || !neighbours) return <PanelSkeleton />;
  return <PanelLayout details={details} neighbours={neighbours} />;
}
```

For the panel-via-intercepting-route case, the same component is invoked. The data is fetched from CDN; if cached (likely after first visit), the panel feels instant.

### Caching strategy

Vercel's CDN applies default cache headers to `/public` assets — typically 1 year max-age with revalidation. Optionally tighten in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/data/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800" }
      ]
    }
  ]
}
```

Browser-side: the `fetch` calls hit the HTTP cache. A user who's already loaded `atlas.json` once won't re-download it on subsequent visits.

### URL state and navigation

URLs encode which job is selected:

- `/` → constellation, no selection
- `/job/software-developers` → constellation with panel showing Software Developers
  - If user came from `/`, this is intercepted and renders as a panel
  - If user landed directly, it renders as the full page

Click handlers use `router.push('/job/{slug}', { scroll: false })` to update the URL without reloading. The Constellation Client Component stays mounted, preserves zoom/pan state, and only the panel content changes.

Closing the panel: `router.back()` (returns to `/`) or `router.push('/')`. Esc key triggers the same.

The `scroll: false` is important — without it, the browser scrolls to the top of the page on navigation, which feels wrong.

### Reading URL state inside the constellation

To highlight the currently-selected node, the Constellation Client Component reads the URL:

```tsx
'use client';
import { useParams, usePathname } from 'next/navigation';

function Constellation({ atlas }) {
  const pathname = usePathname();
  const selectedSlug = pathname.startsWith('/job/')
    ? pathname.split('/')[2]
    : null;
  // ... render with selected highlight
}
```

This is read-only — the URL is the source of truth for selection state, and the constellation reflects it. Clicking a node updates the URL, which re-renders the constellation with the new selection.

## Rendering the constellation

React Flow handles the heavy lifting: pan, zoom, hit detection, hover, click, viewport culling. Use `@xyflow/react` (the current package; `reactflow` is the deprecated name).

### Node setup

Each occupation becomes a React Flow node:

```tsx
const nodes = atlas.map(occ => ({
  id: occ.slug,
  type: 'jobBubble',  // custom node type
  position: { x: occ.x, y: occ.y },
  data: { ...occ },
  draggable: false,
  selectable: true,
}));

const edges = [];  // no edges in the constellation
```

### Custom node component

```tsx
// components/job-bubble.tsx
'use client';
import { Handle, Position } from '@xyflow/react';

export function JobBubble({ data, selected }) {
  const radius = scaleRadius(data.employment);
  const luminosity = scaleLuminosity(data.jobZone);

  return (
    <div
      style={{
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        backgroundColor: luminosity,
        opacity: data.dimmed ? 0.25 : 1,
        boxShadow: selected ? '0 0 16px rgba(255, 245, 230, 0.6)' : undefined,
        transition: 'opacity 200ms, box-shadow 200ms',
      }}
    />
  );
}
```

Tailwind classes can replace inline styles for everything except the dynamic radius and luminosity, which need to come from data.

### Performance

`onlyRenderVisibleElements` on the ReactFlow component enables viewport culling — only nodes within the visible area get rendered to the DOM. At typical zoom levels that's 100–300 of the 900, well within DOM performance budget.

Memoize the node component with `React.memo` so it doesn't re-render unless its data changes. The Constellation manages selection state and passes a `dimmed` flag to each node's data; only nodes whose dimmed state changes re-render.

### Visual style

- **Background:** very deep near-black (e.g. `#0a0a0a` or Polymer's equivalent). Not pure black — a touch of warmth.
- **Bubbles:** filled circles, no individual gradients. Slightly off-white (warm cream tone like `#e8e6e3`) with luminosity varying by `jobZone` (entry-level dimmer, specialised brighter).
- **Sizing:** radius mapped from employment count via sqrt scale, range 4px–24px. Sqrt rather than linear so the largest jobs don't visually dominate.
- **Hover:** brighten + soft `box-shadow` glow with warm cream tint
- **Selected:** brightest state + strong glow. Non-neighbour bubbles dim to ~25% opacity. Top-N neighbours stay at full opacity to highlight transition options.
- **Labels:** None by default. Hover shows a floating label near the cursor. Top 10–15 bubbles by employment get permanent labels at low opacity (~40%) as anchor points so users can orient.
- **No background grid, no controls, no minimap.** Clean canvas.

## OG image generation

Each `/job/[slug]` route generates a custom Open Graph image at build time using Next's `opengraph-image.tsx` convention:

```tsx
// app/job/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { getDetails, getAllSlugs, getAtlas } from '@/lib/data';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateImageMetadata() {
  const slugs = await getAllSlugs();
  return slugs.map(slug => ({ id: slug }));
}

export default async function OGImage({ params }) {
  const { slug } = await params;
  const details = await getDetails(slug);
  const atlas = await getAtlas();

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: '#0a0a0a',
        color: '#e8e6e3',
        // Polymer-styled card with constellation thumbnail showing
        // the highlighted bubble, title, wage, footer
      }}>
        <ConstellationThumbnail atlas={atlas} highlightSlug={slug} />
        <div className="content">
          <h1>{details.title}</h1>
          <p>${details.wage?.toLocaleString()} median · {details.employment?.toLocaleString()} working</p>
        </div>
        <footer>Career Map · by Polymer</footer>
      </div>
    ),
    size
  );
}
```

900 OG images generated at build time, each showing the constellation with that specific job's bubble glowing. Every Twitter share unfurls into a custom Polymer-styled preview. This is the viral mechanic — the share card doing the marketing work.

`ImageResponse` uses a simplified rendering engine (Satori under the hood) — not all CSS is supported. Stick to basic flexbox, colours, fonts, simple shapes. Inline SVG works for the constellation thumbnail.

## Pages

### Landing (`/`)

Constellation full-bleed, search bar in the top-left corner, very minimal chrome. Footer with "Career Map · by Polymer · about · methodology". First-time visitors might see a brief onboarding tooltip ("click any bubble to explore") that dismisses on first interaction.

### Job (`/job/[slug]`)

Two modes — panel overlay (intercepted) or full page (direct). Both render the same `JobContent` component:

- Title, cluster label
- Wage, employment, job zone
- Description (full paragraph)
- Top skills (list of 10, with importance bars)
- "Similar careers" section: top 5 neighbours as cards
  - Each card: title, wage delta (e.g. "+$32k"), similarity score visualised, shared skills summary
  - Clicking a card navigates to that neighbour
- "View on map" button (panel only — closes panel and centres map on this bubble)
- Close button (panel only)

### About

Static markdown-style page. Brief explanation, methodology link, credits (O*NET, BLS), made-by-Polymer attribution with link.

### Methodology

Static page explaining the pipeline at a layman level. Useful for credibility — links to O*NET and BLS, explains UMAP and clustering in plain English, acknowledges limitations (US-only, national averages, snapshot in time).

## Deploy and build

**Local development:**

```bash
pnpm dev
```

**Build:**

```bash
pnpm build
# Internally: next build
# Reads from public/data/ for SSG
# Generates 900 pages × 2 (intercepted + full) + 900 OG images
# Takes ~60-120 seconds
```

**Deploy:**

```bash
git push origin main
# Vercel auto-deploys on push
# Build runs in Vercel's environment, artefacts uploaded to CDN
```

**Data refresh (yearly):**

```bash
cd build-pipeline
python build_data.py  # writes to ../public/data/
cd ..
git add public/data/
git commit -m "Refresh: O*NET 31.0, BLS 2026"
git push
```

## What v1 does NOT include

- Personalised "drop your resume / skill profile" feature
- Search by skills rather than title
- Regional wage variation (uses national medians)
- Time-series / historical comparison
- Newer roles O*NET hasn't catalogued (AI-era jobs)
- Multi-region support (US labour data only)
- Account features, saved jobs, history
- Analytics dashboards
- Mobile-specific layout (works on mobile but desktop-first)

All of these are reasonable v2+ ideas. Keeping v1 tight is the point.

## Definition of done for v1

- All 900 occupations render correctly in the constellation
- Spot-checks pass: Software Developers' neighbours are tech roles, Nurses' neighbours are healthcare, Carpenters' neighbours are trades
- Panel opens on click, shows correct data, top-5 neighbours navigable
- URLs work: `/job/software-developers` opens the panel (from constellation) or renders the full page (direct visit)
- OG images render correctly when sharing a job URL on Twitter/Linkedin/etc.
- Build is fully static — no serverless function invocations at runtime
- Total wire size under 1.5MB for first visit
- Constellation interactive within 500ms of landing
- Visually matches Polymer's design language — calm, dark, considered, not generic

## Why this architecture

Every choice traces back to one of three principles:

1. **The data is static; the renderer should be too.** O*NET updates yearly, BLS updates yearly. Nothing here needs request-time computation. Static generation is correct, free-tier-friendly, and infinitely scalable.

2. **The viral mechanic depends on per-job URLs.** Without `/job/[slug]` routes, Twitter unfurl previews don't work, Google can't index individual occupations, and people can't share specific jobs. The intercepting-routes pattern keeps the URL infrastructure while preserving the UX of "panel over the map."

3. **The intelligence is in the pipeline, not the runtime.** UMAP, similarity, clustering, neighbour ranking — all expensive operations done once in Python at build time. The browser plots dumb pre-computed coordinates. This is what makes the experience instant.
