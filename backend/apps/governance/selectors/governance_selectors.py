from datetime import timedelta
from typing import Any, Dict, Optional, List
from django.db.models import Count, Q
from django.utils import timezone

from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceTargetRevision,
    GovernanceEvidence,
    GovernanceTargetRevisionRequest,
)
from apps.organization.models import Circle
from apps.identity.models import User


def sort_reporting_weeks_desc(weeks: List[str]) -> List[str]:
    """
    Sorts week identifiers in reverse chronological order (latest first).
    Handles 'Week 43', 'Week 42', '2026-W43', etc.
    """
    import re

    def week_key(w_str: str):
        if not w_str:
            return (0, 0)
        # Extract 4-digit year if present
        y_match = re.search(r"(\d{4})", w_str)
        year = int(y_match.group(1)) if y_match else 2026
        # Extract week number
        w_match = re.search(r"[Ww]eek[-_ ]?(\d+)|[Ww](\d+)|(\d+)", w_str)
        w_num = 0
        if w_match:
            for g in w_match.groups():
                if g:
                    w_num = int(g)
                    break
        return (year, w_num)

    clean_weeks = [w.strip() for w in weeks if w and w.strip()]
    return sorted(list(set(clean_weeks)), key=week_key, reverse=True)


def get_available_reporting_weeks(user: User) -> List[str]:
    """
    Dynamically returns distinct reporting weeks available in the imported data
    and weekly progress updates within the authorized user scope.
    """
    from apps.governance.models import GovernanceActionPoint, GovernanceWeeklyUpdate
    qs = GovernanceActionPoint.objects.all()
    qs = apply_governance_scope(qs, user)

    action_weeks = set(
        qs.exclude(reporting_week="")
        .values_list("reporting_week", flat=True)
        .distinct()
    )

    update_weeks = set(
        GovernanceWeeklyUpdate.objects.filter(action_point__in=qs)
        .exclude(reporting_week="")
        .values_list("reporting_week", flat=True)
        .distinct()
    )

    all_weeks = action_weeks.union(update_weeks)
    # If no recorded weeks exist yet in database, fall back to current calendar week
    if not all_weeks:
        current_cal_week = f"Week {timezone.localdate().isocalendar()[1]}"
        all_weeks.add(current_cal_week)
    return sort_reporting_weeks_desc(list(all_weeks))


def apply_governance_scope(queryset, user):
    """
    Applies role-based and organization-hierarchy scoped access to governance actions.
    - Super Admin / Unrestricted Corporate: View all actions across enterprise.
    - Scoped roles (e.g. CBH, Circle Validator, Data Entry, Viewer): View actions belonging to authorized Circle(s).
    - Action Owner / Creator / Assigner: View actions assigned to them or created/assigned by them.
    """
    if not user or not user.is_authenticated:
        return queryset.none()

    if user.is_superuser or getattr(user, "is_superadmin", False):
        return queryset

    from common.permissions.authorization import AuthorizationService
    scope = AuthorizationService.get_user_hierarchy_scope(user)
    if scope.is_unrestricted:
        return queryset

    user_accessible_q = (
        Q(owner=user)
        | Q(created_by=user)
        | Q(assigned_by=user)
        | Q(assigned_reviewer=user)
        | Q(task_reviews__assigned_reviewer=user)
    )

    role = getattr(user, "role", None)
    if role == User.Role.ACTION_OWNER:
        if scope.circle_ids:
            return queryset.filter(Q(circle_id__in=scope.circle_ids) | user_accessible_q).distinct()
        return queryset.filter(user_accessible_q).distinct()

    if scope.circle_ids is not None:
        return queryset.filter(Q(circle_id__in=scope.circle_ids) | user_accessible_q).distinct()

    user_circle_id = getattr(user, "circle_id", None)
    if user_circle_id:
        return queryset.filter(Q(circle_id=user_circle_id) | user_accessible_q).distinct()

    return queryset.filter(user_accessible_q).distinct()


