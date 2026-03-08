# Generated migration — Phase 2.3 Vector Search
# Creates IVFFlat index on Video.embedding for fast cosine similarity search.

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("videos", "0003_video_embedding"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS
                    videos_embedding_ivfflat_idx
                ON videos
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS videos_embedding_ivfflat_idx;",
        ),
    ]
