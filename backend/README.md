# Backend

"Upload any messy spreadsheet. Get a dashboard."

## Architecture (v2 — generalized)

The pipeline no longer asks business-specific questions like "is this a
sales_amount column?" It asks universal statistical questions instead:

1. **`type_inference.py`** — determines each column's type directly from
   the data: does it parse as a date? Is it numeric (and if so, a measure
   you'd sum, or an identifier you'd never aggregate)? Is it a low-cardinality
   category, free text, or a boolean flag? This is 100% deterministic —
   no AI involved, and it works identically on sales data, student grades,
   HR records, or anything else with rows and columns.
2. **`semantic_labeler.py`** — AI (Claude Haiku) generates nicer display
   labels for messy column names ("amt_usd" → "Revenue (USD)"). This is
   now **purely cosmetic**. If the API call fails or the key is missing,
   the dashboard still works fine with plain title-cased column names as
   labels — nothing depends on this succeeding.
3. **`chart_engine.py`** — builds charts from the statistical types:
   a numeric measure → a summary card; a date + a numeric measure → a
   trend line; a category + a numeric measure → a comparison bar chart;
   a category with no numeric measure → a frequency count chart.

## Why this replaced v1

The original version (see `legacy_v1_sales_specific/`) asked the AI to
guess a business-specific role for each column (sales_amount, customer_name,
etc), then verified that guess against the data. That worked well for sales
spreadsheets, but testing it against a genuinely unrelated file (student
grades — no sales data at all) produced **zero usable output**, because
the whole KPI engine was hardcoded around sales-shaped concepts.

The v2 rebuild fixes this at the root: type inference no longer depends on
business semantics at all, so the same code produces sensible charts on
literally any tabular spreadsheet. Verified on both files:

| File | v1 result | v2 result |
|---|---|---|
| Sales export | 3 KPIs (revenue, trend, top products) | Same charts, generated generically |
| Student grades (no sales data) | **0 charts — total product failure** | 4 charts (score summary, trend, by-student, by-subject) |

A real bug was also caught and fixed during this rebuild: pandas silently
misinterprets integer-dtype columns as nanosecond timestamps when you run
`pd.to_datetime` on them without checking numeric-ness first — this caused
`Qty`, `Price`, and `Total` to initially get misclassified as dates. Fixed
by checking numeric-ness before date-ness. Caught by testing against real
data before shipping, not after.

## Files

- `type_inference.py` — statistical column typing (the new foundation)
- `semantic_labeler.py` — cosmetic AI labeling, graceful fallback built in
- `chart_engine.py` — generic chart generation from statistical types
- `app.py` — Flask API tying it together
- `events_logger.py` — usage logging (Supabase in production, local file in dev)
- `legacy_v1_sales_specific/` — the original business-role-based approach, kept for reference

## Setup

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key-here"   # optional now -- only used for label prettifying
python app.py
```

Test it:
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "file=@../sample_data/ugly_sales_export.csv"

curl -X POST http://localhost:5000/api/analyze \
  -F "file=@../sample_data/totally_unrelated_grades.csv"
```
Both should return real charts now.