def get_governance_actions(filters: Dict[str, Any], user: User):
    """
    Retrieves filtered and scoped governance actions.
    Supports view_mode ('all', 'my_tasks', 'assigned_for_review', 'review_submitted',
    'assigned_to_me', 'pending_reviews', 'submitted_reviews', 'evidence_review').
    """
    from apps.governance.models import GovernanceTaskReview
    qs = GovernanceActionPoint.objects.select_related("circle", "owner", "assigned_by", "created_by", "assigned_reviewer").all()
    qs = apply_governance_scope(qs, user)

    # View Mode Filter
    view_mode = filters.get("view_mode")
    if view_mode == "my_tasks":
        qs = qs.filter(owner=user)
    elif view_mode in ["created_by_me", "created_by"]:
        qs = qs.filter(created_by=user)
    elif view_mode == "assigned_for_review":
        qs = qs.filter(
            Q(assigned_reviewer__isnull=False) | Q(task_reviews__isnull=False)
        ).distinct()
    elif view_mode == "review_submitted":
        qs = qs.filter(
            Q(review_workflow_status__in=[
                GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED,
                GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL,
                "Verified",
            ])
            | Q(task_reviews__status__in=[
                GovernanceTaskReview.Status.REVIEW_SUBMITTED,
                GovernanceTaskReview.Status.VERIFIED,
            ])
        ).distinct()
    elif view_mode in ["assigned_to_me", "my_reviews", "assigned_to_me_for_review"]:
        qs = qs.filter(
            Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user)
        ).distinct()
    elif view_mode == "pending_reviews":
        qs = qs.filter(
            (Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user))
            & (
                Q(review_workflow_status__in=[
                    GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED,
                    GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW,
                    GovernanceActionPoint.ReviewWorkflowStatus.NONE,
                    "Pending Review",
                    "In Review",
                ])
                | Q(task_reviews__status__in=[
                    GovernanceTaskReview.Status.PENDING_REVIEW,
                    GovernanceTaskReview.Status.IN_REVIEW,
                    GovernanceTaskReview.Status.SUBMITTED_FOR_REVIEW,
                ])
            )
        ).distinct()
    elif view_mode == "submitted_reviews":
        qs = qs.filter(
            (Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user))
            & (
                Q(review_workflow_status__in=[
                    GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED,
                    GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL,
                    GovernanceActionPoint.ReviewWorkflowStatus.APPROVED,
                    GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED,
                    "Verified",
                ])
                | Q(task_reviews__status__in=[
                    GovernanceTaskReview.Status.REVIEW_SUBMITTED,
                    GovernanceTaskReview.Status.VERIFIED,
                    GovernanceTaskReview.Status.REVIEWED,
                    GovernanceTaskReview.Status.APPROVED,
                    GovernanceTaskReview.Status.REWORK_REQUIRED,
                ])
            )
        ).distinct()
    elif view_mode == "missing_weekly":
        qs = qs.filter(
            status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP]
        ).annotate(updates_count=Count("weekly_updates")).filter(updates_count=0)
    elif view_mode == "evidence_review":
        qs = qs.filter(evidence_status__in=[
            GovernanceActionPoint.EvidenceStatus.PENDING_REVIEW,
            GovernanceActionPoint.EvidenceStatus.REWORK_REQUIRED,
        ])

    reviewer_id = filters.get("reviewer_id")
    if reviewer_id:
        qs = qs.filter(task_reviews__assigned_reviewer_id=reviewer_id).distinct()

    # Hierarchy Level and Node Filter
    hierarchy_level = filters.get("hierarchy_level")
    if hierarchy_level and hierarchy_level != "ALL":
        qs = qs.filter(hierarchy_level=hierarchy_level)

    hierarchy_node_id = filters.get("hierarchy_node_id")
    if hierarchy_node_id:
        qs = qs.filter(hierarchy_node_id=hierarchy_node_id)


    # Search filter (action_id, action_point, deliverable, owner name)
    search = filters.get("search")
    if search:
        search = search.strip()
        qs = qs.filter(
            Q(action_id__icontains=search)
            | Q(action_point__icontains=search)
            | Q(key_deliverable__icontains=search)
            | Q(bucket__icontains=search)
            | Q(owner__first_name__icontains=search)
            | Q(owner__last_name__icontains=search)
            | Q(owner__username__icontains=search)
            | Q(owner_name_override__icontains=search)
            | Q(last_update__icontains=search)
        )

    # Bucket filter (classification bucket)
    bucket = filters.get("bucket")
    if bucket and bucket != "ALL":
        qs = qs.filter(bucket__iexact=bucket)

    # Circle filter
    circle_id = filters.get("circle_id")
    if circle_id:
        qs = qs.filter(circle_id=circle_id)

    # Status filter
    status = filters.get("status")
    if status and status != "ALL":
        qs = qs.filter(status=status)

    # Evidence Status filter
    evidence_status = filters.get("evidence_status")
    if evidence_status and evidence_status != "ALL":
        qs = qs.filter(evidence_status=evidence_status)

    # Priority filter
    priority = filters.get("priority")
    if priority and priority != "ALL":
        qs = qs.filter(priority=priority)

    # Function / Area filter
    function_area = filters.get("function_area")
    if function_area and function_area != "ALL":
        qs = qs.filter(function_area=function_area)

    # Owner filter
    owner_id = filters.get("owner_id")
    if owner_id:
        qs = qs.filter(owner_id=owner_id)
    else:
        owner_name = filters.get("owner_name")
        if owner_name:
            qs = qs.filter(
                Q(owner_name_override__iexact=owner_name)
                | Q(owner__first_name__icontains=owner_name)
                | Q(owner__last_name__icontains=owner_name)
                | Q(owner__username__iexact=owner_name)
            )

    # Escalated filter (workbook rule: active action with ageing > 30 days)
    is_escalated = filters.get("is_escalated")
    if is_escalated is not None:
        if isinstance(is_escalated, str):
            is_escalated = is_escalated.lower() in ("true", "1", "yes")
        today = timezone.localdate()
        d30_ago = today - timedelta(days=30)
        if is_escalated:
            qs = qs.filter(
                status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
                raised_date__lt=d30_ago,
            )
        else:
            qs = qs.filter(
                Q(status=GovernanceActionPoint.Status.CLOSED) | Q(raised_date__gte=d30_ago)
            )

    # Overdue filter (dynamic check: active action with current_target_date < today)
    is_overdue = filters.get("is_overdue")
    if is_overdue is not None:
        if isinstance(is_overdue, str):
            is_overdue = is_overdue.lower() in ("true", "1", "yes")
        today = timezone.localdate()
        if is_overdue:
            qs = qs.filter(
                status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
                current_target_date__lt=today,
            )
        else:
            qs = qs.filter(
                Q(status=GovernanceActionPoint.Status.CLOSED)
                | Q(current_target_date__gte=today)
                | Q(current_target_date__isnull=True)
            )

    # Ageing bucket filter (dynamic against immutable raised_date for active actions)
    ageing_bucket = filters.get("ageing_bucket")
    if ageing_bucket and ageing_bucket != "ALL":
        today = timezone.localdate()
        d7_ago = today - timedelta(days=7)
        d15_ago = today - timedelta(days=15)
        d30_ago = today - timedelta(days=30)
        qs = qs.filter(status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP])
        if ageing_bucket == "0-7 Days":
            qs = qs.filter(raised_date__gte=d7_ago)
        elif ageing_bucket == "8-15 Days":
            qs = qs.filter(raised_date__gte=d15_ago, raised_date__lt=d7_ago)
        elif ageing_bucket == "16-30 Days":
            qs = qs.filter(raised_date__gte=d30_ago, raised_date__lt=d15_ago)
        elif ageing_bucket == "30+ Days":
            qs = qs.filter(raised_date__lt=d30_ago)
        else:
            qs = qs.filter(ageing_bucket=ageing_bucket)

    # Due soon filter (active actions due within next 7 days)
    is_due_soon = filters.get("is_due_soon")
    if is_due_soon is not None:
        if isinstance(is_due_soon, str):
            is_due_soon = is_due_soon.lower() in ("true", "1", "yes")
        if is_due_soon:
            today = timezone.localdate()
            qs = qs.filter(
                status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
                current_target_date__gte=today,
                current_target_date__lte=today + timedelta(days=7),
            )

    # Reporting Week filter (matches action reporting_week or weekly update week)
    reporting_week = filters.get("reporting_week")
    if reporting_week and reporting_week != "ALL":
        from apps.governance.services.governance_excel_service import GovernanceExcelService
        norm_week = GovernanceExcelService.normalize_reporting_week(reporting_week)
        qs = qs.filter(
            Q(reporting_week__iexact=reporting_week)
            | Q(reporting_week__iexact=norm_week)
            | Q(weekly_updates__reporting_week__iexact=reporting_week)
            | Q(weekly_updates__reporting_week__iexact=norm_week)
        ).distinct()

    # Date range filters
    start_date = filters.get("start_date")
    if start_date:
        qs = qs.filter(raised_date__gte=start_date)
    end_date = filters.get("end_date")
    if end_date:
        qs = qs.filter(raised_date__lte=end_date)

    # Ordering
    ordering = filters.get("ordering", "-raised_date")
    allowed_orderings = [
        "raised_date", "-raised_date",
        "current_target_date", "-current_target_date",
        "ageing_days", "-ageing_days",
        "priority", "-priority",
        "status", "-status",
        "evidence_status", "-evidence_status",
        "action_id", "-action_id",
    ]
    if ordering in allowed_orderings:
        qs = qs.order_by(ordering)
    else:
        qs = qs.order_by("-raised_date", "-id")

    return qs


