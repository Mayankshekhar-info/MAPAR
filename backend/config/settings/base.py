"""
MAPAR base Django configuration.

Never place production secrets in this file.
"""

from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[2]


def _load_env(path: Path) -> None:
    """Loads key=value pairs into os.environ if file exists."""
    if path.is_file():
        try:
            with open(path, "r", encoding="utf-8") as fp:
                for line in fp:
                    cleaned = line.strip()
                    if cleaned and not cleaned.startswith("#") and "=" in cleaned:
                        key, val = cleaned.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
        except OSError:
            pass


# Load environment variables (supports both workspace root and backend directory)
_load_env(BASE_DIR.parent / ".env")
_load_env(BASE_DIR / ".env")

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-mapar-v2-dev-secret-key-10df6023-7c76-46eb"
)

DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
if "testserver" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("testserver")

ENV_CSRF_ORIGINS = os.environ.get("CSRF_TRUSTED_ORIGINS", "")
if ENV_CSRF_ORIGINS:
    CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in ENV_CSRF_ORIGINS.split(",") if origin.strip()]
else:
    # Safe fallback default for local dev env
    CSRF_TRUSTED_ORIGINS = ["http://localhost:8004", "http://127.0.0.1:8004"]

# 2. Hardcode the proxy headers so Django trusts Nginx's secure HTTPS routing
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "django_filters",
    "corsheaders",

    # MAPAR applications
    "apps.identity",
    "apps.organization",
    "apps.authorization",
    "apps.users",
    "apps.dashboard",
    "apps.kpi",
    "apps.workflow",
    "apps.operations",
    "apps.workforce",
    "apps.finance",
    "apps.governance",
    "apps.imports",
    "apps.documents",
    "apps.notifications",
    "apps.audit",
    "apps.reporting",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]


ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME") or os.environ.get("POSTGRES_DB", "mapar"),
        "USER": os.environ.get("DB_USER") or os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST") or os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT") or os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", 60)),
    }
}


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),
    "PAGE_SIZE": 25,
}

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "https://pagms.pratap.tech",
    "http://pagms.pratap.tech",
    "https://mapar.pratap.tech",
    "http://mapar.pratap.tech",
    "http://localhost:5185",
    "http://127.0.0.1:5185",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
CSRF_TRUSTED_ORIGINS = [
    "https://pagms.pratap.tech",
    "http://pagms.pratap.tech",
    "https://mapar.pratap.tech",
    "http://mapar.pratap.tech",
    "http://localhost:5185",
    "http://127.0.0.1:5185",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "https://pagms.pratap.tech")


LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"

USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


MEDIA_URL = os.environ.get("MEDIA_URL", "/media/")
MEDIA_ROOT = Path(os.environ.get("MAPAR_MEDIA_ROOT", BASE_DIR / "media"))

STORAGES = {
    "default": {
        "BACKEND": os.environ.get("DEFAULT_FILE_STORAGE", "django.core.files.storage.FileSystemStorage"),
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "identity.User"

AUTHENTICATION_BACKENDS = [
    "apps.identity.backends.EmailOrUsernameModelBackend",
    "django.contrib.auth.backends.ModelBackend",
]


# Security defaults
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
X_CONTENT_TYPE_OPTIONS = "nosniff"
SECURE_REFERRER_POLICY = "same-origin"


# Celery Configuration
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = False
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60

from celery.schedules import crontab  # type: ignore

CELERY_BEAT_SCHEDULE = {
    # Friday: 1 reminder at 10:00 AM IST
    "friday-reminder-10am": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=10, day_of_week="friday"),
        "kwargs": {"target_slot": "Friday:10:00"},
    },
    # Saturday: 2 reminders at 9:00 AM and 5:00 PM IST
    "saturday-reminder-9am": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=9, day_of_week="saturday"),
        "kwargs": {"target_slot": "Saturday:09:00"},
    },
    "saturday-reminder-5pm": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=17, day_of_week="saturday"),
        "kwargs": {"target_slot": "Saturday:17:00"},
    },
    # Sunday: 3 reminders at 9:00 AM, 1:00 PM, 5:00 PM IST
    "sunday-reminder-9am": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=9, day_of_week="sunday"),
        "kwargs": {"target_slot": "Sunday:09:00"},
    },
    "sunday-reminder-1pm": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=13, day_of_week="sunday"),
        "kwargs": {"target_slot": "Sunday:13:00"},
    },
    "sunday-reminder-5pm": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour=17, day_of_week="sunday"),
        "kwargs": {"target_slot": "Sunday:17:00"},
    },
    # Dynamic hourly evaluation for user-configured weekly reminder schedules (8 AM to 8 PM IST)
    "dynamic-hourly-reminder-evaluation": {
        "task": "apps.notifications.tasks.process_scheduled_reminders_task",
        "schedule": crontab(minute=0, hour="8-20"),
        "kwargs": {},
    },
}

