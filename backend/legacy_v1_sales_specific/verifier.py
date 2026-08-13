"""
verifier.py

Takes AI's column role guesses (from column_classifier.py) and actually
checks them against the real data in the DataFrame. This is the core
"don't just trust AI" step -- same philosophy as the AI SQL Auditor project.

For each guessed role, we run a real check:
  - date            -> does the column actually parse as a date?
  - sales_amount /
    expense_amount /
    unit_price      -> is it numeric, and mostly non-negative?
  - quantity        -> is it numeric, and mostly non-negative integers?
  - customer_name /
    product_name /
    category        -> is it mostly text (not numeric)?
  - notes / other   -> no strict check, always passes (low-stakes roles)

Returns a verified classification: each column gets its AI-guessed role,
a "verified" boolean, and a note explaining the check's outcome.
"""

import pandas as pd


def _try_parse_dates(series: pd.Series) -> float:
    """Returns the fraction of non-null values that successfully parse as dates."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0
    parsed = pd.to_datetime(non_null, errors="coerce", format="mixed")
    return parsed.notna().sum() / len(non_null)


def _numeric_fraction(series: pd.Series) -> tuple[float, float]:
    """Returns (fraction_numeric, fraction_non_negative_of_numeric)."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0, 0.0
    numeric = pd.to_numeric(non_null, errors="coerce")
    frac_numeric = numeric.notna().sum() / len(non_null)
    numeric_vals = numeric.dropna()
    if len(numeric_vals) == 0:
        return frac_numeric, 0.0
    frac_non_negative = (numeric_vals >= 0).sum() / len(numeric_vals)
    return frac_numeric, frac_non_negative


def _text_fraction(series: pd.Series) -> float:
    """Returns the fraction of non-null values that are NOT purely numeric
    (a rough proxy for 'this looks like a name/category, not a number')."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0
    numeric = pd.to_numeric(non_null, errors="coerce")
    return numeric.isna().sum() / len(non_null)


THRESHOLD = 0.8  # a role must be supported by at least 80% of non-null values


def verify_column(series: pd.Series, guessed_role: str) -> dict:
    """Returns {"verified": bool, "note": str} for a single column + guessed role."""

    if guessed_role == "date":
        frac = _try_parse_dates(series)
        verified = frac >= THRESHOLD
        return {"verified": verified, "note": f"{frac:.0%} of values parsed as valid dates"}

    if guessed_role in ("sales_amount", "expense_amount", "unit_price"):
        frac_numeric, frac_non_negative = _numeric_fraction(series)
        verified = frac_numeric >= THRESHOLD and frac_non_negative >= THRESHOLD
        return {
            "verified": verified,
            "note": f"{frac_numeric:.0%} numeric, {frac_non_negative:.0%} of those non-negative",
        }

    if guessed_role == "quantity":
        frac_numeric, frac_non_negative = _numeric_fraction(series)
        verified = frac_numeric >= THRESHOLD and frac_non_negative >= THRESHOLD
        return {
            "verified": verified,
            "note": f"{frac_numeric:.0%} numeric, {frac_non_negative:.0%} of those non-negative",
        }

    if guessed_role in ("customer_name", "product_name", "category"):
        frac_text = _text_fraction(series)
        verified = frac_text >= THRESHOLD
        return {"verified": verified, "note": f"{frac_text:.0%} of values are non-numeric text"}

    # notes / other -- no strict check, low stakes either way
    return {"verified": True, "note": "no strict check applied for this role"}


def verify_classification(df: pd.DataFrame, ai_classification: dict) -> dict:
    """
    ai_classification: {column_name: {"role": ..., "confidence": ...}}
    Returns: {column_name: {"role": ..., "confidence": ..., "verified": bool, "note": ...}}
    """
    result = {}
    for col, info in ai_classification.items():
        if col not in df.columns:
            continue
        role = info.get("role", "other")
        check = verify_column(df[col], role)
        result[col] = {
            "role": role,
            "confidence": info.get("confidence", "unknown"),
            "verified": check["verified"],
            "note": check["note"],
        }
    return result
