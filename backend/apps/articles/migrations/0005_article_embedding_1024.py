"""
Migration: alter article embedding column from vector(384) to vector(1024).

TASK-005-B2 — Upgrade embeddings to BAAI/bge-large-en-v1.5
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0004_article_embedding_ivfflat_index"),
    ]

    operations = [
        # Drop old IVFFlat index before altering column type
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS articles_article_embedding_ivfflat_idx;",
            reverse_sql="",
        ),
        # Alter column dimension from 384 to 1024
        migrations.RunSQL(
            sql="""
                ALTER TABLE articles_article
                ALTER COLUMN embedding TYPE vector(1024)
                USING embedding::text::vector(1024);
            """,
            reverse_sql="""
                ALTER TABLE articles_article
                ALTER COLUMN embedding TYPE vector(384)
                USING embedding::text::vector(384);
            """,
        ),
        # Recreate IVFFlat index for 1024-dim vectors
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_article_embedding_ivfflat_idx
                ON articles_article
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS articles_article_embedding_ivfflat_idx;",
        ),
    ]
