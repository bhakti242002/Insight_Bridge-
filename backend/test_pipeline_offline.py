"""
test_pipeline_offline.py

Tests the core v2 pipeline (type_inference.py + chart_engine.py) against
BOTH sample files, WITHOUT needing an API key -- semantic_labeler.py is
skipped here in favor of a plain title-case fallback, since labeling is
purely cosmetic and the core pipeline doesn't depend on it.

Usage:
    python test_pipeline_offline.py
"""

import pandas as pd
from type_inference import infer_all_columns
from chart_engine import build_charts


def run(path, name):
    print(f"=== {name} ===")
    df = pd.read_csv(path)
    column_types = infer_all_columns(df)

    print("Column types:")
    for col, info in column_types.items():
        print(f"  {col:15s} -> {info['type']}")

    labels = {c: c.replace("_", " ").title() for c in df.columns}  # fallback labels, no API call
    dashboard = build_charts(df, column_types, labels)

    print(f"\nCharts generated: {len(dashboard['charts'])}")
    for chart in dashboard["charts"]:
        print(f"  [{chart['type']}] {chart['title']}")
    print()


run("../sample_data/ugly_sales_export.csv", "SALES CSV")
run("../sample_data/totally_unrelated_grades.csv", "STUDENT GRADES CSV (proves generalization)")

print("If both files produced charts above, the core pipeline works correctly.")
