import logging
from typing import Dict, Any, List, Optional, Tuple
from django.utils import timezone
from django.db.models import Q

from apps.identity.models import User
from apps.governance.models import GovernanceActionPoint
from apps.governance.selectors.governance_selectors import apply_governance_scope
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.governance_email_builder import GovernanceEmailBuilder

logger = logging.getLogger(__name__)


class StatusMatrixEmailService:
    """
    Service responsible for dispatching consolidated governance notification emails
    to action owners identified from the Action Status Matrix.
    
    Guarantees:
    - 1 consolidated email per unique recipient email address containing all their assigned tasks.
    - Full database accuracy for all task details, progress, priorities, and direct links.
    - Idempotency to prevent rapid double-sends.
    - Respects organization-scoped authorization.
    """

    @classmethod
    def get_scoped_matrix_tasks(
        cls,
        user: User,
        reporting_week: Optional[str] = None,
        circle_id: Optional[int] = None,
    ) -> List[GovernanceActionPoint]:
        """
        Retrieves active unclosed governance actions within user's authorized scope
        matching the matrix filter criteria.
        """
        qs = GovernanceActionPoint.objects.exclude(
            status=GovernanceActionPoint.Status.CLOSED
        ).select_related(
            "owner", "circle", "department", "assigned_by", "created_by"
        ).prefetch_related("weekly_updates")

        qs = apply_governance_scope(qs, user)

        if circle_id:
            qs = qs.filter(circle_id=circle_id)

        if reporting_week and reporting_week != "ALL":
            from apps.governance.services.governance_excel_service import GovernanceExcelService
            norm_week = GovernanceExcelService.normalize_reporting_week(reporting_week)
            qs = qs.filter(
                Q(reporting_week__iexact=reporting_week)
                | Q(reporting_week__iexact=norm_week)
                | Q(weekly_updates__reporting_week__iexact=reporting_week)
                | Q(weekly_updates__reporting_week__iexact=norm_week)
            ).distinct()

        return list(qs.order_by("current_target_date", "id"))

    @classmethod
    def group_tasks_by_recipient(
        cls, tasks: List[GovernanceActionPoint]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Groups tasks by the owner's normalized email address.
        Deduplicates by normalized email so multiple user records with same email
        get consolidated into a single recipient group.
        """
        today = timezone.localdate()
        grouped: Dict[str, Dict[str, Any]] = {}

        for task in tasks:
            task.calculate_derived_fields()
            owner = task.owner
            if not owner or not owner.email or not owner.email.strip():
                # Skip tasks without valid owner email
                continue

            normalized_email = owner.email.strip().lower()
            owner_name = GovernanceEmailBuilder.get_recipient_display_name(owner)

            if normalized_email not in grouped:
                grouped[normalized_email] = {
                    "owner": owner,
                    "recipient_name": owner_name,
                    "recipient_email": normalized_email,
                    "tasks": [],
                    "overdue_count": 0,
                    "high_priority_count": 0,
                }

            grouped[normalized_email]["tasks"].append(task)

            # Check overdue
            target_date = task.current_target_date or task.target_closure_date
            if target_date and target_date < today:
                grouped[normalized_email]["overdue_count"] += 1

            # Check high priority
            if task.priority == GovernanceActionPoint.Priority.HIGH:
                grouped[normalized_email]["high_priority_count"] += 1

        return grouped

    @classmethod
    def get_matrix_email_preview(
        cls,
        user: User,
        reporting_week: Optional[str] = None,
        circle_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Returns pre-send summary metrics and list of distinct recipients with task counts.
        """
        tasks = cls.get_scoped_matrix_tasks(user, reporting_week, circle_id)
        grouped = cls.group_tasks_by_recipient(tasks)

        recipients_list = []
        for normalized_email, g in grouped.items():
            recipients_list.append({
                "recipient_name": g["recipient_name"],
                "recipient_email": normalized_email,
                "task_count": len(g["tasks"]),
                "action_ids": [t.action_id for t in g["tasks"]],
                "overdue_count": g["overdue_count"],
                "high_priority_count": g["high_priority_count"],
            })

        # Sort recipients by overdue count descending, then task count descending
        recipients_list.sort(key=lambda r: (r["overdue_count"], r["task_count"]), reverse=True)

        total_tasks_included = sum(r["task_count"] for r in recipients_list)
        total_overdue = sum(r["overdue_count"] for r in recipients_list)
        total_high_priority = sum(r["high_priority_count"] for r in recipients_list)

        return {
            "distinct_recipients_count": len(recipients_list),
            "total_tasks_count": total_tasks_included,
            "total_overdue_count": total_overdue,
            "total_high_priority_count": total_high_priority,
            "recipients": recipients_list,
        }

    @classmethod
    def send_matrix_consolidated_emails(
        cls,
        triggered_by: User,
        reporting_week: Optional[str] = None,
        circle_id: Optional[int] = None,
        override_recipient_email: Optional[str] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes sending of consolidated governance emails to all eligible action owners.
        Each distinct owner receives exactly one email containing all their assigned tasks.
        """
        tasks = cls.get_scoped_matrix_tasks(triggered_by, reporting_week, circle_id)
        grouped = cls.group_tasks_by_recipient(tasks)

        if not grouped:
            return {
                "success": False,
                "total_recipients": 0,
                "total_tasks": 0,
                "sent_count": 0,
                "failed_count": 0,
                "skipped_count": 0,
                "results": [],
                "message": "No eligible action owners with unclosed tasks found in the Action Status Matrix.",
            }

        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = config.get("frontend_base_url", "http://localhost:5185").rstrip("/")

        now = timezone.now()
        batch_key = now.strftime("%Y%m%d%H%M")
        one_minute_ago = now - timezone.timedelta(seconds=60)

        sent_count = 0
        failed_count = 0
        skipped_count = 0
        results_log = []

        for normalized_email, group in grouped.items():
            owner = group["owner"]
            owner_tasks = group["tasks"]
            task_ids_str = "-".join(sorted(t.action_id for t in owner_tasks))
            idempotency_key = f"matrix_digest:{normalized_email}:{task_ids_str}:{batch_key}"
            action_id_summary = ", ".join(t.action_id for t in owner_tasks)

            # Prevent duplicate rapid dispatches (within 60s)
            recent_duplicate = EmailDeliveryRecord.objects.filter(
                recipient_email=normalized_email,
                notification_type=EmailDeliveryRecord.NotificationType.STATUS_MATRIX_DIGEST,
                status=EmailDeliveryRecord.Status.SENT,
                created_at__gte=one_minute_ago,
            ).exists()

            if recent_duplicate:
                logger.info("Recent digest already dispatched to %s in last 60s. Skipping.", normalized_email)
                skipped_count += 1
                results_log.append({
                    "recipient_email": normalized_email,
                    "recipient_name": group["recipient_name"],
                    "task_count": len(owner_tasks),
                    "action_ids": [t.action_id for t in owner_tasks],
                    "status": "SKIPPED",
                    "message": "Already sent in the last 60 seconds (duplicate prevention).",
                })
                continue

            # Target delivery address (supports test override if specified)
            target_delivery_email = (
                override_recipient_email.strip().lower()
                if override_recipient_email and override_recipient_email.strip()
                else normalized_email
            )

            # Build approved PAGMS consolidated email
            subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
                tasks=owner_tasks,
                recipient_name=group["recipient_name"],
                email_type="reminder",
                subtitle="Action Status Matrix • Assigned action items requiring your review",
                lead_message="You have the following actions assigned to you from the Action Status Matrix. Please review each task and update their progress in PAGMS.",
                base_url=base_url,
            )

            if dry_run:
                sent_count += 1
                results_log.append({
                    "recipient_email": target_delivery_email,
                    "recipient_name": group["recipient_name"],
                    "task_count": len(owner_tasks),
                    "action_ids": [t.action_id for t in owner_tasks],
                    "status": "DRY_RUN",
                    "message": "Email constructed successfully (Dry Run).",
                })
                continue

            # Dispatch via SMTP
            primary_action = owner_tasks[0] if len(owner_tasks) == 1 else None
            success, record = SMTPService.send_html_email(
                recipient_email=target_delivery_email,
                subject=subject,
                plain_text=plain_text,
                html_content=html_content,
                notification_type=EmailDeliveryRecord.NotificationType.STATUS_MATRIX_DIGEST,
                action_point=primary_action,
                action_id=action_id_summary[:64],
                recipient_name=group["recipient_name"],
                idempotency_key=idempotency_key,
                custom_config=config,
            )

            if record and triggered_by:
                record.triggered_by = triggered_by
                record.save(update_fields=["triggered_by"])

            if success:
                sent_count += 1
                results_log.append({
                    "recipient_email": target_delivery_email,
                    "recipient_name": group["recipient_name"],
                    "task_count": len(owner_tasks),
                    "action_ids": [t.action_id for t in owner_tasks],
                    "status": "SENT",
                    "message": "Successfully delivered to SMTP server.",
                })
            else:
                failed_count += 1
                err_msg = record.error_message if record else "SMTP dispatch failure"
                results_log.append({
                    "recipient_email": target_delivery_email,
                    "recipient_name": group["recipient_name"],
                    "task_count": len(owner_tasks),
                    "action_ids": [t.action_id for t in owner_tasks],
                    "status": "FAILED",
                    "error": err_msg,
                })

        total_tasks_count = sum(len(g["tasks"]) for g in grouped.values())
        overall_success = (sent_count > 0 or skipped_count > 0)

        return {
            "success": overall_success,
            "total_recipients": len(grouped),
            "total_tasks": total_tasks_count,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "results": results_log,
            "message": f"Dispatched consolidated emails: {sent_count} sent, {failed_count} failed, {skipped_count} skipped ({total_tasks_count} total tasks).",
        }

    @classmethod
    def get_scoped_owner_tasks(
        cls,
        user: User,
        owner_id: Optional[int] = None,
        owner_name: Optional[str] = None,
    ) -> List[GovernanceActionPoint]:
        """
        Retrieves active unclosed governance actions assigned to a specific owner
        within user's authorized scope.
        STRICT REQUIREMENT: Exclude all Closed tasks.
        """
        qs = GovernanceActionPoint.objects.exclude(
            status=GovernanceActionPoint.Status.CLOSED
        ).select_related(
            "owner", "circle", "department", "assigned_by", "created_by"
        ).prefetch_related("weekly_updates")

        qs = apply_governance_scope(qs, user)

        if owner_id and owner_id != 0:
            qs = qs.filter(owner_id=owner_id)
        elif owner_name and owner_name.strip():
            norm_name = owner_name.strip()
            name_q = (
                Q(owner_name_override__iexact=norm_name)
                | Q(owner__first_name__iexact=norm_name)
                | Q(owner__username__iexact=norm_name)
            )
            parts = norm_name.split()
            if len(parts) >= 2:
                name_q |= (
                    Q(owner__first_name__iexact=parts[0], owner__last_name__iexact=parts[-1])
                    | Q(owner__first_name__icontains=parts[0], owner__last_name__icontains=parts[-1])
                )
            qs = qs.filter(name_q)
        else:
            return []

        return list(qs.order_by("current_target_date", "id"))

    @classmethod
    def get_owner_email_preview(
        cls,
        user: User,
        owner_id: Optional[int] = None,
        owner_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Returns pre-send validation details and preview for a specific action owner.
        Excludes all Closed tasks and checks database records for owner identity & email.
        """
        owner_tasks = cls.get_scoped_owner_tasks(user, owner_id=owner_id, owner_name=owner_name)

        target_user = None
        recipient_email = None
        recipient_name = owner_name or "Action Owner"

        if owner_id and owner_id != 0:
            target_user = User.objects.filter(id=owner_id).first()
            if target_user:
                recipient_email = (target_user.email or "").strip().lower()
                recipient_name = GovernanceEmailBuilder.get_recipient_display_name(target_user)

        if not recipient_email and owner_tasks:
            for t in owner_tasks:
                if t.owner and t.owner.email and t.owner.email.strip():
                    recipient_email = t.owner.email.strip().lower()
                    if not target_user:
                        target_user = t.owner
                        recipient_name = GovernanceEmailBuilder.get_recipient_display_name(target_user)
                    break

        if not recipient_email and owner_name and owner_name.strip():
            u = User.objects.filter(
                Q(first_name__iexact=owner_name.strip()) | Q(username__iexact=owner_name.strip()),
                email__isnull=False,
            ).exclude(email="").first()
            if u:
                recipient_email = (u.email or "").strip().lower()
                recipient_name = GovernanceEmailBuilder.get_recipient_display_name(u)

        today = timezone.localdate()
        overdue_count = 0
        high_priority_count = 0
        for task in owner_tasks:
            task.calculate_derived_fields()
            target_date = task.current_target_date or task.target_closure_date
            if target_date and target_date < today:
                overdue_count += 1
            if task.priority == GovernanceActionPoint.Priority.HIGH:
                high_priority_count += 1

        # Check total vs closed assigned to provide specific feedback
        total_assigned_qs = GovernanceActionPoint.objects.all()
        total_assigned_qs = apply_governance_scope(total_assigned_qs, user)
        if owner_id and owner_id != 0:
            total_assigned_qs = total_assigned_qs.filter(owner_id=owner_id)
        elif owner_name:
            total_assigned_qs = total_assigned_qs.filter(
                Q(owner_name_override__iexact=owner_name.strip()) | Q(owner__first_name__iexact=owner_name.strip())
            )
        else:
            total_assigned_qs = GovernanceActionPoint.objects.none()

        total_assigned_count = total_assigned_qs.count()
        closed_assigned_count = total_assigned_qs.filter(status=GovernanceActionPoint.Status.CLOSED).count()

        has_eligible_tasks = len(owner_tasks) > 0 and bool(recipient_email)
        no_eligible_reason = None
        if total_assigned_count == 0:
            no_eligible_reason = "This action owner has no assigned tasks."
        elif len(owner_tasks) == 0 and closed_assigned_count > 0:
            no_eligible_reason = f"All {closed_assigned_count} assigned tasks are Closed. Closed tasks are excluded from notification emails."
        elif not recipient_email:
            no_eligible_reason = "No valid email address registered for this action owner in the database."

        return {
            "eligible_tasks_count": len(owner_tasks),
            "total_assigned_count": total_assigned_count,
            "closed_excluded_count": closed_assigned_count,
            "overdue_count": overdue_count,
            "high_priority_count": high_priority_count,
            "recipient_name": recipient_name,
            "recipient_email": recipient_email or "",
            "action_ids": [t.action_id for t in owner_tasks],
            "has_eligible_tasks": has_eligible_tasks,
            "no_eligible_reason": no_eligible_reason,
        }

    @classmethod
    def send_owner_consolidated_email(
        cls,
        triggered_by: User,
        owner_id: Optional[int] = None,
        owner_name: Optional[str] = None,
        override_recipient_email: Optional[str] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Sends exactly 1 consolidated email containing all eligible, non-closed tasks for a specific action owner.
        Excludes all Closed tasks from the email.
        """
        preview = cls.get_owner_email_preview(triggered_by, owner_id=owner_id, owner_name=owner_name)
        if not preview["has_eligible_tasks"]:
            return {
                "success": False,
                "sent": False,
                "message": preview.get("no_eligible_reason") or "No eligible non-closed tasks to send for this action owner.",
                "preview": preview,
            }

        owner_tasks = cls.get_scoped_owner_tasks(triggered_by, owner_id=owner_id, owner_name=owner_name)
        recipient_email = override_recipient_email.strip().lower() if override_recipient_email else preview["recipient_email"]
        recipient_name = preview["recipient_name"]

        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = config.get("frontend_base_url", "http://localhost:5185").rstrip("/")

        now = timezone.now()
        batch_key = now.strftime("%Y%m%d%H%M")
        one_minute_ago = now - timezone.timedelta(seconds=60)
        task_ids_str = "-".join(sorted(t.action_id for t in owner_tasks))
        idempotency_key = f"owner_digest:{recipient_email}:{task_ids_str}:{batch_key}"
        action_id_summary = ", ".join(t.action_id for t in owner_tasks)

        # Duplicate protection (within 60s)
        recent_duplicate = EmailDeliveryRecord.objects.filter(
            recipient_email=recipient_email,
            notification_type=EmailDeliveryRecord.NotificationType.STATUS_MATRIX_DIGEST,
            status=EmailDeliveryRecord.Status.SENT,
            created_at__gte=one_minute_ago,
        ).exists()

        if recent_duplicate:
            return {
                "success": True,
                "sent": False,
                "skipped": True,
                "message": "A consolidated email was already dispatched to this recipient in the last 60 seconds (duplicate prevention).",
                "recipient_email": recipient_email,
                "task_count": len(owner_tasks),
            }

        subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
            tasks=owner_tasks,
            recipient_name=recipient_name,
            email_type="reminder",
            subtitle="Assigned Action Items • Governance & Action Tracking",
            lead_message="You have the following active actions assigned to you. Please review each task and update their progress in PAGMS.",
            base_url=base_url,
        )

        if dry_run:
            return {
                "success": True,
                "sent": True,
                "dry_run": True,
                "message": f"Constructed consolidated email for {recipient_name} with {len(owner_tasks)} tasks (Dry Run).",
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "task_count": len(owner_tasks),
                "action_ids": [t.action_id for t in owner_tasks],
            }

        primary_action = owner_tasks[0] if len(owner_tasks) == 1 else None
        success, record = SMTPService.send_html_email(
            recipient_email=recipient_email,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.STATUS_MATRIX_DIGEST,
            action_point=primary_action,
            action_id=action_id_summary[:64],
            recipient_name=recipient_name,
            idempotency_key=idempotency_key,
            custom_config=config,
        )

        if record and triggered_by:
            record.triggered_by = triggered_by
            record.save(update_fields=["triggered_by"])

        if success:
            return {
                "success": True,
                "sent": True,
                "message": f"Consolidated email successfully sent to {recipient_name} ({recipient_email}) with {len(owner_tasks)} active tasks.",
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "task_count": len(owner_tasks),
                "action_ids": [t.action_id for t in owner_tasks],
            }
        else:
            err = record.error_message if record else "SMTP delivery failed."
            return {
                "success": False,
                "sent": False,
                "message": f"Failed to send email to {recipient_email}: {err}",
                "recipient_email": recipient_email,
                "error": err,
            }

