# Career Map — Build plan (v0 → v1)

## Where we are

v0 is shipped. ~150 mock occupations render in a constellation, panel slides in on click, neighbours navigable, Esc/click-outside close. 73 unit tests across pure-logic modules. Code is structured so ~70% of it survives the v1 swap untouched; the mock-data layer (~1000 lines) is the part that gets ejected.

## Where we're going

v1 = real O*NET data (~900 occupations), per-job URLs with intercepting routes for "panel over the map" UX, custom OG images for every occupation, about + methodology pages, search.

Three full-context documents already exist:

- [00-product-brief.md](./00-product-brief.md) — what v0 was
- [01-data-pipeline.md](./01-data-pipeline.md) — the Python pipeline
- [02-full-system-context.md](./02-full-system-context.md) — the v1 target system

This doc is the *plan*, not the spec — phase sequence, dependencies, estimates, what blocks what.

## Sequence overview

Three streams, partly parallel:

1. **Python pipeline** — longest pole, blocks the v1 frontend swap. Produces the real `atlas.json` / `details/*.json` / `neighbours/*.json` / `clusters.json` that everything downstream depends on.
2. **Frontend v1 transplant** — waits on stream 1. Mechanical once the JSON exists: delete mock layer, add fetchers + routes, rewire selection to URL state.
3. **Polish + share infrastructure** — waits on stream 2. OG images, methodology page, about page, search bar. These need real data + the routing scaffold to be meaningful.

## Phases

### Phase 0 — Pipeline scaffolding *(half day, zero blockers)*

Create the directory structure and tooling so the actual pipeline implementation can start without setup overhead.

- `/pipeline/` directory at repo root (separate from `/web/`)
- `pyproject.toml` (or `requirements.txt`) with pinned versions of `pandas`, `numpy`, `scikit-learn`, `umap-learn`, `hdbscan`, `openpyxl`
- `pipeline/data-sources/` directory in `.gitignore` — raw O*NET zip (~50MB) and BLS xlsx don't get committed
- `pipeline/build_data.py` skeleton with the 12 pipeline steps stubbed as functions with docstrings
- `pipeline/README.md` documenting: which O*NET version (30.2 / Feb 2026) and BLS file (`oesm[YY]nat.xlsx`) to download, where to put them, how to run the script

**Done when:** someone can `cd pipeline && python build_data.py` and it runs to completion (producing nothing useful yet, but no import errors, no missing-data errors).

### Phase 1 — Pipeline implementation *(2–3 days)*

Implement the 12 steps end-to-end against real data. Iterate on parameters until the spot-checks pass.

