"""
heuristic_classifier.py

Handles the OBVIOUS column classifications with simple pattern matching on
the column name -- completely free, no API call needed. Only columns that
don't confidently match a pattern get escalated to the AI classifier
(column_classifier.py), which costs real money per call.

This is a legitimate cost-optimization: most real-world spreadsheets have
at least a few unambiguous column names ("Date", "Total", "Customer"),
and there's no reason to spend an API call confirming what's already obvious.
"""

import re

# Ordered by specificity -- more specific patterns first, so e.g.
# "unit_price" matches before the more general "price" pattern would.
PATTERNS = [
    ("date", [r"date", r"^dt$", r"transaction.?date", r"order.?date"]),
    ("customer_name", [r"cust(omer)?.?name", r"client.?name", r"^customer$", r"^client$"]),
    ("product_name", [r"product", r"item", r"sku", r"description"]),
    ("quantity", [r"qty", r"quantity", r"units?.?sold", r"^count$"]),
    ("unit_price", [r"unit.?price", r"price.?per", r"^price$", r"^rate$"]),
    ("sales_amount", [r"total", r"amount", r"revenue", r"sales", r"sub.?total"]),
    ("expense_amount", [r"expense", r"cost", r"spend"]),
    ("category", [r"category", r"type", r"segment", r"department"]),
    ("notes", [r"note", r"comment", r"remark"]),
]

# A pattern match on the name alone is only "confident" -- we still don't
# fully trust it without the data-level verification step in verifier.py.
# This just decides whether we need to ASK THE AI at all.


def heuristic_classify(column_name: str):
    """Returns a role string if the column name confidently matches a known
    pattern, or None if it's ambiguous and should be sent to the AI."""
    normalized = column_name.strip().lower().replace(" ", "_")
    for role, patterns in PATTERNS:
        for pattern in patterns:
            if re.search(pattern, normalized):
                return role
    return None


def split_columns(columns: list[str]) -> tuple[dict, list[str]]:
    """
    Splits columns into (heuristic_matches, needs_ai).
    heuristic_matches: {column_name: {"role": ..., "confidence": "high", "source": "heuristic"}}
    needs_ai: list of column names that didn't confidently match anything.
    """
    heuristic_matches = {}
    needs_ai = []
    for col in columns:
        role = heuristic_classify(col)
        if role:
            heuristic_matches[col] = {"role": role, "confidence": "high", "source": "heuristic"}
        else:
            needs_ai.append(col)
    return heuristic_matches, needs_ai
