from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']


# Allow all CORS in development
CORS_ALLOW_ALL_ORIGINS = True

# Disable axes in development for convenience
AXES_ENABLED = False

# Show SQL queries in development
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'DEBUG',
    'propagate': False,
}
