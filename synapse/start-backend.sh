#!/bin/bash

export DJANGO_SETTINGS_MODULE=config.settings.replit
export PYTHONPATH=/home/runner/workspace/synapse/backend:/home/runner/workspace/synapse
export DB_NAME=heliumdb
export DB_USER=postgres
export DB_PASSWORD=password
export DB_HOST=helium
export DB_PORT=5432

# Robustly free port 8000 — kill all processes, then wait until the port is actually free
echo "Freeing port 8000..."
fuser -k 8000/tcp 2>/dev/null || true
for i in $(seq 1 10); do
  fuser 8000/tcp 2>/dev/null || break
  sleep 1
done

cd /home/runner/workspace/synapse/backend

echo "Installing required Python packages..."
pip install langchain-openai==0.2.14 --quiet 2>/dev/null || true

echo "Running database migrations..."
python manage.py migrate --noinput 2>&1 | tail -5 || true

echo "Collecting static files..."
python manage.py collectstatic --noinput -v 0 2>&1 | tail -3 || true

echo "Starting Django backend on port 8000..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
