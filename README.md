# Insight Bridge — Upload any messy spreadsheet. Get a dashboard.

**Live: [insight-bridge-omega.vercel.app](https://insight-bridge-omega.vercel.app)**

Insight Bridge takes any spreadsheet — sales data, student grades,
inventory, job postings, hospital records, anything with rows and columns
— and turns it into a working dashboard automatically. No template, no
manual configuration, no picking chart types. It figures out what's
actually in the data directly from the data itself, builds relevant
charts, flags data quality issues, and lets you ask questions about it in
plain English.

## What it does

**Understands any spreadsheet from the data itself.** Rather than
guessing based on column names or a fixed business template, it
statistically determines what each column actually is — a date, a number
to total, a number to average, a category, an ID, or free text — and
builds the dashboard from that. The same logic works identically on a
sales report or a set of student grades.

**AI assists, code verifies.** AI is used to suggest clean column labels,
resolve ambiguous cases (should this be summed or averaged?), write a
short plain-English overview of the dataset, and translate natural-language
questions into structured queries. Every actual number shown on screen is
computed deterministically by code, never invented by the AI. If the AI
service is temporarily unavailable, the dashboard still works, just with
plainer labels.

**Flags data quality issues automatically:**
- Missing values and exact duplicate rows
- Statistical outliers in numeric columns
- Near-duplicate entities — the same real-world record (like the same
  product) appearing more than once with slightly different data, which
  ordinary duplicate-row checks don't catch

**Lets you correct it when it gets something wrong.** If a column is
misclassified, the interface lets you fix it directly, and that correction
is respected as final — it's never silently overridden by the automatic
system afterward.

**Answers questions in plain English.** Ask something like "which product
has the highest sales" or "average score for students who study more than
5 hours" and get a real, computed answer grounded in your actual data.

**Other features:**
- Click a bar to filter the whole dashboard; pick a date range
- Build your own histogram, scatter plot, or pie chart from any columns
- Multi-sheet Excel support, with a picker if a workbook has more than one
- Handles messy real-world formatting: currency symbols, `1.2K`/`3.4M`
  style shorthand, inconsistent date formats, spreadsheets with title rows
  above the real header
- Export the dashboard as a PDF
- Real usage tracking via a hosted Postgres database

## Tech stack

**Backend:** Python, Flask, pandas, the Claude API
**Frontend:** React (Vite), Tailwind CSS, Recharts
**Infrastructure:** Render (API), Vercel (frontend), Supabase (usage data)

## Structure
backend/
app.py Flask API: upload -> parse -> analyze -> respond
type_inference.py Statistical column typing
chart_engine.py Builds charts from the verified column types
data_quality.py Missing values, duplicates, outliers, near-duplicate entities
qa_engine.py Natural-language question parsing
semantic_labeler.py AI-assisted labeling and aggregation review
summary_writer.py AI phrasing of computed chart insights
events_logger.py Usage tracking

frontend/
src/components/ Dashboard, correction UI, question box, and more
src/lib/chartCompute.js Client-side filtering and query execution

# DEPLOYMENT.md Deployment walkthrough (Render + Vercel + Supabase)
## Local development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key-here"  # optional -- graceful fallback without it
python app.py
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5173` and try uploading a sample file from
`sample_data/`.

## Limitations

- **Single file at a time.** There's no support yet for relating multiple
  sheets or files together (for example, joining a sales table to a
  separate customer table by ID).
- **File size caps.** Uploads are capped at 20,000 rows and 500 columns to
  keep processing fast and AI costs predictable; larger files are
  rejected rather than partially processed.
- **The question-answering feature handles single-step lookups and
  aggregations well** (sums, averages, counts, filters, "which record has
  the highest X") but isn't designed for multi-step or highly ambiguous
  reasoning — it will ask for clarification rather than guess.
- **No accounts or saved history.** Each upload is processed in memory and
  not stored, which is good for privacy but means there's no way to
  revisit a past analysis without re-uploading the file.
- **Outlier and duplicate detection are statistical heuristics**, not
  ground truth — they're a helpful signal for what to double check, not a
  certainty that something is actually wrong.
- **Built on free-tier infrastructure**, so there's a brief cold-start
  delay if the backend has been idle, and upload rate limits are in place
  to keep API costs predictable.

## What could be improved

- Detecting relationships across multiple uploaded sheets or files (real
  joins, not just independent analysis of each one)
- User accounts to save and revisit past dashboards
- Support for additional data sources (Google Sheets, JSON, Parquet)
- A more granular column-type system (for example, distinguishing a
  time-only value from a full date, or currency from a generic number)
- Stronger file-upload security for a fully public, high-traffic deployment
  (content scanning, sandboxed processing per upload)
- Expanded automated test coverage for the natural-language question
  feature specifically, since it's the part of the system with the least
  predictable input space

## Testing

```bash
cd backend && python run_test_suite.py
cd frontend/src/lib && node chartCompute.test.js
```

## Deployment

See `DEPLOYMENT.md` for the full walkthrough.

## License

MIT — see `LICENSE`.
