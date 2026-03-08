# Generated migration — Phase 2.3 Vector Search
# Creates IVFFlat index on ResearchPaper.embedding for fast cosine similarity search.

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("papers", "0003_researchpaper_embedding"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS
                    research_papers_embedding_ivfflat_idx
                ON research_papers
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="DROP INDEX IF EXISTS research_papers_embedding_ivfflat_idx;",
        ),
    ]
