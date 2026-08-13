"""
column_classifier.py

Sends column names + sample values to Claude and asks it to classify each
column's semantic role (date, sales_amount, customer_name, etc).

IMPORTANT: this classification is a GUESS, not ground truth. See verifier.py
for the step that actually checks whether each guess holds up against the
real data -- that verification step is the actual differentiator of this
project, same philosophy as the AI SQL Auditor project.
"""

import os
import json
import pandas as pd
import anthropic

from heuristic_classifier import split_columns

# Haiku is roughly 3x cheaper than Sonnet and plenty capable for this
# simple structured classification task -- no need to pay for Sonnet here.
MODEL = "claude-haiku-4-5-20251001"

VALID_ROLES = [
    "date", "sales_amount", "expense_amount", "quantity", "unit_price",
    "customer_name", "product_name", "category", "notes", "other"
]

SYSTEM_PROMPT = f"""You are a data analyst helping classify spreadsheet columns
for a small business owner. You will be given column names and a few sample
values from each column. Classify each column into ONE of these roles:
{', '.join(VALID_ROLES)}

Respond with ONLY a JSON object (no markdown fences, no preamble):
{{
  "columns": {{
    "<column_name>": {{"role": "<one of the roles above>", "confidence": "high"|"medium"|"low"}}
  }}
}}
"""


def get_column_samples(df: pd.DataFrame, n_samples: int = 5) -> dict:
    """Build a dict of column_name -> list of sample values (as strings)."""
    samples = {}
    for col in df.columns:
        non_null = df[col].dropna()
        vals = non_null.head(n_samples).astype(str).tolist()
        samples[col] = vals
    return samples


def classify_columns(df: pd.DataFrame) -> dict:
    """
    Classifies each column's semantic role, spending an API call ONLY on
    columns the free heuristic layer couldn't confidently handle.

    Returns the raw (unverified) classification dict:
    {column_name: {role, confidence, source}}
    """
    heuristic_matches, needs_ai = split_columns(list(df.columns))

    if not needs_ai:
        # Every column matched a known pattern -- zero API cost for this upload.
        return heuristic_matches

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    samples = get_column_samples(df[needs_ai])

    user_msg = "COLUMNS AND SAMPLE VALUES:\n" + json.dumps(samples, indent=2)
    user_msg += "\n\nClassify each column's role."

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw_text = "".join(b.text for b in resp.content if b.type == "text")
    cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    ai_matches = {}
    try:
        parsed = json.loads(cleaned)
        for col, info in parsed.get("columns", {}).items():
            info["source"] = "ai"
            ai_matches[col] = info
    except json.JSONDecodeError:
        print("WARNING: could not parse classifier response:", raw_text)

    return {**heuristic_matches, **ai_matches}
