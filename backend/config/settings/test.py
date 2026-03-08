from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*', 'localhost', 'testserver', '127.0.0.1']
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'synapse_test'),
        'USER': os.environ.get('DB_USER', 'synapse_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'synapse_pass'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
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
