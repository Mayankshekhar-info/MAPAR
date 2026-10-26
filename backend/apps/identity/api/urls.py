from django.urls import path
from .views import (
    ChangePasswordView,
    CsrfTokenView,
    CurrentUserView,
    HealthView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetVerifyView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="identity-health"),
    path("auth/csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("auth/password-reset/verify/", PasswordResetVerifyView.as_view(), name="auth-password-reset-verify"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
