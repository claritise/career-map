"""Career Map data pipeline.

Converts O*NET + BLS source files into the static JSON dataset the frontend
consumes. Designed to be run locally (not in CI) when O*NET releases a new
version or BLS publishes new wage data. Outputs are committed to the repo.

Run:
    cd pipeline
    python build_data.py

Or with explicit paths:
    python build_data.py \\
        --onet-dir data-sources/onet \\
        --bls-xlsx data-sources/national_M2024_dl.xlsx \\
        --output-dir ../web/public/data

See README.md for setup, source data download URLs, and the full pipeline
description. See ../docs/01-data-pipeline.md for the conceptual reference.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

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

# Cluster id used for HDBSCAN noise points (-1). Frontend treats this as "Other".
NOISE_CLUSTER_ID = -1
NOISE_CLUSTER_LABEL = "Other"


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
# ---------------------------------------------------------------------------


def load_onet_descriptors(paths: Paths) -> dict[str, pd.DataFrame]:
    """Step 1: Read Skills.txt, Knowledge.txt, Abilities.txt.

    Each is in long format (SOC × Element × Scale → Value). Filter to
    Scale ID == 'IM' (Importance), pivot to wide format with SOC codes as
    rows and element names as columns.
    """
    descriptors: dict[str, pd.DataFrame] = {}
    for name, filename in (
        ("skills", "Skills.txt"),
        ("knowledge", "Knowledge.txt"),
        ("abilities", "Abilities.txt"),
    ):
        path = paths.onet_dir / filename
        df = pd.read_csv(path, sep="\t", low_memory=False)
        df = df[df["Scale ID"] == "IM"]
        wide = df.pivot_table(
            index="O*NET-SOC Code",
            columns="Element Name",
            values="Data Value",
            aggfunc="first",
        )
        log.info("  %s: %d occupations × %d elements", name, len(wide), wide.shape[1])
        descriptors[name] = wide
    return descriptors


def build_feature_matrix(descriptors: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Step 2: Horizontally concatenate the three wide descriptor tables.

    Drop occupations with missing rows. Returns a DataFrame of ~894 rows
    × ~120 features (importance scores, 1–5 scale).
    """
    # Prefix columns with category so e.g. "Active Listening" (skill) and a
    # similarly-named ability don't collide.
    prefixed = []
    for name, df in descriptors.items():
        renamed = df.add_prefix(f"{name}:")
        prefixed.append(renamed)
    matrix = pd.concat(prefixed, axis=1, join="inner")
    matrix = matrix.dropna()
    log.info("  feature matrix: %d occupations × %d features", *matrix.shape)
    return matrix


def normalize_features(matrix: pd.DataFrame) -> pd.DataFrame:
    """Step 3: Z-score normalize each column.

    Without this, universally-important skills like Active Listening dominate
    similarity calculations and clusters become mushy. Handle zero-variance
    columns by filling resulting NaNs with 0.
    """
    means = matrix.mean()
    stds = matrix.std()
    # Avoid divide-by-zero on zero-variance columns.
    stds = stds.replace(0, np.nan)
    normalized = (matrix - means) / stds
    normalized = normalized.fillna(0.0)
    return normalized


def compute_similarity(normalized: pd.DataFrame) -> pd.DataFrame:
    """Step 4: Pairwise cosine similarity → symmetric ~900×900 matrix.

    Returned as a DataFrame indexed by SOC on both axes so downstream code
    can use label-based lookup instead of integer positions.
    """
    sim = cosine_similarity(normalized.values)
    return pd.DataFrame(sim, index=normalized.index, columns=normalized.index)


