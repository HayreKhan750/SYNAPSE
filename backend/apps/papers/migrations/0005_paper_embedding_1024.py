"""
Migration: alter research paper embedding column from vector(384) to vector(1024).

TASK-005-B2 — Upgrade embeddings to BAAI/bge-large-en-v1.5
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("papers", "0004_researchpaper_embedding_ivfflat_index"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS papers_researchpaper_embedding_ivfflat_idx;",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE papers_researchpaper
                ALTER COLUMN embedding TYPE vector(1024)
                USING embedding::text::vector(1024);
            """,
            reverse_sql="""
                ALTER TABLE papers_researchpaper
                ALTER COLUMN embedding TYPE vector(384)
                USING embedding::text::vector(384);
            """,
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS papers_researchpaper_embedding_ivfflat_idx
                ON papers_researchpaper
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS papers_researchpaper_embedding_ivfflat_idx;",
        ),
    ]
