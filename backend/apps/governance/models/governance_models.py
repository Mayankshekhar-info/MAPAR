import math
from datetime import date, datetime
from typing import Any, Optional
from django.db import models
from django.utils import timezone
from apps.organization.models import Circle, Domain, Department, SubDepartment, MainCompany, SubCompany, Project
from apps.identity.models import User


def _parse_date_value(val: Any) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str:
            return None
        clean_str = val_str.split("T")[0].split(" ")[0].strip()
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(clean_str, fmt).date()
            except ValueError:
                continue
    return None


class GovernanceActionPoint(models.Model):
    """
    Action Point entity derived directly from 'Governance & Action Tracking.xlsx'.
    Tracks governance action items, owner assignment, target dates, ageing, and escalation.
    Can be assigned across any tier of the organization hierarchy.
    """

    class Status(models.TextChoices):
        OPEN = "Open", "Open"
        WIP = "WIP", "WIP"
        CLOSED = "Closed", "Closed"

    class ReviewWorkflowStatus(models.TextChoices):
        NONE = "None", "None"
        REVIEW_ASSIGNED = "Review Assigned", "Review Assigned"
        SUBMITTED_FOR_REVIEW = "Submitted for Review", "Submitted for Review"
        REVIEW_SUBMITTED = "Review Submitted", "Review Submitted"
        REWORK_REQUIRED = "Rework Required", "Rework Required"
        AWAITING_APPROVAL = "Awaiting Final Approval", "Awaiting Final Approval"
        APPROVED = "Approved", "Approved"

    class Priority(models.TextChoices):
        HIGH = "High", "High"
        MEDIUM = "Medium", "Medium"
        LOW = "Low", "Low"

    FUNCTION_AREA_CHOICES = [
        ("SCM", "SCM"),
        ("Operations", "Operations"),
        ("Sales", "Sales"),
        ("Finance", "Finance"),
        ("HR", "HR"),
        ("IT/Systems", "IT/Systems"),
        ("Compliance/Legal", "Compliance/Legal"),
        ("Other", "Other"),
    ]

    action_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Canonical unique identifier for the action point (e.g. ACT-00101)",
    )
    circle = models.ForeignKey(
        Circle,
        on_delete=models.CASCADE,
        related_name="governance_actions",
        help_text="Operational / Regional circle responsible for this action item",
    )
    # Flexible organization hierarchy anchoring
    hierarchy_level = models.CharField(
        max_length=50,
        blank=True,
        default="CIRCLE",
        help_text="Organization hierarchy level (MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE, DOMAIN, DEPARTMENT, SUB_DEPARTMENT)",
    )
    hierarchy_node_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Specific node ID within the selected hierarchy level",
    )
    hierarchy_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Full human-readable organizational path",
    )
    domain = models.ForeignKey(
        Domain,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_actions",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_actions",
    )
    sub_department = models.ForeignKey(
        SubDepartment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_actions",
    )

    function_area = models.CharField(
        max_length=100,
        choices=FUNCTION_AREA_CHOICES,
        default="Operations",
        db_index=True,
        help_text="Function or area (SCM, Operations, Sales, Finance, HR, IT/Systems, Compliance/Legal, Other)",
    )
    bucket = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Classification bucket or category from Excel upload or task assignment",
    )
    action_point = models.TextField(help_text="Concise description of the action point")
    key_deliverable = models.TextField(
        blank=True,
        default="",
        help_text="Key deliverable or expected outcome",
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_assigned_actions",
        help_text="Responsible assigned user",
    )
    owner_name_override = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Captured name from Excel import when user account mapping is not yet matched",
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_delegated_actions",
        help_text="User who assigned or delegated this action point",
    )

    raised_date = models.DateField(
        default=timezone.localdate,
        db_index=True,
        help_text="Date on which the action point was identified/raised",
    )
    target_closure_date = models.DateField(
        db_index=True,
        help_text="Initial target closure date",
    )
    current_target_date = models.DateField(
        db_index=True,
        help_text="Current effective target closure date after revisions",
    )
    revision_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of target closure date revisions",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    actual_closure_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when action item was confirmed closed",
    )

    class EvidenceStatus(models.TextChoices):
        NOT_SUBMITTED = "Not Submitted", "Not Submitted"
        PENDING_REVIEW = "Pending Review", "Pending Review"
        ACCEPTED = "Accepted", "Accepted"
        REWORK_REQUIRED = "Rework Required", "Rework Required"

    # Calculated metrics stored for indexing and fast analytics
    ageing_days = models.IntegerField(default=0, db_index=True)
    ageing_bucket = models.CharField(max_length=30, default="0-7 Days", db_index=True)
    weeks_in_review = models.IntegerField(default=0)
    reporting_week = models.CharField(
        max_length=30,
        blank=True,
        default="",
        db_index=True,
        help_text="Reporting week identifier from imported Excel or assignment (e.g. Week 42 or 2026-W42)",
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    is_escalated = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if item is Open/WIP and ageing > 30 days (workbook escalation formula)",
    )
    is_overdue = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if item is Open/WIP and current target date is before today",
    )

    evidence_status = models.CharField(
        max_length=30,
        choices=EvidenceStatus.choices,
        default=EvidenceStatus.NOT_SUBMITTED,
        db_index=True,
        help_text="Current review status of supporting proof/evidence",
    )
    evidence_required = models.BooleanField(
        default=True,
        help_text="Whether evidence/proof is required before closing this task",
    )
    review_workflow_status = models.CharField(
        max_length=40,
        choices=ReviewWorkflowStatus.choices,
        default=ReviewWorkflowStatus.NONE,
        db_index=True,
        help_text="Review, verification & approval lifecycle status",
    )
    assigned_reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_assigned_review_tasks",
        help_text="Designated reviewer assigned to verify this task",
    )

    current_progress_percent = models.PositiveIntegerField(
        default=0,
        help_text="User-reported progress percentage from weekly progress updates (0-100)",
    )

    last_update = models.TextField(
        blank=True,
        default="",
        help_text="Latest update or progress notes",
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_created_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "governance"
        db_table = "governance_action_point"
        ordering = ["-raised_date", "-id"]
        verbose_name = "Governance Action Point"
        verbose_name_plural = "Governance Action Points"

    def __str__(self):
        return f"{self.action_id}: {self.action_point[:40]}"

    def calculate_derived_fields(self, reference_date=None):
        """
        Calculates ageing, bucket, weeks in review, overdue, and escalation status.
        Follows the workbook formulas:
        - Ageing (Days):
            If Closed and actual_closure_date: (actual_closure_date - raised_date).days
            Else: (reference_date - raised_date).days
        - Ageing Bucket:
            <= 7: '0-7 Days'
            8-15: '8-15 Days'
            16-30: '16-30 Days'
            > 30: '30+ Days'
        - Weeks in Review: ROUNDUP(Ageing / 7, 0)
        - Escalation: True if Status != 'Closed' and Ageing > 30
        - Overdue: True if Status != 'Closed' and current_target_date < reference_date
        """
        today = reference_date or timezone.localdate()
        if isinstance(today, str):
            today = _parse_date_value(today) or timezone.localdate()

        if self.actual_closure_date:
            self.actual_closure_date = _parse_date_value(self.actual_closure_date)
        if self.raised_date:
            self.raised_date = _parse_date_value(self.raised_date) or timezone.localdate()
        else:
            self.raised_date = timezone.localdate()
        if self.current_target_date:
            self.current_target_date = _parse_date_value(self.current_target_date)
        if self.target_closure_date:
            self.target_closure_date = _parse_date_value(self.target_closure_date)

        if self.status == self.Status.CLOSED and self.actual_closure_date:
            days = (self.actual_closure_date - self.raised_date).days
        else:
            days = (today - self.raised_date).days

        self.ageing_days = max(0, days)

        if self.ageing_days <= 7:
            self.ageing_bucket = "0-7 Days"
        elif self.ageing_days <= 15:
            self.ageing_bucket = "8-15 Days"
        elif self.ageing_days <= 30:
            self.ageing_bucket = "16-30 Days"
        else:
            self.ageing_bucket = "30+ Days"

        self.weeks_in_review = math.ceil(self.ageing_days / 7.0) if self.ageing_days > 0 else 0
        self.is_escalated = (self.status != self.Status.CLOSED and self.ageing_days > 30)
        self.is_overdue = (self.status != self.Status.CLOSED and self.current_target_date is not None and self.current_target_date < today)

    def save(self, *args, **kwargs):
        if not self.current_target_date and self.target_closure_date:
            self.current_target_date = self.target_closure_date
        self.calculate_derived_fields()
        super().save(*args, **kwargs)


class GovernanceTargetRevision(models.Model):
    """
    Maintains target-date revision history linked directly to an action point.
    Preserves previous target, revised target, revision date, user who revised, and reason.
    """

    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    revision_number = models.PositiveIntegerField(help_text="Sequential revision index for this action point (1, 2, ...)")
    previous_target = models.DateField(help_text="Previous target closure date")
    revised_target = models.DateField(help_text="New revised target closure date")
    revision_date = models.DateField(default=timezone.localdate, help_text="Date when revision occurred")
    revised_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_target_revisions",
    )
    reason = models.TextField(blank=True, default="", help_text="Reason for target date revision")
    approved_by = models.CharField(max_length=150, blank=True, default="", help_text="Approver name / designation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "governance"
        db_table = "governance_target_revision"
        ordering = ["-revision_number", "-id"]
        unique_together = ("action_point", "revision_number")
        verbose_name = "Target Revision History"
        verbose_name_plural = "Target Revision Histories"

    def __str__(self):
        return f"{self.action_point.action_id} Rev #{self.revision_number}: {self.previous_target} -> {self.revised_target}"


class GovernanceWeeklyUpdate(models.Model):
    """
    Weekly progress update submitted by the assigned task owner or authorized updater.
    Enforces uniqueness per action point and reporting week to prevent accidental duplicates.
    Preserves complete historical record of deliverables, blockers, and progress trends.
    """
    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.CASCADE,
        related_name="weekly_updates",
        help_text="Target action point this weekly progress belongs to",
    )
    reporting_week = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Reporting week identifier (e.g. 2026-W42 or Week 42)",
    )
    week_start_date = models.DateField(null=True, blank=True)
    week_end_date = models.DateField(null=True, blank=True)
    work_completed = models.TextField(help_text="Detailed description of work completed during the reporting week")
    progress_percent = models.PositiveIntegerField(default=0, help_text="User-reported progress percentage (0-100)")
    achievements = models.TextField(blank=True, default="", help_text="Key achievements and milestones reached")
    blockers = models.TextField(blank=True, default="", help_text="Challenges, blockers, or reasons for delay")
    next_week_plan = models.TextField(blank=True, default="", help_text="Planned work and deliverables for next week")
    status = models.CharField(
        max_length=20,
        choices=GovernanceActionPoint.Status.choices,
        default=GovernanceActionPoint.Status.WIP,
        db_index=True,
    )
    actual_closure_date = models.DateField(null=True, blank=True, help_text="Date when task was completed if finished this week")
    remarks = models.TextField(blank=True, default="", help_text="Optional remarks or notes")
    previous_progress_percent = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Previous progress percentage before this update",
    )
    previous_status = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Previous task status before this update",
    )
    update_sequence = models.PositiveIntegerField(
        default=1,
        help_text="Monotonically increasing update sequence number for this task",
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_weekly_updates",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    revision_number = models.PositiveIntegerField(default=1)

    class Meta:
        app_label = "governance"
        db_table = "governance_weekly_update"
        ordering = ["-submitted_at", "-id"]
        verbose_name = "Weekly Progress Update"
        verbose_name_plural = "Weekly Progress Updates"
        indexes = [
            models.Index(fields=["action_point", "reporting_week", "submitted_at"]),
        ]

    def __str__(self):
        return f"{self.action_point.action_id} [{self.reporting_week} #{self.revision_number}]: {self.progress_percent}%"


class GovernanceEvidence(models.Model):
    """
    Evidence submission and review history for a GovernanceActionPoint.
    Supports multi-file attachments, sequential versioned resubmissions, and review audit trail.
    """

    class Status(models.TextChoices):
        PENDING_REVIEW = "Pending Review", "Pending Review"
        ACCEPTED = "Accepted", "Accepted"
        REWORK_REQUIRED = "Rework Required", "Rework Required"

    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.CASCADE,
        related_name="evidence_items",
        help_text="Target action point this proof is linked to",
    )
    version = models.PositiveIntegerField(
        default=1,
        help_text="Submission cycle/version number (1, 2, ...)",
    )
    reporting_week = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Optional reporting week linked to this evidence",
    )
    title = models.CharField(
        max_length=255,
        help_text="Descriptive title or label for the evidence",
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Explanation of what this evidence demonstrates",
    )
    file = models.FileField(
        upload_to="governance/evidence/%Y/%m/",
        help_text="Uploaded evidence document or image",
    )
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    file_type = models.CharField(max_length=100, blank=True, default="", help_text="MIME type or file extension")

    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_submitted_evidence",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_reviewed_evidence",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(
        blank=True,
        default="",
        help_text="Review feedback, acceptance note, or required rework instructions",
    )

    class Meta:
        app_label = "governance"
        db_table = "governance_evidence"
        ordering = ["-version", "-submitted_at"]
        verbose_name = "Governance Evidence"
        verbose_name_plural = "Governance Evidence Items"

    def __str__(self):
        return f"{self.action_point.action_id} Evidence v{self.version}: {self.title} ({self.status})"


