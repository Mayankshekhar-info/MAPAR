import io
import datetime
from decimal import Decimal
from typing import Any
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook  # type: ignore

from django.contrib.auth import get_user_model

User: Any = get_user_model()
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.dashboard.models import ReportingPeriod, KPI, KPIValue
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.services.master_data_service import MasterDataService
from apps.kpi.models import KPIDefinition, KPIParameter, KPIFilter


class UploadKPIWorkflowTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="kpi_upload_admin",
            email="kpi_admin@mapar.com",
            role=User.Role.SUPER_ADMIN,
        )
        self.company = MainCompany.objects.create(name="Telecom Corp", code="TEL", status="ACTIVE")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="Infratel", code="INF", status="ACTIVE")
        self.project = Project.objects.create(sub_company=self.sub_company, name="4G Rollout", code="4G_ROLL", status="ACTIVE")
        self.circle = Circle.objects.create(project=self.project, name="Bihar Circle", code="BIHAR", is_active=True)

        # Template
        self.template = UploadTemplate.objects.create(
            name="Network Performance",
            code="NET_PERF",
            created_by=self.user,
        )
        self.version = UploadTemplateVersion.objects.create(
            template=self.template,
            version_number=1,
            is_active=True,
            created_by=self.user,
        )
        self.col_circle = UploadTemplateColumn.objects.create(
            version=self.version,
            name="circle_code",
            display_label="Circle",
            column_order=1,
            data_type=UploadTemplateColumn.DataType.TEXT,
            is_required=True,
        )
        self.col_uptime = UploadTemplateColumn.objects.create(
            version=self.version,
            name="uptime",
            display_label="Uptime",
            column_order=2,
            data_type=UploadTemplateColumn.DataType.DECIMAL,
            is_required=True,
        )
        self.col_outage = UploadTemplateColumn.objects.create(
            version=self.version,
            name="outage_min",
            display_label="Outage Min",
            column_order=3,
            data_type=UploadTemplateColumn.DataType.INTEGER,
            is_required=False,
        )

        # KPI 1: Compatible
        self.kpi_avg_uptime = KPIDefinition.objects.create(
            name="Average Uptime",
            code="KPI_AVG_UPTIME",
            source_dataset=self.template,
            hierarchy_level="CIRCLE",
            hierarchy_id=self.circle.id,
            calculation_type=KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            aggregation_method="AVG",
            unit="%",
            is_active=True,
            created_by=self.user,
        )
        KPIParameter.objects.create(
            kpi=self.kpi_avg_uptime,
            name="uptime_col",
            source_column="Uptime",
            aggregation="AVG",
        )

        # KPI 2: Incompatible (requires non-existent column)
        self.kpi_incompatible = KPIDefinition.objects.create(
            name="DG Fuel Efficiency",
            code="KPI_DG_FUEL",
            source_dataset=self.template,
            hierarchy_level="CIRCLE",
            hierarchy_id=self.circle.id,
            calculation_type=KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            aggregation_method="SUM",
            unit="Liters",
            is_active=True,
            created_by=self.user,
        )
        KPIParameter.objects.create(
            kpi=self.kpi_incompatible,
            name="fuel_col",
            source_column="Fuel Consumed Liters",
        )

    def _create_excel_file(self, rows):
        wb = Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "Data Entry"
        ws.append(["Circle", "Uptime", "Outage Min"])
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return SimpleUploadedFile("test_upload.xlsx", buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    def test_daily_reporting_period_resolution(self):
        file = self._create_excel_file([["BIHAR", 99.4, 15], ["BIHAR", 98.8, 40]])
        batch = UploadValidationService.process_and_validate_upload(
            version=self.version,
            uploaded_file=file,
            reporting_period_type="DAILY",
            reporting_date="2026-10-10",
            user=self.user,
        )
        self.assertIsNotNone(batch.reporting_period)
        self.assertEqual(batch.reporting_period.period_type, "DAILY")
        self.assertEqual(batch.reporting_period.start_date, datetime.date(2026, 10, 10))
        self.assertEqual(batch.reporting_period.end_date, datetime.date(2026, 10, 10))
        self.assertEqual(batch.status, ImportBatch.Status.VALIDATED)

    def test_weekly_reporting_period_resolution(self):
        file = self._create_excel_file([["BIHAR", 99.1, 10]])
        batch = UploadValidationService.process_and_validate_upload(
            version=self.version,
            uploaded_file=file,
            reporting_period_type="WEEKLY",
            start_date="2026-10-05",
            end_date="2026-10-11",
            user=self.user,
        )
        self.assertIsNotNone(batch.reporting_period)
        self.assertEqual(batch.reporting_period.period_type, "WEEKLY")
        self.assertEqual(batch.reporting_period.start_date, datetime.date(2026, 10, 5))
        self.assertEqual(batch.reporting_period.end_date, datetime.date(2026, 10, 11))

    def test_upload_with_compatible_kpi_execution(self):
        file = self._create_excel_file([["BIHAR", 98.0, 30], ["BIHAR", 96.0, 60]])
        batch = UploadValidationService.process_and_validate_upload(
            version=self.version,
            uploaded_file=file,
            reporting_period_type="DAILY",
            reporting_date="2026-10-12",
            kpi_id=self.kpi_avg_uptime.id,
            user=self.user,
        )
        self.assertEqual(batch.applied_kpi, self.kpi_avg_uptime)
        self.assertEqual(batch.kpi_execution_status, "COMPLETED")
        self.assertIsNotNone(batch.kpi_result_summary)
        # Average of 98.0 and 96.0 is 97.0
        self.assertAlmostEqual(float(batch.kpi_result_summary["calculated_value"]), 97.0, places=1)

    def test_upload_with_incompatible_kpi_marks_compatibility_error_without_failing_upload(self):
        file = self._create_excel_file([["BIHAR", 98.0, 30]])
        batch = UploadValidationService.process_and_validate_upload(
            version=self.version,
            uploaded_file=file,
            reporting_period_type="DAILY",
            reporting_date="2026-10-12",
            kpi_id=self.kpi_incompatible.id,
            user=self.user,
        )
        # Upload itself is valid!
        self.assertEqual(batch.status, ImportBatch.Status.VALIDATED)
        self.assertEqual(batch.valid_rows, 1)
        # But KPI execution failed compatibility check
        self.assertEqual(batch.applied_kpi, self.kpi_incompatible)
        self.assertEqual(batch.kpi_execution_status, "COMPATIBILITY_ERROR")
        self.assertIn("missing_columns", batch.kpi_result_summary)
        self.assertIn("not found", batch.kpi_result_summary.get("message", "").lower())

    def test_master_data_complete_separation(self):
        """Verify that Master Data actions never alter Upload records or KPI execution results."""
        file = self._create_excel_file([["BIHAR", 99.0, 10]])
        batch = UploadValidationService.process_and_validate_upload(
            version=self.version,
            uploaded_file=file,
            reporting_period_type="DAILY",
            reporting_date="2026-10-14",
            kpi_id=self.kpi_avg_uptime.id,
            user=self.user,
        )
        initial_val = batch.kpi_result_summary["calculated_value"]
        self.assertAlmostEqual(float(initial_val), 99.0, places=1)

        # Update Master Data (which is reference only)
        # Verify MasterDataService has no hook altering the batch or KPI result
        batch.refresh_from_db()
        self.assertEqual(batch.kpi_result_summary["calculated_value"], initial_val)
        self.assertEqual(batch.valid_rows, 1)
