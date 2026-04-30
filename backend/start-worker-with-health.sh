#!/bin/sh
# ----------------------------------------------------------------------------
# start-worker-with-health.sh
#
# Runs the Celery worker on this container AND a tiny HTTP health endpoint
# bound to $PORT. The health endpoint exists ONLY so the host platform
# (Render's free Web Service tier) sees a listening port and treats this
# service as "live". Real work happens in Celery, not over HTTP.
#
# Usage:
#   - The Dockerfile already runs `chmod +x` on this script.
#   - Set the host's start command to: /app/start-worker-with-health.sh
#   - The host injects $PORT (Render uses 10000 by default).
#
# Memory budget on free tier: ~256 MB usable for the worker process. Keep
# CELERY_CONCURRENCY=1 and CELERY_MAX_TASKS_PER_CHILD=20 in the env.
# ----------------------------------------------------------------------------

set -e

PORT="${PORT:-10000}"
echo "[start-worker-with-health] starting health server on 0.0.0.0:${PORT}"

# Tiny stdlib-only HTTP server. No filesystem exposure (custom handler), no
# extra dependencies. Responds 200 'ok' to any GET, ignores everything else.
python - <<'PY' &
import http.server, socketserver, os, sys

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()
    def log_message(self, fmt, *args):
        # Silence default access logs to keep Celery output readable.
        pass

port = int(os.environ.get("PORT", "10000"))
with socketserver.TCPServer(("0.0.0.0", port), H) as s:
    s.allow_reuse_address = True
    sys.stderr.write(f"[health] listening on 0.0.0.0:{port}\n")
    s.serve_forever()
PY

HEALTH_PID=$!

# If the health server dies for any reason, kill the whole container so the
# host restarts it cleanly. Likewise kill the health server when celery exits.
trap 'kill -TERM "$HEALTH_PID" 2>/dev/null || true' EXIT INT TERM

echo "[start-worker-with-health] handing off to start-worker.sh (PID will replace shell)"
exec /app/start-worker.sh
