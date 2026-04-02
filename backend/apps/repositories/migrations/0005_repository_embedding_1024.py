"""
Migration: alter repository embedding column from vector(384) to vector(1024).

TASK-005-B2 — Upgrade embeddings to BAAI/bge-large-en-v1.5
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("repositories", "0004_repository_embedding_ivfflat_index"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS repositories_repository_embedding_ivfflat_idx;",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE repositories_repository
                ALTER COLUMN embedding TYPE vector(1024)
                USING embedding::text::vector(1024);
            """,
            reverse_sql="""
                ALTER TABLE repositories_repository
                ALTER COLUMN embedding TYPE vector(384)
                USING embedding::text::vector(384);
            """,
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS repositories_repository_embedding_ivfflat_idx
                ON repositories_repository
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS repositories_repository_embedding_ivfflat_idx;",
        ),
    ]
