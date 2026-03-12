from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*', 'localhost', 'testserver', '127.0.0.1']

# Hardcode local test DB — Docker maps synapse_postgres:5432 -> host:5433
# This overrides the .env file values (which point to the Docker internal hostname)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'synapse_db',
        'USER': 'synapse_user',
        'PASSWORD': 'synapse_pass',
        'HOST': 'localhost',
        'PORT': '5433',
        'TEST': {
            'NAME': 'synapse_test',
        },
    }
}
# Use fast password hasher in tests
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
# Disable axes in tests
AXES_ENABLED = False
# Use dummy cache in tests
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
# Celery in eager mode for tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
