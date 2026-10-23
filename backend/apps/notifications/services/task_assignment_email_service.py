import logging
from typing import Optional, Tuple
from django.utils import timezone
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService

logger = logging.getLogger("mapar.notifications")


class TaskAssignmentEmailService:
    """
    Handles immediate automated email notifications when a task is assigned or reassigned.
    Retrieves the recipient strictly from registered user account records.
    Constructs comprehensive task details and secure direct access links.
    """

    @classmethod
    def send_assignment_email(
        cls,
        action_point: GovernanceActionPoint,
        is_reassignment: bool = False,
    ) -> Tuple[bool, Optional[EmailDeliveryRecord]]:
        """
        Dispatches a detailed assignment alert email to the assigned owner.
        Enforces idempotency, mandatory CC addresses, and database validation.
        """
        if not action_point or not action_point.owner:
            logger.info("Task %s has no registered user owner. Skipping assignment email.", getattr(action_point, "action_id", "N/A"))
            return False, None

        owner = action_point.owner
        recipient_email = (owner.email or "").strip().lower()
        if not recipient_email or "@" not in recipient_email:
            logger.warning(
                "Task %s owner '%s' does not have a verified email address. Skipping email alert.",
                action_point.action_id,
                owner.username,
            )
            return False, None

        # Build idempotency key: unique per action_id and assigned owner
        # If reassignment, includes reassignment timestamp signature
        prefix = "reassignment" if is_reassignment else "assignment"
        idempotency_key = f"{prefix}:{action_point.action_id}:{owner.id}"

        # Resolve organization context
        org_context_parts = []
        if action_point.circle:
            org_context_parts.append(f"Circle: {action_point.circle.name}")
        if action_point.department:
            org_context_parts.append(f"Dept: {action_point.department.name}")
        if action_point.function_area:
            org_context_parts.append(f"Function: {action_point.function_area}")
        if action_point.hierarchy_path:
            org_context_parts.append(f"Path: {action_point.hierarchy_path}")
        org_context_str = " | ".join(org_context_parts) if org_context_parts else "Enterprise Governance"

        # Owner and Assigner names
        owner_name = owner.get_full_name() or owner.username
        assigner_name = "MAPAR System"
        if action_point.assigned_by:
            assigner_name = action_point.assigned_by.get_full_name() or action_point.assigned_by.username
        elif action_point.created_by:
            assigner_name = action_point.created_by.get_full_name() or action_point.created_by.username

        # Target closure date formatting
        target_date_str = action_point.current_target_date.strftime("%d %b %Y") if action_point.current_target_date else "Not Specified"
        raised_date_str = action_point.raised_date.strftime("%d %b %Y") if action_point.raised_date else timezone.localdate().strftime("%d %b %Y")

        # Base URL for secure direct task link
        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = config.get("frontend_base_url", "http://localhost:5185")
        task_url = f"{base_url}/governance/tasks/{action_point.id}"

        # Subject line
        action_title_short = (action_point.action_point or "Task").replace("\n", " ").strip()[:65]
        if is_reassignment:
            subject = f"[MAPAR] Task Reassigned — {action_point.action_id} — {action_title_short}"
            heading = "Task Reassignment Notification"
            lead_text = f"You have been assigned as the new responsible owner for task <strong>{action_point.action_id}</strong>."
        else:
            subject = f"[MAPAR] New Task Assigned — {action_point.action_id} — {action_title_short}"
            heading = "New Task Assignment Notification"
            lead_text = f"A new governance action point has been assigned to you in MAPAR."

        deliverables = action_point.key_deliverable.strip() or "Please review action point details and submit deliverables in weekly updates."
        instructions = action_point.last_update.strip() or "Submit your weekly progress updates and required evidence before the target closure date."

        plain_text = f"""Hello {owner_name},

{lead_text}

TASK DETAILS:
--------------------------------------------------
Action ID:           {action_point.action_id}
Task Title:          {action_point.action_point}
Priority:            {action_point.priority}
Current Status:      {action_point.status}
Organization:        {org_context_str}
Assigned By:         {assigner_name}
Assignment Date:     {raised_date_str}
Target Closure Date: {target_date_str}

KEY DELIVERABLES:
{deliverables}

NEXT STEPS & INSTRUCTIONS:
{instructions}

ACCESS YOUR TASK IN MAPAR:
{task_url}

Please update your progress weekly and attach supporting evidence as required.
"""

        # Priority color
        priority_color = "#d97706"  # medium
        if action_point.priority == GovernanceActionPoint.Priority.HIGH:
            priority_color = "#dc2626"
        elif action_point.priority == GovernanceActionPoint.Priority.LOW:
            priority_color = "#16a34a"

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; padding: 24px; margin: 0; }}
    .container {{ max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; }}
    .header {{ background: #0f172a; padding: 24px; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px; }}
    .header p {{ margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }}
    .body {{ padding: 24px; font-size: 14px; line-height: 1.6; }}
    .task-hero {{ background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 16px 0 20px 0; border-radius: 0 6px 6px 0; }}
    .action-id {{ font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; }}
    .task-title {{ font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 4px; }}
    .grid-table {{ width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }}
    .grid-table td {{ padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }}
    .grid-table td.label {{ color: #64748b; font-weight: 600; width: 34%; }}
    .grid-table td.val {{ color: #0f172a; font-weight: 500; }}
    .pill {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #ffffff; }}
    .section-title {{ font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 20px; margin-bottom: 6px; }}
    .section-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.5; }}
    .button-container {{ text-align: center; margin: 28px 0 16px 0; }}
    .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.25); }}
    .footer {{ background: #f8fafc; padding: 18px 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MAPAR &bull; Governance & Action Tracking</h1>
      <p>{heading}</p>
    </div>
    <div class="body">
      <p>Hello <strong>{owner_name}</strong>,</p>
      <p>{lead_text}</p>

      <div class="task-hero">
        <div class="action-id">{action_point.action_id}</div>
        <div class="task-title">{action_point.action_point}</div>
      </div>

      <table class="grid-table">
        <tr>
          <td class="label">Priority:</td>
          <td class="val"><span class="pill" style="background: {priority_color};">{action_point.priority}</span></td>
        </tr>
        <tr>
          <td class="label">Current Status:</td>
          <td class="val"><strong>{action_point.status}</strong></td>
        </tr>
        <tr>
          <td class="label">Organization Scope:</td>
          <td class="val">{org_context_str}</td>
        </tr>
        <tr>
          <td class="label">Assigned By:</td>
          <td class="val">{assigner_name}</td>
        </tr>
        <tr>
          <td class="label">Assignment Date:</td>
          <td class="val">{raised_date_str}</td>
        </tr>
        <tr>
          <td class="label">Target Closure Date:</td>
          <td class="val"><strong style="color: #dc2626;">{target_date_str}</strong></td>
        </tr>
      </table>

      <div class="section-title">Key Deliverables</div>
      <div class="section-box">{deliverables}</div>

      <div class="section-title">Instructions & Next Steps</div>
      <div class="section-box">{instructions}</div>

      <div class="button-container">
        <a href="{task_url}" class="btn">Open Task in MAPAR &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 4px;">
        Direct link: <a href="{task_url}" style="color: #2563eb;">{task_url}</a>
      </p>
    </div>
    <div class="footer">
      This is an automated operational alert from MAPAR Enterprise Governance. Please do not reply directly to this email.<br>
      Mandatory CC: abhay@pratap.co.in, shakti.singh@pratap.co.in
    </div>
  </div>
</body>
</html>"""

        notification_type = (
            EmailDeliveryRecord.NotificationType.TASK_REASSIGNMENT
            if is_reassignment
            else EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT
        )

        success, record = SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=owner_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=notification_type,
            action_point=action_point,
            action_id=action_point.action_id,
            idempotency_key=idempotency_key,
        )

        return success, record
