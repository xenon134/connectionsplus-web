import http.server
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PUZZLE_DIR = os.path.join(ROOT, "puzzle")
NYT_BASE = "https://www.nytimes.com/svc/connections/v2/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
PUZZLE_RE = re.compile(r"^/puzzle/(\d{4}-\d{2}-\d{2})(?:\.json)?$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        m = PUZZLE_RE.match(self.path.split("?")[0])
        if m:
            self._serve_puzzle(m.group(1))
            return
        super().do_GET()

    def _serve_puzzle(self, date):
        disk = os.path.join(PUZZLE_DIR, date + ".json")
        if not os.path.exists(disk):
            try:
                req = urllib.request.Request(NYT_BASE + date + ".json", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=25) as res:
                    body = res.read()
                data = json.loads(body)
                if not isinstance(data.get("categories"), list) or not data.get("categories"):
                    raise ValueError("bad puzzle payload")
                os.makedirs(PUZZLE_DIR, exist_ok=True)
                with open(disk, "wb") as f:
                    f.write(body)
            except Exception:
                self.send_error(404, "Puzzle not available for " + date)
                return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(os.path.getsize(disk)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        with open(disk, "rb") as f:
            self.wfile.write(f.read())


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5180"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("serving on", port)
    server.serve_forever()