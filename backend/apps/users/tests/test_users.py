from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import connection

from apps.users.services.user_service import UserService
from apps.users.selectors.user_selectors import get_users_list, get_user_detail
from apps.authorization.models import AccessRole
from apps.organization.models import MainCompany, SubCompany, Project, Circle

User = get_user_model()


class UserManagementTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin_lead",
            email="lead@mapar.test",
            password="adminpassword123",
        )

        self.company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="Apex Energy", code="APEX_ENG")
        self.project = Project.objects.create(sub_company=self.sub_company, name="Solar Alpha", code="PRJ_SOLAR")
        self.circle = Circle.objects.create(project=self.project, name="North Circle", code="CIRC_NORTH")

        self.role = AccessRole.objects.create(
            name="Operations Lead",
            code="OPS_LEAD",
            status="ACTIVE",
        )

    def test_create_and_update_user(self):
        user_data = {
            "username": "amit_verma",
            "email": "amit.verma@mapar.test",
            "password": "SecurePassword123!",
            "first_name": "Amit",
            "last_name": "Verma",
            "role": "OPS_LEAD",
            "role_id": self.role.id,
            "circle_id": self.circle.id,
            "department": "Solar Operations",
            "designation": "Assistant Director",
            "status": "ACTIVE",
        }

        user = UserService.create_user(user_data, admin_user=self.admin)
        self.assertIsNotNone(user.id)
        self.assertEqual(user.username, "amit_verma")
        self.assertEqual(user.circle_id, self.circle.id)
        self.assertEqual(user.user_roles.count(), 1)
        self.assertEqual(user.user_roles.first().role_id, self.role.id)

        # Retrieve user detail
        detail = get_user_detail(user.id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["circle_code"], "CIRC_NORTH")
        self.assertIn("Solar Alpha", detail["organization_scope"])

        # Update user
        updated = UserService.update_user(user.id, {"designation": "Director Operations"}, admin_user=self.admin)
        self.assertEqual(updated.designation, "Director Operations")

        # Toggle status
        toggled = UserService.toggle_user_status(user.id, admin_user=self.admin)
        self.assertFalse(toggled.is_active)
        self.assertEqual(toggled.status, "INACTIVE")

        # Check list selector
        res = get_users_list(search="amit")
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["results"][0]["username"], "amit_verma")

    def test_create_user_with_team_hierarchy(self):
        from apps.organization.models import Domain, Department, SubDepartment

        domain = Domain.objects.create(circle=self.circle, name="Renewables", code="DOM_REN")
        dept = Department.objects.create(domain=domain, name="Field Systems", code="DEP_FIELD")
        team = SubDepartment.objects.create(department=dept, name="Inverter Ops Team", code="TM_INV")

        user_data = {
            "username": "suresh_team",
            "email": "suresh.team@mapar.test",
            "password": "SecurePassword123!",
            "first_name": "Suresh",
            "last_name": "Raina",
            "team_id": team.id,
            "role": "OPS_LEAD",
            "role_id": self.role.id,
        }

        user = UserService.create_user(user_data, admin_user=self.admin)
        self.assertEqual(user.sub_department_id, team.id)
        # Automatic inference of circle from team
        self.assertEqual(user.circle_id, self.circle.id)

        # Retrieve user detail
        detail = get_user_detail(user.id)
        self.assertEqual(detail["team_id"], team.id)
        self.assertEqual(detail["team_name"], "Inverter Ops Team")
        self.assertIn("Apex Enterprise → Apex Energy → Solar Alpha → North Circle → Renewables → Field Systems → Inverter Ops Team", detail["organization_scope"])

        # Check list filter by team_id
        res = get_users_list(team_id=team.id)
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["results"][0]["username"], "suresh_team")
        self.assertEqual(res["results"][0]["team_id"], team.id)

