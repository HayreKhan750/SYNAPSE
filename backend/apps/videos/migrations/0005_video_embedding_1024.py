"""
Migration: alter video embedding column from vector(384) to vector(1024).

TASK-005-B2 — Upgrade embeddings to BAAI/bge-large-en-v1.5
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("videos", "0004_video_embedding_ivfflat_index"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS videos_video_embedding_ivfflat_idx;",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE videos_video
                ALTER COLUMN embedding TYPE vector(1024)
                USING embedding::text::vector(1024);
            """,
            reverse_sql="""
                ALTER TABLE videos_video
                ALTER COLUMN embedding TYPE vector(384)
                USING embedding::text::vector(384);
            """,
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_video_embedding_ivfflat_idx
                ON videos_video
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS videos_video_embedding_ivfflat_idx;",
        ),
    ]
