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


@pytest.mark.django_db
def test_login_with_corporate_email():
    """Verify login works when user enters their corporate email address."""
    user, _ = User.objects.get_or_create(
        username="rahmaan_telecrats",
        defaults={
            "email": "cbh.web@telecrats.com",
            "role": User.Role.CIRCLE_DOMAIN_MANAGER,
            "status": User.Status.ACTIVE,
            "is_active": True,
        },
    )
    user.set_password("SecurePass2026!")
    user.save()

    client = APIClient()
    # Login using email
    res = client.post(
        "/api/v1/auth/login/",
        {"username": "cbh.web@telecrats.com", "password": "SecurePass2026!"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["success"] is True
    assert res.data["user"]["username"] == "rahmaan_telecrats"


@pytest.mark.django_db
def test_login_case_insensitivity():
    """Verify login matches username and email regardless of case."""
    user, _ = User.objects.get_or_create(
        username="AmitBarman",
        defaults={
            "email": "Amit.Barman@pratap.co.in",
            "role": User.Role.MANAGEMENT,
            "status": User.Status.ACTIVE,
            "is_active": True,
        },
    )
    user.set_password("P@ssword123")
    user.save()

    client = APIClient()
    # Test lowercase username
    res_user = client.post(
        "/api/v1/auth/login/",
        {"username": "amitbarman", "password": "P@ssword123"},
        format="json",
    )
    assert res_user.status_code == 200

    # Test uppercase email
    res_email = client.post(
        "/api/v1/auth/login/",
        {"username": "AMIT.BARMAN@PRATAP.CO.IN", "password": "P@ssword123"},
        format="json",
    )
    assert res_email.status_code == 200


@pytest.mark.django_db
def test_login_with_employee_id():
    """Verify login works using employee ID."""
    user, _ = User.objects.get_or_create(
        username="emp_user_99",
        defaults={
            "email": "emp99@mapar.com",
            "employee_id": "MAP-9901",
            "status": User.Status.ACTIVE,
            "is_active": True,
        },
    )
    user.set_password("EmpPassword1!")
    user.save()

    client = APIClient()
    res = client.post(
        "/api/v1/auth/login/",
        {"username": "MAP-9901", "password": "EmpPassword1!"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["user"]["username"] == "emp_user_99"


@pytest.mark.django_db
def test_login_inactive_and_invited_accounts_return_403():
    """Verify inactive and invited accounts return HTTP 403 with appropriate explanation."""
    user_inactive, _ = User.objects.get_or_create(
        username="user_inactive",
        defaults={
            "email": "inactive@telecrats.in",
            "status": User.Status.INACTIVE,
            "is_active": False,
        },
    )
    user_inactive.set_password("SomePass123!")
    user_inactive.save()

    client = APIClient()
    res_inactive = client.post(
        "/api/v1/auth/login/",
        {"username": "user_inactive", "password": "SomePass123!"},
        format="json",
    )
    assert res_inactive.status_code == 403
    assert "inactive" in res_inactive.data["detail"].lower()

    user_invited, _ = User.objects.get_or_create(
        username="user_invited",
        defaults={
            "email": "invited@telecrats.in",
            "status": User.Status.INVITED,
            "is_active": False,
        },
    )
    user_invited.set_password("InvitedPass123!")
    user_invited.save()

    res_invited = client.post(
        "/api/v1/auth/login/",
        {"username": "user_invited", "password": "InvitedPass123!"},
        format="json",
    )
    assert res_invited.status_code == 403
    assert "pending activation" in res_invited.data["detail"].lower()


@pytest.mark.django_db
def test_login_user_management_creation_workflow():
    """Verify end-to-end login with a user created via UserService.create_user."""
    from apps.users.services.user_service import UserService

    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        admin = User.objects.create_superuser("admin_test", "adm@test.com", "AdminTestPass123!")

    # Simulate creating user through User Management
    user_data = {
        "username": "new_created_user",
        "email": "new_user@mapar.telecrats.in",
        "password": "CorporatePassword2026#",
        "first_name": "Test",
        "last_name": "Employee",
        "status": "ACTIVE",
        "role": "VIEWER",
    }
    created_user = UserService.create_user(user_data, admin_user=admin)
    assert created_user.is_active is True

    client = APIClient()
    # 1. Login with username
    login_user_res = client.post(
        "/api/v1/auth/login/",
        {"username": "new_created_user", "password": "CorporatePassword2026#"},
        format="json",
    )
    assert login_user_res.status_code == 200
    assert login_user_res.data["success"] is True

    # 2. Login with email
    login_email_res = client.post(
        "/api/v1/auth/login/",
        {"username": "new_user@mapar.telecrats.in", "password": "CorporatePassword2026#"},
        format="json",
    )
    assert login_email_res.status_code == 200
    assert login_email_res.data["success"] is True

    # 3. Wrong password fails with 401
    bad_pass_res = client.post(
        "/api/v1/auth/login/",
        {"username": "new_created_user", "password": "WrongPassword999!"},
        format="json",
    )
    assert bad_pass_res.status_code == 401
