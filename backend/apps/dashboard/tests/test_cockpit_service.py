from django.test import TestCase
from apps.dashboard.services.cockpit_service import CockpitService
from apps.organization.models import Circle


class CockpitServiceTests(TestCase):

    def test_cockpit_master_summary(self):
        summary = CockpitService.get_master_summary()
        self.assertIn("rows", summary)
        self.assertIn("period", summary)
        self.assertIn("metrics_summary", summary)
        self.assertGreater(summary["total_records"], 0)
        # Check that subtotal rows exist
        subtotals = [r for r in summary["rows"] if r["is_subtotal"]]
        self.assertGreaterEqual(len(subtotals), 1)
        # Check grand total
        grand_totals = [r for r in summary["rows"] if r["is_grand_total"]]
        self.assertEqual(len(grand_totals), 1)

    def test_cockpit_detail_breakdown(self):
        circle = Circle.objects.first()
        self.assertIsNotNone(circle)
        detail = CockpitService.get_detail_breakdown(circle_id=circle.id)
        self.assertIn("records", detail)
        self.assertIn("context", detail)
        self.assertIn("observations", detail)
        self.assertIn("actions", detail)
        if detail["records"]:
            rec = detail["records"][0]
            self.assertIn("rules", rec)
            self.assertIn("comparisons", rec)

    def test_dynamic_metrics_summary_fields(self):
        summary = CockpitService.get_master_summary()
        ms = summary["metrics_summary"]
        self.assertIn("total_comparisons", ms)
        self.assertIn("rules_met", ms)
        self.assertIn("rules_not_met", ms)
        self.assertIn("rules_pending_data", ms)
        self.assertIn("rules_config_issue", ms)
        self.assertIn("has_data", ms)

    def test_record_detail_with_multi_rule_comparisons(self):
        from apps.dashboard.models import KPIValue
        kv = KPIValue.objects.first()
        if kv:
            detail = CockpitService.get_record_detail(kpi_value_id=kv.id)
            self.assertIsNotNone(detail)
            assert detail is not None
            self.assertIn("comparisons", detail)
            self.assertIn("staged_records", detail)
            self.assertIn("staged_columns", detail)

    def test_slide_table_service_staged_records(self):
        from apps.dashboard.services.slide_table_service import SlideTableService
        from apps.dashboard.models import KPIValue
        kv = KPIValue.objects.first()
        if kv:
            detail = SlideTableService.get_record_detail(record_id=kv.id)
            self.assertIsNotNone(detail)
            assert detail is not None
            self.assertIn("comparisons", detail)
            self.assertIn("staged_records", detail)
            self.assertIn("staged_columns", detail)

    def test_cockpit_export_csv(self):
        csv_str = CockpitService.export_csv()
        self.assertIn("Circle,Region,Domain,KPI Code,KPI Name", csv_str)
