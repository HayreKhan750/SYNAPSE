# Generated migration — Phase 2.3 Vector Search
# Enables the pgvector extension in PostgreSQL (required before vector columns).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0002_article_nlp_processed"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS vector;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
