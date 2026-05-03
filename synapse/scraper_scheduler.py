#!/usr/bin/env python3
"""
SYNAPSE Background Scraper Scheduler
=====================================
Runs periodic scraping tasks without Redis or Celery Beat.
Designed for Replit environment where only one process group is available.

Schedule:
  - HackerNews:  every 30 minutes (no API key needed)
  - GitHub:      every 2 hours    (no API key needed; GITHUB_TOKEN improves rate limit)
  - arXiv:       every 6 hours    (no API key needed)

This script runs in the background from start-backend.sh.
"""

import os
import sys
import time
import logging
import subprocess

# Setup
BACKEND_DIR = "/home/runner/workspace/synapse/backend"
PYTHON = sys.executable

logging.basicConfig(
    level=logging.INFO,
    format="[scraper-scheduler] %(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def run_scraper(sources):
    """Run the management command for the given sources list."""
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.replit")
    env.setdefault("PYTHONPATH", f"{BACKEND_DIR}:/home/runner/workspace/synapse")

    cmd = [
        PYTHON, "manage.py", "run_scrapers",
        "--sources", *sources,
    ]
    log.info("Running: %s", " ".join(cmd[2:]))
    try:
        result = subprocess.run(
            cmd,
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute hard limit per scrape run
        )
        if result.stdout:
            log.info(result.stdout.strip())
        if result.returncode != 0 and result.stderr:
            log.warning("stderr: %s", result.stderr.strip()[:500])
    except subprocess.TimeoutExpired:
        log.warning("Scraper timed out after 5 minutes.")
    except Exception as e:
        log.error("Scraper error: %s", e)


def main():
    log.info("Scraper scheduler starting. Waiting 30s for Django to start up...")
    time.sleep(30)  # Give Daphne time to start first

    # Track last run times (epoch seconds)
    last_hn = 0
    last_github = 0
    last_arxiv = 0

    INTERVAL_HN = 30 * 60       # 30 minutes
    INTERVAL_GITHUB = 2 * 3600  # 2 hours
    INTERVAL_ARXIV = 6 * 3600   # 6 hours

    log.info("Starting scraper schedule loop.")

    while True:
        now = time.time()

        if now - last_hn >= INTERVAL_HN:
            log.info("Running HackerNews scraper...")
            run_scraper(["hn"])
            last_hn = time.time()

        if now - last_github >= INTERVAL_GITHUB:
            log.info("Running GitHub scraper...")
            run_scraper(["github"])
            last_github = time.time()

        if now - last_arxiv >= INTERVAL_ARXIV:
            log.info("Running arXiv scraper...")
            run_scraper(["arxiv"])
            last_arxiv = time.time()

        # Sleep 60 seconds between schedule checks
        time.sleep(60)


if __name__ == "__main__":
    main()
