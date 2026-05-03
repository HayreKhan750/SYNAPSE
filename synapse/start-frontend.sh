#!/bin/bash

export PORT=22167
# NEXT_PUBLIC_API_URL must be empty so the browser uses relative URLs (/api/v1/*)
# that route through the Replit proxy → Next.js → Django.
# Do NOT set this to http://localhost:8000 — the browser can't reach the server's port.
export NEXT_PUBLIC_API_URL=
export NEXT_PUBLIC_WS_URL=
export NEXT_PUBLIC_APP_URL=
export NEXT_PUBLIC_APP_NAME=SYNAPSE

# Robustly free the port — kill all processes, then wait until the port is actually free
echo "Freeing port $PORT..."
fuser -k ${PORT}/tcp 2>/dev/null || true
for i in $(seq 1 10); do
  fuser ${PORT}/tcp 2>/dev/null || break
  sleep 1
done

cd /home/runner/workspace/synapse/frontend

NEXT_BIN="node /home/runner/workspace/synapse/frontend/node_modules/next/dist/bin/next"

# ── Production build with smart caching ────────────────────────────────────────
# Compute a hash of all TypeScript/CSS source files so we only rebuild when
# something actually changed. Falls back to dev mode if the build fails.
HASH=$(find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.json" \) 2>/dev/null \
  | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
HASH_FILE=".build-hash"
PREV_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
BUILD_ID_FILE=".next/BUILD_ID"

if [ "$HASH" != "$PREV_HASH" ] || [ ! -f "$BUILD_ID_FILE" ]; then
  echo "Building SYNAPSE for production (source changed or first run)..."
  export NODE_ENV=production
  if $NEXT_BIN build 2>&1; then
    echo "$HASH" > "$HASH_FILE"
    echo "✓ Production build complete."
  else
    echo "⚠ Build failed — starting in development mode (slower navigation)."
    export NODE_ENV=development
    exec $NEXT_BIN dev --port $PORT --hostname 0.0.0.0
  fi
else
  echo "✓ Source unchanged — reusing cached production build."
fi

echo "Starting SYNAPSE on port $PORT (production mode)..."
export NODE_ENV=production
exec $NEXT_BIN start --port $PORT --hostname 0.0.0.0
