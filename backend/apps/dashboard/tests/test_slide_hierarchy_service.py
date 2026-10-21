from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from apps.dashboard.services.slide_hierarchy_service import SlideHierarchyService
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from django.db import connection
from apps.dashboard.models import ReportingPeriod, KPI, KPIValue
from apps.authorization.models import AccessRole, AccessUserRole, UserAccessScope, UserAccessScopeCircle

from typing import Any

User: Any = get_user_model()


class SlideHierarchyServiceTests(TestCase):

    @classmethod
    def setUpClass(cls):
        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS organization_reportingperiod (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) UNIQUE,
                        period_type VARCHAR(20),
                        start_date DATE,
                        end_date DATE,
                        freeze_at TIMESTAMP,
                        is_frozen BOOLEAN DEFAULT FALSE,
                        is_current BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS kpis_kpi (
                        id SERIAL PRIMARY KEY,
                        code VARCHAR(50) UNIQUE,
                        name VARCHAR(200),
                        definition TEXT DEFAULT '',
                        calculation_formula TEXT DEFAULT '',
                        unit VARCHAR(50) DEFAULT '',
                        direction VARCHAR(20) DEFAULT 'HIGHER_BETTER',
                        frequency VARCHAR(20) DEFAULT 'MONTHLY',
                        risk_category VARCHAR(100) DEFAULT '',
                        priority VARCHAR(20) DEFAULT 'MEDIUM',
                        default_owner VARCHAR(100) DEFAULT '',
                        is_executive BOOLEAN DEFAULT FALSE,
                        is_active BOOLEAN DEFAULT TRUE,
                        display_order INTEGER DEFAULT 0,
                        domain_id INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS kpis_kpivalue (
                        id SERIAL PRIMARY KEY,
                        kpi_id INTEGER,
                        circle_id INTEGER,
                        period_id INTEGER,
                        actual_value NUMERIC(15, 2),
                        target_value NUMERIC(15, 2),
                        previous_value NUMERIC(15, 2),
                        numerator_value NUMERIC(15, 2),
                        denominator_value NUMERIC(15, 2),
                        variance_to_target NUMERIC(15, 2),
                        variance_percentage NUMERIC(8, 2),
                        rag_status VARCHAR(20) DEFAULT 'GREEN',
                        trend VARCHAR(20) DEFAULT 'FLAT',
                        notes TEXT DEFAULT '',
                        entered_by_id INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(kpi_id, circle_id, period_id)
                    );
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS organization_reportingperiod (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(100) UNIQUE,
                        period_type VARCHAR(20),
                        start_date DATE,
                        end_date DATE,
                        freeze_at DATETIME,
                        is_frozen BOOLEAN DEFAULT 0,
                        is_current BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS kpis_kpi (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        code VARCHAR(50) UNIQUE,
                        name VARCHAR(200),
                        definition TEXT DEFAULT '',
                        calculation_formula TEXT DEFAULT '',
                        unit VARCHAR(50) DEFAULT '',
                        direction VARCHAR(20) DEFAULT 'HIGHER_BETTER',
                        frequency VARCHAR(20) DEFAULT 'MONTHLY',
                        risk_category VARCHAR(100) DEFAULT '',
                        priority VARCHAR(20) DEFAULT 'MEDIUM',
                        default_owner VARCHAR(100) DEFAULT '',
                        is_executive BOOLEAN DEFAULT 0,
                        is_active BOOLEAN DEFAULT 1,
                        display_order INTEGER DEFAULT 0,
                        domain_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS kpis_kpivalue (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kpi_id INTEGER,
                        circle_id INTEGER,
                        period_id INTEGER,
                        actual_value NUMERIC(15, 2),
                        target_value NUMERIC(15, 2),
                        previous_value NUMERIC(15, 2),
                        numerator_value NUMERIC(15, 2),
                        denominator_value NUMERIC(15, 2),
                        variance_to_target NUMERIC(15, 2),
                        variance_percentage NUMERIC(8, 2),
                        rag_status VARCHAR(20) DEFAULT 'GREEN',
                        trend VARCHAR(20) DEFAULT 'FLAT',
                        notes TEXT DEFAULT '',
                        entered_by_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(kpi_id, circle_id, period_id)
                    );
                """)
        super().setUpClass()

    @classmethod
    def setUpTestData(cls):
        cls.period = ReportingPeriod.objects.create(
            name="September 2026",
            period_type="MONTHLY",
            is_current=True,
            start_date="2026-09-01",
            end_date="2026-09-30",
        )
        cls.company_a = MainCompany.objects.create(name="Enterprise Co A", code="ENT_A")
        cls.company_b = MainCompany.objects.create(name="Enterprise Co B", code="ENT_B")

        cls.sub_a1 = SubCompany.objects.create(main_company=cls.company_a, name="Power SubCo 1", code="PWR_1")
        cls.sub_a2 = SubCompany.objects.create(main_company=cls.company_a, name="Power SubCo 2", code="PWR_2")

        cls.project_p1 = Project.objects.create(sub_company=cls.sub_a1, name="Grid Modernization", code="GRD_1")
        cls.circle_c1 = Circle.objects.create(project=cls.project_p1, name="Haryana Circle", code="HR_C1", region="North")
        cls.domain_d1 = Domain.objects.create(circle=cls.circle_c1, name="Operations", code="OPS_D1")
        cls.dept_rec = Department.objects.create(domain=cls.domain_d1, name="Recruitment Dept", code="REC_D1")
        cls.team_t1 = SubDepartment.objects.create(department=cls.dept_rec, name="Recruitment Team 1", code="REC_T1")

        cls.circle_c2 = Circle.objects.create(project=cls.project_p1, name="Punjab Circle", code="PB_C2", region="North")

        cls.super_admin = User.objects.create_superuser(
            username="super_admin",
            email="admin@mapar.test",
            password="testpassword123",
            role="SUPER_ADMIN",
        )

        cls.scoped_user = User.objects.create_user(
            username="circle_user",
            email="circle_user@mapar.test",
            password="testpassword123",
            role="VIEWER",
            circle=cls.circle_c1,
        )

        role, _ = AccessRole.objects.get_or_create(code="VIEWER", defaults={"name": "Viewer", "status": "ACTIVE"})
        AccessUserRole.objects.create(user=cls.scoped_user, role=role, is_primary=True)

        scope = UserAccessScope.objects.create(
            user=cls.scoped_user,
            scope_type=UserAccessScope.ScopeType.CIRCLE,
            circle=cls.circle_c1,
            can_view=True,
        )
        UserAccessScopeCircle.objects.create(useraccessscope=scope, circle=cls.circle_c1)

        cls.kpi = KPI.objects.create(
            code="KPI_AVAIL_01",
            name="Network Availability",
            domain=cls.domain_d1,
            unit="Percentage",
            direction="HIGHER_BETTER",
        )

        cls.kpi_value = KPIValue.objects.create(
            kpi=cls.kpi,
            circle=cls.circle_c1,
            period=cls.period,
            actual_value=Decimal("98.50"),
            target_value=Decimal("95.00"),
            variance_to_target=Decimal("3.50"),
            variance_percentage=Decimal("3.68"),
            rag_status="GREEN",
            entered_by=cls.scoped_user,
        )

    def test_root_level_super_admin_sees_all_companies(self):
        data = SlideHierarchyService.get_root_level_data(user=self.super_admin)
        self.assertEqual(data["level"], "MAIN_COMPANY")
        company_codes = [node["code"] for node in data["nodes"]]
        self.assertIn("ENT_A", company_codes)
        self.assertIn("ENT_B", company_codes)
        self.assertEqual(data["summary"]["total_companies"], 2)

    def test_root_level_scoped_user_sees_only_authorized_company(self):
        data = SlideHierarchyService.get_root_level_data(user=self.scoped_user)
        company_codes = [node["code"] for node in data["nodes"]]
        self.assertIn("ENT_A", company_codes)
        self.assertNotIn("ENT_B", company_codes)

    def test_node_drill_down_main_company(self):
        data = SlideHierarchyService.get_node_level_data(
            level="MAIN_COMPANY",
            node_id=self.company_a.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "ENT_A")
        self.assertEqual(len(data["breadcrumbs"]), 2)
        self.assertEqual(data["breadcrumbs"][0]["code"], "SLIDES")
        self.assertEqual(data["breadcrumbs"][1]["code"], "ENT_A")
        # Direct children are Sub Companies
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("PWR_1", child_codes)
        self.assertIn("PWR_2", child_codes)
        self.assertEqual(data["child_level"], "SUB_COMPANY")

    def test_node_drill_down_sub_company(self):
        data = SlideHierarchyService.get_node_level_data(
            level="SUB_COMPANY",
            node_id=self.sub_a1.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "PWR_1")
        # Breadcrumbs: Root > MainCompany > SubCompany
        self.assertEqual(len(data["breadcrumbs"]), 3)
        self.assertEqual(data["breadcrumbs"][1]["code"], "ENT_A")
        self.assertEqual(data["breadcrumbs"][2]["code"], "PWR_1")
        # Direct children are Projects
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("GRD_1", child_codes)
        self.assertEqual(data["child_level"], "PROJECT")

    def test_node_drill_down_project(self):
        data = SlideHierarchyService.get_node_level_data(
            level="PROJECT",
            node_id=self.project_p1.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "GRD_1")
        # Direct children are Circles
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("HR_C1", child_codes)
        self.assertIn("PB_C2", child_codes)
        self.assertEqual(data["child_level"], "CIRCLE")

    def test_node_drill_down_circle(self):
        data = SlideHierarchyService.get_node_level_data(
            level="CIRCLE",
            node_id=self.circle_c1.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "HR_C1")
        # Breadcrumbs: Root > Company > SubCompany > Project > Circle
        self.assertEqual(len(data["breadcrumbs"]), 5)
        # Direct children are Domains
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("OPS_D1", child_codes)
        self.assertEqual(data["child_level"], "DOMAIN")
        # Operational data is present
        self.assertTrue(len(data["operational_data"]) > 0)
        self.assertEqual(data["operational_data"][0]["kpi_code"], "KPI_AVAIL_01")
        self.assertEqual(data["operational_data"][0]["actual_value"], 98.50)

    def test_node_drill_down_domain(self):
        data = SlideHierarchyService.get_node_level_data(
            level="DOMAIN",
            node_id=self.domain_d1.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "OPS_D1")
        # Direct children are Departments
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("REC_D1", child_codes)
        self.assertEqual(data["child_level"], "DEPARTMENT")

    def test_node_drill_down_department(self):
        data = SlideHierarchyService.get_node_level_data(
            level="DEPARTMENT",
            node_id=self.dept_rec.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "REC_D1")
        # Direct children are Teams / SubDepartments
        child_codes = [c["code"] for c in data["children"]]
        self.assertIn("REC_T1", child_codes)
        self.assertEqual(data["child_level"], "SUB_DEPARTMENT")

    def test_node_drill_down_team(self):
        data = SlideHierarchyService.get_node_level_data(
            level="SUB_DEPARTMENT",
            node_id=self.team_t1.id,
            user=self.super_admin,
        )
        self.assertEqual(data["node"]["code"], "REC_T1")
        self.assertEqual(data["child_level"], "USER")
        # Breadcrumbs depth is 8
        self.assertEqual(len(data["breadcrumbs"]), 8)

    def test_scoped_user_cannot_access_unauthorized_circle(self):
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            SlideHierarchyService.get_node_level_data(
                level="CIRCLE",
                node_id=self.circle_c2.id,
                user=self.scoped_user,
            )

    def test_api_slide_hierarchy_root(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        response = client.get("/api/v1/dashboard/slide-hierarchy/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["level"], "MAIN_COMPANY")

    def test_api_slide_hierarchy_node(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        response = client.get(f"/api/v1/dashboard/slide-hierarchy/main_company/{self.company_a.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["node"]["code"], "ENT_A")

    def test_api_slide_hierarchy_scoped_denied(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.scoped_user)
        response = client.get(f"/api/v1/dashboard/slide-hierarchy/circle/{self.circle_c2.id}/")
        self.assertEqual(response.status_code, 403)
