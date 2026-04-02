"""
Migration: add embedding column (vector 1024) to tweets table.

TASK-005-B2 — Upgrade embeddings to BAAI/bge-large-en-v1.5
"""
from django.db import migrations
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("tweets", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS vector;",
            reverse_sql="",
        ),
        migrations.AddField(
            model_name="tweet",
            name="embedding",
            field=pgvector.django.VectorField(dimensions=1024, null=True, blank=True),
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS tweets_tweet_embedding_ivfflat_idx
                ON tweets_tweet
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS tweets_tweet_embedding_ivfflat_idx;",
        ),
    ]
