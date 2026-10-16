import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organization.models import Circle, Domain
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.kpi.models import KPIDefinition, KPIFilter, KPIParameter
from apps.kpi.services.kpi_logic_parser import KPILogicParser, KPILogicParseError
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.kpi.services.kpi_definition_service import KPIDefinitionService

User = get_user_model()


@pytest.fixture
def kpi_test_data(db):
    user = User.objects.create_user(username="testuser", password="password123", email="test@example.com")
    admin = User.objects.create_superuser(username="adminuser", password="password123", email="admin@example.com")
    
    circle_dl, _ = Circle.objects.get_or_create(code="DL", defaults={"name": "Delhi Circle"})
    circle_mum, _ = Circle.objects.get_or_create(code="MUM", defaults={"name": "Mumbai Circle"})
    domain, _ = Domain.objects.get_or_create(code="OPS", defaults={"name": "Operations"})
    
    period, _ = ReportingPeriod.objects.get_or_create(
        name="Oct 2026",
        defaults={"is_current": True, "start_date": "2026-10-01", "end_date": "2026-10-31"}
    )
    
    template = UploadTemplate.objects.create(
        code="OPS_DATA",
        name="Operations Site Dataset",
        status=UploadTemplate.Status.ACTIVE,
    )
    version = UploadTemplateVersion.objects.create(
        template=template,
        version_number=1,
        is_active=True,
    )
    UploadTemplateColumn.objects.create(version=version, name="Circle", display_label="Circle", data_type="TEXT", column_order=1)
    UploadTemplateColumn.objects.create(version=version, name="Department", display_label="Department", data_type="TEXT", column_order=2)
    UploadTemplateColumn.objects.create(version=version, name="Status", display_label="Status", data_type="TEXT", column_order=3)
    UploadTemplateColumn.objects.create(version=version, name="Sites_Up", display_label="Sites Up", data_type="DECIMAL", column_order=4)
    UploadTemplateColumn.objects.create(version=version, name="Total_Sites", display_label="Total Sites", data_type="DECIMAL", column_order=5)
    UploadTemplateColumn.objects.create(version=version, name="Amount", display_label="Amount", data_type="DECIMAL", column_order=6)

    batch = ImportBatch.objects.create(
        batch_id="BATCH-TEST-LOGIC-001",
        template_version=version,
        uploaded_by=user,
        reporting_period=period,
        status=ImportBatch.Status.COMPLETED,
        total_rows=4,
        valid_rows=4,
    )

    # Row 1: DL, Operations, Open, 95 sites up, 100 total sites, 15000 amount
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=1,
        is_valid=True,
        is_imported=True,
        raw_data={
            "Circle": "DL",
            "Department": "Operations",
            "Status": "Open",
            "Sites_Up": 95,
            "Total_Sites": 100,
            "Amount": 15000,
        },
    )

    # Row 2: DL, Operations, Closed, 80 sites up, 100 total sites, 5000 amount
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=2,
        is_valid=True,
        is_imported=True,
        raw_data={
            "Circle": "DL",
            "Department": "Operations",
            "Status": "Closed",
            "Sites_Up": 80,
            "Total_Sites": 100,
            "Amount": 5000,
        },
    )

    # Row 3: DL, IT, Open, 90 sites up, 100 total sites, 20000 amount
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=3,
        is_valid=True,
        is_imported=True,
        raw_data={
            "Circle": "DL",
            "Department": "IT",
            "Status": "Open",
            "Sites_Up": 90,
            "Total_Sites": 100,
            "Amount": 20000,
        },
    )

    # Row 4: MUM, Operations, Open, 99 sites up, 100 total sites, 12000 amount
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=4,
        is_valid=True,
        is_imported=True,
        raw_data={
            "Circle": "MUM",
            "Department": "Operations",
            "Status": "Open",
            "Sites_Up": 99,
            "Total_Sites": 100,
            "Amount": 12000,
        },
    )

    return {
        "user": user,
        "admin": admin,
        "circle_dl": circle_dl,
        "circle_mum": circle_mum,
        "domain": domain,
        "period": period,
        "template": template,
        "batch": batch,
    }


