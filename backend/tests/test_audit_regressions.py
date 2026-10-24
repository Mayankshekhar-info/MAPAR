import inspect
import pytest
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.exceptions import PermissionDenied

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
from apps.dashboard.models import KPI, KPIValue, ReportingPeriod
from apps.imports.models import ImportBatch, ImportStagedRow, UploadTemplate, UploadTemplateVersion
from apps.imports.services.import_execution_service import ImportExecutionService
from apps.organization.api.views import CreateNodeView, UpdateNodeView, DeleteNodeView
from apps.users.api.views import UserDetailView
from common.permissions.authorization import AuthorizationService


class AuditRegressionsTestCase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.super_user = User.objects.create_superuser(
            username="test_super",
            email="super@test.com",
            password="password123",
            role=User.Role.SUPER_ADMIN,
        )
        self.viewer_user = User.objects.create_user(
            username="test_viewer",
            email="viewer@test.com",
            password="password123",
            role=User.Role.VIEWER,
        )

        self.mc = MainCompany.objects.create(name="Regression Corp", code="REG_CORP")
        self.sc = SubCompany.objects.create(name="Regression Sub", code="REG_SUB", main_company=self.mc)
        self.prj = Project.objects.create(name="Regression Prj", code="REG_PRJ", sub_company=self.sc)
        self.cir = Circle.objects.create(name="Regression Cir", code="REG_CIR", project=self.prj, region="North")
        self.dom = Domain.objects.create(name="Regression Dom", code="REG_DOM", circle=self.cir)

        self.period = ReportingPeriod.objects.filter(is_current=True).first()
        if not self.period:
            import datetime
            self.period = ReportingPeriod.objects.create(
                name="Reg Period 2026",
                period_type="MONTHLY",
                start_date=datetime.date(2026, 1, 1),
                end_date=datetime.date(2026, 1, 31),
                is_current=True,
            )

    def test_authorization_annotations_introspection(self):
        """Verify that AuthorizationService.require_organization_access annotations inspect cleanly."""
        annotations = inspect.get_annotations(AuthorizationService.require_organization_access)
        self.assertIn("target_user", annotations)
        self.assertIn("circle_id", annotations)

    def test_organization_mutators_permission_enforcement(self):
        """Verify CreateNodeView, UpdateNodeView, DeleteNodeView enforce organization permissions."""
        # Unprivileged viewer should be denied
        create_req = self.factory.post(
            "/api/v1/organization/nodes/",
            {"level": "CIRCLE", "name": "Unauthorized Circle", "code": "UNAUTH_CIR", "parent_id": self.prj.id},
            format="json"
        )
        force_authenticate(create_req, user=self.viewer_user)
        res_denied = CreateNodeView.as_view()(create_req)
        self.assertEqual(res_denied.status_code, 403)

        # Superuser should succeed
        create_req_super = self.factory.post(
            "/api/v1/organization/nodes/",
            {"level": "CIRCLE", "name": "Super Circle", "code": "SUPER_CIR", "parent_id": self.prj.id},
            format="json"
        )
        force_authenticate(create_req_super, user=self.super_user)
        res = CreateNodeView.as_view()(create_req_super)
        self.assertEqual(res.status_code, 201)

    def test_import_rag_calculation_lower_better(self):
        """Verify ImportExecutionService RAG calculation for LOWER_BETTER metrics."""
        kpi_lower = KPI.objects.create(
            code="KPI_DEFECT_RATE",
            name="Defect Rate",
            domain=self.dom,
            unit="Count",
            direction="LOWER_BETTER",
            is_active=True,
        )

        template = UploadTemplate.objects.create(
            code="TPL_DEFECTS",
            name="Defect Template",
            target_entity="KPI_VALUES",
        )
        version = UploadTemplateVersion.objects.create(
            template=template,
            version_number=1,
            is_active=True,
        )

        batch = ImportBatch.objects.create(
            batch_id="BATCH_LOWER_BETTER_TEST",
            template_version=version,
            reporting_period=self.period,
            status=ImportBatch.Status.VALIDATED,
        )

        # Staged row: target=10, actual=8 (under limit -> GREEN)
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=2,
            raw_data={
                "circle": self.cir.code,
                "kpi_code": kpi_lower.code,
                "target": 10,
                "actual": 8,
            },
            is_valid=True,
            is_imported=False,
        )

        # Staged row 2: target=10, actual=15 (exceeds limit -> RED)
        kpi_outage = KPI.objects.create(
            code="KPI_OUTAGE_MINS",
            name="Outage Minutes",
            domain=self.dom,
            unit="Mins",
            direction="LOWER_BETTER",
            is_active=True,
        )
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=3,
            raw_data={
                "circle": self.cir.code,
                "kpi_code": kpi_outage.code,
                "target": 10,
                "actual": 15,
            },
            is_valid=True,
            is_imported=False,
        )

        ImportExecutionService.commit_batch(batch, user=self.super_user)

        val_green = KPIValue.objects.get(kpi=kpi_lower, circle=self.cir, period=self.period)
        self.assertEqual(val_green.rag_status, "GREEN")

        val_red = KPIValue.objects.get(kpi=kpi_outage, circle=self.cir, period=self.period)
        self.assertEqual(val_red.rag_status, "RED")
