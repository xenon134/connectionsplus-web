import json
import os
import tempfile
import threading
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
PUZZLE_DIR = os.path.join(ROOT, "puzzle")
NYT_BASE = "https://www.nytimes.com/svc/connections/v2/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
LAUNCH_DATE = date(2023, 6, 12)

_lock = threading.Lock()


def _valid(data):
    if not isinstance(data, dict):
        return False
    categories = data.get("categories")
    return isinstance(categories, list) and bool(categories)


def load_puzzle(date_str):
    """Return a Connections puzzle for a date, reading the local cache first.

    Fetches from the NYT JSON endpoint and caches the response on disk when the
    date is not cached yet. Returns None if the puzzle cannot be loaded.
    """
    path = os.path.join(PUZZLE_DIR, date_str + ".json")

    with _lock:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if _valid(data):
                    return data
            except Exception:
                pass

        try:
            req = urllib.request.Request(
                NYT_BASE + date_str + ".json",
                headers={"User-Agent": UA},
            )
            with urllib.request.urlopen(req, timeout=15) as res:
                body = res.read()
            data = json.loads(body)
            if not _valid(data):
                return None

            os.makedirs(PUZZLE_DIR, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=PUZZLE_DIR, prefix=".tmp-", suffix=".json")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(body)
                os.replace(tmp, path)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            return data
        except Exception:
            return None
