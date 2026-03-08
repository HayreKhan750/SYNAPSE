from rest_framework import serializers
from .models import Article, Source


class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Source
        fields = ['id', 'name', 'url', 'source_type', 'is_active', 'last_scraped_at']


class ArticleListSerializer(serializers.ModelSerializer):
    """
    Serializer for article list views.
    Includes summary (BART-generated, Phase 2.2) and nlp_processed flag
    so the frontend can show AI badges and summary text on cards.
    """
    source = SourceSerializer(read_only=True)

    class Meta:
        model  = Article
        fields = [
            'id', 'title', 'summary', 'url', 'source', 'author',
            'published_at', 'topic', 'tags', 'keywords',
            'sentiment_score', 'trending_score', 'view_count',
            'scraped_at', 'nlp_processed',
        ]


class ArticleDetailSerializer(serializers.ModelSerializer):
    """
    Full article serializer for detail views.
    Exposes all fields including BART summary, NLP metadata and entities
    stored in the metadata JSON field.
    """
    source = SourceSerializer(read_only=True)

    # Convenience read-only fields surfaced from the metadata JSON blob
    entities     = serializers.SerializerMethodField()
    language     = serializers.SerializerMethodField()
    topic_confidence = serializers.SerializerMethodField()

    class Meta:
        model  = Article
        fields = '__all__'

    def get_entities(self, obj):
        return (obj.metadata or {}).get("entities", [])

    def get_language(self, obj):
        return (obj.metadata or {}).get("language", "")

    def get_topic_confidence(self, obj):
        return (obj.metadata or {}).get("topic_confidence", None)
