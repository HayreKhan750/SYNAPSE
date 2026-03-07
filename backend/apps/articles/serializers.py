from rest_framework import serializers
from .models import Article, Source


class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Source
        fields = ['id', 'name', 'url', 'source_type', 'is_active', 'last_scraped_at']


class ArticleListSerializer(serializers.ModelSerializer):
    source = SourceSerializer(read_only=True)
    class Meta:
        model  = Article
        fields = ['id', 'title', 'summary', 'url', 'source', 'author',
                  'published_at', 'topic', 'tags', 'keywords',
                  'trending_score', 'view_count', 'scraped_at']


class ArticleDetailSerializer(serializers.ModelSerializer):
    source = SourceSerializer(read_only=True)
    class Meta:
        model  = Article
        fields = '__all__'
