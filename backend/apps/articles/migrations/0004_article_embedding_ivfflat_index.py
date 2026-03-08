# Generated migration — Phase 2.3 Vector Search
# Creates IVFFlat index on Article.embedding for fast cosine similarity search.

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("articles", "0004_article_embedding"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS
                    articles_embedding_ivfflat_idx
                ON articles
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS articles_embedding_ivfflat_idx;",
        ),
    ]
