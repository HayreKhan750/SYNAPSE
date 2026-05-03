#!/bin/bash

export PORT=22167
export NODE_ENV=development
export NEXT_PUBLIC_API_URL=http://localhost:8000
export NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
export NEXT_PUBLIC_APP_URL=http://localhost:22167
export NEXT_PUBLIC_APP_NAME=SYNAPSE

echo "Freeing port $PORT..."
fuser -k ${PORT}/tcp 2>/dev/null || true
sleep 1

cd /home/runner/workspace/synapse/frontend

echo "Starting SYNAPSE Next.js frontend on port $PORT..."
exec node /home/runner/workspace/synapse/frontend/node_modules/next/dist/bin/next dev --port $PORT --hostname 0.0.0.0
