"""
chart_engine.py

Generates a dashboard's worth of charts from ONLY the statistical type
information in type_inference.py -- no business-domain assumptions, no
AI dependency. This is what makes the product work on any spreadsheet,
not just sales data.

Chart selection rules (deliberately simple and explainable):
  - Any numeric_measure column -> a summary card (sum, mean, min, max)
  - date column + numeric_measure column -> a line chart of that measure
    over time, grouped by day/week/month depending on the date range
  - categorical column + numeric_measure column -> a bar chart of the
    top categories by that measure
  - categorical column with NO numeric measure available -> a bar chart
    of row counts per category (frequency)

Caps are applied everywhere so a wide spreadsheet doesn't generate an
overwhelming number of charts.
"""

import itertools
import pandas as pd
from type_inference import _clean_numeric_series, trimmed_mean

MAX_SUMMARY_CARDS = 6
MAX_TIME_CHARTS = 2
MAX_MEASURES_FOR_BREAKDOWN = 3  # how many top numeric measures get paired with each category
MAX_CATEGORY_COLUMNS = 4        # how many categorical columns get used at all
MAX_TOTAL_BAR_CHARTS = 10       # overall cap so measures x categories can't explode
MAX_HISTOGRAM_CHARTS = 3        # distribution charts -- generated regardless of dataset shape
MAX_PIE_CHARTS = 2              # proportions view, for low-cardinality categorical columns
MAX_PIE_CATEGORIES = 7
TOP_N_CATEGORIES = 8

# An average computed from too few rows isn't a meaningful statistic --
# it's just that one row's value. A single outlier or data-entry error can
# then look exactly like a real trend. Sums don't have this problem (a sum
# of one row is still a legitimate total), so this guard only applies when
# agg_kind == "average".
MIN_GROUP_SIZE_FOR_AVERAGE = 5

# A trend line drawn from too few time buckets isn't a meaningful signal,
# it just connects 2-3 dots. This commonly happens with a "scraped_at" or
# "posted_at" style date column that only spans a few days, not a genuine
# analytical time dimension. Same principle as above, applied to the
# number of periods instead of rows per period.
MIN_TIME_BUCKETS_FOR_TREND = 7


def _format_value(v):
    if abs(v) >= 1000:
        return f"{v:,.0f}"
    return f"{v:,.2f}" if v != int(v) else f"{int(v):,}"


def _summarize_bar(bars: list, kind: str) -> dict:
    """Deterministic facts about a bar chart -- computed in Python from
    real values, not left to AI to calculate. AI (if used later) only
    rephrases these already-true facts, never invents new ones."""
    if not bars:
        return {}
    highest = bars[0]
    lowest = bars[-1]
    verb = "averages" if kind == "average" else "totals"
    stat = f"Highest: {highest['category']} ({_format_value(highest['value'])}). Lowest: {lowest['category']} ({_format_value(lowest['value'])})."
    return {"stat_summary": stat, "highest": highest, "lowest": lowest, "verb": verb}


def _summarize_line(points: list, kind: str) -> dict:
    """Deterministic facts about a time trend -- real first/last/peak
    values computed directly, not estimated or guessed."""
    if len(points) < 2:
        return {}
    first, last = points[0], points[-1]
    peak = max(points, key=lambda p: p["value"])
    change_pct = None
    if first["value"] != 0:
        change_pct = (last["value"] - first["value"]) / abs(first["value"]) * 100

    direction = "flat"
    if change_pct is not None:
        direction = "up" if change_pct > 1 else ("down" if change_pct < -1 else "flat")

    if change_pct is not None:
        stat = f"{'Up' if direction == 'up' else 'Down' if direction == 'down' else 'Roughly flat'} {abs(change_pct):.0f}% from {first['period']} to {last['period']}. Peak: {peak['period']} ({_format_value(peak['value'])})."
    else:
        stat = f"Peak: {peak['period']} ({_format_value(peak['value'])})."

    return {"stat_summary": stat, "first": first, "last": last, "peak": peak, "direction": direction, "change_pct": change_pct}


