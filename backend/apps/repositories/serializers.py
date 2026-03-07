from rest_framework import serializers
from .models import Repository

class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Repository
        fields = ['id', 'github_id', 'name', 'full_name', 'description', 'url',
                  'stars', 'forks', 'watchers', 'language', 'topics', 'owner',
                  'is_trending', 'stars_today', 'readme_summary', 'scraped_at']
