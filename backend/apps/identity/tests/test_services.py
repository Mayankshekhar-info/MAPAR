import pytest
from apps.identity.models import User
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_csrf_token_view():
    client = APIClient()
    response = client.get("/api/v1/auth/csrf/")
    assert response.status_code == 200
    assert "csrfToken" in response.data


@pytest.mark.django_db
def test_login_success_and_current_user():
    # Create test user if not exists
    user, _ = User.objects.get_or_create(
        username="test_leader",
        defaults={
            "email": "test.leader@telecrats.in",
            "role": User.Role.CORPORATE_DOMAIN_LEAD,
            "is_active": True,
        },
    )
    user.set_password("Mapar@2026")
    user.save()

    client = APIClient()
    # Test valid login
    login_res = client.post(
        "/api/v1/auth/login/",
        {"username": "test_leader", "password": "Mapar@2026", "remember_me": True},
        format="json",
    )
    assert login_res.status_code == 200
    assert login_res.data["success"] is True
    assert login_res.data["user"]["username"] == "test_leader"
    assert login_res.data["user"]["role"] == "CORPORATE_DOMAIN_LEAD"

    # Test me view
    me_res = client.get("/api/v1/auth/me/")
    assert me_res.status_code == 200
    assert me_res.data["is_authenticated"] is True
    assert me_res.data["user"]["username"] == "test_leader"

    # Test logout
    logout_res = client.post("/api/v1/auth/logout/")
    assert logout_res.status_code == 200
    assert logout_res.data["success"] is True


@pytest.mark.django_db
def test_login_invalid_credentials():
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "non_existent", "password": "WrongPassword!"},
        format="json",
    )
    assert response.status_code == 401
    assert "Invalid username or password" in response.data["detail"]
