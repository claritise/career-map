# Career Map — Docs

The source-of-truth documents for what we're building and how.

Read in order if you're new:

1. **[00-product-brief.md](./00-product-brief.md)** — the original v0 build brief. What Career Map is at the product level, what v0 set out to prove, what's explicitly out of scope. Mostly historical now that v0 has shipped, but useful context for the design choices already in the codebase.

2. **[01-data-pipeline.md](./01-data-pipeline.md)** — the Python build pipeline. Takes O*NET + BLS, produces the static JSON files (`atlas.json`, `details/*.json`, `neighbours/*.json`, `clusters.json`) that the frontend consumes. Run locally when O*NET releases a new version; outputs are committed to the repo.

3. **[02-full-system-context.md](./02-full-system-context.md)** — the full v1 architecture brief. Data + pipeline + frontend routing + rendering + fetching + deploy, end-to-end. This is the document you hand a new contributor (human or AI) who needs to understand the whole system, not one slice.

If anything in these docs disagrees with what the code currently does, the docs reflect the *target* state for v1. The code currently reflects v0 (mock data, single-page, no per-job routes).
