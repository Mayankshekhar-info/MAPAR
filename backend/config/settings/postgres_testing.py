import os
from .base import *
from django.test.runner import DiscoverRunner


DEBUG = False

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Dedicated PostgreSQL Database Configuration for Integration Testing
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("TEST_DB_NAME") or os.environ.get("DB_NAME") or os.environ.get("POSTGRES_DB", "mapar"),
        "USER": os.environ.get("TEST_DB_USER") or os.environ.get("DB_USER") or os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("TEST_DB_PASSWORD") or os.environ.get("DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("TEST_DB_HOST") or os.environ.get("DB_HOST") or os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("TEST_DB_PORT") or os.environ.get("DB_PORT") or os.environ.get("POSTGRES_PORT", "5432"),
        "TEST": {
            "NAME": "test_mapar",
        },
    }
}


class ManagedModelTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        from django.apps import apps
        for m in apps.get_models():
            if not m._meta.managed:
                m._meta.managed = True
        return super().setup_databases(**kwargs)


TEST_RUNNER = "config.settings.postgres_testing.ManagedModelTestRunner"