@pytest.mark.django_db
class TestKPILogicParser:
    def test_parse_human_readable_filter_and_calculate(self):
        expr = """
        FILTER records WHERE
            [Department] = "Operations"
            AND [Status] = "Open"
            AND [Amount] > 10000
        CALCULATE:
            SUM([Amount])
        """
        cols = ["Circle", "Department", "Status", "Sites_Up", "Total_Sites", "Amount"]
        res = KPILogicParser.parse_logic_expression(expr, available_columns=cols)

        assert len(res["filters"]) == 3
        assert res["filters"][0]["field_name"].lower() == "department"
        assert res["filters"][0]["operator"] in ["=", "EQUALS"]
        assert res["filters"][0]["value"] == "Operations"
        assert res["filters"][0]["conjunction"] == "AND"

        assert res["filters"][1]["field_name"].lower() == "status"
        assert res["filters"][1]["operator"] in ["=", "EQUALS"]
        assert res["filters"][1]["value"] == "Open"
        assert res["filters"][1]["conjunction"] == "AND"

        assert res["filters"][2]["field_name"].lower() == "amount"
        assert res["filters"][2]["operator"] in [">", "GREATER_THAN"]
        assert res["filters"][2]["value"] == "10000"

        # Parameters extracted
        assert len(res["parameters"]) == 1
        param = res["parameters"][0]
        assert param["source_column"].lower() == "amount"
        assert param["aggregation"] == "SUM"
        assert param["name"] in res["formula_expression"]

    def test_parse_ratio_formula_with_aggregations(self):
        expr = "CALCULATE (SUM([Sites_Up]) / SUM([Total_Sites])) * 100"
        cols = ["Sites_Up", "Total_Sites"]
        res = KPILogicParser.parse_logic_expression(expr, available_columns=cols)

        assert len(res["parameters"]) == 2
        p_names = [p["name"] for p in res["parameters"]]
        for name in p_names:
            assert name in res["formula_expression"]
        assert "*" in res["formula_expression"]
        assert "/" in res["formula_expression"]

    def test_invalid_column_raises_clear_error(self):
        expr = 'FILTER records WHERE [NonExistentCol] = "Test" CALCULATE COUNT()'
        cols = ["Department", "Amount"]
        with pytest.raises(KPILogicParseError) as exc_info:
            KPILogicParser.parse_logic_expression(expr, available_columns=cols)
        assert "NonExistentCol" in str(exc_info.value)
        assert "Available fields" in str(exc_info.value)

    def test_invalid_syntax_raises_clear_error(self):
        expr = "FILTER records WHERE [Amount] >> 5000 CALCULATE SUM([Amount])"
        with pytest.raises(KPILogicParseError):
            KPILogicParser.parse_logic_expression(expr)

    def test_roundtrip_format_to_readable_expression(self):
        filters = [
            {"field_name": "Department", "operator": "=", "value": "Operations", "conjunction": "AND"},
            {"field_name": "Amount", "operator": ">", "value": "1000", "conjunction": "OR"},
        ]
        formula = "p_sites_up_sum / 10"
        params = [{"name": "p_sites_up_sum", "source_column": "Sites_Up", "aggregation": "SUM"}]
        text = KPILogicParser.format_to_readable_expression(filters, formula, params)
        assert "FILTER records WHERE" in text
        assert '[Department] = "Operations"' in text
        assert 'OR [Amount] > 1000' in text
        assert "SUM([Sites_Up])" in text


