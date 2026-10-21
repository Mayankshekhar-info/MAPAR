import pytest
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient
from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.kpi.models import (
    KPIDefinition,
    KPICalculatedOutput,
    KPICalculationResult,
)
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator
from apps.kpi.services.formula_calculation_service import KPIFormulaCalculationService
from apps.kpi.services.kpi_engine_service import KPIEngineService
from django.contrib.auth import get_user_model
User = get_user_model()


@pytest.fixture
def org_hierarchy(db):
    company = MainCompany.objects.create(name="Telecom Corp", code="TELCO")
    sub = SubCompany.objects.create(main_company=company, name="Circle South", code="CS")
    project = Project.objects.create(sub_company=sub, name="Project Alpha", code="PA")
    circle = Circle.objects.create(project=project, name="Chennai", code="CHN")
    domain, _ = Domain.objects.get_or_create(name="Operations", defaults={"code": "OPS"})
    period = ReportingPeriod.objects.create(
        name="2026-10 Daily",
        period_type="DAILY",
        start_date="2026-10-01",
        end_date="2026-10-31",
        is_current=True,
    )
    return {
        "company": company,
        "sub": sub,
        "project": project,
        "circle": circle,
        "domain": domain,
        "period": period,
    }


@pytest.fixture
def uptime_template_and_batch(db, org_hierarchy):
    circle = org_hierarchy["circle"]
    period = org_hierarchy["period"]

    template = UploadTemplate.objects.create(
        name="Daily Site Availability",
        code="DAILY_AVAIL",
        data_level="CIRCLE",
        target_entity="KPI_VALUES",
    )
    version = UploadTemplateVersion.objects.create(
        template=template,
        version_number=1,
        is_active=True,
    )
    UploadTemplateColumn.objects.create(
        version=version,
        name="Site_ID",
        display_label="Site ID",
        data_type="TEXT",
    )
    UploadTemplateColumn.objects.create(
        version=version,
        name="Downtime",
        display_label="Downtime",
        data_type="DECIMAL",
    )

    batch = ImportBatch.objects.create(
        template_version=version,
        circle=circle,
        reporting_period=period,
        batch_id="BATCH-20261021-001",
        original_filename="daily_downtime_oct21.xlsx",
        status=ImportBatch.Status.COMPLETED,
        total_rows=3,
        valid_rows=3,
    )

    row1 = ImportStagedRow.objects.create(
        batch=batch,
        row_index=1,
        raw_data={"Site_ID": "SITE_A", "Downtime": "22"},
        is_valid=True,
    )
    row2 = ImportStagedRow.objects.create(
        batch=batch,
        row_index=2,
        raw_data={"Site_ID": "SITE_B", "Downtime": "0"},
        is_valid=True,
    )
    row3 = ImportStagedRow.objects.create(
        batch=batch,
        row_index=3,
        raw_data={"Site_ID": "SITE_C", "Downtime": "144"},
        is_valid=True,
    )

    return {
        "template": template,
        "version": version,
        "batch": batch,
        "rows": [row1, row2, row3],
    }


@pytest.mark.django_db
class TestSafeFormulaEvaluatorEnhancements:
    def test_case_insensitive_functions(self):
        context = {"downtime": Decimal("22"), "total_time": Decimal("1440")}
        # ROUND uppercase
        expr = "ROUND(((total_time - downtime) / total_time) * 100, 2)"
        res = SafeFormulaEvaluator.evaluate(expr, context)
        assert res == Decimal("98.47")

        # ABS and MIN uppercase
        assert SafeFormulaEvaluator.evaluate("ABS(-5.5)", {}) == Decimal("5.5")
        assert SafeFormulaEvaluator.evaluate("MIN(10, 20)", {}) == Decimal("10")
        assert SafeFormulaEvaluator.evaluate("MAX(10, 20)", {}) == Decimal("20")

    def test_bracketed_column_names(self):
        context = {"Downtime": Decimal("22"), "Total_Time": Decimal("1440")}
        expr = "(([Total_Time] - [Downtime]) / [Total_Time]) * 100"
        res = SafeFormulaEvaluator.evaluate(expr, context)
        # 1418 / 1440 * 100 = 98.4722...
        rounded = res.quantize(Decimal("1.00"))
        assert rounded == Decimal("98.47")


