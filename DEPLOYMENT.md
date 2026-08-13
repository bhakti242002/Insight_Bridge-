# Deployment Guide — Going Live

This gets your app from "runs on my laptop" to a real URL real people can use.

Stack: **Render** (backend API) + **Vercel** (frontend) + **Supabase** (usage database) — all have free tiers sufficient for an early-stage project like this.

## 1. Set up Supabase (usage database) — do this first

1. Go to supabase.com, create a free account and a new project
2. In the SQL Editor, run:
   ```sql
   create table events (
     id uuid default gen_random_uuid() primary key,
     ts timestamptz default now(),
     event_type text not null,
     upload_id text,
     filename text,
     n_rows int,
     n_cols int,
     n_sheets int,
     n_charts int,
     chart_types text[],
     overridden_columns text[],
     elapsed_ms numeric,
     reason text,
     detail text
   );
   ```
   This matches every field the backend actually logs as of this version. If you
   add a new `log_event(..., some_new_field=...)` call later, add a matching
   column here too — a mismatched field doesn't error, it just silently falls
   back to a local file that gets wiped on every redeploy, so you'd quietly
   lose that data without any error to warn you.
3. Go to Settings -> API, copy your **Project URL** and **service_role key** (or anon key) — you'll need these for the backend's environment variables.

## 2. Deploy the backend (Render)

1. Push this whole project to a GitHub repo (backend + frontend folders together is fine)
2. Go to render.com -> New -> Web Service -> connect your repo
3. Settings:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `gunicorn app:app`
4. Add environment variables (Render dashboard -> Environment):
   - `ANTHROPIC_API_KEY` = your real key
   - `SUPABASE_URL` = from step 1
   - `SUPABASE_KEY` = from step 1
   - `FRONTEND_ORIGIN` = your Vercel URL (you'll get this in step 3 — come back and set this after)
   - `UPLOAD_RATE_LIMIT` = `10 per hour` (adjust as you like)
   - `STATS_SECRET` = any random string you make up (e.g. a long password). This
     protects your `/api/stats` usage-dashboard endpoint — without setting this,
     anyone with your backend URL could hit `/api/stats` with no password at all.
5. Deploy. Render gives you a URL like `https://your-app.onrender.com` — save it, the frontend needs it.

**Cost control note:** the free Render tier spins down when idle and takes ~30-60 seconds to wake up on the first request after inactivity — normal for a free tier, just know that's not a bug if your first demo request is slow.

## 3. Deploy the frontend (Vercel)

1. Go to vercel.com -> New Project -> import the same repo
2. Settings:
   - **Root directory**: `frontend`
   - **Framework preset**: Vite
3. Add environment variable:
   - `VITE_API_BASE` = your Render URL from step 2 (e.g. `https://your-app.onrender.com`)
4. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`

## 4. Close the loop on CORS

Go back to Render -> your backend's environment variables -> set `FRONTEND_ORIGIN` to your actual Vercel URL from step 3, and redeploy the backend. Without this, your production frontend will get CORS errors calling your production backend.

## 5. Test it end to end

Visit your Vercel URL, upload the sample CSV, confirm it works exactly like it did locally.

## 6. Before you actually share this with real people

- **Set a real Anthropic API budget alert** in console.anthropic.com -> Plans & Billing, so a traffic spike doesn't surprise you with a bill
- **Double check `UPLOAD_RATE_LIMIT`** is set to something sane for your budget (10/hour per IP is a reasonable starting point)
- **Add a privacy line** to your landing page if you haven't (already in the frontend copy: "your file is read in memory and never saved to disk") — this is true as long as you don't add file-persistence later, so keep it true
- **Decide what "real people" means for v1** — a soft launch to classmates/a subreddit/a small business owner you know is plenty for your first round of real usage data; you don't need viral traffic to have a legitimate "I shipped this and got real users" story

## What you'll be able to say after this

"I built and deployed a full-stack web app — Python/Flask backend, React frontend, Postgres for usage tracking — that's live at a real URL, used by real people, with real usage data I can analyze." That's a materially different (and stronger) claim than "I built a project," and it's exactly the gap this was meant to fill for Product Analyst roles.
