"""
type_inference.py

Determines each column's statistical TYPE directly from the data --
no AI involved, no business-domain assumptions. This works identically
whether the spreadsheet is sales data, student grades, HR records, or
anything else, because it only asks universal questions:

  - Does this parse as a date?
  - Is this numeric?
  - If numeric, does it look like a measure (a quantity you'd sum/average)
    or an identifier (a code you'd never aggregate, like an ID number)?
  - If text, is cardinality low enough to be a grouping category, or is
    it closer to free text / a unique identifier?

This replaces the old business-specific role guessing (sales_amount,
customer_name, etc) as the FOUNDATION of the product. AI is layered on
top of this purely to generate nicer display labels -- it is no longer
required for the dashboard to function at all.
"""

import re
import pandas as pd

def _word_pattern(words):
    """Matches any of `words` as a whole word, where 'whole word' means not
    directly adjacent to another letter/digit -- but underscores, spaces,
    hyphens, and string boundaries all count as valid separators. Plain \\b
    treats underscore as a word character (no boundary), which breaks on
    names like 'stop_id'; this fixes that while still correctly handling
    space-separated names like 'Retailer ID'."""
    alts = "|".join(words)
    return re.compile(rf"(?<![a-zA-Z0-9])(?:{alts})(?![a-zA-Z0-9])", re.IGNORECASE)


ID_NAME_PATTERN = _word_pattern(["id", "key", "no", "number", "code", "footnote", "flag"])

# Word-boundary-safe matching is essential here -- without it, "rating"
# matches as a bare substring inside "Operating" (ope-RATING-), and "rate"
# matches inside "Corporate" (corpo-RATE). A real bug caught by testing
# against an actual sales file with an "Operating Profit" column.
AVERAGE_TYPE_PATTERN = _word_pattern(
    ["rating", "score", "percent", "rate", "ratio", "index", "avg", "average",
     "satisfaction", "grade", "stars?", "gpa", "margin", "per"]
)
SUM_TYPE_PATTERN = _word_pattern(
    ["total", "amount", "revenue", "sales", "price", "cost", "expense",
     "quantity", "qty", "units?", "count", "volume", "spend", "profit"]
)

CURRENCY_SYMBOLS_PATTERN = re.compile(r"[$,€£%]")

_SUFFIX_PATTERN = re.compile(r"^([+-]?\d*\.?\d+)\s*([KkMmBb])$")
_SUFFIX_MULTIPLIERS = {"K": 1e3, "M": 1e6, "B": 1e9}
# K/M/B is genuinely ambiguous: it means thousand/million/billion in
# financial or count shorthand ("1.2K reviews"), but kilobyte/megabyte in
# file-size units ("19M" for a 19-megabyte app). No purely statistical
# check reliably tells these apart -- both produce similar-looking values
# in a similar range. Caught this exact collision by testing against a
# real file: an app "Size" column with values like "19M" was silently
# being reinterpreted as 19 million instead of 19 megabytes. This is a
# narrow, deliberate exception to name-based decisions elsewhere in this
# file, made because the ambiguity is in the notation itself, not
# something a value alone can resolve.
_SIZE_CONTEXT_PATTERN = _word_pattern(["size", "storage", "memory", "capacity", "filesize", "disk", "ram"])


def _expand_suffix_notation(series: pd.Series) -> pd.Series:
    """
    Expands 'K'/'M'/'B' suffix notation ('1.2K' -> 1200, '3.4M' ->
    3400000, '2.1B' -> 2100000000) into plain numbers before the final
    numeric parse. Without this, these values just silently fail to
    parse and get dropped as missing instead of being counted at all --
    a real gap named explicitly in a production-readiness review of
    this project, distinct from the currency/percent stripping above.

    Only replaces values that actually match the suffix pattern --
    everything else (plain numbers, already-stripped currency, genuine
    non-numeric text) passes through completely unchanged.
    """
    extracted = series.astype(str).str.strip().str.extract(_SUFFIX_PATTERN)
    number_part = pd.to_numeric(extracted[0], errors="coerce")
    suffix_part = extracted[1].str.upper().map(_SUFFIX_MULTIPLIERS)
    expanded = number_part * suffix_part

    matched = expanded.notna()
    result = series.astype(object)
    result[matched] = expanded[matched]
    return result


