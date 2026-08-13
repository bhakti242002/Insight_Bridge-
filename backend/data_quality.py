"""
data_quality.py

Computes a data quality report and per-column outlier flags. Everything
here is deterministic statistics (IQR-based outlier detection, missing
value counts, duplicate row detection) -- no AI involved, so it works
identically regardless of dataset shape and never depends on an API key.
"""

import pandas as pd
from type_inference import _clean_numeric_series

MAX_OUTLIER_EXAMPLES = 5


def detect_outliers(series: pd.Series, column_name: str = None) -> dict:
    """
    IQR-based outlier detection: a value is flagged if it falls outside
    Q1 - 1.5*IQR to Q3 + 1.5*IQR. This is a standard, well-known method,
    not something invented for this project -- chosen because it doesn't
    assume a normal distribution the way a z-score method would.
    """
    values = _clean_numeric_series(series, column_name).dropna()
    if len(values) < 5:
        return {"count": 0, "pct": 0.0, "examples": [], "bounds": None}

    q1, q3 = values.quantile(0.25), values.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return {"count": 0, "pct": 0.0, "examples": [], "bounds": None}

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    outliers = values[(values < lower) | (values > upper)]

    examples = sorted(outliers.tolist(), key=lambda v: abs(v - values.median()), reverse=True)[:MAX_OUTLIER_EXAMPLES]

    return {
        "count": int(len(outliers)),
        "pct": round(len(outliers) / len(values) * 100, 1),
        "examples": [round(float(v), 2) for v in examples],
        "bounds": {"lower": round(float(lower), 2), "upper": round(float(upper), 2)},
    }


MAX_DUPLICATE_ENTITY_EXAMPLES = 5
MIN_DUPLICATE_GROUP_SIZE = 2
MIN_UNIQUE_RATIO_FOR_ENTITY_CHECK = 0.7  # see note below


def detect_duplicate_entities(df: pd.DataFrame, column_types: dict) -> dict:
    """
    Detects the same real-world entity appearing multiple times with
    NON-identical data -- e.g. the same app scraped on different days
    with a slightly different review count each time. Exact-row
    duplicate detection (df.duplicated()) never catches this, because
    the rows aren't byte-identical -- something differs. But summing a
    measure across them still double (or triple) counts the same
    underlying entity, which is exactly the kind of thing that quietly
    inflates a total into something meaningless.

    Only checks identifier/free_text columns where MOST values are
    unique (>= MIN_UNIQUE_RATIO_FOR_ENTITY_CHECK). This is the
    difference between an entity name (mostly unique, a few repeats are
    the anomaly worth flagging) and a plain attribute column like "Size"
    or "Genres" (mostly repeated by design -- that's what makes it an
    attribute, not an entity, and flagging it would just describe every
    normal categorical-ish column as a "problem"). Verified against a
    real file: an app-name column at 89% unique vs a size/genre column
    at 1-26% unique -- a wide, reliable gap, not a fine-tuned threshold.
    """
    results = {}
    candidates = []  # (unique_ratio, col)
    for col, info in column_types.items():
        if info.get("type") not in ("identifier", "free_text"):
            continue
        non_null = df[col].dropna()
        if len(non_null) == 0:
            continue
        unique_ratio = non_null.nunique() / len(non_null)
        if unique_ratio >= MIN_UNIQUE_RATIO_FOR_ENTITY_CHECK:
            candidates.append((unique_ratio, col))

    if not candidates:
        return results

    # Only check the SINGLE most-unique candidate, not every qualifying
    # column independently. Verified this matters on a real file: a
    # hospital dataset had "Facility Name" at 97.6% unique (12 different,
    # unrelated hospitals happen to share the common name "Memorial
    # Hospital") and "Facility ID" at 100% unique (genuinely one row per
    # hospital, zero repeats). Checking "Facility Name" alone would have
    # wrongly flagged 12 different real hospitals as "the same hospital
    # duplicated" -- checking the more authoritative ID column instead
    # correctly finds nothing wrong, because there genuinely isn't
    # anything wrong. When no dedicated ID column exists (like the Play
    # Store app-name case), the best available candidate is still used.
    candidates.sort(key=lambda c: c[0], reverse=True)
    col = candidates[0][1]

    counts = df[col].dropna().value_counts()
    repeated_values = counts[counts >= MIN_DUPLICATE_GROUP_SIZE].index
    if len(repeated_values) == 0:
        return results
    if len(repeated_values) > 5000:
        repeated_values = repeated_values[:5000]  # safety cap on pathological cases

    # Pre-filter to only the rows worth checking ONCE, then group that much
    # smaller subset -- avoids re-scanning the full dataframe once per
    # repeated value (which is what made this slow: ~1.5s on a 10,841 row
    # file with 523 repeated names, scanning the whole frame every time).
    relevant_rows = df[df[col].isin(repeated_values)]
    flagged = {}
    for val, subset in relevant_rows.groupby(col, sort=False):
        if len(subset.drop_duplicates()) > 1:
            # More than one genuinely distinct version of this same-named
            # entity exists -- not just repeated identical rows.
            flagged[val] = len(subset)

    if flagged:
        sorted_flagged = sorted(flagged.items(), key=lambda kv: kv[1], reverse=True)
        results[col] = {
            "n_repeated_values": len(flagged),
            "n_affected_rows": sum(flagged.values()),
            "examples": [{"value": str(v), "count": int(c)} for v, c in sorted_flagged[:MAX_DUPLICATE_ENTITY_EXAMPLES]],
        }

    return results


def build_data_quality_report(df: pd.DataFrame, column_types: dict) -> dict:
    """
    Returns a report covering:
      - missing values per column (count + percent)
      - duplicate row count
      - outliers per numeric column (via detect_outliers)
    """
    n_rows = len(df)

    missing = {}
    for col in df.columns:
        n_missing = int(df[col].isna().sum())
        if n_missing > 0:
            missing[col] = {"count": n_missing, "pct": round(n_missing / n_rows * 100, 1)}

    duplicate_count = int(df.duplicated().sum())

    outliers = {}
    for col, info in column_types.items():
        if info.get("type") == "numeric_measure":
            result = detect_outliers(df[col], col)
            if result["count"] > 0:
                outliers[col] = result

    duplicate_entities = detect_duplicate_entities(df, column_types)

    return {
        "n_rows": n_rows,
        "missing_values": missing,
        "duplicate_rows": duplicate_count,
        "outliers": outliers,
        "duplicate_entities": duplicate_entities,
    }
