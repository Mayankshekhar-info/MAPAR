"""
Authoritative Reporting Period Resolution & Temporal Filtering Service for MAPAR-v2.
Centralizes date range calculations, frequency modes (Daily, Weekly, Monthly, Quarterly, Yearly, Custom),
ISO-8601 week conventions, and database query filters (inclusive date vs start-inclusive/end-exclusive timestamp).
"""

import datetime
from calendar import monthrange
from typing import Dict, Any, List, Optional, Tuple
from django.utils import timezone
from django.db.models import Q

from apps.dashboard.models import ReportingPeriod
from common.database.transactions import atomic_operation


class PeriodResolutionService:
    # Supported Frequency Types
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"

    @classmethod
    def get_week_bounds(cls, dt: datetime.date) -> Tuple[datetime.date, datetime.date]:
        """
        ISO-8601 week convention: Monday as start of week, Sunday as end.
        """
        start = dt - datetime.timedelta(days=dt.weekday())
        end = start + datetime.timedelta(days=6)
        return start, end

    @classmethod
    def get_month_bounds(cls, year: int, month: int) -> Tuple[datetime.date, datetime.date]:
        """Returns the first and last calendar day of the given month."""
        start = datetime.date(year, month, 1)
        _, last_day = monthrange(year, month)
        end = datetime.date(year, month, last_day)
        return start, end

    @classmethod
    def get_quarter_bounds(cls, year: int, quarter: int) -> Tuple[datetime.date, datetime.date]:
        """Returns start and end dates for Q1, Q2, Q3, or Q4."""
        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2
        start = datetime.date(year, start_month, 1)
        _, last_day = monthrange(year, end_month)
        end = datetime.date(year, end_month, last_day)
        return start, end

    @classmethod
    def get_year_bounds(cls, year: int) -> Tuple[datetime.date, datetime.date]:
        """Returns Jan 1 to Dec 31 of the year."""
        return datetime.date(year, 1, 1), datetime.date(year, 12, 31)

    @classmethod
    def get_active_or_current_period(cls) -> Optional[ReportingPeriod]:
        """Returns the current active reporting period, or the latest recorded period."""
        return (
            ReportingPeriod.objects.filter(is_current=True).first()
            or ReportingPeriod.objects.order_by("-start_date").first()
        )

    @classmethod
    def resolve_period(
        cls,
        period_id: Optional[int] = None,
        period_type: Optional[str] = None,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
        period_name: Optional[str] = None,
    ) -> ReportingPeriod:
        """
        Authoritatively resolves or dynamically creates a canonical ReportingPeriod record.
        Prevents duplicate period records for identical date ranges and frequencies.
        """
        # 1. Direct ID lookup
        if period_id:
            period = ReportingPeriod.objects.filter(id=period_id).first()
            if period:
                return period

        # 2. Parse dates if provided as strings
        parsed_start = None
        parsed_end = None

        if isinstance(start_date, str):
            parsed_start = datetime.date.fromisoformat(start_date.strip())
        elif isinstance(start_date, datetime.date):
            parsed_start = start_date

        if isinstance(end_date, str):
            parsed_end = datetime.date.fromisoformat(end_date.strip())
        elif isinstance(end_date, datetime.date):
            parsed_end = end_date

        # 3. Fallback to current period if no range provided
        if not parsed_start or not parsed_end:
            curr = cls.get_active_or_current_period()
            if curr:
                return curr
            today = timezone.localdate()
            parsed_start, parsed_end = cls.get_month_bounds(today.year, today.month)
            period_type = cls.MONTHLY

        # Validate range
        if parsed_end < parsed_start:
            raise ValueError(f"Invalid date range: end_date ({parsed_end}) cannot be earlier than start_date ({parsed_start}).")

        # 4. Check for existing period matching exact start_date and end_date
        freq = (period_type or cls.CUSTOM).upper()
        existing = ReportingPeriod.objects.filter(start_date=parsed_start, end_date=parsed_end).first()
        if existing:
            return existing

        # 5. Determine canonical display name
        if not period_name:
            if freq == cls.DAILY or parsed_start == parsed_end:
                period_name = parsed_start.isoformat()
                freq = cls.DAILY
            elif freq == cls.WEEKLY:
                week_num = parsed_start.isocalendar()[1]
                period_name = f"Week {week_num} ({parsed_start.strftime('%d %b')} - {parsed_end.strftime('%d %b %Y')})"
            elif freq == cls.MONTHLY:
                period_name = parsed_start.strftime("%b-%y MTD")
            elif freq == cls.QUARTERLY:
                q_num = (parsed_start.month - 1) // 3 + 1
                period_name = f"Q{q_num}-{parsed_start.strftime('%y')}"
            elif freq == cls.YEARLY:
                period_name = f"FY-{parsed_start.year}"
            else:
                period_name = f"Custom ({parsed_start.isoformat()} to {parsed_end.isoformat()})"

        # Ensure name uniqueness
        unique_name = period_name
        counter = 1
        while ReportingPeriod.objects.filter(name=unique_name).exists():
            unique_name = f"{period_name} ({counter})"
            counter += 1

        with atomic_operation():
            period = ReportingPeriod.objects.create(
                name=unique_name,
                period_type=freq,
                start_date=parsed_start,
                end_date=parsed_end,
                is_current=False,
                is_frozen=False,
            )

        return period

    @classmethod
    def build_date_filter_query(
        cls,
        field_name: str,
        start_date: datetime.date,
        end_date: datetime.date,
        is_timestamp: bool = False,
    ) -> Q:
        """
        Builds precise Django ORM date filtering query.
        - For DateField: inclusive range [start_date, end_date]
        - For DateTimeField: [start_date 00:00:00, end_date + 1 day 00:00:00)
          avoiding off-by-one errors and preserving timestamp records on the end date.
        """
        if is_timestamp:
            start_dt = timezone.make_aware(
                datetime.datetime.combine(start_date, datetime.time.min)
            )
            # End-exclusive boundary: start of next day
            next_day = end_date + datetime.timedelta(days=1)
            end_dt = timezone.make_aware(
                datetime.datetime.combine(next_day, datetime.time.min)
            )
            return Q(**{f"{field_name}__gte": start_dt, f"{field_name}__lt": end_dt})
        else:
            return Q(**{f"{field_name}__gte": start_date, f"{field_name}__lte": end_date})