@pytest.mark.django_db
class TestKPIFormulaCalculationService:
    def test_validate_formula_against_template_columns(self, uptime_template_and_batch):
        template = uptime_template_and_batch["template"]
        available_cols = ["Site_ID", "Downtime"]

        # Valid expression using column and constant
        res = KPIFormulaCalculationService.validate_formula(
            formula="((Total_Time - Downtime) / Total_Time) * 100",
            available_columns=available_cols,
            constants={"Total_Time": 1440},
        )
        assert res["is_valid"] is True
        assert "Downtime" in res["referenced_columns"]

        # Invalid column reference
        res_bad = KPIFormulaCalculationService.validate_formula(
            formula="NonExistentColumn * 100",
            available_columns=available_cols,
            constants={"Total_Time": 1440},
        )
        assert res_bad["is_valid"] is False
        assert "NonExistentColumn" in res_bad["error"]

    def test_evaluate_row_uptime_example(self, uptime_template_and_batch):
        row = uptime_template_and_batch["rows"][0]  # Downtime = 22
        calc_val, status_code, err = KPIFormulaCalculationService.evaluate_row(
            row=row,
            formula="((Total_Time - Downtime) / Total_Time) * 100",
            input_column="Downtime",
            constants={"Total_Time": 1440},
            decimal_precision=2,
        )
        assert status_code == "SUCCESS"
        assert calc_val == Decimal("98.47")
        assert err is None

    def test_evaluate_row_data_quality_rejections(self, uptime_template_and_batch):
        batch = uptime_template_and_batch["batch"]

        # 1. Negative downtime
        neg_row = ImportStagedRow.objects.create(
            batch=batch,
            row_index=99,
            raw_data={"Site_ID": "SITE_X", "Downtime": "-10"},
            is_valid=True,
        )
        calc_val, status_code, err = KPIFormulaCalculationService.evaluate_row(
            row=neg_row,
            formula="((Total_Time - Downtime) / Total_Time) * 100",
            input_column="Downtime",
            constants={"Total_Time": 1440},
        )
        assert status_code == "INVALID_INPUT"
        assert "cannot be negative" in err.lower()

        # 2. Downtime > configured period
        exceed_row = ImportStagedRow.objects.create(
            batch=batch,
            row_index=100,
            raw_data={"Site_ID": "SITE_Y", "Downtime": "1500"},
            is_valid=True,
        )
        calc_val, status_code, err = KPIFormulaCalculationService.evaluate_row(
            row=exceed_row,
            formula="((Total_Time - Downtime) / Total_Time) * 100",
            input_column="Downtime",
            constants={"Total_Time": 1440},
        )
        assert status_code == "INVALID_INPUT"
        assert "exceeds" in err.lower()

        # 3. Missing / blank column
        blank_row = ImportStagedRow.objects.create(
            batch=batch,
            row_index=101,
            raw_data={"Site_ID": "SITE_Z", "Downtime": ""},
            is_valid=True,
        )
        calc_val, status_code, err = KPIFormulaCalculationService.evaluate_row(
            row=blank_row,
            formula="((Total_Time - Downtime) / Total_Time) * 100",
            input_column="Downtime",
            constants={"Total_Time": 1440},
        )
        assert status_code == "PENDING_DATA"
        assert "missing or blank" in err.lower()

        # 4. Division by zero
        zero_row = ImportStagedRow.objects.create(
            batch=batch,
            row_index=102,
            raw_data={"Site_ID": "SITE_W", "Downtime": "22"},
            is_valid=True,
        )
        calc_val, status_code, err = KPIFormulaCalculationService.evaluate_row(
            row=zero_row,
            formula="Downtime / 0",
            input_column="Downtime",
        )
        assert status_code == "DIV_ZERO"
        assert "Division by zero" in err

    def test_process_batch_and_non_destructive_enrichment(self, org_hierarchy, uptime_template_and_batch):
        circle = org_hierarchy["circle"]
        period = org_hierarchy["period"]
        domain = org_hierarchy["domain"]
        batch = uptime_template_and_batch["batch"]
        template = uptime_template_and_batch["template"]

        formula_rule = {
            "id": "rule_uptime",
            "achieved_data_column": "Uptime",
            "standard_value": 98.80,
            "performance_direction": "HIGHER_BETTER",
            "unit": "%",
            "formula_expression": "((Total_Time - Downtime) / Total_Time) * 100",
            "formula_name": "Daily Uptime Calculation",
            "input_column": "Downtime",
            "input_unit": "Minutes",
            "output_column_name": "Uptime",
            "output_unit": "%",
            "decimal_precision": 2,
            "constants": {"Total_Time": 1440},
        }

        # Create KPI with dynamic formula configuration in presentation_config
        kpi = KPIDefinition.objects.create(
            code="KPI_UPTIME_DAILY",
            name="Daily Site Uptime",
            domain=domain,
            source_dataset=template,
            hierarchy_level="CIRCLE",
            unit="%",
            target_value=Decimal("98.80"),
            direction=KPIDefinition.Direction.HIGHER_BETTER,
            calculation_type=KPIDefinition.CalculationType.FORMULA,
            aggregation_method=KPIDefinition.AggregationMethod.AVG,
            presentation_config={
                "comparison_items": [
                    {
                        "id": "comp_1",
                        "name": "Site Availability Target",
                        "target_value": 98.80,
                        "performance_direction": "HIGHER_BETTER",
                        "unit": "%",
                        "rules": [formula_rule],
                        "data_source": {
                            "dataset_id": template.id,
                            "dataset_name": template.name,
                            "metric_field": "Uptime",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            is_active=True,
        )

        # Execute formula calculation across batch
        res = KPIFormulaCalculationService.process_batch(
            kpi=kpi,
            batch=batch,
            formula_config=formula_rule,
        )

        assert res["success"] is True
        assert res["calculated_rows"] == 3
        assert res["calculated_value"] is not None

        # Verify KPICalculatedOutput persistence
        outputs = list(KPICalculatedOutput.objects.filter(kpi=kpi, batch=batch).order_by("staged_row__row_index"))
        assert len(outputs) == 3
        assert outputs[0].calculated_value == Decimal("98.47")
        assert outputs[0].output_column_name == "Uptime"
        assert outputs[0].output_unit == "%"
        assert outputs[0].status == "SUCCESS"

        # Verify raw data in ImportStagedRow was NOT mutated (preserved intact)
        staged_rows = list(uptime_template_and_batch["rows"])
        row1 = ImportStagedRow.objects.get(id=staged_rows[0].id)
        assert row1.raw_data == {"Site_ID": "SITE_A", "Downtime": "22"}

        # Verify merge_calculated_columns_into_rows
        enriched = KPIFormulaCalculationService.merge_calculated_columns_into_rows(staged_rows, kpi=kpi)
        assert len(enriched) == 3
        assert enriched[0]["Site_ID"] == "SITE_A"
        assert enriched[0]["Downtime"] == "22"
        assert enriched[0]["Uptime"] == 98.47
        assert enriched[0]["Uptime (%)"] == 98.47

    def test_kpi_engine_target_comparison(self, org_hierarchy, uptime_template_and_batch):
        circle = org_hierarchy["circle"]
        period = org_hierarchy["period"]
        domain = org_hierarchy["domain"]
        batch = uptime_template_and_batch["batch"]
        template = uptime_template_and_batch["template"]

        formula_rule = {
            "id": "rule_uptime",
            "achieved_data_column": "Uptime",
            "standard_value": 98.80,
            "performance_direction": "HIGHER_BETTER",
            "unit": "%",
            "formula_expression": "((Total_Time - Downtime) / Total_Time) * 100",
            "input_column": "Downtime",
            "input_unit": "Minutes",
            "output_column_name": "Uptime",
            "output_unit": "%",
            "decimal_precision": 2,
            "constants": {"Total_Time": 1440},
        }

        kpi = KPIDefinition.objects.create(
            code="KPI_UPTIME_ENGINE",
            name="Daily Site Uptime Engine Test",
            domain=domain,
            source_dataset=template,
            hierarchy_level="CIRCLE",
            unit="%",
            target_value=Decimal("98.80"),
            direction=KPIDefinition.Direction.HIGHER_BETTER,
            calculation_type=KPIDefinition.CalculationType.FORMULA,
            presentation_config={
                "comparison_items": [
                    {
                        "id": "comp_1",
                        "name": "Site Availability Target",
                        "target_value": 98.80,
                        "performance_direction": "HIGHER_BETTER",
                        "unit": "%",
                        "rules": [formula_rule],
                        "data_source": {
                            "dataset_id": template.id,
                            "dataset_name": template.name,
                            "metric_field": "Uptime",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            is_active=True,
        )

        # Run KPI engine evaluation
        result = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=period,
            hierarchy_level="CIRCLE",
            hierarchy_id=circle.id,
        )

        assert result["calculated_value"] is not None
        # Calculated ~96.16% vs Target 98.80% (Higher is Better) -> Below Target
        assert float(result["target_value"]) == 98.80
        assert float(result["calculated_value"]) < float(result["target_value"])

        # Check comparison rule breakdown in lineage
        comp_summary = result.get("lineage_metadata", {}).get("comparisons_summary", [])
        assert len(comp_summary) == 1
        rule_eval = comp_summary[0]["rules"][0]
        assert rule_eval["performance_status"] == "BELOW_TARGET"
        assert rule_eval["formula_expression"] == "((Total_Time - Downtime) / Total_Time) * 100"



@pytest.mark.django_db
class TestKPIPreviewFormulaAPI:
    def test_preview_formula_endpoint(self, org_hierarchy, uptime_template_and_batch):
        user = User.objects.create_user(
            username="kpi_analyst",
            email="analyst@example.com",
            password="securePassword123!",
            is_active=True,
        )
        template = uptime_template_and_batch["template"]

        client = APIClient()
        client.force_authenticate(user=user)

        payload = {
            "dataset_id": template.id,
            "formula": "((Total_Time - Downtime) / Total_Time) * 100",
            "input_column": "Downtime",
            "constants": {"Total_Time": 1440},
            "decimal_precision": 2,
            "input_unit": "Minutes",
            "output_unit": "%",
            "limit": 3,
        }

        response = client.post("/api/v1/kpi/preview-formula/", payload, format="json")
        assert response.status_code == 200
        data = response.json()

        assert data["is_valid"] is True
        assert data["has_actual_data"] is True
        assert len(data["samples"]) == 3
        # First row: Downtime = 22 -> Calculated 98.47%
        assert data["samples"][0]["inputs"]["Downtime"] == "22"
        assert data["samples"][0]["calculated_value"] == 98.47
        assert data["samples"][0]["status"] == "SUCCESS"
        assert "Total_Time = 1440" in data["explanation"]
