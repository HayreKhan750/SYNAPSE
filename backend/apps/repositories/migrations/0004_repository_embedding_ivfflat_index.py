# Generated migration — Phase 2.3 Vector Search
# Creates IVFFlat index on Repository.embedding for fast cosine similarity search.

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("repositories", "0003_repository_embedding"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS
                    repositories_embedding_ivfflat_idx
                ON repositories
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS repositories_embedding_ivfflat_idx;",
        ),
    ]
