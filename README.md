# Insight Bridge — Upload any messy spreadsheet. Get a dashboard.

Sales, student grades, inventory, attendance — whatever tabular data you've
got. This reads it, figures out what's actually in it directly from the
data itself (not from guessing what your business is), and builds a
dashboard from what it finds.

## Why this works on ANY spreadsheet

Earlier versions of this asked "is this column a sales_amount?" — a
business-specific question that only made sense for sales data. Testing it
against a totally unrelated file (student grades, no sales data at all)
produced zero usable output — a real, honest limitation found through
testing, not guessing.

The current version asks universal statistical questions instead: does
this column parse as a date? Is it numeric? Is it a low-cardinality
category? Those questions work identically no matter what the spreadsheet
is about — see `backend/README.md` for the full before/after comparison,
including a real pandas bug that was caught and fixed along the way.

AI is now a purely cosmetic layer (nicer column labels only) — the core
product works even if the AI API is completely unavailable.

## Structure

```
backend/    Flask API: read spreadsheet -> infer types -> build charts
frontend/   React (Vite) app: upload UI + dashboard
DEPLOYMENT.md   Step-by-step guide to actually go live (Render + Vercel + Supabase)
```

## Interactive exploration (Phase 1 of the interactivity roadmap)

Beyond the auto-generated dashboard, every upload also sends a capped
sample of raw rows (up to 3,000) for the columns worth charting. This
powers an "Explore your data" section where you pick your own columns:

- **Distribution** — histogram of any numeric column
- **Relationship** — scatter plot between any two numeric columns
- **Proportions** — pie chart of any categorical column

**Roadmap for what's next:**
- Phase 2: date-range filtering on top of this
- Phase 3: click-to-filter drill-down across the whole dashboard

## Local development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key-here"  # optional -- only affects label prettifying
python app.py
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```
Visit http://localhost:5173, try uploading both sample files in
`sample_data/` — the sales export AND the totally unrelated grades file —
to see the same pipeline handle both correctly.

## Going live

See `DEPLOYMENT.md` for the full walkthrough (Render for the backend,
Vercel for the frontend, Supabase for tracking real usage).

## Instrumentation

Every upload logs an event (succeeded, failed, chart count, elapsed time)
either to a local file (dev) or to a real hosted Postgres table via
Supabase (production) — this is the real usage data behind the "shipped
and got real users" story.

