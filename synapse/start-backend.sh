#!/bin/bash

export DJANGO_SETTINGS_MODULE=config.settings.replit
export PYTHONPATH=/home/runner/workspace/synapse/backend
export DB_NAME=heliumdb
export DB_USER=postgres
export DB_PASSWORD=password
export DB_HOST=helium
export DB_PORT=5432

cd /home/runner/workspace/synapse/backend

echo "Running database migrations..."
python manage.py migrate --noinput 2>&1 | tail -5 || true

echo "Collecting static files..."
python manage.py collectstatic --noinput -v 0 2>&1 | tail -3 || true

echo "Starting Django backend on port 8000..."
exec python manage.py runserver 0.0.0.0:8000
