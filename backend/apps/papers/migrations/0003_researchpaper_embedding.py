# Generated migration — Phase 2.3 Vector Search
# Adds pgvector embedding column to ResearchPaper model.

from django.db import migrations
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("papers", "0002_enable_pgvector_extension"),
    ]

    operations = [
        migrations.AddField(
            model_name="researchpaper",
            name="embedding",
            field=pgvector.django.VectorField(blank=True, dimensions=384, null=True),
        ),
    ]