def get_governance_summary_metrics(
    user: User, circle_id: Optional[int] = None, reporting_week: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes dashboard metrics from live database records within authorized scope.
    Includes evidence review status metrics.
    """
    today = timezone.localdate()
    seven_days_later = today + timedelta(days=7)

    available_weeks = get_available_reporting_weeks(user)

    qs = GovernanceActionPoint.objects.all()
    qs = apply_governance_scope(qs, user)

    if circle_id:
        qs = qs.filter(circle_id=circle_id)

    active_week = reporting_week
    if reporting_week and reporting_week != "ALL":
        from apps.governance.services.governance_excel_service import GovernanceExcelService
        norm_week = GovernanceExcelService.normalize_reporting_week(reporting_week)
        active_week = norm_week or reporting_week
        qs = qs.filter(
            Q(reporting_week__iexact=reporting_week)
            | Q(reporting_week__iexact=norm_week)
            | Q(weekly_updates__reporting_week__iexact=reporting_week)
            | Q(weekly_updates__reporting_week__iexact=norm_week)
        ).distinct()
    elif not reporting_week:
        active_week = "All Periods"

    total_actions = qs.count()

    if total_actions == 0:
        return {
            "total_actions": 0,
            "open_count": 0,
            "wip_count": 0,
            "closed_count": 0,
            "overdue_count": 0,
            "high_priority_count": 0,
            "escalated_count": 0,
            "upcoming_count": 0,
            "due_in_3_days_count": 0,
            "no_update_7d_count": 0,
            "on_track_score": 0.0,
            "avg_days_late": 0.0,
            "max_days_late": 0,
            "reporting_week": active_week,
            "available_weeks": available_weeks,
            "as_of_date": today.strftime("%d-%b-%y"),
            "executive_insight": f"{active_week} Management Review: No actions recorded for this reporting period.",
            "overdue_ageing_chart": {
                "not_yet_due": 0,
                "1-3d": 0,
                "4-7d": 0,
                "8-15d": 0,
                "15+d": 0,
            },
            "target_timeline": [],
            "urgent_items": [],
            "completion_rate": 0.0,
            "created_by_me_count": 0,
            "my_assigned_count": 0,
            "missing_weekly_count": 0,
            "assigned_for_review_count": 0,
            "review_submitted_count": 0,
            "assigned_to_me_review_count": 0,
            "pending_reviews_count": 0,
            "submitted_reviews_count": 0,
            "pending_evidence_count": 0,
            "accepted_evidence_count": 0,
            "rework_evidence_count": 0,
            "not_submitted_evidence_count": 0,
            "bucket_counts": {
                "0-7 Days": 0,
                "8-15 Days": 0,
                "16-30 Days": 0,
                "30+ Days": 0,
            },
            "status_counts": {
                "Open": 0,
                "WIP": 0,
                "Closed": 0,
            },
            "evidence_counts": {
                "Not Submitted": 0,
                "Pending Review": 0,
                "Accepted": 0,
                "Rework Required": 0,
            },
            "priority_counts": {
                "High": 0,
                "Medium": 0,
                "Low": 0,
            },
            "circle_distribution": [],
            "owner_distribution": [],
            "my_progress_metrics": {
                "total": 0,
                "open": 0,
                "wip": 0,
                "closed": 0,
                "overdue": 0,
                "upcoming": 0,
                "missing_weekly": 0,
                "completion_rate": 0.0,
                "evidence_pending": 0,
                "evidence_accepted": 0,
                "evidence_rework": 0,
                "evidence_not_submitted": 0,
            },
            "closure_performance": {
                "on_time_closed": 0,
                "delayed_closed": 0,
                "on_time_rate": 0.0,
            },
        }
    open_count = qs.filter(status=GovernanceActionPoint.Status.OPEN).count()
    wip_count = qs.filter(status=GovernanceActionPoint.Status.WIP).count()
    closed_count = qs.filter(status=GovernanceActionPoint.Status.CLOSED).count()

    overdue_count = qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        current_target_date__lt=today,
    ).count()

    high_priority_count = qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        priority=GovernanceActionPoint.Priority.HIGH,
    ).count()

    d30_ago = today - timedelta(days=30)
    d15_ago = today - timedelta(days=15)
    d7_ago = today - timedelta(days=7)

    escalated_count = qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        raised_date__lt=d30_ago,
    ).count()

    upcoming_count = qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        current_target_date__gte=today,
        current_target_date__lte=seven_days_later,
    ).count()

    # Evidence status metrics
    pending_evidence_count = qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.PENDING_REVIEW).count()
    accepted_evidence_count = qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.ACCEPTED).count()
    rework_evidence_count = qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.REWORK_REQUIRED).count()
    not_submitted_evidence_count = qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.NOT_SUBMITTED).count()

    # Ageing buckets breakdown for open/wip items (dynamic against raised_date)
    open_wip_qs = qs.filter(status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP])
    bucket_counts = {
        "0-7 Days": open_wip_qs.filter(raised_date__gte=d7_ago).count(),
        "8-15 Days": open_wip_qs.filter(raised_date__gte=d15_ago, raised_date__lt=d7_ago).count(),
        "16-30 Days": open_wip_qs.filter(raised_date__gte=d30_ago, raised_date__lt=d15_ago).count(),
        "30+ Days": open_wip_qs.filter(raised_date__lt=d30_ago).count(),
    }

    # Status breakdown
    status_counts = {
        "Open": open_count,
        "WIP": wip_count,
        "Closed": closed_count,
    }

    # Evidence breakdown
    evidence_counts = {
        "Not Submitted": not_submitted_evidence_count,
        "Pending Review": pending_evidence_count,
        "Accepted": accepted_evidence_count,
        "Rework Required": rework_evidence_count,
    }

    # Priority breakdown for active items
    priority_counts = {
        "High": open_wip_qs.filter(priority=GovernanceActionPoint.Priority.HIGH).count(),
        "Medium": open_wip_qs.filter(priority=GovernanceActionPoint.Priority.MEDIUM).count(),
        "Low": open_wip_qs.filter(priority=GovernanceActionPoint.Priority.LOW).count(),
    }

    # Creator & Owner counts
    created_by_me_count = qs.filter(created_by=user).count()
    my_assigned_count = qs.filter(owner=user).count()
    missing_weekly_count = (
        open_wip_qs.annotate(updates_count=Count("weekly_updates"))
        .filter(updates_count=0)
        .count()
    )

    from apps.governance.models import GovernanceTaskReview
    assigned_for_review_count = qs.filter(
        Q(assigned_reviewer__isnull=False) | Q(task_reviews__isnull=False)
    ).distinct().count()

    review_submitted_count = qs.filter(
        Q(review_workflow_status__in=[
            GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED,
            GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL,
            "Verified",
        ])
        | Q(task_reviews__status__in=[
            GovernanceTaskReview.Status.REVIEW_SUBMITTED,
            GovernanceTaskReview.Status.VERIFIED,
        ])
    ).distinct().count()

    assigned_to_me_review_count = qs.filter(
        Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user)
    ).distinct().count()

    pending_reviews_count = qs.filter(
        (Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user))
        & (
            Q(review_workflow_status__in=[
                GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED,
                GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW,
                GovernanceActionPoint.ReviewWorkflowStatus.NONE,
                "Pending Review",
                "In Review",
            ])
            | Q(task_reviews__status__in=[
                GovernanceTaskReview.Status.PENDING_REVIEW,
                GovernanceTaskReview.Status.IN_REVIEW,
                GovernanceTaskReview.Status.SUBMITTED_FOR_REVIEW,
            ])
        )
    ).distinct().count()

    submitted_reviews_count = qs.filter(
        (Q(assigned_reviewer=user) | Q(task_reviews__assigned_reviewer=user))
        & (
            Q(review_workflow_status__in=[
                GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED,
                GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL,
                GovernanceActionPoint.ReviewWorkflowStatus.APPROVED,
                GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED,
                "Verified",
            ])
            | Q(task_reviews__status__in=[
                GovernanceTaskReview.Status.REVIEW_SUBMITTED,
                GovernanceTaskReview.Status.VERIFIED,
                GovernanceTaskReview.Status.REVIEWED,
                GovernanceTaskReview.Status.APPROVED,
                GovernanceTaskReview.Status.REWORK_REQUIRED,
            ])
        )
    ).distinct().count()

    # Due in 3 days & No update in 7 days
    three_days_later = today + timedelta(days=3)
    due_in_3_days_count = open_wip_qs.filter(
        current_target_date__gte=today,
        current_target_date__lte=three_days_later,
    ).count()

    seven_days_ago_dt = timezone.now() - timedelta(days=7)
    no_update_7d_count = (
        open_wip_qs.annotate(
            recent_updates=Count("weekly_updates", filter=Q(weekly_updates__submitted_at__gte=seven_days_ago_dt))
        )
        .filter(recent_updates=0)
        .count()
    )

    # Overdue stats (average days late, max days late)
    overdue_actions = list(open_wip_qs.filter(current_target_date__lt=today).values("id", "current_target_date"))
    overdue_days_list = [(today - a["current_target_date"]).days for a in overdue_actions if a.get("current_target_date")]
    avg_days_late = round(sum(overdue_days_list) / len(overdue_days_list), 1) if overdue_days_list else 0.0
    max_days_late = max(overdue_days_list) if overdue_days_list else 0

    # On-track score: (Closed + Open on-track) / Total * 100
    on_track_open_count = open_wip_qs.filter(current_target_date__gte=today).count()
    on_track_score = round(((closed_count + on_track_open_count) / total_actions * 100), 1) if total_actions > 0 else 100.0

    # Overdue ageing exact distribution matching reference chart
    overdue_ageing_chart = {
        "not_yet_due": on_track_open_count,
        "1-3d": open_wip_qs.filter(current_target_date__gte=today - timedelta(days=3), current_target_date__lt=today).count(),
        "4-7d": open_wip_qs.filter(current_target_date__gte=today - timedelta(days=7), current_target_date__lt=today - timedelta(days=3)).count(),
        "8-15d": open_wip_qs.filter(current_target_date__gte=today - timedelta(days=15), current_target_date__lt=today - timedelta(days=7)).count(),
        "15+d": open_wip_qs.filter(current_target_date__lt=today - timedelta(days=15)).count(),
    }

    # Circle-wise distribution with region and completion rate
    circle_distribution_raw = list(
        qs.values("circle__id", "circle__name", "circle__code", "circle__region")
        .annotate(
            total=Count("id"),
            open=Count("id", filter=Q(status=GovernanceActionPoint.Status.OPEN)),
            wip=Count("id", filter=Q(status=GovernanceActionPoint.Status.WIP)),
            closed=Count("id", filter=Q(status=GovernanceActionPoint.Status.CLOSED)),
            overdue=Count(
                "id",
                filter=Q(
                    status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
                    current_target_date__lt=today,
                ),
            ),
            escalated=Count(
                "id",
                filter=Q(
                    status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
                    raised_date__lt=d30_ago,
                ),
            ),
        )
        .order_by("-total")[:25]
    )
    circle_distribution = []
    for cd in circle_distribution_raw:
        tot = cd["total"]
        cd["completion_rate"] = round((cd["closed"] / tot * 100), 1) if tot > 0 else 0.0
        circle_distribution.append(cd)

    # Helper for initials
    def get_initials(name_str: str) -> str:
        parts = [p.strip() for p in name_str.replace("/", " ").replace("-", " ").split() if p.strip()]
        if not parts:
            return "U"
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][0] + parts[-1][0]).upper()

    # Owner-wise workload and progress distribution with reference scorecard fields
    owner_stats: Dict[Any, Dict[str, Any]] = {}
    for act in qs.select_related("owner"):
        if act.owner:
            owner_key = f"u_{act.owner_id}"
            owner_name = f"{act.owner.first_name} {act.owner.last_name}".strip() or act.owner.username
            username = act.owner.username
            user_id = act.owner.id
        elif act.owner_name_override:
            owner_key = f"o_{act.owner_name_override}"
            owner_name = act.owner_name_override
            username = ""
            user_id = None
        else:
            owner_key = "unassigned"
            owner_name = "Unassigned"
            username = ""
            user_id = None

        if owner_key not in owner_stats:
            owner_stats[owner_key] = {
                "owner_id": user_id,
                "owner_name": owner_name,
                "username": username,
                "initials": get_initials(owner_name),
                "total": 0,
                "open": 0,
                "wip": 0,
                "closed": 0,
                "overdue": 0,
                "open_on_track": 0,
                "overdue_under_7d": 0,
                "overdue_over_7d": 0,
                "max_days_late": 0,
                "escalated": 0,
                "evidence_pending": 0,
                "total_progress": 0,
            }

        s = owner_stats[owner_key]
        s["total"] += 1
        if act.status == GovernanceActionPoint.Status.OPEN:
            s["open"] += 1
        elif act.status == GovernanceActionPoint.Status.WIP:
            s["wip"] += 1
        elif act.status == GovernanceActionPoint.Status.CLOSED:
            s["closed"] += 1

        # Check overdue / on-track
        if act.status in [GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP]:
            if act.current_target_date and act.current_target_date < today:
                s["overdue"] += 1
                days_late = (today - act.current_target_date).days
                if days_late > s["max_days_late"]:
                    s["max_days_late"] = days_late
                if days_late <= 7:
                    s["overdue_under_7d"] += 1
                else:
                    s["overdue_over_7d"] += 1
            else:
                s["open_on_track"] += 1

        if act.status in [GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP] and (today - act.raised_date).days > 30:
            s["escalated"] += 1
        if act.evidence_status == GovernanceActionPoint.EvidenceStatus.PENDING_REVIEW:
            s["evidence_pending"] += 1
        s["total_progress"] += (act.current_progress_percent or 0)

    owner_distribution = []
    for s in owner_stats.values():
        s["completion_rate"] = round((s["closed"] / s["total"] * 100), 1) if s["total"] > 0 else 0.0
        s["avg_progress"] = round((s["total_progress"] / s["total"]), 1) if s["total"] > 0 else 0.0
        s["is_on_track"] = (s["overdue"] == 0)
        del s["total_progress"]
        owner_distribution.append(s)

    owner_distribution.sort(key=lambda x: (x["overdue"], x["total"]), reverse=True)

    # Dedicated Owner Progress Dashboard Metrics for current user
    my_qs = qs.filter(owner=user)
    my_total = my_qs.count()
    my_open = my_qs.filter(status=GovernanceActionPoint.Status.OPEN).count()
    my_wip = my_qs.filter(status=GovernanceActionPoint.Status.WIP).count()
    my_closed = my_qs.filter(status=GovernanceActionPoint.Status.CLOSED).count()
    my_overdue = my_qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        current_target_date__lt=today,
    ).count()
    my_upcoming = my_qs.filter(
        status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP],
        current_target_date__gte=today,
        current_target_date__lte=seven_days_later,
    ).count()
    my_missing_weekly = (
        my_qs.filter(status__in=[GovernanceActionPoint.Status.OPEN, GovernanceActionPoint.Status.WIP])
        .annotate(updates_count=Count("weekly_updates"))
        .filter(updates_count=0)
        .count()
    )
    my_evidence_pending = my_qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.PENDING_REVIEW).count()
    my_evidence_accepted = my_qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.ACCEPTED).count()
    my_evidence_rework = my_qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.REWORK_REQUIRED).count()
    my_evidence_not_submitted = my_qs.filter(evidence_status=GovernanceActionPoint.EvidenceStatus.NOT_SUBMITTED).count()
    my_completion_rate = round((my_closed / my_total * 100), 1) if my_total > 0 else 0.0

    my_progress_metrics = {
        "total": my_total,
        "open": my_open,
        "wip": my_wip,
        "closed": my_closed,
        "overdue": my_overdue,
        "upcoming": my_upcoming,
        "missing_weekly": my_missing_weekly,
        "completion_rate": my_completion_rate,
        "evidence_pending": my_evidence_pending,
        "evidence_accepted": my_evidence_accepted,
        "evidence_rework": my_evidence_rework,
        "evidence_not_submitted": my_evidence_not_submitted,
    }

    # Completion Rate and Closure Performance
    overall_completion_rate = round((closed_count / total_actions * 100), 1) if total_actions > 0 else 0.0
    closed_qs = qs.filter(status=GovernanceActionPoint.Status.CLOSED)
    from django.db.models import F
    delayed_closed = closed_qs.filter(
        actual_closure_date__isnull=False,
        current_target_date__isnull=False,
        actual_closure_date__gt=F("current_target_date"),
    ).count()
    on_time_closed = max(0, closed_count - delayed_closed)

    closure_performance = {
        "on_time_closed": on_time_closed,
        "delayed_closed": delayed_closed,
        "on_time_rate": round((on_time_closed / closed_count * 100), 1) if closed_count > 0 else 0.0,
    }

    # Target Timeline Data (Window from 10 days ago to 16 days ahead)
    timeline_start = today - timedelta(days=10)
    timeline_end = today + timedelta(days=16)
    active_actions = list(
        open_wip_qs.filter(current_target_date__isnull=False)
        .select_related("circle", "owner")
        .values("id", "action_id", "action_point", "bucket", "current_target_date", "priority", "status", "circle__name", "owner__first_name", "owner__last_name", "owner__username")
    )

    timeline_points = []
    current_d = timeline_start
    while current_d <= timeline_end:
        d_actions = [
            {
                "id": a["id"],
                "action_id": a["action_id"],
                "title": a["action_point"],
                "bucket": a.get("bucket") or "",
                "owner": f"{a.get('owner__first_name') or ''} {a.get('owner__last_name') or ''}".strip() or a.get("owner__username") or "Unassigned",
                "circle": a.get("circle__name") or "",
                "priority": a["priority"],
            }
            for a in active_actions if a["current_target_date"] == current_d
        ]
        timeline_points.append({
            "date": current_d.strftime("%Y-%m-%d"),
            "label": current_d.strftime("%d %b"),
            "is_overdue": current_d < today,
            "is_today": current_d == today,
            "count": len(d_actions),
            "actions": d_actions,
        })
        current_d += timedelta(days=1)

    # Top Urgent / Actionable Risk Items
    urgent_records = []
    urgent_qs = open_wip_qs.select_related("circle", "owner").order_by("current_target_date")[:8]
    for act in urgent_qs:
        is_ovd = bool(act.current_target_date and act.current_target_date < today)
        days_ovd = (today - act.current_target_date).days if is_ovd and act.current_target_date else 0
        o_name = f"{act.owner.first_name} {act.owner.last_name}".strip() if act.owner else (act.owner_name_override or "Unassigned")
        urgent_records.append({
            "id": act.id,
            "action_id": act.action_id,
            "action_point": act.action_point,
            "bucket": act.bucket or "",
            "owner_name": o_name,
            "circle_name": act.circle.name if act.circle else "",
            "circle_code": act.circle.code if act.circle else "",
            "status": act.status,
            "priority": act.priority,
            "current_target_date": act.current_target_date.strftime("%Y-%m-%d") if act.current_target_date else "",
            "is_overdue": is_ovd,
            "days_overdue": days_ovd,
            "progress_percent": act.current_progress_percent or 0,
            "evidence_status": act.evidence_status,
        })

    # Executive Narrative Insight
    scope_str = "Selected Circle" if circle_id else "Organization"
    if overdue_count > 0:
        executive_insight = (
            f"{active_week} Management Review: {open_count + wip_count} active actions in scope, with {overdue_count} past target "
            f"(averaging {avg_days_late} days late, oldest by {max_days_late} days). {no_update_7d_count} actions have no weekly progress logged in 7 days."
        )
    elif (open_count + wip_count) > 0:
        executive_insight = (
            f"{active_week} Management Review: All {open_count + wip_count} active actions are currently on track. "
            f"{due_in_3_days_count} action(s) due within 3 days."
        )
    else:
        executive_insight = f"{active_week} Management Review: All governance actions in {scope_str} are 100% completed."

    return {
        "total_actions": total_actions,
        "open_count": open_count,
        "wip_count": wip_count,
        "closed_count": closed_count,
        "overdue_count": overdue_count,
        "high_priority_count": high_priority_count,
        "escalated_count": escalated_count,
        "upcoming_count": upcoming_count,
        "due_in_3_days_count": due_in_3_days_count,
        "no_update_7d_count": no_update_7d_count,
        "on_track_score": on_track_score,
        "avg_days_late": avg_days_late,
        "max_days_late": max_days_late,
        "reporting_week": active_week,
        "available_weeks": available_weeks,
        "as_of_date": today.strftime("%d-%b-%y"),
        "executive_insight": executive_insight,
        "overdue_ageing_chart": overdue_ageing_chart,
        "target_timeline": timeline_points,
        "urgent_items": urgent_records,
        "completion_rate": overall_completion_rate,
        "created_by_me_count": created_by_me_count,
        "my_assigned_count": my_assigned_count,
        "missing_weekly_count": missing_weekly_count,
        "assigned_for_review_count": assigned_for_review_count,
        "review_submitted_count": review_submitted_count,
        "assigned_to_me_review_count": assigned_to_me_review_count,
        "pending_reviews_count": pending_reviews_count,
        "submitted_reviews_count": submitted_reviews_count,
        "pending_evidence_count": pending_evidence_count,
        "accepted_evidence_count": accepted_evidence_count,
        "rework_evidence_count": rework_evidence_count,
        "not_submitted_evidence_count": not_submitted_evidence_count,
        "bucket_counts": bucket_counts,
        "status_counts": status_counts,
        "evidence_counts": evidence_counts,
        "priority_counts": priority_counts,
        "circle_distribution": circle_distribution,
        "owner_distribution": owner_distribution,
        "my_progress_metrics": my_progress_metrics,
        "closure_performance": closure_performance,
    }


def get_task_weekly_updates(action_point_id: int, user: User):
    """
    Fetches chronological weekly updates for an action point with scope check.
    """
    qs = GovernanceActionPoint.objects.all()
    qs = apply_governance_scope(qs, user)
    action_point = qs.filter(id=action_point_id).first()
    if not action_point:
        return None

    from apps.governance.models import GovernanceWeeklyUpdate
    return GovernanceWeeklyUpdate.objects.filter(action_point=action_point).select_related("submitted_by").order_by("submitted_at", "id")


def get_task_full_detail(action_point_id: int, user: User) -> Optional[Dict[str, Any]]:
    """
    Retrieves full comprehensive details for dedicated Task Detail Page.
    Includes task metadata, hierarchy path, weekly updates timeline,
    progress trend chart points, target revisions, and evidence gallery.
    """
    qs = GovernanceActionPoint.objects.select_related(
        "circle", "domain", "department", "sub_department",
        "owner", "assigned_by", "created_by"
    ).all()
    qs = apply_governance_scope(qs, user)
    action = qs.filter(id=action_point_id).first()
    if not action:
        return None

    # Weekly updates in chronological sequence
    weekly_updates = list(action.weekly_updates.select_related("submitted_by").order_by("submitted_at", "id"))

    # Progress trend series
    progress_trend = []
    for wu in weekly_updates:
        progress_trend.append({
            "reporting_week": wu.reporting_week,
            "revision_number": wu.revision_number,
            "progress_percent": wu.progress_percent,
            "previous_progress_percent": wu.previous_progress_percent,
            "status": wu.status,
            "submitted_at": wu.submitted_at.isoformat() if wu.submitted_at else None,
        })

    # Target revisions
    revisions = list(action.revisions.select_related("revised_by").order_by("-revision_number"))

    # Evidence items
    evidence_items = list(action.evidence_items.select_related("submitted_by", "reviewed_by").order_by("-version", "-submitted_at"))

    # Dynamic organization hierarchy path
    hierarchy_segments = []
    if action.circle and action.circle.project and action.circle.project.sub_company and action.circle.project.sub_company.main_company:
        hierarchy_segments.append(action.circle.project.sub_company.main_company.name)
        hierarchy_segments.append(action.circle.project.sub_company.name)
        hierarchy_segments.append(action.circle.project.name)
    if action.circle:
        hierarchy_segments.append(action.circle.name)
    if action.domain:
        hierarchy_segments.append(action.domain.name)
    if action.department:
        hierarchy_segments.append(action.department.name)
    if action.sub_department:
        hierarchy_segments.append(action.sub_department.name)

    resolved_path = " → ".join(hierarchy_segments) if hierarchy_segments else (action.hierarchy_path or (action.circle.name if action.circle else ""))

    # Target date revision requests
    revision_requests = list(
        action.revision_requests.select_related("requested_by", "reviewed_by").order_by("-requested_at")
    )

    # Task reviews in reverse chronological order (latest first)
    task_reviews = list(
        action.task_reviews.select_related(
            "assigned_reviewer",
            "requested_by",
            "submitted_by",
            "submitted_for_verification_by",
            "verified_by",
            "approved_by",
        ).order_by("-assigned_at")
    )
    active_review = task_reviews[0] if task_reviews else None

    from apps.governance.services.governance_service import GovernanceService
    from apps.governance.services.governance_evidence_service import GovernanceEvidenceService
    from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService

    can_assign_review = GovernanceTaskReviewService.can_assign_review(action, user)
    can_submit_for_verification = GovernanceTaskReviewService.can_submit_for_verification(action, user)
    can_verify_review = GovernanceTaskReviewService.can_verify_review(action, user)
    can_approve_review = GovernanceTaskReviewService.can_approve_review(action, user)

    # Review submission capability for assigned reviewer
    can_submit_review = bool(
        user.is_superuser
        or getattr(user, "is_superadmin", False)
        or (action.assigned_reviewer_id and action.assigned_reviewer_id == user.id)
        or (active_review and active_review.assigned_reviewer_id and active_review.assigned_reviewer_id == user.id)
    )

    can_close_task = True
    closure_block_reason = None
    try:
        GovernanceTaskReviewService.check_can_close_task(action, user)
    except Exception as exc:
        can_close_task = False
        if hasattr(exc, "message_dict") and "status" in exc.message_dict:
            closure_block_reason = exc.message_dict["status"][0]
        else:
            closure_block_reason = str(exc)

    can_review_revision = GovernanceService.can_review_target_revision(action, user)
    can_request_revision = GovernanceService.can_request_target_revision(action, user)
    can_review_evidence = GovernanceEvidenceService.can_review_evidence(action, user)
    can_edit_task = GovernanceService.can_edit_task(action, user)
    has_pending_revision = any(r.status == GovernanceTargetRevisionRequest.Status.PENDING for r in revision_requests)

    return {
        "action": action,
        "resolved_hierarchy_path": resolved_path,
        "weekly_updates": weekly_updates,
        "progress_trend": progress_trend,
        "revisions": revisions,
        "evidence_items": evidence_items,
        "revision_requests": revision_requests,
        "task_reviews": task_reviews,
        "active_review": active_review,
        "can_edit_task": can_edit_task,
        "can_assign_review": can_assign_review,
        "can_submit_for_verification": can_submit_for_verification,
        "can_verify_review": can_verify_review,
        "can_approve_review": can_approve_review,
        "can_close_task": can_close_task,
        "closure_block_reason": closure_block_reason,
        "can_submit_review": can_submit_review,
        "can_review_revision": can_review_revision,
        "can_request_revision": can_request_revision,
        "can_review_evidence": can_review_evidence,
        "has_pending_revision": has_pending_revision,
    }



def get_eligible_users_for_hierarchy_node(level: Optional[str] = None, node_id: Optional[int] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns eligible users scoped to the selected organization hierarchy level and node,
    with support for searching by User ID, username, email, and full name.
    """
    qs = User.objects.filter(is_active=True).select_related("circle", "sub_department")

    if search:
        search_clean = search.strip()
        search_q = (
            Q(username__icontains=search_clean)
            | Q(email__icontains=search_clean)
            | Q(first_name__icontains=search_clean)
            | Q(last_name__icontains=search_clean)
        )
        if search_clean.isdigit():
            search_q |= Q(id=int(search_clean))
        qs = qs.filter(search_q)
    elif level and node_id:
        level_upper = level.upper()
        if level_upper == "CIRCLE":
            qs = qs.filter(
                Q(circle_id=node_id)
                | Q(access_scopes__circle_id=node_id)
                | Q(access_scopes__assigned_circles__circle_id=node_id)
                | Q(is_superuser=True)
                | Q(role__in=[User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD])
                | Q(circle__isnull=True)
            ).distinct()
        elif level_upper == "SUB_DEPARTMENT":
            qs = qs.filter(sub_department_id=node_id)
        elif level_upper == "DEPARTMENT":
            qs = qs.filter(sub_department__department_id=node_id)
        elif level_upper == "DOMAIN":
            qs = qs.filter(sub_department__department__domain_id=node_id)
        elif level_upper == "PROJECT":
            qs = qs.filter(circle__project_id=node_id)
        elif level_upper == "SUB_COMPANY":
            qs = qs.filter(circle__project__sub_company_id=node_id)
        elif level_upper == "MAIN_COMPANY":
            qs = qs.filter(circle__project__sub_company__main_company_id=node_id)

    users_list = []
    for u in qs.order_by("first_name", "username")[:200]:
        full_name = f"{u.first_name} {u.last_name}".strip()
        users_list.append({
            "id": u.id,
            "username": u.username,
            "full_name": full_name or u.username,
            "email": u.email,
            "role": u.role,
            "circle_id": getattr(u, "circle_id", None),
        })
    return users_list


def get_target_revision_history(action_point_id: int, user: User):
    """
    Fetches target date revision history for an action point with scope check.
    """
    qs = GovernanceActionPoint.objects.all()
    qs = apply_governance_scope(qs, user)
    action_point = qs.filter(id=action_point_id).first()
    if not action_point:
        return None

    return action_point.revisions.select_related("revised_by").order_by("-revision_number")


def get_action_evidence_list(action_point_id: int, user: User):
    """
    Fetches full evidence submission and review history for an action point with scope check.
    """
    qs = GovernanceActionPoint.objects.all()
    qs = apply_governance_scope(qs, user)
    action_point = qs.filter(id=action_point_id).first()
    if not action_point:
        return None

    return action_point.evidence_items.select_related("submitted_by", "reviewed_by").order_by("-version", "-submitted_at")


def get_scoped_evidence_list(user: User, search: Optional[str] = None, status: Optional[str] = None):
    """
    Returns evidence items for action points within the user's authorized governance scope.
    Allows owners to see their own evidence, and reviewers/validators/managers to inspect circle evidence.
    """
    scoped_actions = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
    qs = GovernanceEvidence.objects.filter(
        Q(action_point__in=scoped_actions) | Q(submitted_by=user)
    ).select_related(
        "action_point", "action_point__circle", "submitted_by", "reviewed_by"
    ).order_by("-submitted_at")

    if status and status != "ALL":
        qs = qs.filter(status=status)

    if search:
        search = search.strip()
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(file_name__icontains=search)
            | Q(action_point__action_id__icontains=search)
            | Q(action_point__action_point__icontains=search)
            | Q(submitted_by__username__icontains=search)
            | Q(submitted_by__first_name__icontains=search)
            | Q(submitted_by__last_name__icontains=search)
        )

    return qs