def project_2d(normalized: pd.DataFrame) -> pd.DataFrame:
    """Step 5: UMAP from feature space to 2D, rescaled to [0, LAYOUT_SIZE]."""
    # Imported here so the heavy umap-learn module isn't loaded just to print
    # --help.
    import umap  # noqa: PLC0415

    reducer = umap.UMAP(
        n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        metric=UMAP_METRIC,
        random_state=UMAP_RANDOM_STATE,
    )
    embedding = reducer.fit_transform(normalized.values)
    coords = pd.DataFrame(embedding, index=normalized.index, columns=["x", "y"])

    # Rescale each axis independently to [0, LAYOUT_SIZE] so the frontend gets
    # predictable bounds.
    for axis in ("x", "y"):
        col = coords[axis]
        lo, hi = col.min(), col.max()
        coords[axis] = (col - lo) / (hi - lo) * LAYOUT_SIZE
    coords["x"] = coords["x"].round(2)
    coords["y"] = coords["y"].round(2)
    log.info(
        "  UMAP done: x ∈ [%.1f, %.1f], y ∈ [%.1f, %.1f]",
        coords["x"].min(),
        coords["x"].max(),
        coords["y"].min(),
        coords["y"].max(),
    )
    return coords


def cluster_layout(coords_2d: pd.DataFrame) -> pd.Series:
    """Step 6: HDBSCAN on the 2D layout (not the original feature space).

    Returns a Series indexed by SOC mapping to clusterId. Noise points (-1)
    keep that id and are surfaced as "Other" downstream.
    """
    import hdbscan  # noqa: PLC0415

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=HDBSCAN_MIN_SAMPLES,
    )
    labels = clusterer.fit_predict(coords_2d[["x", "y"]].values)
    series = pd.Series(labels, index=coords_2d.index, name="clusterId")
    counts = series.value_counts().sort_index()
    log.info(
        "  HDBSCAN: %d clusters + %d noise points",
        (counts.index >= 0).sum(),
        counts.get(NOISE_CLUSTER_ID, 0),
    )
    return series


def label_clusters(
    cluster_ids: pd.Series, raw_features: pd.DataFrame
) -> dict[int, str]:
    """Step 7: Name each cluster by its top distinguishing features.

    For each cluster, computes the mean importance of each feature across its
    members, picks the top 3 features, and produces a short label by
    joining their human names.

    Hand-naming gives crisper labels; this is a defensible auto-label that
    keeps the pipeline reproducible. Override `cluster_labels` in step 12 if
    you want curated names.
    """
    labels: dict[int, str] = {NOISE_CLUSTER_ID: NOISE_CLUSTER_LABEL}
    # Strip the "skills:" / "knowledge:" / "abilities:" category prefix so
    # labels read naturally.
    feature_display = {col: col.split(":", 1)[1] for col in raw_features.columns}

    cluster_means_by_id: dict[int, pd.Series] = {}
    for cid in sorted(cluster_ids.unique()):
        if cid == NOISE_CLUSTER_ID:
            continue
        members = cluster_ids[cluster_ids == cid].index
        cluster_means_by_id[cid] = raw_features.loc[members].mean()

    # Pick top features that are also distinctive (high mean in this cluster
    # relative to the global mean). Plain top-by-mean tends to repeat
    # "Active Listening" everywhere; subtracting the global mean is the cheap
    # tf-idf-shaped fix.
    global_mean = raw_features.mean()
    for cid, cluster_mean in cluster_means_by_id.items():
        distinctive = (cluster_mean - global_mean).sort_values(ascending=False)
        top = [feature_display[col] for col in distinctive.head(3).index]
        labels[cid] = " · ".join(top)
    return labels


