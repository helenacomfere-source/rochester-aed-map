#!/usr/bin/env python3
"""
Development server for the AED map.

Same idea as `python3 -m http.server`, with one addition: it tells the browser
never to cache anything. Without that, editing a .css or .js file and refreshing
often shows the OLD version, because the browser reuses the copy it already has.
That wastes a lot of time and looks like your change "didn't work."

Usage:
    python3 tools/serve.py           # http://localhost:8000
    python3 tools/serve.py 8080      # pick a different port

Stop it with Ctrl+C.

This is for local development only. Do not use it to host a real site.
"""

import http.server
import os
import socketserver
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Ask the browser to re-fetch every file, every time.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter than the default: skip the successful-request noise.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(PROJECT_ROOT)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), NoCacheHandler) as httpd:
            print(f"AED map running at  http://localhost:{port}")
            print("Caching is off, so a normal refresh always shows your latest edits.")
            print("Press Ctrl+C to stop.\n")
            httpd.serve_forever()
    except OSError as err:
        raise SystemExit(
            f"Could not start on port {port}: {err}\n"
            f"Something may already be using it. Try: python3 tools/serve.py {port + 1}"
        )
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
