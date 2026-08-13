"""
kpi_engine.py

Computes dashboard KPIs, but ONLY using columns that passed verification
(verifier.py). If a required column wasn't found or didn't verify, that
KPI is simply not computed -- and the frontend should show an honest
"couldn't detect this" message rather than silently guessing.
"""

import pandas as pd


def _find_verified_column(verified_classification: dict, role: str):
    """Returns the first column name verified for the given role, or None."""
    for col, info in verified_classification.items():
        if info["role"] == role and info["verified"]:
            return col
    return None


def compute_kpis(df: pd.DataFrame, verified_classification: dict) -> dict:
    kpis = {"available": [], "unavailable": []}

    date_col = _find_verified_column(verified_classification, "date")
    amount_col = _find_verified_column(verified_classification, "sales_amount")
    category_col = (
        _find_verified_column(verified_classification, "product_name")
        or _find_verified_column(verified_classification, "category")
    )

    # KPI 1: Total revenue
    if amount_col:
        amounts = pd.to_numeric(df[amount_col], errors="coerce").dropna()
        kpis["total_revenue"] = round(float(amounts.sum()), 2)
        kpis["available"].append("total_revenue")
    else:
        kpis["unavailable"].append({"kpi": "total_revenue", "reason": "no verified sales amount column found"})

    # KPI 2: Revenue over time (monthly)
    if date_col and amount_col:
        temp = df[[date_col, amount_col]].copy()
        temp[date_col] = pd.to_datetime(temp[date_col], errors="coerce", format="mixed")
        temp[amount_col] = pd.to_numeric(temp[amount_col], errors="coerce")
        temp = temp.dropna()
        temp["month"] = temp[date_col].dt.to_period("M").astype(str)
        monthly = temp.groupby("month")[amount_col].sum().round(2)
        kpis["revenue_over_time"] = [{"month": m, "revenue": v} for m, v in monthly.items()]
        kpis["available"].append("revenue_over_time")
    else:
        kpis["unavailable"].append({
            "kpi": "revenue_over_time",
            "reason": "requires both a verified date column and a verified sales amount column",
        })

    # KPI 3: Top categories/products by revenue
    if category_col and amount_col:
        temp = df[[category_col, amount_col]].copy()
        temp[amount_col] = pd.to_numeric(temp[amount_col], errors="coerce")
        temp = temp.dropna()
        top = temp.groupby(category_col)[amount_col].sum().sort_values(ascending=False).head(5).round(2)
        kpis["top_categories"] = [{"name": k, "revenue": v} for k, v in top.items()]
        kpis["available"].append("top_categories")
    else:
        kpis["unavailable"].append({
            "kpi": "top_categories",
            "reason": "requires both a verified product/category column and a verified sales amount column",
        })

    return kpis
