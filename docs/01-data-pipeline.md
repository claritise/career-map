# Career Map — Data Generation Pipeline

## What this pipeline does

Converts the US Department of Labor's O*NET occupation database plus BLS wage data into the static JSON files that the Career Map frontend consumes. Runs once at build time in Python. Output is a flat set of files that the browser loads directly from CDN.

The pipeline takes ~900 occupations described by ~120 skill/knowledge/ability features and produces:

- A 2D coordinate per occupation (for the constellation layout)
- A cluster assignment per occupation (for optional colour coding)
- A list of top-25 most similar occupations per occupation (for the panel's "similar careers" section)
- Median wage and employment count per occupation (from BLS)
- Cleaned title, slug, and description per occupation

The intelligence is entirely in this build step. The frontend renderer is dumb — it just plots points at the coordinates this pipeline generates.

## Input data

### O*NET database (free, public, US Department of Labor)

- Download URL: https://www.onetcenter.org/database.html
- Format: zip of TSV files
- Update cadence: yearly, with the current version being 30.2 (released February 2026)
- Relevant files inside the zip:
  - `Skills.txt` — ~35 skills × 900 occupations × 2 scales (Importance, Level), one row per combination
  - `Knowledge.txt` — ~33 knowledge areas, same long-format structure
  - `Abilities.txt` — ~52 abilities, same long-format structure
  - `Occupation Data.txt` — titles and descriptions, one row per occupation
  - `Job Zones.txt` — preparation level (1–4 under new framework), one row per occupation

### BLS Occupational Employment Statistics (free, public)

- Download URL: https://www.bls.gov/oes/oes_dl.htm
- File: `oesm[YY]nat.xlsx` (national wage estimates, e.g. `oesm23nat.xlsx` for 2023 data)
- Relevant columns: `OCC_CODE` (SOC code), `A_MEDIAN` (annual median wage), `TOT_EMP` (total employment count)
- Update cadence: yearly, usually March/April with prior-year data

## Conceptual model

Each occupation is treated as a feature vector in ~120-dimensional space. The dimensions are the union of all O*NET Skills, Knowledge, and Abilities elements. Each cell is the importance score (1–5) of that element for that occupation.

So "Software Developers" might be a row like:

```
[Active Listening: 4.0, Programming: 4.5, Mathematics: 4.0, Manual Dexterity: 2.0, ...]
```

And "Registered Nurses" is another row with the same columns but very different values.

Once jobs are vectors, the analysis is standard:

- **Similarity** between two jobs = cosine similarity of their vectors
- **Spatial layout** = UMAP projection of the 120D space into 2D
- **Clusters** = HDBSCAN clustering on the 2D coordinates (so visual and data clusters match)
- **Career transitions** = nearest neighbours in the original 120D space (more accurate than using 2D distances)

The 2D coordinates are only for visual layout. All similarity calculations and neighbour rankings happen in the full 120D space.

## Pipeline steps

### Step 1: Load and pivot O*NET descriptors

Each O*NET descriptor file is in long format:

```
SOC Code | Element ID | Element Name      | Scale ID | Data Value
15-1252  | 2.A.1.a    | Reading Compreh.  | IM       | 4.5
15-1252  | 2.A.1.a    | Reading Compreh.  | LV       | 5.0
...
```

For each of Skills, Knowledge, Abilities:

- Read the TSV
- Filter to `Scale ID == 'IM'` (Importance — use this, not Level)
- Pivot to wide format: rows = SOC codes, columns = element names, values = importance scores

Result is three wide tables, one per descriptor type, each ~900 rows × 30–50 columns.

**Why Importance not Level:** Importance asks "how important is this skill?", Level asks "how proficient must you be?" Importance is more discriminating across jobs and is the standard choice in academic work on occupational similarity.

### Step 2: Concatenate into one matrix

Horizontally concatenate the three wide tables. Result is one big matrix of ~900 occupations × ~120 features.

Drop any occupations with missing rows (some occupations have incomplete O*NET coverage). Expect to lose a handful, not many.

### Step 3: Normalize the feature matrix

This step matters more than it seems. Without normalization, skills that everyone needs (Active Listening rates 3–4 for almost every job) dominate the similarity math, and clusters become mushy.

Apply z-score normalization per column: for each feature, subtract its mean across all occupations and divide by its standard deviation. Now every feature has mean 0 and std 1, and each contributes equally to distance calculations. Distinctive skills (Programming, Surgery, Welding) shine through because they have high variance.

Handle the edge case of zero-variance features (shouldn't happen with real O*NET data, but defensive coding helps): fill resulting NaNs with 0.

### Step 4: Compute pairwise cosine similarity

Compute cosine similarity between every pair of occupations using the normalized matrix. Result is a symmetric 900×900 matrix.

Cosine similarity measures the angle between vectors regardless of magnitude — appropriate for "are these jobs similar in their pattern of skill demands."

Values will roughly range from -0.5 to 1.0, with most pairs near 0 (most jobs aren't very similar to most other jobs).

### Step 5: 2D layout with UMAP

UMAP reduces the 120D space to 2D for visualisation. It's preferred over t-SNE because it preserves both local structure (tight clusters) and global structure (clusters of clusters).

Parameters that matter:

- `n_neighbors`: ~15–30. Smaller emphasises local structure; larger emphasises global. Start with 20.
- `min_dist`: 0.1–0.3. Smaller makes clusters tighter; larger makes them more spread out. Start with 0.15.
- `metric`: `'cosine'` to match the similarity metric used elsewhere.
- `random_state`: pin this to a fixed value (e.g. 42). UMAP is stochastic — without a fixed seed, every run produces a different layout. Pinning ensures the constellation stays stable across rebuilds.

After UMAP, rescale coordinates to a useful coordinate space (e.g. 0–1000 in each axis) by min-max normalization. This makes the frontend's life easier — no negative coordinates, fixed bounds.

### Step 6: Cluster the 2D layout with HDBSCAN

HDBSCAN finds clusters of varying density without requiring you to specify a cluster count. It's appropriate here because the labour market isn't uniformly clustered — some areas (medical specialists) are tight, others (general management) are diffuse.

Cluster on the 2D layout, not the original 120D matrix. Clustering in 120D and then projecting to 2D produces clusters that visually overlap, which looks broken. Clustering on the projection means the visual clusters and the data clusters are the same.

Parameters:

- `min_cluster_size`: 8 (smallest meaningful occupational grouping)
- `min_samples`: 3

Expect 15–30 clusters. Some occupations will be labelled -1 (noise — not in any cluster). Treat these as belonging to an "Other" cluster.

To label clusters: for each cluster, identify the top-importance skills across its member occupations (take the column means within the cluster, sort descending). Either name clusters by hand (~30 minutes of work to label ~25 clusters) or feed the top skills to an LLM and ask for a 2-word name. Save the labels in the output.

### Step 7: Join BLS wage and employment data

BLS uses SOC codes that match O*NET-SOC codes after stripping the `.00` suffix:

- O*NET: `15-1252.00`
- BLS: `15-1252`

For each occupation, look up the corresponding row in the BLS data and pull `A_MEDIAN` (median annual wage) and `TOT_EMP` (employment count). Some O*NET occupations are more granular than BLS — for those, fall back to the parent SOC code or leave the wage as null.

Handle missing data gracefully — emit `null` rather than zero. The frontend should handle both.

### Step 8: Generate slugs

Convert each occupation title to a URL-friendly slug:

- "Software Developers" → `software-developers`
- "Registered Nurses" → `registered-nurses`

Slugification: lowercase, replace any non-alphanumeric sequence with a single hyphen, strip leading/trailing hyphens.

Handle collisions: two different occupations might slugify to the same string (rare but possible). For collisions, append the last 4 digits of the SOC code with separators removed (e.g. `software-developers-1252`).

Save a slug → soc mapping so the frontend can look up the canonical SOC code from a URL slug.

### Step 9: Compute top neighbours per occupation

For each occupation:

- Get its row from the similarity matrix
- Exclude itself (set self-similarity to -1)
- Sort descending, take the top 25
- For each neighbour, compute:
  - `similarity`: the cosine similarity score
  - `sharedSkills`: skills where both occupations score above an importance threshold (3.5 works well — means "meaningfully important to both")
  - `gapSkills`: skills the neighbour scores high on but the origin doesn't (these are what the user would need to learn for the transition)
  - `surplusSkills`: skills the origin scores high on but the neighbour doesn't (skills the user already has that don't transfer to the neighbour — useful information but secondary)
  - `wageDelta`: neighbour's wage minus origin's wage (positive = pay raise, negative = pay cut)

**Threshold tuning:** 3.5 is a starting point on the 1–5 importance scale. Too low and every pair shares 30+ skills; too high and shared lists are sparse. Eyeball the output and adjust if needed.

### Step 10: Compute top skills per occupation

For the panel display, each occupation gets its top 10 skills by importance — just take the highest-scoring rows of its skill vector and emit them as `{ name, importance }` pairs.

### Step 11: Assemble output

Write three sets of files into `public/data/`:

**`atlas.json`** — single file, array of all occupations with minimal data needed for the constellation render:

```json
[
  {
    "soc": "15-1252.00",
    "slug": "software-developers",
    "title": "Software Developers",
    "x": 723,
    "y": 412,
    "wage": 132270,
    "employment": 1656880,
    "jobZone": 4,
    "clusterId": 3,
    "clusterLabel": "Knowledge Work"
  },
  ...
]
```

Size: ~150KB raw, ~30KB gzipped. Loads instantly.

**`details/{slug}.json`** — one file per occupation with verbose data not needed for initial render:

```json
{
  "soc": "15-1252.00",
  "slug": "software-developers",
  "title": "Software Developers",
  "description": "Develop, create, and modify general computer applications...",
  "topSkills": [
    { "name": "Programming", "importance": 4.62 },
    ...
  ],
  "wage": 132270,
  "employment": 1656880,
  "jobZone": 4,
  "clusterId": 3,
  "clusterLabel": "Knowledge Work"
}
```

Loaded only when the user opens a panel for that job. Each file ~2KB.

**`neighbours/{slug}.json`** — one file per occupation with its top 25 similar occupations:

```json
[
  {
    "soc": "15-1251.00",
    "slug": "computer-programmers",
    "title": "Computer Programmers",
    "similarity": 0.87,
    "sharedSkills": ["Programming", "Critical Thinking", ...],
    "gapSkills": ["Systems Analysis"],
    "surplusSkills": ["Active Learning"],
    "wage": 99700,
    "wageDelta": -32570
  },
  ...
]
```

Loaded on click. Each file ~3–5KB.

**Optional: `clusters.json`** — cluster ID to human-readable label mapping, if you want to look up cluster names from the frontend:

```json
{
  "0": "Healthcare",
  "1": "Skilled Trades",
  ...
}
```

## Output directory structure

```
public/
└── data/
    ├── atlas.json
    ├── clusters.json
    ├── details/
    │   ├── software-developers.json
    │   ├── registered-nurses.json
    │   └── ... (~900 files)
    └── neighbours/
        ├── software-developers.json
        ├── registered-nurses.json
        └── ... (~900 files)
```

Total disk: ~5MB raw, ~1–1.5MB gzipped. CDN-cacheable. No server needed.

## Required Python packages

- `pandas` — data manipulation
- `numpy` — array math
- `scikit-learn` — for cosine similarity
- `umap-learn` — for 2D projection
- `hdbscan` — for clustering
- `openpyxl` — for reading the BLS xlsx file

## Practical notes

- The whole pipeline runs in under a minute on a laptop.
- Pin the UMAP `random_state` — without it, the layout shifts every run and the constellation feels different each time you rebuild.
- The first run will expose data hygiene issues (missing values, SOC code mismatches between O*NET and BLS, weird title formatting). Budget half a day for the script, mostly for plumbing edge cases.
- Re-run yearly when O*NET releases a new version (typically Q3) and BLS releases new wage data (typically Q2).
- The script outputs are deterministic given pinned seeds — same inputs produce identical outputs. Commit the JSON files to the repo for simplicity; no need to regenerate at deploy time.

## What's deliberately not included in v1

- Multiple languages (US-only labour data)
- Regional wage variation (uses national medians only; the Fed's Occupational Mobility Explorer goes deeper here if you want that direction later)
- Time-series data (current snapshot only, no historical comparisons)
- Newer "AI-era" jobs that ONET hasn't yet catalogued (prompt engineer, etc.) — could be added later by hand-scoring on the ONET schema and appending

## Definition of done

The script runs end-to-end without errors and produces:

- `public/data/atlas.json` with one entry per included occupation
- `public/data/details/*.json` — one file per occupation
- `public/data/neighbours/*.json` — one file per occupation
- (Optional) `public/data/clusters.json` mapping cluster IDs to labels

Spot-check the output:

- Pick "Software Developers" — its neighbours should be other tech roles (Programmers, Web Developers, Database Admins), not nurses or plumbers
- Pick "Registered Nurses" — neighbours should be other healthcare roles (LPNs, Nurse Practitioners, Medical Assistants)
- Pick "Carpenters" — neighbours should be other skilled trades (Construction Workers, Cabinetmakers, Drywall Installers)

If the spot-checks make sense, the pipeline is working.
