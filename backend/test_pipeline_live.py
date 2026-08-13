"""
test_pipeline_live.py

Same as test_pipeline_offline.py, but uses the REAL Claude API call for
semantic_labeler.py (nicer column display labels) instead of the plain
fallback. Useful to see what labels Claude actually generates, and to
confirm the fallback logic isn't masking a real API problem.

Usage:
    export ANTHROPIC_API_KEY="your-key-here"
    python test_pipeline_live.py
"""

import pandas as pd
from type_inference import infer_all_columns
from chart_engine import build_charts
from semantic_labeler import generate_labels


def run(path, name):
    print(f"=== {name} ===")
    df = pd.read_csv(path)
    column_types = infer_all_columns(df)

    labels = generate_labels(list(df.columns))
    print("Labels generated:", labels)

    dashboard = build_charts(df, column_types, labels)
    print(f"Charts generated: {len(dashboard['charts'])}")
    for chart in dashboard["charts"]:
        print(f"  [{chart['type']}] {chart['title']}")
    print()


run("../sample_data/ugly_sales_export.csv", "SALES CSV")
run("../sample_data/totally_unrelated_grades.csv", "STUDENT GRADES CSV")
