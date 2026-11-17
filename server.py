import http.server
import json
import os
import re
import urllib.parse

from odd_one import build_round
from puzzles import load_puzzle

ROOT = os.path.dirname(os.path.abspath(__file__))
PUZZLE_RE = re.compile(r"^/puzzle/(\d{4}-\d{2}-\d{2})(?:\.json)?$")
ODD_ONE_RE = re.compile(r"^/api/odd-one/?$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if ODD_ONE_RE.match(parsed.path):
            self._serve_odd_one(parsed)
            return

        match = PUZZLE_RE.match(parsed.path)
        if match:
            self._serve_puzzle(match.group(1))
            return

        super().do_GET()

    def _send_json(self, payload, status=200, cache="no-store"):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def _serve_puzzle(self, date):
        data = load_puzzle(date)
        if data is None:
            self._send_json({"error": "Puzzle not available for " + date}, status=404)
            return
        self._send_json(data, cache="no-cache")

    def _serve_odd_one(self, parsed):
        params = urllib.parse.parse_qs(parsed.query)
        exclude = params.get("exclude", [None])[0]
        payload = build_round(exclude=exclude)
        if payload is None:
            self._send_json({"error": "No Connections puzzle available"}, status=503)
            return
        self._send_json(payload)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5180"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("serving on", port)
    server.serve_forever()
