"""
summary_writer.py

Takes the deterministic stat_summary facts already computed in
chart_engine.py and asks AI to phrase them as a short, natural sentence.

IMPORTANT: the AI is given the exact facts and told explicitly not to
introduce any number that isn't already present in what it was given.
It is a phrasing layer, not a calculation layer -- the actual numbers
come entirely from Python, matching the project's overall principle of
verifying/constraining AI rather than trusting it to compute things.

Graceful fallback: if this fails entirely, the frontend simply shows the
stat_summary text as-is (already a complete, correct sentence on its own).
"""

import os
import json
import anthropic

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You will be given a list of chart titles, each with a short
list of already-verified facts about that chart. Write ONE short, natural,
plain-English sentence per chart that communicates the facts conversationally.

STRICT RULE: only use the numbers and facts given to you. Do not introduce,
estimate, round differently, or invent any number not explicitly provided.
If you cannot phrase something without adding a new number, keep the
original stat text mostly as-is instead.

Do not use em dashes anywhere in your output. Use periods or commas instead.

Respond with ONLY a JSON object (no markdown fences, no preamble):
{"sentences": {"<chart_title>": "<one sentence>"}}
"""


def write_summaries(charts_with_facts: list[dict]) -> dict:
    """
    charts_with_facts: [{"title": ..., "facts": "..."}]
    Returns {title: sentence}. Returns {} on any failure -- caller should
    fall back to showing the raw stat_summary text in that case.
    """
    if not charts_with_facts:
        return {}
    try:
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=MODEL,
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(charts_with_facts)}],
             timeout=20.0,
        )
        raw_text = "".join(b.text for b in resp.content if b.type == "text")
        cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        return parsed.get("sentences", {})
    except Exception as e:
        print(f"WARNING: AI summary phrasing failed, falling back to stat text. Error: {e}")
        return {}
