#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import process_week

class DynastyHubHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        self.repo = Path(directory or process_week.root())
        super().__init__(*args, directory=str(self.repo), **kwargs)

    def _send_json(self, payload, status=200):
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/dynasty/source-truth":
            path = self.repo / "data" / "generated" / "dynasty" / "source_truth_summary.json"
            self._send_json(process_week.read_json(path, {"status": "missing", "message": "Run python process_week.py --extract dynasty_save first."}))
            return
        if parsed.path == "/api/dynasty/current-team":
            path = self.repo / "data" / "generated" / "dynasty" / "current_team.json"
            self._send_json(process_week.read_json(path, {"status": "missing", "message": "Run python process_week.py --extract dynasty_save first."}))
            return
        if parsed.path == "/api/dynasty/health":
            self._send_json({"status": "ok", "runtime": "local_dynasty_hub", "repo": str(self.repo)})
            return
        super().do_GET()

def main(argv=None):
    parser = argparse.ArgumentParser(description="Serve the local Dynasty Hub and generated save-file JSON.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--refresh", action="store_true", help="Run the dynasty save reader before serving.")
    parser.add_argument("--dynasty-save", help="Optional path to the CFB27 dynasty save file.")
    args = parser.parse_args(argv)
    if args.refresh:
        code = process_week.run_dynasty_save_reader(args)
        if code != 0:
            return code
    repo = process_week.root()
    def handler(*handler_args, **handler_kwargs):
        return DynastyHubHandler(*handler_args, directory=repo, **handler_kwargs)
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Dynasty Hub local server: http://{args.host}:{args.port}")
    print("API: /api/dynasty/source-truth /api/dynasty/current-team /api/dynasty/health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Dynasty Hub local server.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
