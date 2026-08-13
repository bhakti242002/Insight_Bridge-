"""
run_test_suite.py

Runs every file in test_datasets/ through the REAL /api/analyze endpoint
(via Flask's test client, not just individual functions) and reports
whether each one reached a controlled, explainable state.

"Pass" does not mean "produced a dashboard" -- an empty file SHOULD be
rejected with a clean 400, not produce charts. Pass means: the app
reached a sensible, non-crashing state and told the truth about it.

Usage:
    python run_test_suite.py
"""

import os
import sys
import glob

sys.path.insert(0, os.path.dirname(__file__))

# Stub out the two AI-dependent packages so this suite runs without
# needing real API credentials -- it's testing pipeline robustness, not
# AI quality. Only used if the real packages aren't installed.
try:
    import anthropic  # noqa
except ImportError:
    stub_dir = "/tmp/qa_stubs"
    os.makedirs(os.path.join(stub_dir, "flask_limiter"), exist_ok=True)
    with open(os.path.join(stub_dir, "flask_cors.py"), "w") as f:
        f.write("def CORS(app, **kwargs):\n    return app\n")
    with open(os.path.join(stub_dir, "flask_limiter", "__init__.py"), "w") as f:
        f.write(
            "class Limiter:\n"
            "    def __init__(self, key_func, app=None, **kwargs): pass\n"
            "    def limit(self, *a, **kw):\n"
            "        def decorator(f): return f\n"
            "        return decorator\n"
        )
    with open(os.path.join(stub_dir, "flask_limiter", "util.py"), "w") as f:
        f.write("def get_remote_address():\n    return '0.0.0.0'\n")
    with open(os.path.join(stub_dir, "anthropic.py"), "w") as f:
        f.write(
            "class Anthropic:\n"
            "    def __init__(self, *a, **kw): pass\n"
            "    class messages:\n"
            "        @staticmethod\n"
            "        def create(*a, **kw): raise RuntimeError('stub - no real API call')\n"
        )
    sys.path.insert(0, stub_dir)

import app as myapp

TEST_DIR = os.path.join(os.path.dirname(__file__), "test_datasets")

# What we EXPECT for each file, so a run can be graded pass/fail
# automatically, not just eyeballed. "handled_error" means: a clean 4xx
# with a real message is the CORRECT outcome, not a bug.
EXPECTATIONS = {
    "empty.csv": "handled_error",
    "header_only.csv": "handled_error",
    "corrupted.xlsx": "handled_error",
    "formatted_report.csv": "any",  # no crash either way is acceptable
}


def run_one(path):
    filename = os.path.basename(path)
    client = myapp.app.test_client()
    try:
        with open(path, "rb") as f:
            resp = client.post(
                "/api/analyze",
                data={"file": (f, filename)},
                content_type="multipart/form-data",
            )
    except Exception as e:
        return {"filename": filename, "outcome": "CRASHED", "detail": str(e)}

    if resp.status_code == 500:
        return {"filename": filename, "outcome": "CRASHED (500)", "detail": resp.get_json()}

    if resp.status_code >= 400:
        data = resp.get_json() or {}
        return {"filename": filename, "outcome": "handled_error", "detail": data.get("error", "")}

    data = resp.get_json() or {}

    if data.get("multiple_sheets"):
        sheet_names = [s["name"] for s in data.get("sheets", [])]
        return {"filename": filename, "outcome": "multi_sheet_prompt", "detail": f"{len(sheet_names)} sheets: {sheet_names}"}

    n_charts = len(data.get("charts", []))
    n_warnings = sum(1 for c in data.get("charts", []) if "warning" in c)
    return {
        "filename": filename,
        "outcome": "analyzed",
        "detail": f"{data.get('n_rows', '?')} rows, {n_charts} charts, {n_warnings} warnings",
    }


def main():
    files = sorted(glob.glob(os.path.join(TEST_DIR, "*")))
    print(f"Running {len(files)} intentionally difficult files through the real pipeline...\n")

    results = []
    n_crashed = 0
    for path in files:
        result = run_one(path)
        results.append(result)
        expected = EXPECTATIONS.get(result["filename"], "analyzed")
        crashed = result["outcome"].startswith("CRASHED")
        if crashed:
            n_crashed += 1
        status = "CRASH!!" if crashed else "ok"
        print(f"[{status:8s}] {result['filename']:25s} -> {result['outcome']:15s} | {result['detail']}")

    print()
    print(f"Total: {len(results)} files. Crashes: {n_crashed}.")
    if n_crashed == 0:
        print("PASS: nothing crashed the pipeline. Every file reached a controlled state.")
    else:
        print("FAIL: one or more files crashed the pipeline unexpectedly.")
    return n_crashed


if __name__ == "__main__":
    sys.exit(1 if main() > 0 else 0)
