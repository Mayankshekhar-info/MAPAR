import datetime
import pytest
from apps.dashboard.models import ReportingPeriod
from apps.reporting.services.period_resolution_service import PeriodResolutionService


@pytest.mark.django_db
class TestPeriodResolutionService:
    def test_week_bounds_iso8601(self):
        # 2026-10-14 is a Wednesday -> Week should start on Monday 2026-10-12, end Sunday 2026-10-18
        wednesday = datetime.date(2026, 10, 14)
        start, end = PeriodResolutionService.get_week_bounds(wednesday)
        assert start == datetime.date(2026, 10, 12)
        assert end == datetime.date(2026, 10, 18)
        assert start.weekday() == 0  # Monday
        assert end.weekday() == 6    # Sunday

    def test_month_bounds_leap_year(self):
        # Feb 2024 (Leap year)
        start, end = PeriodResolutionService.get_month_bounds(2024, 2)
        assert start == datetime.date(2024, 2, 1)
        assert end == datetime.date(2024, 2, 29)

        # Feb 2025 (Non-leap year)
        start_25, end_25 = PeriodResolutionService.get_month_bounds(2025, 2)
        assert end_25 == datetime.date(2025, 2, 28)

    def test_quarter_bounds(self):
        # Q1: Jan 1 - Mar 31
        start, end = PeriodResolutionService.get_quarter_bounds(2026, 1)
        assert start == datetime.date(2026, 1, 1)
        assert end == datetime.date(2026, 3, 31)

        # Q3: Jul 1 - Sep 30
        start_q3, end_q3 = PeriodResolutionService.get_quarter_bounds(2026, 3)
        assert start_q3 == datetime.date(2026, 7, 1)
        assert end_q3 == datetime.date(2026, 9, 30)

    def test_resolve_period_without_duplicates(self):
        start = datetime.date(2026, 11, 1)
        end = datetime.date(2026, 11, 30)

        # First resolution creates the period
        period1 = PeriodResolutionService.resolve_period(
            period_type=PeriodResolutionService.MONTHLY,
            start_date=start,
            end_date=end,
        )
        assert period1.id is not None
        assert period1.start_date == start
        assert period1.end_date == end

        # Second resolution with exact same range returns existing period
        period2 = PeriodResolutionService.resolve_period(
            period_type=PeriodResolutionService.MONTHLY,
            start_date=start,
            end_date=end,
        )
        assert period1.id == period2.id

    def test_invalid_date_range_rejection(self):
        start = datetime.date(2026, 10, 20)
        end = datetime.date(2026, 10, 10)  # Earlier than start

        with pytest.raises(ValueError, match="cannot be earlier than start_date"):
            PeriodResolutionService.resolve_period(
                period_type=PeriodResolutionService.CUSTOM,
                start_date=start,
                end_date=end,
            )

    def test_timestamp_boundary_filtering(self):
        start = datetime.date(2026, 10, 1)
        end = datetime.date(2026, 10, 5)

        q_ts = PeriodResolutionService.build_date_filter_query("created_at", start, end, is_timestamp=True)
        # Should filter created_at__gte and created_at__lt (end-exclusive next day)
        children = q_ts.children
        keys = [c[0] for c in children]
        assert "created_at__gte" in keys
        assert "created_at__lt" in keys

        q_date = PeriodResolutionService.build_date_filter_query("record_date", start, end, is_timestamp=False)
        keys_date = [c[0] for c in q_date.children]
        assert "record_date__gte" in keys_date
        assert "record_date__lte" in keys_date
