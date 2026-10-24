from .base import *
from django.test.runner import DiscoverRunner


DEBUG = False

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


class ManagedModelTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        from django.apps import apps
        for m in apps.get_models():
            if not m._meta.managed:
                m._meta.managed = True
        return super().setup_databases(**kwargs)


TEST_RUNNER = "config.settings.testing.ManagedModelTestRunner"