def _clean_numeric_series(series: pd.Series, column_name: str = None) -> pd.Series:
    """Strips currency symbols, commas, and percent signs, and expands
    K/M/B suffix notation, before numeric parsing -- so e.g. '$4.99'
    parses as 4.99 and '1.2K' parses as 1200, instead of either failing
    silently. Skips suffix expansion when column_name suggests a file
    size or storage context, where K/M mean kilobyte/megabyte, not
    thousand/million -- see _SIZE_CONTEXT_PATTERN above for why.

    Checks is_numeric_dtype rather than `dtype == object` specifically,
    since pandas 3.x defaults text columns to a new StringDtype rather
    than the classic object dtype -- a version-specific gotcha that
    silently broke this exact check when tested against pandas 3.0."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    cleaned = series.astype(str).str.replace(CURRENCY_SYMBOLS_PATTERN, "", regex=True)
    if not (column_name and _SIZE_CONTEXT_PATTERN.search(column_name)):
        cleaned = _expand_suffix_notation(cleaned)
    return pd.to_numeric(cleaned, errors="coerce")


def _trimmed_bounds(values: pd.Series, multiplier: float = 3.0):
    """Returns (trimmed_min, trimmed_max) -- the same outlier-resistant
    bounds used by trimmed_mean and the histogram binning, exposed
    separately so other decisions (like whether a chart axis should
    start at zero) can use them too without re-deriving the logic."""
    non_null = values.dropna()
    if len(non_null) == 0:
        return float("nan"), float("nan")
    true_min, true_max = float(non_null.min()), float(non_null.max())
    q1, q3 = non_null.quantile(0.25), non_null.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return true_min, true_max
    lower = max(true_min, float(q1 - multiplier * iqr))
    upper = min(true_max, float(q3 + multiplier * iqr))
    if lower >= upper:
        return true_min, true_max
    return lower, upper


def _count_extreme_outliers(values: pd.Series, multiplier: float = 3.0) -> int:
    """How many values fall outside the same outlier-trimmed bounds used
    by trimmed_mean and histogram binning. Exposed so charts can carry an
    explicit warning ("N extreme values excluded") instead of silently
    changing numbers with no explanation of why."""
    non_null = values.dropna()
    if len(non_null) == 0:
        return 0
    q1, q3 = non_null.quantile(0.25), non_null.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return 0
    lower, upper = q1 - multiplier * iqr, q3 + multiplier * iqr
    return int(((non_null < lower) | (non_null > upper)).sum())


def _should_zero_anchor(values: pd.Series) -> bool:
    """
    Decides whether a chart of this measure should force its axis to
    start at 0 (the right default for things like revenue or counts,
    where 0 is a meaningful baseline) or not (for "positioned" numbers
    like a year, where 0 is meaningless and forcing it just compresses
    all the real variation into a sliver at the top of the chart).

    Based on outlier-TRIMMED bounds, not raw min/max -- using raw min/max
    would reintroduce the exact same single-outlier-distorts-everything
    problem this function exists to help avoid.

    Heuristic: if the trimmed minimum is more than 2x the trimmed range
    above zero, 0 isn't a meaningful reference point for this measure.
    A year (min ~1925, range ~100) has a ratio of ~19 -- clearly not
    zero-anchored. Revenue (min ~0, range large) has a ratio near 0 --
    clearly zero-anchored. A 1-5 rating (min 1, range 4) has a ratio of
    0.25 -- stays zero-anchored too, which matches the common convention
    of showing a full 0-5 scale for ratings.
    """
    tmin, tmax = _trimmed_bounds(values)
    if pd.isna(tmin) or pd.isna(tmax):
        return True
    value_range = tmax - tmin
    if value_range <= 0 or tmin <= 0:
        return True
    return (tmin / value_range) <= 2.0


def trimmed_mean(values: pd.Series, multiplier: float = 3.0) -> float:
    """
    Mean excluding extreme outliers (beyond `multiplier` x IQR from Q1/Q3).

    Only used for AVERAGE-type measures, never SUM-type ones -- a sum is
    supposed to include everything (that's what "total" means), but an
    average is meant to represent a typical value, and a single corrupted
    or extreme row (e.g. a shifted-column CSV error) can otherwise drag
    an average to somewhere meaningless. This is a standard statistical
    technique (a "trimmed mean"), not something invented for this project.
    Uses a wider multiplier (3x) than the outlier *detection* threshold in
    data_quality.py (1.5x) -- this only kicks in for genuinely extreme
    values, not just "somewhat unusual" ones, since data_quality.py's job
    is to flag anything unusual, while this only needs to protect against
    values extreme enough to make an average meaningless.
    """
    non_null = values.dropna()
    if len(non_null) == 0:
        return float("nan")
    q1, q3 = non_null.quantile(0.25), non_null.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return float(non_null.mean())
    lower, upper = q1 - multiplier * iqr, q3 + multiplier * iqr
    trimmed = non_null[(non_null >= lower) & (non_null <= upper)]
    if len(trimmed) == 0:
        return float(non_null.mean())
    return float(trimmed.mean())


def _confidence_from_fraction(frac: float, threshold: float = 0.8) -> float:
    """
    Maps a parse-success fraction (numeric_frac, date_frac) that's at or
    above `threshold` into a 0.5-1.0 confidence score, instead of a bare
    pass/fail. Sitting right at the threshold (the most marginal case
    that still qualifies) maps to 0.5; a perfect 1.0 fraction maps to
    full 1.0 confidence. This is what lets a column that's 81% numeric
    (risky, borderline) be treated differently from one that's 99.9%
    numeric (safe), instead of both being "just numeric" identically.
    """
    if frac >= 1.0:
        return 1.0
    span = 1.0 - threshold
    if span <= 0:
        return 1.0
    return round(0.5 + max(0.0, (frac - threshold)) / span * 0.5, 3)


def _date_fraction(series: pd.Series) -> float:
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0
    parsed = pd.to_datetime(non_null, errors="coerce", format="mixed")
    return parsed.notna().sum() / len(non_null)


def _numeric_fraction(series: pd.Series, column_name: str = None) -> float:
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0
    numeric = _clean_numeric_series(non_null, column_name)
    return numeric.notna().sum() / len(non_null)


def infer_column_type(name: str, series: pd.Series, n_rows: int) -> dict:
    """
    Returns a dict describing the column's inferred type and relevant stats:
    {
      "type": "date" | "numeric_measure" | "identifier" | "categorical" | "boolean" | "free_text" | "constant" | "empty",
      "cardinality": int,
      "null_fraction": float,
      ...type-specific stats...
    }
    """
    non_null = series.dropna()
    null_fraction = 1 - (len(non_null) / n_rows if n_rows else 0)
    cardinality = non_null.nunique()

    if len(non_null) == 0:
        return {"type": "empty", "cardinality": 0, "null_fraction": 1.0, "type_confidence": 1.0}

    # IMPORTANT: check numeric-ness BEFORE date-ness. If a column is already
    # a numeric pandas dtype (e.g. int64), pd.to_datetime will happily but
    # WRONGLY interpret those integers as nanoseconds-since-1970 and report
    # a high "successfully parsed as date" rate. Checking numeric first
    # avoids ever misclassifying a numeric column as a date.
    numeric_frac = _numeric_fraction(series, name)
    if numeric_frac >= 0.8:
        numeric_vals = _clean_numeric_series(non_null, name).dropna()
        looks_like_identifier = bool(ID_NAME_PATTERN.search(name))
        type_confidence = _confidence_from_fraction(numeric_frac)

        if looks_like_identifier:
            return {
                "type": "identifier",
                "cardinality": cardinality,
                "null_fraction": round(null_fraction, 3),
                "type_confidence": type_confidence,
            }

        if AVERAGE_TYPE_PATTERN.search(name):
            agg_kind, agg_kind_confident, agg_kind_confidence = "average", True, 0.9
        elif SUM_TYPE_PATTERN.search(name):
            agg_kind, agg_kind_confident, agg_kind_confidence = "sum", True, 0.9
        else:
            # Genuinely ambiguous -- name matches neither known pattern.
            # Default to "sum" (the safer/more common case) but mark this
            # as NOT confident, so the caller can escalate to an AI
            # tiebreaker and/or log it for future pattern-list improvement.
            agg_kind, agg_kind_confident, agg_kind_confidence = "sum", False, 0.5

        return {
            "type": "numeric_measure",
            "cardinality": cardinality,
            "null_fraction": round(null_fraction, 3),
            "type_confidence": type_confidence,
            "agg_kind": agg_kind,
            "agg_kind_confident": agg_kind_confident,
            "agg_kind_confidence": agg_kind_confidence,
            "zero_anchor": _should_zero_anchor(numeric_vals),
            "n_extreme_outliers": _count_extreme_outliers(numeric_vals),
            "sum": round(float(numeric_vals.sum()), 2),
            "mean": round(trimmed_mean(numeric_vals), 2),
            "min": round(float(numeric_vals.min()), 2),
            "max": round(float(numeric_vals.max()), 2),
        }

    date_frac = _date_fraction(series)
    if date_frac >= 0.8:
        parsed = pd.to_datetime(non_null, errors="coerce", format="mixed").dropna()
        return {
            "type": "date",
            "cardinality": cardinality,
            "null_fraction": round(null_fraction, 3),
            "type_confidence": _confidence_from_fraction(date_frac),
            "min_date": str(parsed.min().date()),
            "max_date": str(parsed.max().date()),
        }

    # Text column from here on
    if cardinality == 1:
        return {"type": "constant", "cardinality": 1, "null_fraction": round(null_fraction, 3),
                "type_confidence": 1.0, "value": str(non_null.iloc[0])}

    lowered = non_null.astype(str).str.lower().unique()
    boolean_sets = [{"yes", "no"}, {"true", "false"}, {"y", "n"}, {"1", "0"}]
    if cardinality <= 2 and any(set(lowered) <= bset for bset in boolean_sets):
        return {"type": "boolean", "cardinality": cardinality, "null_fraction": round(null_fraction, 3),
                "type_confidence": 0.9}

    unique_ratio = cardinality / len(non_null) if len(non_null) else 0
    is_low_cardinality = cardinality <= 50 and unique_ratio <= 0.5
    # Distance from the 0.5 unique-ratio boundary, not just which side of
    # it a column falls on -- a column at 0.05 unique ratio is obviously a
    # real category, one at 0.48 is a genuinely borderline call.
    boundary_distance = abs(unique_ratio - 0.5)
    cardinality_confidence = round(min(1.0, 0.5 + boundary_distance), 3)

    if is_low_cardinality:
        top_values = non_null.value_counts().head(10)
        return {
            "type": "categorical",
            "cardinality": cardinality,
            "null_fraction": round(null_fraction, 3),
            "type_confidence": cardinality_confidence,
            "top_values": [{"value": str(v), "count": int(c)} for v, c in top_values.items()],
        }

    return {
        "type": "free_text",
        "cardinality": cardinality,
        "null_fraction": round(null_fraction, 3),
        "type_confidence": cardinality_confidence,
    }


def apply_column_overrides(df: pd.DataFrame, column_types: dict, overrides: dict) -> dict:
    """
    Applies user-specified corrections on top of the auto-detected column
    types -- the human-in-the-loop escape hatch. Statistics and AI get it
    right most of the time, but "Total Revenue" and "Total Cost" can look
    identical to a name-pattern heuristic, and only the person who
    actually knows their spreadsheet can tell them apart with certainty.

    overrides: {column_name: {"type": "...", "agg_kind": "..." (only used
        if type is numeric_measure)}}

    Returns a NEW column_types dict. Overridden columns are recomputed
    from scratch using the SAME statistical helpers as auto-detection
    (trimmed_mean, outlier detection, zero-anchor) so a manually-corrected
    column gets identical treatment to an auto-detected one, not a
    second-class code path. Each is marked "user_corrected": True so the
    frontend can show it was a manual fix, not a guess.
    """
    result = dict(column_types)
    n_rows = len(df)

    for col, override in overrides.items():
        if col not in df.columns:
            continue  # ignore unknown columns rather than failing the whole request
        new_type = override.get("type")
        if not new_type:
            continue

        series = df[col]
        non_null = series.dropna()
        null_fraction = 1 - (len(non_null) / n_rows if n_rows else 0)
        cardinality = non_null.nunique()

        if len(non_null) == 0:
            result[col] = {"type": "empty", "cardinality": 0, "null_fraction": 1.0, "type_confidence": 1.0, "user_corrected": True}
            continue

        if new_type == "numeric_measure":
            numeric_vals = _clean_numeric_series(non_null, col).dropna()
            if len(numeric_vals) == 0:
                # Can't force numeric on genuinely non-numeric data -- fall
                # back to categorical rather than silently producing NaNs
                # everywhere downstream.
                top_values = non_null.value_counts().head(10)
                result[col] = {
                    "type": "categorical",
                    "cardinality": cardinality,
                    "null_fraction": round(null_fraction, 3),
                    "top_values": [{"value": str(v), "count": int(c)} for v, c in top_values.items()],
                    "type_confidence": 1.0,
                "user_corrected": True,
                    "correction_note": f"'{col}' doesn't contain enough numeric values to treat as a measure. Showing it as a category instead.",
                }
                continue
            agg_kind = override.get("agg_kind") if override.get("agg_kind") in ("sum", "average") else "sum"
            result[col] = {
                "type": "numeric_measure",
                "cardinality": cardinality,
                "null_fraction": round(null_fraction, 3),
                "agg_kind": agg_kind,
                "agg_kind_confident": True,  # human-specified, not a guess
                "agg_kind_confidence": 1.0,
                "zero_anchor": _should_zero_anchor(numeric_vals),
                "n_extreme_outliers": _count_extreme_outliers(numeric_vals),
                "sum": round(float(numeric_vals.sum()), 2),
                "mean": round(trimmed_mean(numeric_vals), 2),
                "min": round(float(numeric_vals.min()), 2),
                "max": round(float(numeric_vals.max()), 2),
                "type_confidence": 1.0,
                "user_corrected": True,
            }

        elif new_type == "date":
            parsed = pd.to_datetime(non_null, errors="coerce", format="mixed").dropna()
            if len(parsed) == 0:
                top_values = non_null.value_counts().head(10)
                result[col] = {
                    "type": "categorical",
                    "cardinality": cardinality,
                    "null_fraction": round(null_fraction, 3),
                    "top_values": [{"value": str(v), "count": int(c)} for v, c in top_values.items()],
                    "type_confidence": 1.0,
                "user_corrected": True,
                    "correction_note": f"'{col}' doesn't contain parseable dates. Showing it as a category instead.",
                }
                continue
            result[col] = {
                "type": "date",
                "cardinality": cardinality,
                "null_fraction": round(null_fraction, 3),
                "min_date": str(parsed.min().date()),
                "max_date": str(parsed.max().date()),
                "type_confidence": 1.0,
                "user_corrected": True,
            }

        elif new_type == "categorical":
            top_values = non_null.value_counts().head(10)
            result[col] = {
                "type": "categorical",
                "cardinality": cardinality,
                "null_fraction": round(null_fraction, 3),
                "top_values": [{"value": str(v), "count": int(c)} for v, c in top_values.items()],
                "type_confidence": 1.0,
                "user_corrected": True,
            }

        elif new_type in ("identifier", "free_text", "boolean"):
            result[col] = {
                "type": new_type,
                "cardinality": cardinality,
                "null_fraction": round(null_fraction, 3),
                "type_confidence": 1.0,
                "user_corrected": True,
            }
        # else: unrecognized requested type -- ignore, keep the auto-detected one

    return result


def infer_all_columns(df: pd.DataFrame) -> dict:
    """Returns {column_name: type_info_dict} for every column in the DataFrame."""
    n_rows = len(df)
    return {col: infer_column_type(col, df[col], n_rows) for col in df.columns}
