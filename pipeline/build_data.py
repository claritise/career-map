"""Career Map data pipeline.

Converts O*NET + BLS source files into the static JSON dataset the frontend
consumes. Designed to be run locally (not in CI) when O*NET releases a new
version or BLS publishes new wage data. Outputs are committed to the repo.

Run:
    cd pipeline
    python build_data.py

Or with explicit paths:
    python build_data.py \\
        --onet-dir data-sources/db_30_2_text \\
        --bls-xlsx data-sources/oesm23nat.xlsx \\
        --output-dir ../web/public/data

See README.md for setup, source data download URLs, and the full pipeline
description. See ../docs/01-data-pipeline.md for the conceptual reference.
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path

# UMAP / HDBSCAN parameters — pinned here so the layout stays stable across
# rebuilds. Change deliberately, not casually.
UMAP_N_NEIGHBORS = 20
UMAP_MIN_DIST = 0.15
UMAP_METRIC = "cosine"
UMAP_RANDOM_STATE = 42

HDBSCAN_MIN_CLUSTER_SIZE = 8
HDBSCAN_MIN_SAMPLES = 3

# Layout coordinate space the frontend expects (also see web/src/lib/constants.ts).
LAYOUT_SIZE = 1000

# Per-occupation neighbour list size (frontend currently shows top 5; extra is
# headroom for search / "show all" affordances without re-fetching).
TOP_NEIGHBOURS = 25
TOP_SKILLS = 10

# Threshold on O*NET importance scale (1–5) above which a skill is considered
# "meaningfully important" for the shared/gap/surplus skill diff per neighbour.
SHARED_SKILL_THRESHOLD = 3.5


log = logging.getLogger("career_map.pipeline")


@dataclass
class Paths:
    """Filesystem layout. Resolved from CLI args; passed through every step."""

    onet_dir: Path
    bls_xlsx: Path
    output_dir: Path

    @property
    def output_details_dir(self) -> Path:
        return self.output_dir / "details"

    @property
    def output_neighbours_dir(self) -> Path:
        return self.output_dir / "neighbours"

    @property
    def output_atlas(self) -> Path:
        return self.output_dir / "atlas.json"

    @property
    def output_clusters(self) -> Path:
        return self.output_dir / "clusters.json"


# ---------------------------------------------------------------------------
# Pipeline steps
#
# Each step is a function so the pipeline reads top-to-bottom in main(), and so
# we can unit-test individual stages later. Stubs raise NotImplementedError;
# Phase 1 fills these in against real source data.
# ---------------------------------------------------------------------------


def load_onet_descriptors(paths: Paths):
    """Step 1: Read Skills.txt, Knowledge.txt, Abilities.txt.

    Each is in long format (SOC × Element × Scale → Value). Filter to
    Scale ID == 'IM' (Importance), pivot to wide format with SOC codes as
    rows and element names as columns.

    Returns a dict like {"skills": DataFrame, "knowledge": DataFrame,
    "abilities": DataFrame}.
    """
    raise NotImplementedError("Phase 1: load + pivot O*NET descriptor TSVs")


def build_feature_matrix(descriptors) -> "pandas.DataFrame":  # noqa: F821
    """Step 2: Horizontally concatenate the three wide descriptor tables.

    Drop occupations with missing rows. Returns a DataFrame of ~900 rows
    × ~120 features (importance scores, 1–5 scale).
    """
    raise NotImplementedError("Phase 1: concat descriptors into feature matrix")


def normalize_features(matrix):
    """Step 3: Z-score normalize each column.

    Without this, universally-important skills like Active Listening dominate
    similarity calculations and clusters become mushy. Handle zero-variance
    columns by filling resulting NaNs with 0.
    """
    raise NotImplementedError("Phase 1: z-score normalize the feature matrix")


def compute_similarity(normalized):
    """Step 4: Pairwise cosine similarity → symmetric 900×900 matrix."""
    raise NotImplementedError("Phase 1: cosine similarity matrix")


def project_2d(normalized):
    """Step 5: UMAP from 120D to 2D, rescaled to [0, LAYOUT_SIZE] per axis.

    Pinned parameters: n_neighbors=20, min_dist=0.15, metric='cosine',
    random_state=42. Returns a DataFrame indexed by SOC code with `x` and `y`
    columns.
    """
    raise NotImplementedError("Phase 1: UMAP projection + rescale to 0..LAYOUT_SIZE")


def cluster_layout(coords_2d):
    """Step 6: HDBSCAN on the 2D layout (not the 120D matrix).

    Clustering on the projection means visual and data clusters match. Returns
    a Series mapping SOC code → clusterId. Noise points (-1) get mapped to a
    distinguished cluster id (e.g. last id + 1, labelled "Other").
    """
    raise NotImplementedError("Phase 1: HDBSCAN cluster the 2D coordinates")


def label_clusters(cluster_ids, normalized_features):
    """Step 7: Generate a human-readable label per cluster.

    For each cluster, compute the top-importance skills across its members,
    then either hand-name or LLM-name. Phase 1 will likely start with hand
    names for the top ~15 clusters and "Other" for the rest.

    Returns {clusterId: label}.
    """
    raise NotImplementedError("Phase 1: hand- or LLM-name the clusters")


def join_bls_wages(paths: Paths, occupation_index):
    """Step 8: Read BLS xlsx, join on SOC code (strip O*NET's .00 suffix).

    Pull A_MEDIAN and TOT_EMP. Where O*NET is more granular than BLS, fall
    back to the parent SOC code; if still missing, emit None. Returns a
    DataFrame indexed by SOC with `wage` and `employment` columns (nullable).
    """
    raise NotImplementedError("Phase 1: BLS wage + employment join")


def generate_slugs(titles):
    """Step 9: Title → URL slug, with collision handling.

    "Software Developers" → "software-developers". Collisions get the last
    4 SOC digits appended. Returns a DataFrame indexed by SOC with `slug`
    and reverse-lookup helpers.
    """
    raise NotImplementedError("Phase 1: slug generation + collision handling")


def compute_neighbours(similarity_matrix, occupations, raw_features):
    """Step 10: Top-N neighbours per occupation with skill diffs.

    For each occupation: exclude self, sort similarity descending, take top
    TOP_NEIGHBOURS. For each neighbour compute sharedSkills (both ≥ threshold),
    gapSkills (neighbour ≥ threshold, origin < threshold), surplusSkills
    (origin ≥ threshold, neighbour < threshold), and wageDelta.

    Returns {origin_soc: [neighbour_dict, ...]}.
    """
    raise NotImplementedError("Phase 1: neighbour rankings + skill diffs")


def compute_top_skills(raw_features):
    """Step 11: Top-N skills per occupation by importance.

    Returns {soc: [{name, importance}, ...]}.
    """
    raise NotImplementedError("Phase 1: per-occupation top skills")


def write_outputs(paths: Paths, occupations, neighbours, top_skills, cluster_labels):
    """Step 12: Write atlas.json, details/*.json, neighbours/*.json, clusters.json.

    Shapes match docs/02-full-system-context.md exactly. atlas.json is render-
    minimal (no description, no topSkills); details/*.json carries the verbose
    fields. neighbours/*.json is the per-origin list.
    """
    raise NotImplementedError("Phase 1: write JSON outputs to public/data/")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_pipeline(paths: Paths) -> None:
    """Wire all 12 steps together. Phase 1 fills in the bodies above."""
    log.info("O*NET source: %s", paths.onet_dir)
    log.info("BLS source:   %s", paths.bls_xlsx)
    log.info("Output dir:   %s", paths.output_dir)

    _check_sources_exist(paths)
    _ensure_output_dirs(paths)

    log.info("Step 1/12: load O*NET descriptors")
    descriptors = load_onet_descriptors(paths)

    log.info("Step 2/12: build feature matrix")
    matrix = build_feature_matrix(descriptors)

    log.info("Step 3/12: normalize features (z-score)")
    normalized = normalize_features(matrix)

    log.info("Step 4/12: compute cosine similarity")
    similarity = compute_similarity(normalized)

    log.info("Step 5/12: 2D projection (UMAP)")
    coords = project_2d(normalized)

    log.info("Step 6/12: cluster 2D layout (HDBSCAN)")
    cluster_ids = cluster_layout(coords)

    log.info("Step 7/12: label clusters")
    cluster_labels = label_clusters(cluster_ids, normalized)

    log.info("Step 8/12: join BLS wages")
    wages = join_bls_wages(paths, matrix.index)

    log.info("Step 9/12: generate slugs")
    slugs = generate_slugs(matrix)

    log.info("Step 10/12: compute neighbours + skill diffs")
    occupations = _assemble_occupation_table(
        matrix, coords, cluster_ids, cluster_labels, wages, slugs
    )
    neighbours = compute_neighbours(similarity, occupations, matrix)

    log.info("Step 11/12: per-occupation top skills")
    top_skills = compute_top_skills(matrix)

    log.info("Step 12/12: write JSON outputs")
    write_outputs(paths, occupations, neighbours, top_skills, cluster_labels)

    log.info("Pipeline complete.")


def _check_sources_exist(paths: Paths) -> None:
    """Fail loudly at the start if source files aren't where we expect them."""
    missing = []
    if not paths.onet_dir.exists():
        missing.append(f"O*NET directory not found: {paths.onet_dir}")
    if not paths.bls_xlsx.exists():
        missing.append(f"BLS xlsx not found: {paths.bls_xlsx}")
    if missing:
        for m in missing:
            log.error(m)
        log.error("See pipeline/README.md for download instructions.")
        sys.exit(2)


def _ensure_output_dirs(paths: Paths) -> None:
    paths.output_dir.mkdir(parents=True, exist_ok=True)
    paths.output_details_dir.mkdir(exist_ok=True)
    paths.output_neighbours_dir.mkdir(exist_ok=True)


def _assemble_occupation_table(matrix, coords, cluster_ids, cluster_labels, wages, slugs):
    """Step 10's precondition: stitch per-occupation columns into one table.

    Phase 1 fills this in. Left as a thin helper rather than a numbered step
    because it's bookkeeping, not analysis.
    """
    raise NotImplementedError("Phase 1: assemble per-occupation table for output")


def parse_args(argv: list[str] | None = None) -> Paths:
    here = Path(__file__).resolve().parent
    default_output = (here / ".." / "web" / "public" / "data").resolve()
    parser = argparse.ArgumentParser(
        description="Build the Career Map static dataset from O*NET + BLS.",
    )
    parser.add_argument(
        "--onet-dir",
        type=Path,
        default=here / "data-sources" / "onet",
        help="Path to the unzipped O*NET database directory (contains Skills.txt etc.)",
    )
    parser.add_argument(
        "--bls-xlsx",
        type=Path,
        default=here / "data-sources" / "national_M2024_dl.xlsx",
        help=(
            "Path to the BLS national OEWS xlsx file (e.g. national_M2024_dl.xlsx). "
            "Data lives on the first sheet; other sheets are metadata."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_output,
        help="Where to write atlas.json, details/, neighbours/, clusters.json.",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging."
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-5s %(message)s",
        datefmt="%H:%M:%S",
    )

    return Paths(
        onet_dir=args.onet_dir.resolve(),
        bls_xlsx=args.bls_xlsx.resolve(),
        output_dir=args.output_dir.resolve(),
    )


def main(argv: list[str] | None = None) -> int:
    paths = parse_args(argv)
    try:
        run_pipeline(paths)
    except NotImplementedError as e:
        log.error("Pipeline stub: %s", e)
        log.error("This script is a Phase-0 scaffold — see pipeline/README.md.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