def join_bls_wages(paths: Paths, occupation_index: pd.Index) -> pd.DataFrame:
    """Step 8: Read BLS xlsx, join on SOC code.

    O*NET SOC codes look like `15-1252.00`; BLS uses `15-1252`. Strip the
    .00 suffix to match. Where O*NET is more granular (e.g. `15-1252.01`),
    fall back to the parent SOC `15-1252`. Wage/employment are nullable.

    Returns a DataFrame indexed by the original O*NET SOC code (with .XX
    suffix) so the join key matches downstream tables.
    """
    bls = pd.read_excel(paths.bls_xlsx, sheet_name=0)
    bls = bls[bls["O_GROUP"] == "detailed"][["OCC_CODE", "A_MEDIAN", "TOT_EMP"]]

    # BLS encodes suppressed values as '*' / '#'; coerce to NaN.
    bls["A_MEDIAN"] = pd.to_numeric(bls["A_MEDIAN"], errors="coerce")
    bls["TOT_EMP"] = pd.to_numeric(bls["TOT_EMP"], errors="coerce")
    bls = bls.set_index("OCC_CODE")

    rows = []
    for soc in occupation_index:
        base = soc.split(".")[0]
        if base in bls.index:
            row = bls.loc[base]
            rows.append((soc, row["A_MEDIAN"], row["TOT_EMP"]))
        else:
            rows.append((soc, np.nan, np.nan))
    out = pd.DataFrame(rows, columns=["soc", "wage", "employment"]).set_index("soc")
    missing = out["wage"].isna().sum()
    log.info(
        "  BLS: %d occupations matched, %d missing wage",
        (~out["wage"].isna()).sum(),
        missing,
    )
    return out


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(s: str) -> str:
    s = s.lower()
    s = _SLUG_RE.sub("-", s)
    return s.strip("-")


def generate_slugs(titles: pd.Series) -> pd.DataFrame:
    """Step 9: SOC + title → slug, with collision handling.

    `titles` is a Series indexed by O*NET SOC code with the occupation title
    as the value. Collisions get the SOC numeric tail appended.
    """
    seen: dict[str, str] = {}  # slug -> soc
    rows = []
    for soc, title in titles.items():
        slug = _slugify(title)
        if slug in seen and seen[slug] != soc:
            # Append last 4 digits of the SOC numeric portion.
            tail = re.sub(r"\D", "", soc)[-4:]
            slug = f"{slug}-{tail}"
        seen[slug] = soc
        rows.append((soc, slug, title))
    out = pd.DataFrame(rows, columns=["soc", "slug", "title"]).set_index("soc")
    if out["slug"].duplicated().any():
        dups = out[out["slug"].duplicated(keep=False)]
        raise ValueError(f"Unresolved slug collisions: {dups}")
    return out


def compute_neighbours(
    similarity: pd.DataFrame,
    occupations: pd.DataFrame,
    raw_features: pd.DataFrame,
) -> dict[str, list[dict]]:
    """Step 10: Top-N neighbours per occupation with shared/gap/surplus skills.

    Returns {origin_slug: [neighbour_dict, ...]}.
    """
    # Build a high-importance skill set per occupation once (skills above the
    # SHARED_SKILL_THRESHOLD on the 1–5 importance scale, with the category
    # prefix stripped for display).
    high_skills: dict[str, set[str]] = {}
    feature_display = {col: col.split(":", 1)[1] for col in raw_features.columns}
    for soc, row in raw_features.iterrows():
        high = {
            feature_display[col]
            for col, val in row.items()
            if val >= SHARED_SKILL_THRESHOLD
        }
        high_skills[soc] = high

    # Lookup from soc -> {slug, title, wage}
    info = occupations[["slug", "title", "wage"]].to_dict(orient="index")

    out: dict[str, list[dict]] = {}
    for origin_soc in similarity.index:
        sims = similarity.loc[origin_soc].copy()
        sims[origin_soc] = -1.0  # exclude self
        top = sims.sort_values(ascending=False).head(TOP_NEIGHBOURS)

        origin_high = high_skills[origin_soc]
        origin_wage = info[origin_soc]["wage"]
        neighbours = []
        for n_soc, sim in top.items():
            n_high = high_skills[n_soc]
            n_wage = info[n_soc]["wage"]

            shared = sorted(origin_high & n_high)
            gap = sorted(n_high - origin_high)
            surplus = sorted(origin_high - n_high)

            wage_delta = (
                None
                if (pd.isna(origin_wage) or pd.isna(n_wage))
                else int(n_wage - origin_wage)
            )

            neighbours.append(
                {
                    "soc": n_soc,
                    "slug": info[n_soc]["slug"],
                    "title": info[n_soc]["title"],
                    "similarity": round(float(sim), 4),
                    "sharedSkills": shared,
                    "gapSkills": gap,
                    "surplusSkills": surplus,
                    "wage": None if pd.isna(n_wage) else int(n_wage),
                    "wageDelta": wage_delta,
                }
            )
        out[info[origin_soc]["slug"]] = neighbours
    return out


