"""
qa_engine.py

Translates a natural-language question ("what's the average score for
students who sleep more than 7 hours") into a structured query spec that
gets EXECUTED deterministically against the real data, client-side, in
chartCompute.js. AI never computes the actual answer or sees the real
data here -- it only identifies which operation, column, and filters the
question is asking for. This mirrors the same principle as
semantic_labeler.py and summary_writer.py: AI identifies intent, code
computes truth.

The returned spec is validated against the real column list before being
trusted at all -- if AI names a column that doesn't exist, the request is
rejected rather than passed through.
"""

import os
import json
import anthropic

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You translate a natural-language question about a dataset
into a structured query. You will be given the question and a list of
available columns with their types and, for categorical columns, some of
their real values.

Respond with ONLY a JSON object (no markdown fences, no preamble) matching
this shape:
{
  "operation": "average" | "sum" | "count" | "min" | "max",
  "target_column": "<exact column name, or null if operation is count>",
  "group_by": "<exact column name to group by, or null if not grouping>",
  "return_columns": ["<exact column name>", ...] or null,
  "filters": [
    {"column": "<exact column name>", "operator": ">"|"<"|">="|"<="|"=="|"!=", "value": <number or string>}
  ],
  "clarification_needed": "<a short question to ask back, ONLY if the request is too ambiguous to answer, otherwise null>"
}

IMPORTANT: if the question asks "which X has the highest/lowest Y" or is
looking for a specific record rather than a number (e.g. "highest paying
job", "which product sells best", "who has the most absences"), set
operation to "max" or "min" on the relevant numeric column, and set
"return_columns" to the column(s) that identify the record (e.g. a job
title, product name, or person's name column). Do NOT set group_by in
this case. Only use return_columns for this "find the record" pattern,
not for plain aggregate questions like "what is the average salary".

Column and value names in your response must exactly match the ones given
to you. If the question cannot be answered with the available columns, set
clarification_needed instead of guessing.

Do not use em dashes anywhere in your output.
"""


def parse_question(question: str, column_types: dict, labels: dict) -> dict:
    """
    column_types: {col_name: type_string} (as already sent to the frontend)
    labels: {col_name: display_label}

    Returns the parsed spec dict, or {"error": "..."} on failure/ambiguity.
    Never returns a fabricated number -- this function only ever returns
    the QUESTION'S STRUCTURE, not an answer.
    """
    column_info = [
        {"column": col, "type": t, "label": labels.get(col, col)}
        for col, t in column_types.items()
        if t in ("numeric_measure", "categorical", "free_text", "date", "boolean", "identifier")
    ]

    try:
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=MODEL,
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps({"question": question, "columns": column_info})}],
                timeout=20.0,
        )
        raw_text = "".join(b.text for b in resp.content if b.type == "text")
        cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        spec = json.loads(cleaned)
    except Exception as e:
        return {"error": f"Could not understand the question right now. ({e})"}

    # Validate against the REAL column list before trusting anything --
    # AI naming a column that doesn't exist should fail loudly, not
    # silently produce a wrong or fabricated result downstream.
    valid_columns = set(column_types.keys())
    if spec.get("target_column") and spec["target_column"] not in valid_columns:
        return {"error": f"AI referenced an unknown column: {spec['target_column']}"}
    if spec.get("group_by") and spec["group_by"] not in valid_columns:
        return {"error": f"AI referenced an unknown column: {spec['group_by']}"}
    for f in spec.get("filters", []):
        if f.get("column") not in valid_columns:
            return {"error": f"AI referenced an unknown column in a filter: {f.get('column')}"}
    for col in spec.get("return_columns") or []:
        if col not in valid_columns:
            return {"error": f"AI referenced an unknown column in return_columns: {col}"}

    return spec