- Steps 1–4: load TSVs, pivot, concat, normalize, compute cosine similarity matrix
- Step 5: UMAP to 2D, rescale to 0–1000 coordinate space. Iterate `n_neighbors` and `min_dist` until clusters look visually distinct (matplotlib scatter is fine for iteration; don't wire to frontend yet)
- Step 6: HDBSCAN. Iterate `min_cluster_size` until cluster count lands in 15–30
- Step 7: cluster labelling. Either hand-label (~30 min for 25 clusters) or feed each cluster's top-importance skills to an LLM for 2-word names
- Step 8: BLS join on SOC code (strip `.00` suffix). Handle granularity mismatches with parent-SOC fallback or null
- Step 9: slug generation with collision handling (append last 4 SOC digits)
- Step 10: top-25 neighbours per occupation with shared/gap/surplus skills + wageDelta
- Step 11: top-10 skills per occupation
- Step 12: write `atlas.json`, `details/*.json`, `neighbours/*.json`, `clusters.json` into `web/public/data/`

**Spot-checks (definition of done):**

- Software Developers' neighbours are tech roles (Programmers, Web Developers, Database Admins) — not nurses or plumbers
- Registered Nurses' neighbours are healthcare roles
- Carpenters' neighbours are skilled trades
- Constellation plot (scatter + cluster colours) looks like the UMAP family of visualizations — irregular blobs with bridges between related fields, not uniform circles
- Output JSON files load without parse errors and types match the v1 spec

**Risk:** UMAP/HDBSCAN parameter tuning can eat time. If clusters look bad on first try, iterate. The script outputs are deterministic once seeds are pinned, so subsequent rebuilds are cheap.

### Phase 2 — Frontend v1 transplant *(~1 day)*

With real JSON in `web/public/data/`, swap the mock layer for real data and rewire routing.

**Delete:**
- `web/src/lib/mock-data.ts`
- `web/src/lib/mock-data-clusters.ts`
- `web/src/lib/mock-data.test.ts`
- `web/src/lib/mock-data-clusters.test.ts`

**Update types** in `web/src/lib/types.ts`:
- Add `soc: string` to `Occupation`, `Neighbour`
- Add `surplusSkills: string[]` to `Neighbour`
- Make `wage` and `employment` nullable (`number | null`) — BLS coverage gaps emit null per spec
- Split `Occupation` (atlas-minimal) from `Details` (verbose) per the v1 contract
- `OccupationLayout` either stays separate or flattens back into atlas entries; reader's choice

**Add `web/src/lib/data.ts`:**
- `getAtlas(): Promise<Occupation[]>` — works server-side (via `fs.readFile`) and client-side (via `fetch('/data/atlas.json')`)
- `getDetails(slug: string): Promise<Details>`
- `getNeighbours(slug: string): Promise<Neighbour[]>`
- `getAllSlugs(): Promise<string[]>` (reads atlas slugs, used by `generateStaticParams`)

**Add `web/src/lib/data.test.ts`** with a tiny fixture (3–5 occupations) covering the fetcher shape contracts. Real data integration tests come from running `next build` end-to-end.

**Routing:**
- `web/src/app/page.tsx`: Server Component, reads atlas at build time, passes to Constellation as props (avoid the brief's client-`useEffect` fetch pattern — atlas always needed on every page where Constellation lives, inline it)
- `web/src/app/job/[slug]/page.tsx`: full-page route, `generateStaticParams` over all slugs, `generateMetadata` for SEO
- `web/src/app/@panel/default.tsx`: returns `null`
- `web/src/app/@panel/(.)job/[slug]/page.tsx`: intercepted panel version
- `web/src/app/layout.tsx`: add `@panel` slot
- `web/src/components/job-content.tsx`: shared job content used by both panel and full-page wrappers

**Rewire Constellation:**
- Selection state comes from `usePathname()` (`/job/[slug]` → that slug, else null)
- Click handler: `router.push('/job/${slug}', { scroll: false })`
- Pane click / Esc: `router.push('/', { scroll: false })`
- `resolveSelectedSlug`, `Selection` type, `buildNodes`, `useEscapeKey` all survive

**Update existing tests** to use fixture JSON instead of generator output. `format.ts`, `build-nodes.ts`, `use-escape-key.ts` tests all keep working.

**Done when:**
- `pnpm dev` shows the real 900-occupation constellation
- Click a bubble → URL updates to `/job/[slug]`, panel slides in
- Refresh on `/job/software-developers` → full page renders (not panel)
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all green
- `pnpm build` succeeds and produces ~900 static HTML files

### Phase 3 — OG images *(half day)*

Per-occupation Open Graph images for share-link unfurling.

- `web/src/app/job/[slug]/opengraph-image.tsx` with `generateImageMetadata` over all slugs
- Renders 1200×630 PNG: constellation thumbnail (SVG, via Satori) with the bubble for this occupation highlighted, plus title + wage + footer
- Verify locally that ~900 images generate in reasonable build time

**Risk:** Satori (the rendering engine behind `next/og`) is slow — ~50–200ms per image. 900 × 100ms = ~90s added to every build. Mitigation: gate the route behind `process.env.VERCEL === '1'` so local builds skip it, only Vercel CI builds the full set. Confirm actual timing on first run.

**Done when:** sharing a `/job/software-developers` link to Twitter shows a custom card with the constellation, title, and wage.

### Phase 4 — Chrome pages *(half to one day, partly parallel)*

Non-blocking content pages.

- **Search bar** (`web/src/components/search-bar.tsx`): Client Component with autocomplete over atlas titles. Fuse.js for fuzzy match, or simple substring if 900 titles is small enough that fuzzy is overkill. Lives in the top-left corner of `/`.
- **About page** (`web/src/app/about/page.tsx`): static markdown-style, brief explanation, credits (O*NET, BLS), made-by attribution.
- **Methodology page** (`web/src/app/methodology/page.tsx`): plain-English explanation of UMAP, clustering, similarity computation. Links to O*NET + BLS sources. Acknowledges limitations (US-only, national averages, snapshot in time).
- Footer linking all three from `/`.

**Done when:** all three pages render, search jumps to the correct `/job/[slug]` on selection, footer links work.

### Phase 5 — Final polish + deploy *(half day)*

Production readiness pass.

- Performance budget: confirm <1.5MB total wire size for first visit (Lighthouse or `next build` output)
- Constellation interactive within 500ms — measure on real network conditions
- Onboarding hint on first visit ("click any bubble to explore") that dismisses on first click; remember dismissal in localStorage
- Cross-browser smoke (Chrome, Safari, Firefox at minimum)
- `vercel.json` with cache headers per the brief
- Final visual review against the design references in [02-full-system-context.md](./02-full-system-context.md)
- Deploy to Vercel, verify CDN edge serving, check OG images unfurl correctly on Twitter / Linkedin / Slack

**Done when:** the v1 definition of done from [02-full-system-context.md](./02-full-system-context.md) is met end-to-end.

## Total estimate

| Phase | Estimate | Blocks |
|-------|----------|--------|
| 0. Pipeline scaffolding | 0.5 day | nothing |
| 1. Pipeline implementation | 2–3 days | Phase 2 |
| 2. Frontend transplant | 1 day | Phase 3, 4 |
| 3. OG images | 0.5 day | — |
| 4. Chrome pages | 0.5–1 day | — |
| 5. Polish + deploy | 0.5 day | — |

**Total: ~5–6 working days** if pipeline iteration goes smoothly. The main timing risk is Phase 1: UMAP/HDBSCAN parameter tuning is empirical, and clusters that "look right" can take a few iterations.

## What we're explicitly NOT building in v1

(Same as the brief — restating here for plan clarity.)

- Personalised "drop your resume" feature
- Search by skills rather than title
- Regional wage variation
- Time-series / historical data
- AI-era jobs not in O*NET (prompt engineer, etc.)
- Multi-region / non-US
- Accounts, saved jobs, history
- Mobile-specific layout (works on mobile, not optimized)

## Decisions deferred until pipeline output exists

These are intentionally postponed — easier to decide with real data in hand than to guess in advance.

- **Cluster naming approach** — hand-label vs LLM-name. Decide after seeing how interpretable the HDBSCAN groupings actually are.
- **Anchor label selection** — currently "first N in input order." With real data we'll likely want curated anchors (one big representative job per cluster). Decide after seeing the layout.
- **UMAP parameter tuning** — start with brief defaults (`n_neighbors=20`, `min_dist=0.15`); iterate based on spot-check quality.
- **Whether to keep `OccupationLayout` split from `Occupation`** — depends on whether the atlas-minimal entry feels cleaner with `x,y` inline or separated. Decide during Phase 2.

## Where to pick up

Auto-mode autonomous starting point is **Phase 0** — pipeline scaffolding doesn't touch the web repo, doesn't need real data, and unblocks Phase 1 once you've downloaded the source files.