def get_user_evidence_list(user: User, search: Optional[str] = None):
    """
    Compatibility wrapper delegating to scoped evidence retriever.
    """
    return get_scoped_evidence_list(user, search=search)


def get_governance_metadata(user: User):
    """
    Returns available circles, assignable users, and function areas for forms/filters.
    """
    circles = Circle.objects.filter(status=Circle.Status.ACTIVE).values("id", "name", "code", "region").order_by("name")
    users = (
        User.objects.filter(is_active=True)
        .values("id", "username", "first_name", "last_name", "email", "role", "circle_id")
        .order_by("first_name", "username")
    )

    formatted_users = []
    for u in users:
        full_name = f"{u['first_name']} {u['last_name']}".strip()
        formatted_users.append({
            "id": u["id"],
            "username": u["username"],
            "full_name": full_name or u["username"],
            "email": u["email"],
            "role": u["role"],
            "circle_id": u["circle_id"],
        })

    return {
        "circles": list(circles),
        "users": formatted_users,
        "function_areas": [choice[0] for choice in GovernanceActionPoint.FUNCTION_AREA_CHOICES],
        "statuses": [choice[0] for choice in GovernanceActionPoint.Status.choices],
        "priorities": [choice[0] for choice in GovernanceActionPoint.Priority.choices],
        "evidence_statuses": [choice[0] for choice in GovernanceActionPoint.EvidenceStatus.choices],
        "hierarchy_levels": [
            {"code": "MAIN_COMPANY", "label": "Main Company"},
            {"code": "SUB_COMPANY", "label": "Sub Company"},
            {"code": "PROJECT", "label": "Project"},
            {"code": "CIRCLE", "label": "Circle"},
            {"code": "DOMAIN", "label": "Domain"},
            {"code": "DEPARTMENT", "label": "Department"},
            {"code": "SUB_DEPARTMENT", "label": "Sub Department"},
        ],
        "buckets": list(
            GovernanceActionPoint.objects.exclude(bucket="")
            .values_list("bucket", flat=True)
            .distinct()
            .order_by("bucket")
        ),
        "available_weeks": get_available_reporting_weeks(user),
    }


