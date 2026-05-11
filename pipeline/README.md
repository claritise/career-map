# Career Map — data pipeline

Python script that turns O*NET + BLS source files into the static JSON dataset the [web frontend](../web) consumes. Run locally, output is committed to the repo, the frontend just reads files.

For the full conceptual reference (what each step does, why), see [`docs/01-data-pipeline.md`](../docs/01-data-pipeline.md). This README is operational only.

## Status

**Phase 0 scaffold.** The script's 12 pipeline steps are stubbed (`raise NotImplementedError`). Running it today exits cleanly with a "stub: not implemented" message — useful for confirming the environment works. Phase 1 fills in the bodies against real data.

## One-time setup

### 1. Python environment

The project pins to Python ≥3.10. `uv` is the path of least resistance; `pip` + venv also works.

**Option A — uv (recommended):**

```bash
cd pipeline
uv sync
```

**Option B — pip + venv:**

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Both create an isolated environment with `pandas`, `numpy`, `scikit-learn`, `umap-learn`, `hdbscan`, and `openpyxl` installed.

### 2. Download source data

Source files are big (~50MB combined), re-downloadable, and not committed. They live in `pipeline/data-sources/`, which is gitignored.

**O*NET database** (yearly release, free):

1. Visit https://www.onetcenter.org/database.html
2. Download the latest "Text version" (TSV zip). Current version as of this writing: **30.2** (February 2026).
3. Unzip into `pipeline/data-sources/onet/`. After extraction you should see files like `Skills.txt`, `Knowledge.txt`, `Abilities.txt`, `Occupation Data.txt`, `Job Zones.txt` directly inside that directory.

**BLS Occupational Employment and Wage Statistics** (yearly release, free):

1. Visit https://www.bls.gov/oes/oes_dl.htm
2. Under the most recent "May YYYY" section, click **National (XLSX)**. The file name pattern is `national_M[YYYY]_dl.xlsx` (e.g. `national_M2024_dl.xlsx` contains May 2024 wage estimates; BLS changed the naming convention from the older `oesmYYnat.xlsx` around 2023).
3. Save into `pipeline/data-sources/`. The script's default expects `national_M2024_dl.xlsx`; if you have a different year, pass `--bls-xlsx data-sources/national_M2025_dl.xlsx` etc.

The xlsx has multiple sheets — the data is on the first sheet (also named `national_M[YYYY]_dl`); other sheets (`Field Descriptions`, `UpdateTime`, `Filler`) are metadata. The pipeline reads sheet 0 explicitly.

After both downloads:

```
pipeline/data-sources/
├── onet/
│   ├── Skills.txt
│   ├── Knowledge.txt
│   ├── Abilities.txt
│   ├── Occupation Data.txt
│   ├── Job Zones.txt
│   └── ... (other O*NET files)
└── national_M2024_dl.xlsx
```

## Running the pipeline

From the `pipeline/` directory:

```bash
python build_data.py
```

With explicit paths:

```bash
python build_data.py \
    --onet-dir data-sources/onet \
    --bls-xlsx data-sources/national_M2024_dl.xlsx \
    --output-dir ../web/public/data \
    --verbose
```

Successful runs write four artifacts into `web/public/data/`:

- `atlas.json` — array of all occupations (render-minimal: soc, slug, title, x, y, wage, employment, jobZone, clusterId)
- `details/{slug}.json` — ~900 files, one per occupation, with description + topSkills
- `neighbours/{slug}.json` — ~900 files, top-25 similar occupations per origin
- `clusters.json` — cluster ID → human-readable label

Total disk: ~5MB raw, ~1–1.5MB gzipped.

## When to re-run

- **O*NET releases a new version** — typically annual, Q3
- **BLS releases new wage data** — typically annual, Q2
- **You change pipeline parameters** (UMAP, HDBSCAN, similarity thresholds) — re-run + spot-check

The script outputs are deterministic given pinned seeds (`UMAP_RANDOM_STATE = 42` etc.). Same inputs → identical outputs. Commit the JSON output as part of the data-refresh PR.

## Spot-checking the output

The script doesn't validate semantic correctness — that's a human eyeball job. After a run:

```bash
# Software Developers — neighbours should be tech roles
cat ../web/public/data/neighbours/software-developers.json | jq '.[].title'

# Registered Nurses — neighbours should be healthcare
cat ../web/public/data/neighbours/registered-nurses.json | jq '.[].title'

# Carpenters — neighbours should be skilled trades
cat ../web/public/data/neighbours/carpenters.json | jq '.[].title'
```

If those look right, the pipeline is working. If a Carpenter's nearest neighbour is a Surgeon, something is wrong (likely normalization or feature matrix assembly).

## File layout

```
pipeline/
├── README.md                  ← you are here
├── pyproject.toml             ← deps + project metadata
├── .gitignore                 ← excludes data-sources/ + venv
├── build_data.py              ← the script (12 step functions)
└── data-sources/              ← gitignored; download targets land here
    └── .gitkeep
```

## Troubleshooting

**`ModuleNotFoundError: No module named 'umap'`** — activate the venv (`source .venv/bin/activate`) or use `uv run python build_data.py`.

**`O*NET directory not found`** — check the path; the default expects `pipeline/data-sources/onet/`. Pass `--onet-dir` explicitly if it lives elsewhere.

**`BLS xlsx not found`** — same; default expects `pipeline/data-sources/national_M2024_dl.xlsx`. Pass `--bls-xlsx /full/path/to/file.xlsx`.

**`NotImplementedError: Phase 1: ...`** — Phase 0 stub message. Expected until Phase 1 fills in the step bodies.

## Why this lives in a sibling directory

Keeping `/pipeline/` separate from `/web/` makes the Python toolchain (uv/venv, `__pycache__`, the 50MB raw-data dump) invisible to the Next.js frontend's tooling (`pnpm`, `tsc`, `next build`). The boundary is enforced by directory: nothing in `/web/` imports from `/pipeline/`; the contract is the JSON files in `web/public/data/`.

When O*NET data needs refreshing, the workflow is: download → `python build_data.py` → commit the diff in `web/public/data/`. No Python required at deploy time.
