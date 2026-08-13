"""
semantic_labeler.py

AI is the PRIMARY decision-maker here for anything semantic (display
labels, sum-vs-average aggregation) -- the keyword/statistical defaults
from type_inference.py are a FALLBACK for when AI is unavailable, not
the other way around.

Why this shift: every real-world dataset tested against this project so
far has surfaced a column name that broke a fixed keyword list (Operating
Profit, Price per Unit, stop_id, footnote columns...). Patching the list
forever doesn't scale -- the underlying decision is semantic, and AI is
better suited to it than a fixed vocabulary ever will be. The keyword
defaults still matter: they're what the app falls back to if the API is
down, so the dashboard still works, just less precisely, without a key.
"""

import os
import json
import anthropic

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are helping understand a spreadsheet for a business
dashboard. You will be given the TRUE total row count, the list of columns
(each with a few sample values and, for numeric columns, a keyword-based
suggested aggregation), and a few sample rows from the actual file.

IMPORTANT: the sample rows shown to you are only a handful of examples for
context, NOT the full dataset. Always use the exact "n_rows" number given
to you when stating how many records/rows/entries the dataset has. Never
infer the dataset's size from how many sample rows you were shown.

Provide THREE things:

1. "overview": 2 to 4 plain sentences describing what this dataset appears
   to be about, written for someone who has not seen it yet. Be specific
   (mention the kind of records, the notable columns, and the exact
   n_rows count given to you) rather than generic.

2. "columns": for EACH column, a "label" (short, clean, human-friendly
   display name, 2-4 words, title case) and, for numeric columns only, an
   "agg_kind" ("sum" or "average", or null for non-numeric columns). The
   suggested aggregation given to you is a rough keyword-based guess and is
   often wrong. Override it whenever the column name or sample values
   indicate otherwise. Any "per X" style column (like "Price per Unit")
   should always be averaged, never summed, regardless of other words in
   its name.

Do not use em dashes anywhere in your output. Use periods, commas, or
parentheses instead.

Respond with ONLY a JSON object (no markdown fences, no preamble):
{
  "overview": "...",
  "columns": {"<raw_column_name>": {"label": "...", "agg_kind": "sum"|"average"|null}}
}
"""


def understand_columns(column_names: list, samples: dict, numeric_defaults: dict, sample_rows: list = None, n_rows: int = None) -> dict:
    """
    column_names: every column name in the file
    samples: {col_name: [sample_value, ...]}
    numeric_defaults: {col_name: "sum"|"average"} keyword-based guess,
        present only for numeric_measure columns
    sample_rows: a few full rows (as dicts) to give the AI real context
        for writing the dataset overview
    n_rows: the REAL total row count, passed explicitly so the AI never
        has to (wrongly) infer dataset size from the sample row count

    Returns {"overview": str, "columns": {col_name: {...}}}. Returns
    {} on ANY failure -- callers fall back to keyword defaults, title-cased
    names, and no overview text in that case.
    """
    payload = {
        "n_rows": n_rows,
        "columns": [],
        "sample_rows": (sample_rows or [])[:5],
    }
    for col in column_names:
        entry = {"column": col, "samples": samples.get(col, [])}
        if col in numeric_defaults:
            entry["suggested_agg_kind"] = numeric_defaults[col]
        payload["columns"].append(entry)

    try:
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(payload)}],
            timeout=20.0,
        )
        raw_text = "".join(b.text for b in resp.content if b.type == "text")
        cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        return {"overview": parsed.get("overview", ""), "columns": parsed.get("columns", {})}
    except Exception as e:
        print(f"WARNING: column understanding failed, using keyword/title-case fallback. Error: {e}")
        return {}