def _build_histogram(series: pd.Series, bin_count: int = 10, column_name: str = None):
    """Equal-width histogram over a numeric series. Works on ANY numeric
    column regardless of dataset shape -- doesn't need a categorical or
    date column to exist, unlike bar/line charts.

    Bin edges are computed from an OUTLIER-TRIMMED range, not raw min/max.
    A single corrupted or extreme value (e.g. a shifted-column CSV error
    like the one found in an earlier real dataset during testing) would
    otherwise stretch the entire histogram's scale, compressing 99% of
    genuine data into one bin. Every value is still counted -- outliers
    just land in the first/last bin instead of distorting the axis for
    everything else. Uses a wider multiplier (3x IQR) than the outlier
    *detection* in data_quality.py (1.5x), so this only kicks in for
    genuinely extreme values, not just "somewhat unusual" ones.
    """
    values = _clean_numeric_series(series, column_name).dropna()
    if len(values) == 0:
        return None

    true_min, true_max = float(values.min()), float(values.max())
    if true_min == true_max:
        return {"bins": [{"bin": _format_value(true_min), "count": len(values)}], "total": len(values)}

    q1, q3 = values.quantile(0.25), values.quantile(0.75)
    iqr = q3 - q1
    if iqr > 0:
        vmin = max(true_min, float(q1 - 3 * iqr))
        vmax = min(true_max, float(q3 + 3 * iqr))
        if vmin >= vmax:  # guard against a degenerate trim
            vmin, vmax = true_min, true_max
    else:
        vmin, vmax = true_min, true_max

    bin_size = (vmax - vmin) / bin_count
    edges = [vmin + i * bin_size for i in range(bin_count + 1)]
    counts = [0] * bin_count
    for v in values:
        idx = int((v - vmin) / bin_size)
        if idx >= bin_count:
            idx = bin_count - 1
        if idx < 0:
            idx = 0
        counts[idx] += 1
    bins = [
        {"bin": f"{_format_value(edges[i])}-{_format_value(edges[i + 1])}", "count": counts[i]}
        for i in range(bin_count)
    ]
    return {"bins": bins, "total": len(values), "trimmed": (vmin > true_min or vmax < true_max)}


def _summarize_histogram(hist: dict) -> dict:
    if not hist or not hist["bins"] or hist["total"] == 0:
        return {}
    max_bin = max(hist["bins"], key=lambda b: b["count"])
    if max_bin["count"] == 0:
        return {}
    pct = round(max_bin["count"] / hist["total"] * 100)
    stat = f"Most common range: {max_bin['bin']}, with {max_bin['count']:,} of {hist['total']:,} rows ({pct}%)."
    return {"stat_summary": stat}


def _build_pie(df: pd.DataFrame, cat_col: str, top_n: int = MAX_PIE_CATEGORIES):
    counts = df[cat_col].value_counts()
    if len(counts) > top_n:
        top = counts.head(top_n - 1)
        other = counts.iloc[top_n - 1:].sum()
        slices = [{"category": str(k), "value": int(v)} for k, v in top.items()]
        if other > 0:
            slices.append({"category": "Other", "value": int(other)})
    else:
        slices = [{"category": str(k), "value": int(v)} for k, v in counts.items()]
    return slices


def _summarize_pie(slices: list, total: int) -> dict:
    if not slices or total == 0:
        return {}
    top = slices[0]
    pct = round(top["value"] / total * 100)
    stat = f"{top['category']} accounts for {pct} percent of all rows ({top['value']:,} of {total:,})."
    return {"stat_summary": stat}


def _pick_date_grouping(min_date, max_date) -> str:
    span_days = (pd.Timestamp(max_date) - pd.Timestamp(min_date)).days
    if span_days > 180:
        return "M"  # month
    elif span_days > 21:
        return "W"  # week
    else:
        return "D"  # day


