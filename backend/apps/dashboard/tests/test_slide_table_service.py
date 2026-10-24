from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.dashboard.services.slide_table_service import SlideTableService
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.dashboard.models import ReportingPeriod, KPI, KPIValue

User = get_user_model()


class SlideTableServiceTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.period = ReportingPeriod.objects.create(
            name="September 2026",
            period_type="MONTHLY",
            is_current=True,
            start_date="2026-09-01",
            end_date="2026-09-30",
        )
        cls.company = MainCompany.objects.create(name="Enterprise Co", code="ENT")
        cls.sub_company = SubCompany.objects.create(main_company=cls.company, name="Power SubCo", code="PWR")
        cls.project = Project.objects.create(sub_company=cls.sub_company, name="Grid Modernization", code="GRD")
        cls.circle = Circle.objects.create(project=cls.project, name="Haryana Circle", code="HR", region="North")
        cls.domain = Domain.objects.create(circle=cls.circle, name="Operations", code="OPS")
        cls.dept = Department.objects.create(domain=cls.domain, name="Field Maintenance", code="FLD_MNT")
        cls.team = SubDepartment.objects.create(department=cls.dept, name="Alpha Squad", code="SQ_A")

        cls.other_circle = Circle.objects.create(project=cls.project, name="Punjab Circle", code="PB", region="North")

        cls.user_auth = User.objects.create_user(
            username="user_haryana",
            email="haryana@mapar.test",
            password="testpassword123",
            role="ANALYST",
            circle=cls.circle,
        )
        cls.user_other = User.objects.create_user(
            username="user_punjab",
            email="punjab@mapar.test",
            password="testpassword123",
            role="ANALYST",
            circle=cls.other_circle,
        )

        cls.kpi = KPI.objects.create(
            code="KPI_AVAIL_01",
            name="Network Availability",
            domain=cls.domain,
            unit="Percentage",
            direction="HIGHER_BETTER",
        )
        cls.kpi_value = KPIValue.objects.create(
            kpi=cls.kpi,
            circle=cls.circle,
            period=cls.period,
            target_value=Decimal("98.0"),
            actual_value=Decimal("98.5"),
            rag_status="GREEN",
            notes="Ingested via Uploads Batch BATCH-12345 (Template Ops v1)",
        )

    def test_master_table_structure(self):
        result = SlideTableService.get_master_table()
        self.assertIn("period", result)
        self.assertIn("summary", result)
        self.assertIn("rows", result)
        self.assertIn("grand_total", result)
        self.assertGreater(result["summary"]["total_records"], 0)

    def test_record_detail_retrieval(self):
        detail = SlideTableService.get_record_detail(self.kpi_value.id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["record_id"], self.kpi_value.id)
        self.assertIn("resource", detail)
        self.assertIn("hierarchy", detail)
        self.assertIn("metrics", detail)
        self.assertIn("source", detail)

        # Verify 7-tier dynamic organizational hierarchy
        hierarchy = detail["hierarchy"]
        self.assertEqual(hierarchy["main_company"], "Enterprise Co")
        self.assertEqual(hierarchy["sub_company"], "Power SubCo")
        self.assertEqual(hierarchy["project"], "Grid Modernization")
        self.assertEqual(hierarchy["circle"], "Haryana Circle")
        self.assertEqual(hierarchy["domain"], "Operations")
        self.assertEqual(hierarchy["department"], "Field Maintenance")
        self.assertEqual(hierarchy["team"], "Alpha Squad")

    def test_record_detail_scoped_authorization(self):
        # Authorized user for Haryana circle can view
        detail_auth = SlideTableService.get_record_detail(self.kpi_value.id, user=self.user_auth)
        self.assertIsNotNone(detail_auth)
        self.assertEqual(detail_auth["record_id"], self.kpi_value.id)

        # User scoped to Punjab circle is blocked
        detail_denied = SlideTableService.get_record_detail(self.kpi_value.id, user=self.user_other)
        self.assertIsNone(detail_denied)

    def test_api_detail_endpoints(self):
        from rest_framework.test import APIClient
        client = APIClient()

        # Unauthenticated request is rejected
        res = client.get(f"/api/v1/dashboard/slide-detail/{self.kpi_value.id}/")
        self.assertIn(res.status_code, [401, 403])

        # Authenticated authorized user accessing slide-detail endpoint
        client.force_authenticate(user=self.user_auth)
        res_slide = client.get(f"/api/v1/dashboard/slide-detail/{self.kpi_value.id}/")
        self.assertEqual(res_slide.status_code, 200)
        self.assertTrue(res_slide.data.get("success"))
        self.assertEqual(res_slide.data["data"]["hierarchy"]["circle"], "Haryana Circle")

        # Authenticated authorized user accessing cockpit record endpoint
        res_cockpit = client.get(f"/api/v1/dashboard/record/{self.kpi_value.id}/")
        self.assertEqual(res_cockpit.status_code, 200)
        self.assertTrue(res_cockpit.data.get("success"))
        self.assertEqual(res_cockpit.data["data"]["hierarchy"]["circle"], "Haryana Circle")

        # Authenticated user outside circle scope is denied (404 Not Found / access denied)
        client.force_authenticate(user=self.user_other)
        res_denied = client.get(f"/api/v1/dashboard/slide-detail/{self.kpi_value.id}/")
        self.assertEqual(res_denied.status_code, 404)
