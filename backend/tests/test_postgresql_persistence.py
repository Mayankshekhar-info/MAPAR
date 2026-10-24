"""
PostgreSQL Real Persistence and Relational Integrity Integration Test Suite.
Verifies end-to-end API creation, direct PostgreSQL queries, transaction rollbacks,
relational constraints, and scope restrictions against a live PostgreSQL database.
"""

from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.db import connection, transaction, IntegrityError
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.exceptions import PermissionDenied

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
from apps.organization.api.views import CreateNodeView, UpdateNodeView, HierarchyNodeDetailView
from apps.dashboard.models import ReportingPeriod, KPI, KPIValue
from common.permissions.authorization import AuthorizationService


class PostgreSQLPersistenceTestCase(TestCase):
    """
    Validates CRUD persistence, direct database reads, and relational integrity.
    """

    def setUp(self):
        self.factory = APIRequestFactory()

        # Verify running on PostgreSQL
        self.assertEqual(connection.vendor, "postgresql", "Database vendor MUST be PostgreSQL.")

        # Superuser for API operations
        self.admin = User.objects.create_superuser(
            username="pg_admin",
            email="pg_admin@mapar.com",
            password="secure_password_123",
            role=User.Role.SUPER_ADMIN,
        )

        # Baseline hierarchy for tests
        self.company = MainCompany.objects.create(name="PG Corp", code="PG_CORP")
        self.sub_company = SubCompany.objects.create(
            name="PG Sub", code="PG_SUB", main_company=self.company
        )
        self.project = Project.objects.create(
            name="PG Project", code="PG_PRJ", sub_company=self.sub_company
        )

    def test_database_engine_is_postgresql(self):
        """Confirm database engine is genuine PostgreSQL, not SQLite or mock."""
        self.assertEqual(connection.vendor, "postgresql")
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version_str = cursor.fetchone()[0]
            self.assertIn("PostgreSQL", version_str)

    def test_api_create_verify_in_postgres_retrieve_and_update(self):
        """
        1. Create record through backend API.
        2. Verify record exists directly in PostgreSQL via SQL cursor.
        3. Retrieve through API.
        4. Update through API and verify persisted change in PostgreSQL.
        """
        # Step 1: Create via API
        create_payload = {
            "level": "CIRCLE",
            "name": "Kolkata Metro Circle",
            "code": "CIR_KOL_01",
            "parent_id": self.project.id,
            "extra_fields": {"region": "East"},
        }
        request = self.factory.post("/api/v1/organization/nodes/", create_payload, format="json")
        force_authenticate(request, user=self.admin)
        response = CreateNodeView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        created_node = response.data["node"]
        circle_id = created_node["id"]
        self.assertEqual(created_node["code"], "CIR_KOL_01")

        # Step 2: Verify directly in PostgreSQL via raw SQL cursor
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, code, region FROM organization_circle WHERE id = %s",
                [circle_id],
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row[0], circle_id)
            self.assertEqual(row[1], "Kolkata Metro Circle")
            self.assertEqual(row[2], "CIR_KOL_01")
            self.assertEqual(row[3], "East")

        # Step 3: Retrieve through API
        get_request = self.factory.get(f"/api/v1/organization/nodes/CIRCLE/{circle_id}/")
        force_authenticate(get_request, user=self.admin)
        get_response = HierarchyNodeDetailView.as_view()(get_request, level="CIRCLE", node_id=circle_id)

        self.assertEqual(get_response.status_code, 200)
        self.assertTrue(get_response.data["success"])
        self.assertEqual(get_response.data["data"]["name"], "Kolkata Metro Circle")

        # Step 4: Update through API and verify in PostgreSQL
        update_payload = {
            "level": "CIRCLE",
            "name": "Kolkata Greater Metro",
            "code": "CIR_KOL_01",
            "status": "ACTIVE",
        }
        put_request = self.factory.put(
            f"/api/v1/organization/nodes/CIRCLE/{circle_id}/", update_payload, format="json"
        )
        force_authenticate(put_request, user=self.admin)
        put_response = UpdateNodeView.as_view()(put_request, level="CIRCLE", node_id=circle_id)

        self.assertEqual(put_response.status_code, 200)

        # Confirm update directly in PostgreSQL
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM organization_circle WHERE id = %s", [circle_id])
            updated_name = cursor.fetchone()[0]
            self.assertEqual(updated_name, "Kolkata Greater Metro")

    def test_relational_integrity_and_invalid_foreign_key(self):
        """
        Verify foreign key constraints prevent invalid relationships in PostgreSQL.
        """
        invalid_parent_id = 99999999
        create_payload = {
            "level": "CIRCLE",
            "name": "Orphan Circle",
            "code": "CIR_ORPHAN",
            "parent_id": invalid_parent_id,
        }
        request = self.factory.post("/api/v1/organization/nodes/", create_payload, format="json")
        force_authenticate(request, user=self.admin)
        response = CreateNodeView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

        # Direct SQL constraint check: inserting invalid foreign key raises IntegrityError
        with self.assertRaises(IntegrityError):
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO organization_circle (name, code, project_id, is_active, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s, NOW(), NOW())",
                    ["Direct Orphan", "DIR_ORPHAN", invalid_parent_id, True],
                )

    def test_user_and_organization_scope_restrictions(self):
        """
        Verify cross-branch access restrictions in PostgreSQL.
        """
        circle_a = Circle.objects.create(name="Circle A", code="CIR_A", project=self.project)
        circle_b = Circle.objects.create(name="Circle B", code="CIR_B", project=self.project)

        # Restricted circle user
        scoped_user = User.objects.create_user(
            username="circle_a_user",
            email="circ_a@mapar.com",
            password="password123",
            role=User.Role.CIRCLE_DOMAIN_MANAGER,
            circle=circle_a,
        )

        # Circle A access should succeed
        AuthorizationService.require_organization_access(
            user=scoped_user, circle_id=circle_a.id, action="view"
        )

        # Circle B access MUST raise 403 PermissionDenied
        with self.assertRaises(PermissionDenied):
            AuthorizationService.require_organization_access(
                user=scoped_user, circle_id=circle_b.id, action="view"
            )


class PostgreSQLTransactionTestCase(TransactionTestCase):
    """
    Validates atomic transactions and clean rollbacks on PostgreSQL.
    """

    def test_transaction_rollback_on_failure(self):
        """
        Ensure atomic transaction rolls back completely when an error occurs,
        leaving zero orphaned records in PostgreSQL.
        """
        self.assertEqual(connection.vendor, "postgresql")
        initial_count = MainCompany.objects.count()

        try:
            with transaction.atomic():
                MainCompany.objects.create(name="Rollback Corp", code="ROLLBACK_01")
                # Intentionally trigger an IntegrityError with duplicate unique code
                MainCompany.objects.create(name="Duplicate Corp", code="ROLLBACK_01")
        except IntegrityError:
            pass

        # Verify rollback: count should match initial_count and record must not exist
        self.assertEqual(MainCompany.objects.count(), initial_count)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM organization_maincompany WHERE code = 'ROLLBACK_01'"
            )
            count = cursor.fetchone()[0]
            self.assertEqual(count, 0)
