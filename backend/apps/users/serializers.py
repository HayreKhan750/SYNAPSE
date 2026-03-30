from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'password', 'password2', 'first_name', 'last_name']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    # SECURITY: expose a sanitised view of preferences — never include raw API keys
    preferences_safe = serializers.SerializerMethodField()

    def get_preferences_safe(self, obj):
        prefs = getattr(obj, 'preferences', {}) or {}
        # Strip sensitive keys — only expose non-secret preference flags
        return {k: v for k, v in prefs.items()
                if k not in ('gemini_api_key', 'openrouter_api_key',
                             'mfa_secret', 'mfa_backup_codes')}

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'role', 'avatar_url', 'bio', 'preferences_safe', 'created_at', 'last_login']
        read_only_fields = ['id', 'email', 'role', 'created_at', 'last_login']


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['preferences']