@pytest.mark.django_db
class TestAdHocLogicExecution:
    def test_execute_adhoc_logic_filtering_and_calculation(self, kpi_test_data):
        expr = """
        FILTER records WHERE
            [Department] = "Operations"
            AND [Status] = "Open"
            AND [Amount] > 10000
        CALCULATE:
            SUM([Amount])
        """
        res = KPIEngineService.execute_adhoc_logic(
            dataset_id=kpi_test_data["template"].id,
            logic_expression=expr,
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_dl"].id,
            period_id=kpi_test_data["period"].id,
            unit="INR",
            user=kpi_test_data["admin"],
        )
        assert res["success"] is True
        assert res["records_considered"] == 1
        assert res["calculated_value"] == 15000.0
        assert len(res["refined_records_preview"]) == 1
        assert res["refined_records_preview"][0]["Circle"] == "DL"

    def test_execute_adhoc_logic_with_or_condition(self, kpi_test_data):
        # DL rows: Row 1 (Operations, 15000), Row 2 (Operations, 5000), Row 3 (IT, 20000)
        # Filter: Department = "Operations" OR Amount > 18000 -> matches Row 1, Row 2, Row 3 -> all 3 DL rows
        expr = """
        FILTER records WHERE
            [Department] = "Operations"
            OR [Amount] > 18000
        CALCULATE:
            COUNT()
        """
        res = KPIEngineService.execute_adhoc_logic(
            dataset_id=kpi_test_data["template"].id,
            logic_expression=expr,
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_dl"].id,
            period_id=kpi_test_data["period"].id,
            unit="Sites",
            user=kpi_test_data["admin"],
        )
        assert res["success"] is True
        assert res["records_considered"] == 3
        assert res["calculated_value"] == 3.0

    def test_execute_adhoc_logic_mumbai_circle_respects_hierarchy_scope(self, kpi_test_data):
        expr = """
        FILTER records WHERE
            [Department] = "Operations"
        CALCULATE:
            SUM([Amount])
        """
        res = KPIEngineService.execute_adhoc_logic(
            dataset_id=kpi_test_data["template"].id,
            logic_expression=expr,
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_mum"].id,
            period_id=kpi_test_data["period"].id,
            unit="INR",
            user=kpi_test_data["admin"],
        )
        assert res["success"] is True
        assert res["records_considered"] == 1
        assert res["calculated_value"] == 12000.0
        assert res["refined_records_preview"][0]["Circle"] == "MUM"

    def test_execute_adhoc_logic_missing_field_reports_clear_error(self, kpi_test_data):
        expr = 'FILTER records WHERE [NonExistent] = "XYZ" CALCULATE COUNT()'
        res = KPIEngineService.execute_adhoc_logic(
            dataset_id=kpi_test_data["template"].id,
            logic_expression=expr,
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_dl"].id,
            period_id=kpi_test_data["period"].id,
            user=kpi_test_data["admin"],
        )
        assert res["success"] is False
        assert "NonExistent" in res["error"]


@pytest.mark.django_db
class TestKPIDefinitionServiceWithLogicExpression:
    def test_create_and_run_two_independent_kpis(self, kpi_test_data):
        kpi1_data = {
            "code": "KPI_OPS_OPEN_SUM",
            "name": "Operations Open Sites Sum",
            "domain": kpi_test_data["domain"].id,
            "source_dataset": kpi_test_data["template"].id,
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": kpi_test_data["circle_dl"].id,
            "logic_expression": """
            FILTER records WHERE
                [Department] = "Operations"
                AND [Status] = "Open"
            CALCULATE:
                SUM([Sites_Up])
            """,
            "unit": "Sites",
        }
        kpi1 = KPIDefinitionService.create_definition(kpi1_data, user=kpi_test_data["admin"])
        assert kpi1.filters.count() == 2
        assert kpi1.parameters.count() == 1
        assert kpi1.logic_expression != ""

        # KPI 2: Independent IT Amount KPI
        kpi2_data = {
            "code": "KPI_IT_AMOUNT",
            "name": "IT Amount",
            "domain": kpi_test_data["domain"].id,
            "source_dataset": kpi_test_data["template"].id,
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": kpi_test_data["circle_dl"].id,
            "logic_expression": """
            FILTER records WHERE
                [Department] = "IT"
            CALCULATE:
                SUM([Amount])
            """,
            "unit": "INR",
        }
        kpi2 = KPIDefinitionService.create_definition(kpi2_data, user=kpi_test_data["admin"])

        # Execute KPI 1
        res1 = KPIEngineService.calculate_kpi(
            kpi=kpi1,
            period=kpi_test_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_dl"].id,
            user=kpi_test_data["admin"],
        )
        assert res1["calculation_status"] == "SUCCESS"
        assert res1["calculated_value"] == 95.0
        assert res1["records_considered"] == 1

        # Execute KPI 2
        res2 = KPIEngineService.calculate_kpi(
            kpi=kpi2,
            period=kpi_test_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=kpi_test_data["circle_dl"].id,
            user=kpi_test_data["admin"],
        )
        assert res2["calculation_status"] == "SUCCESS"
        assert res2["calculated_value"] == 20000.0
        assert res2["records_considered"] == 1


@pytest.mark.django_db
class TestKPITestLogicAPI:
    def test_api_test_logic_endpoint(self, kpi_test_data):
        client = APIClient()
        client.force_authenticate(user=kpi_test_data["admin"])

        payload = {
            "dataset_id": kpi_test_data["template"].id,
            "logic_expression": """
            FILTER records WHERE
                [Department] = "Operations"
            CALCULATE:
                COUNT()
            """,
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": kpi_test_data["circle_dl"].id,
            "period_id": kpi_test_data["period"].id,
            "unit": "Count",
        }

        response = client.post("/api/v1/kpi/test-logic/", payload, format="json")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["records_considered"] == 2
        assert data["calculated_value"] == 2.0
        assert len(data["refined_records_preview"]) == 2
