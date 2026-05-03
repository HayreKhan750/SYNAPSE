#!/bin/bash

export PORT=22167
export NODE_ENV=development
# NEXT_PUBLIC_API_URL must be empty so the browser uses relative URLs (/api/v1/*)
# that route through the Replit proxy → Next.js → Django.
# Do NOT set this to http://localhost:8000 — the browser can't reach the server's port.
export NEXT_PUBLIC_API_URL=
export NEXT_PUBLIC_WS_URL=
export NEXT_PUBLIC_APP_URL=
export NEXT_PUBLIC_APP_NAME=SYNAPSE

echo "Freeing port $PORT..."
fuser -k ${PORT}/tcp 2>/dev/null || true
sleep 1

cd /home/runner/workspace/synapse/frontend

echo "Starting SYNAPSE Next.js frontend on port $PORT..."
exec node /home/runner/workspace/synapse/frontend/node_modules/next/dist/bin/next dev --port $PORT --hostname 0.0.0.0
