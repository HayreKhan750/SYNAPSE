# Generated migration — Phase 2.3 Vector Search
# Enables the pgvector extension in PostgreSQL.
# Note: CREATE EXTENSION is idempotent — safe to run multiple times.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("papers", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS vector;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