class GovernanceBulkOperationLog(models.Model):
    """
    Traceable audit log for bulk operations across Governance, Audit, and Evidence sections.
    """
    class OperationType(models.TextChoices):
        ACTION_BULK_UPDATE = "ACTION_BULK_UPDATE", "Action Point Bulk Update"
        WEEKLY_BULK_UPDATE = "WEEKLY_BULK_UPDATE", "Weekly Progress Bulk Update"
        WEEKLY_EXCEL_IMPORT = "WEEKLY_EXCEL_IMPORT", "Weekly Excel Import"
        EVIDENCE_BULK_REVIEW = "EVIDENCE_BULK_REVIEW", "Evidence Bulk Review"

    operation_type = models.CharField(max_length=50, choices=OperationType.choices, db_index=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_bulk_logs",
    )
    total_selected = models.PositiveIntegerField(default=0)
    successful_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = "governance"
        db_table = "governance_bulk_operation_log"
        ordering = ["-timestamp"]
        verbose_name = "Bulk Operation Log"
        verbose_name_plural = "Bulk Operation Logs"

    def __str__(self):
        return f"[{self.timestamp}] {self.operation_type} by {self.user}: {self.successful_count}/{self.total_selected} successful"


class GovernanceTargetRevisionRequest(models.Model):
    """
    Formal request by an assigned task owner or authorized user to revise the target closure date.
    Maintains rigorous audit trail of requested date, mandatory business reason, requester,
    review status (Pending, Approved, Rejected), reviewer identity, and decision feedback.
    The current active target date of the task remains unchanged until approved by a separate
    authorized Governance reviewer.
    """
    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        REJECTED = "Rejected", "Rejected"

    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.CASCADE,
        related_name="revision_requests",
        help_text="Target action point for which date revision is requested",
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_date_revision_requests",
        help_text="User who submitted this revision request",
    )
    original_target_date = models.DateField(help_text="Original target closure date at the time of request")
    current_target_date = models.DateField(help_text="Effective target closure date at the time of request")
    requested_target_date = models.DateField(help_text="Proposed new target closure date")
    reason = models.TextField(help_text="Mandatory business reason for requesting the target date revision")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_reviewed_revision_requests",
        help_text="Authorized governance reviewer who approved or rejected this request",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_comment = models.TextField(blank=True, default="", help_text="Review decision notes or feedback")

    class Meta:
        app_label = "governance"
        db_table = "governance_target_revision_request"
        ordering = ["-requested_at"]
        verbose_name = "Target Date Revision Request"
        verbose_name_plural = "Target Date Revision Requests"

    def __str__(self):
        return f"{self.action_point.action_id} Req: {self.current_target_date} -> {self.requested_target_date} ({self.status})"