def compute_top_skills(raw_features: pd.DataFrame) -> dict[str, list[dict]]:
    """Step 11: Top-N skills per occupation by importance.

    Only emit features from the `skills:` category for the panel display —
    knowledge and abilities power similarity but aren't what users mean by
    "skills" colloquially.
    """
    skill_cols = [c for c in raw_features.columns if c.startswith("skills:")]
    display = {c: c.split(":", 1)[1] for c in skill_cols}
    skills_only = raw_features[skill_cols]
    out: dict[str, list[dict]] = {}
    for soc, row in skills_only.iterrows():
        ranked = row.sort_values(ascending=False).head(TOP_SKILLS)
        out[soc] = [
            {"name": display[col], "importance": round(float(val), 2)}
            for col, val in ranked.items()
        ]
    return out


def write_outputs(
    paths: Paths,
    occupations: pd.DataFrame,
    descriptions: dict[str, str],
    neighbours: dict[str, list[dict]],
    top_skills_by_soc: dict[str, list[dict]],
    cluster_labels: dict[int, str],
) -> None:
    """Step 12: atlas.json + details/*.json + neighbours/*.json + clusters.json."""

    paths.output_details_dir.mkdir(parents=True, exist_ok=True)
    paths.output_neighbours_dir.mkdir(parents=True, exist_ok=True)

    atlas = []
    for soc, row in occupations.iterrows():
        atlas.append(
            {
                "soc": soc,
                "slug": row["slug"],
                "title": row["title"],
                "x": float(row["x"]),
                "y": float(row["y"]),
                "wage": None if pd.isna(row["wage"]) else int(row["wage"]),
                "employment": None
                if pd.isna(row["employment"])
                else int(row["employment"]),
                "jobZone": int(row["jobZone"])
                if not pd.isna(row["jobZone"])
                else None,
                "clusterId": int(row["clusterId"]),
            }
        )
    _write_json(paths.output_atlas, atlas)
    log.info("  wrote %s (%d occupations)", paths.output_atlas.name, len(atlas))

    for soc, row in occupations.iterrows():
        slug = row["slug"]
        details = {
            "soc": soc,
            "slug": slug,
            "title": row["title"],
            "description": descriptions.get(soc, ""),
            "topSkills": top_skills_by_soc.get(soc, []),
            "wage": None if pd.isna(row["wage"]) else int(row["wage"]),
            "employment": None
            if pd.isna(row["employment"])
            else int(row["employment"]),
            "jobZone": int(row["jobZone"]) if not pd.isna(row["jobZone"]) else None,
            "clusterId": int(row["clusterId"]),
            "clusterLabel": cluster_labels.get(
                int(row["clusterId"]), NOISE_CLUSTER_LABEL
            ),
        }
        _write_json(paths.output_details_dir / f"{slug}.json", details)
    log.info(
        "  wrote %d files into %s/",
        len(occupations),
        paths.output_details_dir.name,
    )

    for slug, ns in neighbours.items():
        _write_json(paths.output_neighbours_dir / f"{slug}.json", ns)
    log.info(
        "  wrote %d files into %s/",
        len(neighbours),
        paths.output_neighbours_dir.name,
    )

    _write_json(
        paths.output_clusters,
        {str(cid): label for cid, label in sorted(cluster_labels.items())},
    )
    log.info(
        "  wrote %s (%d cluster labels)",
        paths.output_clusters.name,
        len(cluster_labels),
    )