def build_charts(df: pd.DataFrame, column_types: dict, labels: dict) -> dict:
    """
    column_types: {col_name: type_info_dict} from type_inference.infer_all_columns
    labels: {col_name: display_label_string} for nicer titles (falls back to raw name)

    Returns: {"overview": {...}, "charts": [chart_dict, ...]}
    """
    def label(col):
        return labels.get(col, col.replace("_", " ").title())

    def agg_kind_of(col):
        return column_types[col].get("agg_kind", "sum")

    date_cols = [c for c, t in column_types.items() if t["type"] == "date"]
    numeric_cols = [c for c, t in column_types.items() if t["type"] == "numeric_measure"]
    categorical_cols = [c for c, t in column_types.items() if t["type"] == "categorical"]

    charts = []

    # 1. Summary cards for numeric measures
    for col in numeric_cols[:MAX_SUMMARY_CARDS]:
        info = column_types[col]
        n_outliers = info.get("n_extreme_outliers", 0)
        card = {
            "type": "summary_card",
            "title": label(col),
            "agg_kind": info.get("agg_kind", "sum"),
            "zero_anchor": info.get("zero_anchor", True),
            "measure_column": col,
            "sum": info["sum"],
            "mean": info["mean"],
            "min": info["min"],
            "max": info["max"],
        }
        if n_outliers > 0 and info.get("agg_kind") == "average":
            if n_outliers == 1:
                card["warning"] = (
                    "1 extreme value was excluded from this average (too far outside the "
                    "typical range to be reliable). The min/max above still include it."
                )
            else:
                card["warning"] = (
                    f"{n_outliers} extreme values were excluded from this average (too far "
                    "outside the typical range to be reliable). The min/max above still include them."
                )
        charts.append(card)

    # 2. Time trend charts (date + numeric measure)
    if date_cols and numeric_cols:
        date_col = date_cols[0]  # use the first date column found
        date_info = column_types[date_col]
        grouping = _pick_date_grouping(date_info["min_date"], date_info["max_date"])

        temp_dates = pd.to_datetime(df[date_col], errors="coerce", format="mixed")

        # If even DAY-level grouping doesn't produce enough distinct
        # buckets, this date column doesn't span enough range to support
        # a trend chart at all (e.g. a "scraped_at" timestamp covering
        # only a few days). Skip time charts entirely rather than show a
        # near-flat line connecting 2-3 points.
        n_distinct_days = temp_dates.dt.date.nunique()
        skip_time_charts = n_distinct_days < MIN_TIME_BUCKETS_FOR_TREND

        if not skip_time_charts:
            for measure_col in numeric_cols[:MAX_TIME_CHARTS]:
                kind = agg_kind_of(measure_col)
                temp = pd.DataFrame({
                    "_date": temp_dates,
                    "_value": _clean_numeric_series(df[measure_col], measure_col),
                }).dropna()
                if temp.empty:
                    continue
                temp["_period"] = temp["_date"].dt.to_period(grouping).astype(str)
                grouped_series = temp.groupby("_period")["_value"]

                if kind == "average":
                    counts = grouped_series.size()
                    valid_periods = counts[counts >= MIN_GROUP_SIZE_FOR_AVERAGE].index
                    if len(valid_periods) == 0:
                        continue
                    temp = temp[temp["_period"].isin(valid_periods)]
                    grouped_series = temp.groupby("_period")["_value"]

                grouped = (grouped_series.apply(trimmed_mean) if kind == "average" else grouped_series.sum()).round(2)

                # Even after grouping, if the chosen grouping (week/month)
                # collapses everything into too few buckets, skip this
                # specific chart rather than show an uninformative line.
                if len(grouped) < MIN_TIME_BUCKETS_FOR_TREND:
                    continue

                title_prefix = "Average " if kind == "average" else ""
                points = [{"period": p, "value": v} for p, v in grouped.items()]
                line_chart = {
                    "type": "line",
                    "title": f"{title_prefix}{label(measure_col)} over time",
                    "x_label": {"D": "Day", "W": "Week", "M": "Month"}[grouping],
                    "date_column": date_col,
                    "measure_column": measure_col,
                    "zero_anchor": column_types[measure_col].get("zero_anchor", True),
                    "grouping": grouping,
                    "points": points,
                    "summary": _summarize_line(points, kind),
                }
                n_outliers = column_types[measure_col].get("n_extreme_outliers", 0)
                if kind == "average" and n_outliers > 0:
                    line_chart["warning"] = (
                        f"{label(measure_col)} has {n_outliers} extreme value"
                        f"{'s' if n_outliers != 1 else ''} excluded from averages shown here."
                    )
                charts.append(line_chart)

    # 3. Category breakdown charts -- pair the TOP FEW numeric measures
    #    with the TOP FEW categorical columns, not just a single measure.
    #    This is the fix for "not enough charts": a dataset with several
    #    interesting numeric measures now gets breakdowns for more than
    #    just whichever measure happened to be first in the file.
    charts_added = 0
    measures_for_breakdown = numeric_cols[:MAX_MEASURES_FOR_BREAKDOWN] or [None]
    for cat_col, measure_col in itertools.product(categorical_cols[:MAX_CATEGORY_COLUMNS], measures_for_breakdown):
        if charts_added >= MAX_TOTAL_BAR_CHARTS:
            break

        if measure_col is None:
            counts = df[cat_col].value_counts().head(TOP_N_CATEGORIES)
            bars = [{"category": str(k), "value": int(v)} for k, v in counts.items()]
            charts.append({
                "type": "bar",
                "title": f"Count by {label(cat_col)}",
                "category_column": cat_col,
                "measure_column": None,
                "bars": bars,
                "summary": _summarize_bar(bars, "sum"),
            })
            charts_added += 1
            continue

        kind = agg_kind_of(measure_col)
        temp = pd.DataFrame({
            "_cat": df[cat_col],
            "_value": _clean_numeric_series(df[measure_col], measure_col),
        }).dropna()
        if temp.empty:
            continue

        grouped_series = temp.groupby("_cat")["_value"]

        if kind == "average":
            counts = grouped_series.size()
            valid_cats = counts[counts >= MIN_GROUP_SIZE_FOR_AVERAGE].index
            if len(valid_cats) == 0:
                continue
            temp = temp[temp["_cat"].isin(valid_cats)]
            grouped_series = temp.groupby("_cat")["_value"]

        grouped = (grouped_series.apply(trimmed_mean) if kind == "average" else grouped_series.sum())
        grouped = grouped.sort_values(ascending=False).head(TOP_N_CATEGORIES).round(2)
        title_prefix = "Average " if kind == "average" else ""
        bars = [{"category": str(k), "value": v} for k, v in grouped.items()]
        bar_chart = {
            "type": "bar",
            "title": f"{title_prefix}{label(measure_col)} by {label(cat_col)}",
            "category_column": cat_col,
            "measure_column": measure_col,
            "zero_anchor": column_types[measure_col].get("zero_anchor", True),
            "bars": bars,
            "summary": _summarize_bar(bars, kind),
        }
        n_outliers = column_types[measure_col].get("n_extreme_outliers", 0)
        if kind == "average" and n_outliers > 0:
            bar_chart["warning"] = (
                f"{label(measure_col)} has {n_outliers} extreme value"
                f"{'s' if n_outliers != 1 else ''} excluded from averages shown here."
            )
        charts.append(bar_chart)
        charts_added += 1

    # 4. Distribution charts -- generated for the top numeric measures
    #    REGARDLESS of whether categorical or date columns exist. This
    #    guarantees baseline chart richness for any dataset shape,
    #    including ones with only numeric columns and nothing to group by.
    for measure_col in numeric_cols[:MAX_HISTOGRAM_CHARTS]:
        hist = _build_histogram(df[measure_col], column_name=measure_col)
        if hist is None:
            continue
        chart = {
            "type": "histogram",
            "title": f"Distribution of {label(measure_col)}",
            "measure_column": measure_col,
            "bins": hist["bins"],
            "summary": _summarize_histogram(hist),
        }
        if hist.get("trimmed"):
            n_outliers = column_types[measure_col].get("n_extreme_outliers", 0)
            if n_outliers == 1:
                chart["warning"] = (
                    "1 extreme value falls far outside the typical range and was grouped "
                    "into the outer bin so it doesn't compress the rest of the chart."
                )
            else:
                chart["warning"] = (
                    f"{n_outliers} extreme values fall far outside the typical range and were "
                    "grouped into the outer bins so they don't compress the rest of the chart."
                )
        charts.append(chart)

    # 5. Pie/donut charts -- a proportions view for low-cardinality
    #    categorical columns. Picked separately from the bar-chart
    #    breakdowns above so the same column doesn't just repeat in a
    #    different shape; this is what gives real chart-type variety.
    used_in_bars = {c["category_column"] for c in charts if c["type"] == "bar"}
    pie_candidates = [
        c for c in categorical_cols
        if column_types[c]["cardinality"] <= MAX_PIE_CATEGORIES + 3
    ]
    pie_candidates = [c for c in pie_candidates if c not in used_in_bars] + \
        [c for c in pie_candidates if c in used_in_bars]

    for cat_col in pie_candidates[:MAX_PIE_CHARTS]:
        slices = _build_pie(df, cat_col)
        total = int(df[cat_col].notna().sum())
        charts.append({
            "type": "pie",
            "title": f"Proportion of {label(cat_col)}",
            "category_column": cat_col,
            "slices": slices,
            "summary": _summarize_pie(slices, total),
        })

    overview = {
        "n_numeric": len(numeric_cols),
        "n_categorical": len(categorical_cols),
        "n_date": len(date_cols),
        "date_range": (
            {"min": column_types[date_cols[0]]["min_date"], "max": column_types[date_cols[0]]["max_date"]}
            if date_cols else None
        ),
    }

    return {"overview": overview, "charts": charts}
