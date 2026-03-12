import os
import sys

# Ensure both backend/ and the repo root (for ai_engine) are on the path
_backend_dir = os.path.dirname(__file__)
_repo_root = os.path.dirname(_backend_dir)
sys.path.insert(0, _backend_dir)
sys.path.insert(0, _repo_root)

# Must be set BEFORE Django imports anything
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.test"

# Docker maps synapse_postgres:5432 -> host:5433
# Override unconditionally so test settings pick these up
os.environ["DB_HOST"] = "localhost"
os.environ["DB_PORT"] = "5433"