def _write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def _load_occupation_metadata(paths: Paths) -> tuple[pd.Series, pd.Series, dict[str, str]]:
    """Read Occupation Data.txt + Job Zones.txt into Series/dict by SOC."""
    occ = pd.read_csv(paths.onet_dir / "Occupation Data.txt", sep="\t")
    occ = occ.set_index("O*NET-SOC Code")
    jz = pd.read_csv(paths.onet_dir / "Job Zones.txt", sep="\t")
    jz = jz.set_index("O*NET-SOC Code")["Job Zone"]
    return occ["Title"], jz, occ["Description"].to_dict()


def _assemble_occupation_table(
    titles: pd.Series,
    coords: pd.DataFrame,
    cluster_ids: pd.Series,
    wages: pd.DataFrame,
    slugs: pd.DataFrame,
    job_zones: pd.Series,
) -> pd.DataFrame:
    """Per-occupation table: slug, title, x, y, wage, employment, jobZone, clusterId."""
    df = pd.DataFrame(index=coords.index)
    df["slug"] = slugs["slug"]
    df["title"] = titles
    df["x"] = coords["x"]
    df["y"] = coords["y"]
    df["wage"] = wages["wage"]
    df["employment"] = wages["employment"]
    df["jobZone"] = job_zones
    df["clusterId"] = cluster_ids
    # Title and slug must be present for every occupation; failure here means
    # an O*NET SOC has descriptor data but no Occupation Data.txt row.
    missing = df[df["title"].isna() | df["slug"].isna()]
    if not missing.empty:
        log.warning(
            "  %d occupations missing title/slug; dropping: %s",
            len(missing),
            list(missing.index)[:5],
        )
        df = df.drop(missing.index)
    return df


def run_pipeline(paths: Paths) -> None:
    log.info("O*NET source: %s", paths.onet_dir)
    log.info("BLS source:   %s", paths.bls_xlsx)
    log.info("Output dir:   %s", paths.output_dir)

    _check_sources_exist(paths)
    paths.output_dir.mkdir(parents=True, exist_ok=True)

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
    cluster_labels = label_clusters(cluster_ids, matrix)

    log.info("Step 8/12: join BLS wages")
    wages = join_bls_wages(paths, matrix.index)

    log.info("Step 9/12: generate slugs")
    titles, job_zones, descriptions = _load_occupation_metadata(paths)
    slugs = generate_slugs(titles.reindex(matrix.index).dropna())

    occupations = _assemble_occupation_table(
        titles, coords, cluster_ids, wages, slugs, job_zones
    )

    log.info("Step 10/12: compute neighbours + skill diffs")
    neighbours = compute_neighbours(similarity, occupations, matrix)

    log.info("Step 11/12: per-occupation top skills")
    top_skills = compute_top_skills(matrix)

    log.info("Step 12/12: write JSON outputs")
    write_outputs(
        paths, occupations, descriptions, neighbours, top_skills, cluster_labels
    )

    log.info("Pipeline complete: %d occupations.", len(occupations))


def _check_sources_exist(paths: Paths) -> None:
    """Fail loudly at the start if source files aren't where we expect them."""
    missing: list[str] = []
    if not paths.onet_dir.exists():
        missing.append(f"O*NET directory not found: {paths.onet_dir}")
    if not paths.bls_xlsx.exists():
        missing.append(f"BLS xlsx not found: {paths.bls_xlsx}")
    if missing:
        for m in missing:
            log.error(m)
        log.error("See pipeline/README.md for download instructions.")
        sys.exit(2)


def parse_args(argv: Iterable[str] | None = None) -> Paths:
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
    args = parser.parse_args(list(argv) if argv is not None else None)

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


def main(argv: Iterable[str] | None = None) -> int:
    paths = parse_args(argv)
    run_pipeline(paths)
    return 0


if __name__ == "__main__":
    sys.exit(main())
