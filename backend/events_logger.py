"""
events_logger.py

Logs usage events to a real hosted Postgres database (Supabase) so you
have actual usage data once this is live for real users -- not just a
local file that disappears when your laptop is off.

Falls back to a local events.jsonl file if Supabase env vars aren't set,
so local development still works without needing Supabase set up first.

Setup (once you're ready to deploy):
  1. Create a free project at supabase.com
  2. In the SQL Editor, run:

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

     -- This matches every field actually passed to log_event() across the
     -- codebase as of this version. If you add a new log_event(..., some_new_field=...)
     -- call later, add a matching column here too -- Supabase's insert will
     -- silently fail (falling back to the local file) for any field that
     -- doesn't have a matching column, not error loudly.

  3. Get your Project URL and anon/service key from Settings -> API
  4. Set env vars:
       SUPABASE_URL=https://xxxx.supabase.co
       SUPABASE_KEY=your-service-role-or-anon-key
"""

import os
import json
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

_supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"WARNING: could not init Supabase client, falling back to local log. Error: {e}")
        _supabase_client = None

LOCAL_LOG_PATH = "events.jsonl"


def log_event(event_type: str, **fields):
    """
    Logging should NEVER be able to crash the request that triggered it --
    a failed analytics write is not worth breaking someone's actual upload
    over. This function is called in several places BEFORE the main
    processing pipeline's own safety net even starts, so it needs to be
    unconditionally safe on its own, not rely on a caller to wrap it.
    """
    record = {"event_type": event_type, **fields}

    if _supabase_client is not None:
        try:
            _supabase_client.table("events").insert(record).execute()
            return
        except Exception as e:
            print(f"WARNING: Supabase log failed, falling back to local file. Error: {e}")

    # Local fallback (dev mode, or if the Supabase call failed above)
    try:
        record["ts"] = time.time()
        with open(LOCAL_LOG_PATH, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as e:
        print(f"WARNING: local event log write failed too. Event dropped. Error: {e}")


def get_stats() -> dict:
    """
    Returns aggregate usage stats: total successful uploads, uploads per
    day (for the last 30 days), and unique days with at least one upload.
    Reads from Supabase if configured, otherwise from the local fallback
    file -- same source log_event writes to, so this always reflects
    whatever's actually been recorded.
    """
    import datetime
    from collections import defaultdict

    records = []

    if _supabase_client is not None:
        try:
            resp = _supabase_client.table("events").select("event_type, ts").eq(
                "event_type", "upload_succeeded"
            ).execute()
            records = resp.data or []
        except Exception as e:
            return {"error": f"Could not read stats from Supabase: {e}", "source": "supabase"}
    else:
        if not os.path.exists(LOCAL_LOG_PATH):
            return {"total_uploads": 0, "uploads_by_day": {}, "unique_days_active": 0, "source": "local"}
        with open(LOCAL_LOG_PATH) as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    if rec.get("event_type") == "upload_succeeded":
                        records.append(rec)
                except json.JSONDecodeError:
                    continue

    by_day = defaultdict(int)
    for rec in records:
        ts = rec.get("ts")
        if ts is None:
            continue
        if isinstance(ts, str):
            day = ts[:10]  # Supabase timestamps come back as ISO strings
        else:
            day = datetime.datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d")
        by_day[day] += 1

    sorted_days = dict(sorted(by_day.items()))

    return {
        "total_uploads": len(records),
        "uploads_by_day": sorted_days,
        "unique_days_active": len(sorted_days),
        "source": "supabase" if _supabase_client is not None else "local",
    }
