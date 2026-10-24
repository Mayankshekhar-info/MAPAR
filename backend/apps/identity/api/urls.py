from django.urls import path
from .views import CsrfTokenView, CurrentUserView, HealthView, LoginView, LogoutView

urlpatterns = [
    path("health/", HealthView.as_view(), name="identity-health"),
    path("auth/csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
]