class GovernanceTaskReview(models.Model):
    """
    Dedicated review assignment and audit record for Governance & Action Tracker tasks.
    Enables authorized users to assign any task for review to a designated reviewer.
    Maintains persistent history of review instructions, reviewer notes, status progressions,
    and timestamps without altering the original task's status or progress.
    """
    class Status(models.TextChoices):
        PENDING_REVIEW = "Pending Review", "Pending Review"
        IN_REVIEW = "In Review", "In Review"
        REVIEWED = "Reviewed", "Reviewed"
        REVIEW_SUBMITTED = "Review Submitted", "Review Submitted"
        SUBMITTED_FOR_REVIEW = "Submitted for Review", "Submitted for Review"
        VERIFIED = "Verified", "Verified"
        REWORK_REQUIRED = "Rework Required", "Rework Required"
        APPROVED = "Approved", "Approved"

    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.CASCADE,
        related_name="task_reviews",
        help_text="Target action point assigned for review",
    )
    assigned_reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_assigned_reviews",
        help_text="Registered user assigned to perform this review",
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_requested_reviews",
        help_text="User who initiated this review assignment",
    )
    assigned_at = models.DateTimeField(default=timezone.now, db_index=True)
    instructions = models.TextField(
        blank=True,
        default="",
        help_text="Optional review instruction, guidelines, or scope request from initiator",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
        db_index=True,
    )
    submission_notes = models.TextField(
        blank=True,
        default="",
        help_text="Submission notes from task owner when submitting for verification",
    )
    submitted_for_verification_at = models.DateTimeField(null=True, blank=True)
    submitted_for_verification_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_submitted_verification_reviews",
        help_text="Task owner/user who submitted the task for review",
    )
    review_notes = models.TextField(
        blank=True,
        default="",
        help_text="Reviewer notes, observations, feedback, and recommendations",
    )
    recommendations = models.TextField(
        blank=True,
        default="",
        help_text="Reviewer recommendations and corrective actions",
    )
    reviewer_decision = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Verification outcome: Verified or Rework Required",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_verified_reviews",
        help_text="Reviewer who verified the task",
    )
    approver_decision = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Approval outcome: Approved or Rework Required",
    )
    approver_comments = models.TextField(
        blank=True,
        default="",
        help_text="Approver review comments and directives",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_approved_reviews",
        help_text="Authorized approver who granted final approval or returned for rework",
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="governance_submitted_reviews",
        help_text="User who submitted/completed the review notes",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "governance"
        db_table = "governance_task_review"
        ordering = ["-assigned_at"]
        verbose_name = "Governance Task Review"
        verbose_name_plural = "Governance Task Reviews"

    def __str__(self):
        reviewer_name = self.assigned_reviewer.username if self.assigned_reviewer else "Unassigned"
        return f"{self.action_point.action_id} Review by {reviewer_name} ({self.status})"