def get_governance_revision_requests(filters: Dict[str, Any], user: User) -> Dict[str, Any]:
    """
    Retrieves revision requests within the user's organization scope.
    Supports filtering by status (Pending, Approved, Rejected), circle_id, and search query.
    Returns total count, pending count, and paginated/listed items.
    """
    scoped_actions = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
    qs = GovernanceTargetRevisionRequest.objects.filter(action_point__in=scoped_actions).select_related(
        "action_point",
        "action_point__circle",
        "action_point__owner",
        "requested_by",
        "reviewed_by",
    )

    pending_count = qs.filter(status=GovernanceTargetRevisionRequest.Status.PENDING).count()

    status_filter = filters.get("status")
    if status_filter and status_filter.upper() != "ALL":
        qs = qs.filter(status=status_filter.capitalize())

    circle_id = filters.get("circle_id")
    if circle_id:
        qs = qs.filter(action_point__circle_id=circle_id)

    search = filters.get("search")
    if search:
        search = search.strip()
        qs = qs.filter(
            Q(action_point__action_id__icontains=search)
            | Q(action_point__action_point__icontains=search)
            | Q(reason__icontains=search)
            | Q(requested_by__first_name__icontains=search)
            | Q(requested_by__last_name__icontains=search)
            | Q(requested_by__username__icontains=search)
        )

    qs = qs.order_by("-requested_at")
    total_count = qs.count()

    page = int(filters.get("page", 1) or 1)
    page_size = int(filters.get("page_size", 25) or 25)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_requests = list(qs[start_idx:end_idx])

    return {
        "count": total_count,
        "pending_count": pending_count,
        "results": paginated_requests,
        "page": page,
        "page_size": page_size,
    }


