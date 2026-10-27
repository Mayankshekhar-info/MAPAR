import html
from datetime import date
from typing import Any, List, Optional, Tuple, Union
from django.utils import timezone
from apps.governance.models import GovernanceActionPoint
from apps.identity.models import User


class GovernanceEmailBuilder:
    """
    Constructs approved PGMS Governance & Action Tracker emails.
    Features:
    - Clean executive blue-and-white design
    - Branding: "PGMS" mark with heading "Governance & Action Tracker"
    - Personalized greeting: "Dear {recipient_name},"
    - Dynamic KPI summary bar: Total Tasks, Overdue, High Priority
    - Complete, dedicated detail section per task with "View Task Details" button
    - Dynamic link mapping to existing /governance/tasks/{id} route
    - Professional footer: "PGMS · Governance & Action Tracking"
    - High-fidelity table-based HTML with inline styles & plain-text fallback
    """

    @classmethod
    def get_recipient_display_name(cls, user: Optional[User], fallback: str = "Team Member") -> str:
        """Extracts dynamic full name of the assigned user, falling back to clean username or fallback."""
        if not user:
            return fallback
        if hasattr(user, "get_full_name"):
            full_name = user.get_full_name().strip()
            if full_name and full_name.lower() not in ("authorized reviewer", "reviewer"):
                return full_name
        first_last = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        if first_last and first_last.lower() not in ("authorized reviewer", "reviewer"):
            return first_last
        raw_username = getattr(user, "username", "") or ""
        if raw_username and raw_username.lower() not in ("authorized reviewer", "reviewer_user", "reviewer"):
            cleaned = raw_username.replace(".", " ").replace("_", " ").strip().title()
            if cleaned:
                return cleaned
        return fallback

    @classmethod
    def format_task_context(cls, task: GovernanceActionPoint) -> str:
        """Formats organization path, circle, department, and function area context string."""
        parts = []
        if getattr(task, "hierarchy_path", None) and task.hierarchy_path.strip():
            parts.append(task.hierarchy_path.strip())
        elif task.circle:
            circle_code = f" ({task.circle.code})" if task.circle.code else ""
            parts.append(f"Circle: {task.circle.name}{circle_code}")
        if getattr(task, "department", None) and task.department:
            parts.append(f"Dept: {task.department.name}")
        elif getattr(task, "domain", None) and task.domain:
            parts.append(f"Domain: {task.domain.name}")
        if task.function_area:
            parts.append(f"Function: {task.function_area}")
        return " | ".join(parts) if parts else "Enterprise Governance"

    @classmethod
    def compute_summary_stats(
        cls, tasks: List[GovernanceActionPoint], today: date
    ) -> Tuple[int, int, int]:
        """Calculates (total_tasks, overdue_count, high_priority_count) from actual tasks."""
        total = len(tasks)
        overdue = 0
        high_priority = 0

        for t in tasks:
            t.calculate_derived_fields()
            target_date = t.current_target_date or t.target_closure_date
            is_closed = (t.status == GovernanceActionPoint.Status.CLOSED)
            if not is_closed and target_date and target_date < today:
                overdue += 1
            if t.priority == GovernanceActionPoint.Priority.HIGH:
                high_priority += 1

        return total, overdue, high_priority

    @classmethod
    def build_email(
        cls,
        recipient_name: str,
        tasks: Union[GovernanceActionPoint, List[GovernanceActionPoint]],
        email_type: str = "reminder",  # "assignment", "reassignment", "urgent_followup", "review_assignment", "reminder"
        subtitle: Optional[str] = None,
        lead_message: Optional[str] = None,
        base_url: str = "https://pagms.pratap.tech",
        initiator_name: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Builds the subject, HTML content, and plain text content.
        Returns: (subject, html_content, plain_text)
        """
        if isinstance(tasks, GovernanceActionPoint):
            task_list = [tasks]
        else:
            task_list = list(tasks)

        today = timezone.localdate()
        clean_base = (base_url or "https://pagms.pratap.tech").strip().rstrip("/")
        if not clean_base or "localhost" in clean_base:
            clean_base = "https://pagms.pratap.tech"
        base_url = clean_base
        login_url = f"{base_url}/login"

        # Compute summary metrics from actual tasks
        total_tasks, overdue_count, high_priority_count = cls.compute_summary_stats(task_list, today)

        # Subject and lead messaging based on email_type
        first_task = task_list[0] if task_list else None
        first_title_short = (
            (first_task.action_point or "Task").replace("\n", " ").strip()[:50]
            if first_task
            else "Task Update"
        )

        if email_type == "review_assignment":
            default_sub = "Task Assigned for Your Formal Review"
            default_lead = f"{initiator_name or 'Leadership'} has assigned governance action item {first_task.action_id if first_task else ''} for your formal review."
        elif email_type == "urgent_followup":
            default_sub = "Urgent Leadership Follow-Up"
            default_lead = "Leadership has requested an immediate progress update on the following assigned action items."
        elif email_type == "assignment":
            default_sub = "New Governance Action Point Assigned"
            default_lead = "You have new action points assigned to you in PAGMS. Please review each item below."
        elif email_type == "reassignment":
            default_sub = "Governance Action Point Reassigned"
            default_lead = "An action point has been reassigned to your ownership in PAGMS."
        else:
            default_sub = "Assigned action items requiring your review"
            default_lead = "You have the following actions assigned to you. Please review each task and update their progress in PAGMS."

        if email_type == "assignment":
            if total_tasks > 1:
                subject = f"[PAGMS] {total_tasks} New Tasks Assigned — Action Required"
            else:
                subject = f"[PAGMS] New Task Assigned — {first_task.action_id} — {first_title_short}"
        elif email_type == "reassignment":
            subject = f"[PAGMS] Task Reassigned — {first_task.action_id} — {first_title_short}"
        elif email_type == "urgent_followup":
            if total_tasks > 1:
                subject = f"[PAGMS Urgent] Leadership Follow-Up on {total_tasks} Action Items"
            else:
                subject = f"[PAGMS Urgent] Action Required: [{first_task.action_id}] — {first_title_short}"
        elif email_type == "review_assignment":
            subject = f"[PAGMS Review] Formal Review Required — {first_task.action_id} — {first_title_short}"
        else:  # reminder
            if overdue_count > 0:
                subject = f"[PAGMS Reminder] OVERDUE Action Required — {first_task.action_id if total_tasks == 1 else f'{overdue_count} Overdue Task(s)'}"
            else:
                subject = f"[PAGMS Reminder] Action Required — {first_task.action_id if total_tasks == 1 else f'{total_tasks} Active Task(s)'}"

        if email_type == "review_assignment":
            header_pill_text = "Review Request"
            header_pill_bg = "#4338CA"
        elif email_type == "urgent_followup":
            header_pill_text = "Urgent Alert"
            header_pill_bg = "#DC2626"
        elif email_type in ("assignment", "reassignment"):
            header_pill_text = "Task Assignment"
            header_pill_bg = "#2563EB"
        else:
            header_pill_text = "Action Alert"
            header_pill_bg = "#2563EB"

        subheading_text = subtitle or default_sub
        lead_text = lead_message or default_lead

        # Build HTML Task Cards matching reference design exactly
        task_cards_html = []
        for idx, task in enumerate(task_list, start=1):
            task.calculate_derived_fields()
            t_url = f"{base_url}/governance/tasks/{task.id}"
            target_date = task.current_target_date or task.target_closure_date
            target_date_str = target_date.strftime("%d %b %Y") if target_date else "Not Specified"
            is_closed = (task.status == GovernanceActionPoint.Status.CLOSED)

            if is_closed:
                if task.actual_closure_date:
                    timeline_text = f"Completed ({task.actual_closure_date.strftime('%d %b %Y')})"
                else:
                    timeline_text = "Completed"
                timeline_color = "#16A34A"
                top_badge_text = "Closed"
                top_badge_bg = "#ECFDF5"
                top_badge_color = "#047857"
            elif target_date:
                days_diff = (target_date - today).days
                if days_diff < 0:
                    timeline_text = f"{abs(days_diff)} days overdue"
                    timeline_color = "#DC2626"
                    top_badge_text = "Overdue"
                    top_badge_bg = "#FEE2E2"
                    top_badge_color = "#DC2626"
                elif days_diff == 0:
                    timeline_text = "Due Today"
                    timeline_color = "#EA580C"
                    top_badge_text = "Due Today"
                    top_badge_bg = "#FFEDD5"
                    top_badge_color = "#EA580C"
                else:
                    timeline_text = "On Track"
                    timeline_color = "#16A34A"
                    if task.status == GovernanceActionPoint.Status.WIP:
                        top_badge_text = "In Progress"
                        top_badge_bg = "#FEF3C7"
                        top_badge_color = "#B45309"
                    else:
                        top_badge_text = "Open"
                        top_badge_bg = "#EFF6FF"
                        top_badge_color = "#1D4ED8"
            else:
                timeline_text = "Target Pending"
                timeline_color = "#64748B"
                top_badge_text = task.status
                top_badge_bg = "#F1F5F9"
                top_badge_color = "#475569"

            # Revision badge
            rev_badge = f' <span style="display:inline-block; margin-left:4px; padding:1px 5px; font-size:10px; font-weight:700; background-color:#FEF3C7; color:#B45309; border-radius:3px;">R{task.revision_count}</span>' if task.revision_count > 0 else ""

            # Priority styles
            if task.priority == GovernanceActionPoint.Priority.HIGH:
                pri_bg, pri_color = "#FEE2E2", "#DC2626"
            elif task.priority == GovernanceActionPoint.Priority.LOW:
                pri_bg, pri_color = "#F1F5F9", "#475569"
            else:
                pri_bg, pri_color = "#FEF3C7", "#B45309"

            # Status styles for Current Status column
            if task.status == GovernanceActionPoint.Status.CLOSED:
                status_display = "Closed"
                status_pill_bg, status_pill_color = "#ECFDF5", "#047857"
            elif task.status == GovernanceActionPoint.Status.WIP:
                status_display = "In Progress"
                status_pill_bg, status_pill_color = "#FEF3C7", "#B45309"
            else:
                status_display = "Open"
                status_pill_bg, status_pill_color = "#EFF6FF", "#1D4ED8"

            progress_pct = max(0, min(100, task.current_progress_percent or 0))

            # Owner name and circle display
            if task.owner:
                owner_raw_name = f"{task.owner.first_name} {task.owner.last_name}".strip() or task.owner.username
                owner_email_str = (task.owner.email or "").strip()
                task_owner_display = f"{owner_raw_name} ({owner_email_str})" if owner_email_str else owner_raw_name
                task_owner_simple = owner_raw_name
            elif task.owner_name_override:
                task_owner_display = task.owner_name_override.strip()
                task_owner_simple = task_owner_display
            else:
                task_owner_display = "Unassigned"
                task_owner_simple = "Unassigned"

            circle_name = task.circle.name if task.circle else (task.hierarchy_path or "Enterprise Governance")

            # Description / subtitle snippet
            description_text = (
                task.key_deliverable.strip()
                if task.key_deliverable and task.key_deliverable.strip()
                else (task.last_update.strip() if task.last_update and task.last_update.strip() else "Review assigned action point deliverables and submit regular progress updates.")
            )

            # Assigned By row if initiator_name is provided
            assigned_by_html = ""
            if initiator_name:
                assigned_by_label = "Review Assigned By" if email_type == "review_assignment" else "Assigned By"
                assigned_by_html = f"""
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px; width: 40%;">{assigned_by_label}</td>
                        <td style="padding: 5px 0; color: #0F172A; font-weight: 700; font-size: 13px;">{html.escape(initiator_name)}</td>
                      </tr>"""

            card_html = f"""
            <div style="background-color: #FFFFFF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 22px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
              <!-- Card Header: Action ID + Top Status Badge -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <span style="font-size: 13px; font-weight: 700; color: #1E293B;">Action ID: <a href="{t_url}" style="color: #1D4ED8; font-weight: 800; text-decoration: underline;">{html.escape(task.action_id)}</a></span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 3px 12px; font-size: 11px; font-weight: 700; background-color: {top_badge_bg}; color: {top_badge_color}; border-radius: 12px;">{top_badge_text}</span>
                  </td>
                </tr>
              </table>

              <!-- Task Title -->
              <h3 style="margin: 6px 0 3px 0; font-size: 16px; font-weight: 800; color: #0F172A; line-height: 1.35;">
                {html.escape(task.action_point or "Task Description")}
              </h3>

              <!-- Description / Subtitle -->
              <div style="font-size: 13px; color: #64748B; line-height: 1.45; margin-bottom: 18px;">
                {html.escape(description_text)}
              </div>

              <!-- Two-Column Details Grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #F1F5F9; padding-top: 14px;">
                <tr>
                  <!-- Left Column -->
                  <td width="48%" style="vertical-align: top; padding-right: 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px; width: 40%;">Assigned To</td>
                        <td style="padding: 5px 0; color: #0F172A; font-weight: 700; font-size: 13px;">{html.escape(task_owner_simple)}</td>
                      </tr>{assigned_by_html}
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px;">Circle</td>
                        <td style="padding: 5px 0; color: #0F172A; font-weight: 600; font-size: 13px;">{html.escape(circle_name)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px;">Target Date</td>
                        <td style="padding: 5px 0; color: #0F172A; font-weight: 600; font-size: 13px;">{target_date_str}{rev_badge}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px;">Priority</td>
                        <td style="padding: 5px 0;">
                          <span style="display: inline-block; padding: 2px 10px; font-size: 11px; font-weight: 700; background-color: {pri_bg}; color: {pri_color}; border-radius: 10px;">{html.escape(task.priority)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Divider / Right Column -->
                  <td width="52%" style="vertical-align: top; border-left: 1px solid #F1F5F9; padding-left: 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px; width: 40%;">Current Status</td>
                        <td style="padding: 5px 0;">
                          <span style="display: inline-block; padding: 2px 10px; font-size: 11px; font-weight: 700; background-color: {status_pill_bg}; color: {status_pill_color}; border-radius: 10px;">{status_display}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px;">Progress</td>
                        <td style="padding: 5px 0; font-size: 13px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td style="width: 34px; font-weight: 700; color: #0F172A; font-size: 12px; vertical-align: middle;">
                                {progress_pct}%
                              </td>
                              <td style="vertical-align: middle; padding-left: 6px;">
                                <div style="background-color: #E2E8F0; border-radius: 4px; height: 7px; overflow: hidden; width: 100%; max-width: 110px;">
                                  <div style="background-color: #2563EB; width: {progress_pct}%; height: 7px;"></div>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748B; font-size: 13px;">Timeline</td>
                        <td style="padding: 5px 0; font-size: 13px;">
                          <strong style="color: {timeline_color}; font-weight: 700;">{timeline_text}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Full-Width Blue View Details Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 18px;">
                <tr>
                  <td>
                    <a href="{t_url}" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background-color: #1D4ED8; color: #FFFFFF !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 11px 0; border-radius: 6px;">
                      View {html.escape(task.action_id)} Details &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </div>
            """
            task_cards_html.append(card_html)

        task_cards_combined = "\n".join(task_cards_html)

        # Build Full HTML Document Matching Reference Design Exactly
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAGMS &bull; Governance &amp; Action Tracker</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); text-align: left;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #102A71 0%, #173B96 55%, #1D4ED8 100%); background-color: #173B96; padding: 20px 26px; border-radius: 10px 10px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="background-color: #2563EB; width: 44px; height: 44px; border-radius: 8px; text-align: center; line-height: 44px; color: #FFFFFF; font-size: 26px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            P
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.3px; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">PAGMS</div>
                          <div style="font-size: 12px; color: #C7D2FE; font-weight: 400; margin-top: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Governance &amp; Action Tracking</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: {header_pill_bg}; color: #FFFFFF; font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 20px; letter-spacing: 0.2px;">{header_pill_text}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content Area -->
          <tr>
            <td style="padding: 26px 26px;">
              <!-- Heading and Subtitle -->
              <h1 style="margin: 0; font-size: 23px; font-weight: 800; color: #1E293B; letter-spacing: -0.3px;">Governance &amp; Action Tracker</h1>
              <div style="margin-top: 4px; font-size: 14px; color: #64748B; font-weight: 500;">{html.escape(subheading_text)}</div>

              <!-- Thin divider line -->
              <div style="height: 1px; background-color: #E2E8F0; margin: 18px 0 20px 0;"></div>

              <!-- Personalized Greeting -->
              <p style="margin: 0 0 10px 0; font-size: 15px; color: #334155;">
                Dear <strong style="color: #0F172A;">{html.escape(recipient_name)}</strong>,
              </p>
              
              <!-- Context / Lead Message -->
              <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.55; color: #475569;">
                {lead_text}
              </p>

              <!-- Three Summary Cards -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <!-- Total Tasks -->
                  <td width="32%" style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 14px 12px; vertical-align: middle;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 40px; vertical-align: middle;">
                          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #2563EB; text-align: center; line-height: 36px; color: #FFFFFF; font-size: 16px;">
                            &#128203;
                          </div>
                        </td>
                        <td style="padding-left: 8px; vertical-align: middle;">
                          <div style="font-size: 10px; font-weight: 800; color: #2563EB; letter-spacing: 0.5px; text-transform: uppercase;">TOTAL TASKS</div>
                          <div style="font-size: 22px; font-weight: 800; color: #0F172A; margin-top: 2px;">{total_tasks}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="2%">&nbsp;</td>

                  <!-- Overdue -->
                  <td width="32%" style="background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 14px 12px; vertical-align: middle;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 40px; vertical-align: middle;">
                          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #EA580C; text-align: center; line-height: 36px; color: #FFFFFF; font-size: 16px; font-weight: bold;">
                            &#9888;
                          </div>
                        </td>
                        <td style="padding-left: 8px; vertical-align: middle;">
                          <div style="font-size: 10px; font-weight: 800; color: #EA580C; letter-spacing: 0.5px; text-transform: uppercase;">OVERDUE</div>
                          <div style="font-size: 22px; font-weight: 800; color: #9A3412; margin-top: 2px;">{overdue_count}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="2%">&nbsp;</td>

                  <!-- High Priority -->
                  <td width="32%" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 12px; vertical-align: middle;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 40px; vertical-align: middle;">
                          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #16A34A; text-align: center; line-height: 36px; color: #FFFFFF; font-size: 16px;">
                            &#9733;
                          </div>
                        </td>
                        <td style="padding-left: 8px; vertical-align: middle;">
                          <div style="font-size: 10px; font-weight: 800; color: #16A34A; letter-spacing: 0.5px; text-transform: uppercase;">HIGH PRIORITY</div>
                          <div style="font-size: 22px; font-weight: 800; color: #14532D; margin-top: 2px;">{high_priority_count}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section Heading -->
              <div style="font-size: 17px; font-weight: 800; color: #1E3A8A; margin: 26px 0 16px 0;">
                Your Assigned Actions
              </div>

              <!-- Detailed Task Cards -->
              {task_cards_combined}

              <!-- Info Strip -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px; background-color: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 12px 16px;">
                <tr>
                  <td style="width: 28px; vertical-align: middle;">
                    <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #3B82F6; color: #FFFFFF; text-align: center; line-height: 22px; font-size: 12px; font-weight: 700; font-family: serif;">i</div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 8px; font-size: 12px; color: #1E40AF; line-height: 1.4;">
                    This is an automated notification from PAGMS. Please <a href="{login_url}" style="color: #1D4ED8; font-weight: 700; text-decoration: underline;">log in</a> to review and update your assigned action items.
                  </td>
                </tr>
              </table>

              <!-- Bottom divider line -->
              <div style="height: 1px; background-color: #E2E8F0; margin: 26px 0 16px 0;"></div>

              <!-- PAGMS Footer -->
              <div style="text-align: center; font-size: 12px; color: #64748B;">
                <strong style="color: #1E293B;">PAGMS</strong> &bull; Governance &amp; Action Tracking
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        # Build Plain-Text Content
        plain_lead = lead_message or default_lead.replace("<strong>", "").replace("</strong>", "")
        plain_text_parts = [
            "PAGMS — Governance & Action Tracker",
            "==================================================",
            "",
            f"Dear {recipient_name},",
            "",
            plain_lead,
            "",
            "TASK SUMMARY:",
            "--------------------------------------------------",
            f"Total Tasks:    {total_tasks}",
            f"Overdue:        {overdue_count}",
            f"High Priority:  {high_priority_count}",
            "",
            "ASSIGNED ACTION ITEMS & DETAILS:",
            "==================================================",
        ]

        for idx, task in enumerate(task_list, start=1):
            t_url = f"{base_url}/governance/tasks/{task.id}"
            target_date = task.current_target_date or task.target_closure_date
            target_date_str = target_date.strftime("%d %b %Y") if target_date else "Not Specified"
            is_closed = (task.status == GovernanceActionPoint.Status.CLOSED)

            if is_closed:
                if task.actual_closure_date:
                    timeline_str = f"Completed ({task.actual_closure_date.strftime('%d %b %Y')})"
                else:
                    timeline_str = "Closed / Completed"
            elif target_date:
                days_diff = (target_date - today).days
                if days_diff < 0:
                    timeline_str = f"OVERDUE by {abs(days_diff)} day(s)"
                elif days_diff == 0:
                    timeline_str = "Due Today"
                else:
                    timeline_str = f"{days_diff} days remaining"
            else:
                timeline_str = "Target date pending"

            # Revision details
            rev_str = f" (Revision #{task.revision_count})" if task.revision_count > 0 else ""
            if task.revision_count > 0 and task.target_closure_date and task.current_target_date != task.target_closure_date:
                rev_str += f" [Initial Target Date: {task.target_closure_date.strftime('%d %b %Y')}]"

            # Owner name and email
            if task.owner:
                owner_raw_name = f"{task.owner.first_name} {task.owner.last_name}".strip() or task.owner.username
                owner_email_str = (task.owner.email or "").strip()
                task_owner_display = f"{owner_raw_name} ({owner_email_str})" if owner_email_str else owner_raw_name
            elif task.owner_name_override:
                task_owner_display = task.owner_name_override.strip()
            else:
                task_owner_display = "Unassigned"

            org_str = cls.format_task_context(task)

            plain_text_parts.extend([
                "",
                f"TASK #{idx}: [{task.action_id}] {task.action_point}",
                "--------------------------------------------------",
                f"Action ID:            {task.action_id}",
                f"Priority:             {task.priority}",
                f"Current Status:       {task.status}",
                f"Reported Progress:    {task.current_progress_percent or 0}%",
                f"Target Closure Date:  {target_date_str}{rev_str}",
                f"Timeline Status:      {timeline_str}",
                f"Assigned User:        {task_owner_display}",
            ])
            if initiator_name:
                assigned_by_lbl = "Review Assigned By" if email_type == "review_assignment" else "Assigned By"
                plain_text_parts.append(f"{assigned_by_lbl + ':':<22} {initiator_name}")
            plain_text_parts.append(f"Organization/Context: {org_str}")
            if getattr(task, "evidence_status", None):
                plain_text_parts.append(f"Evidence Status:      {task.evidence_status}")
            if task.ageing_days is not None and not is_closed:
                plain_text_parts.append(f"Ageing:               {task.ageing_days} day(s) ({task.ageing_bucket})")
            if task.bucket:
                plain_text_parts.append(f"Bucket:               {task.bucket}")
            if task.key_deliverable:
                plain_text_parts.append(f"Key Deliverable:      {task.key_deliverable.strip()}")
            if task.last_update:
                plain_text_parts.append(f"Latest Notes:         {task.last_update.strip()}")

            plain_text_parts.extend([
                f"View Task Details:    {t_url}",
                "--------------------------------------------------",
            ])

        plain_text_parts.extend([
            "",
            f"Portal Login:         {login_url}",
            "==================================================",
            "PAGMS · Governance & Action Tracking",
        ])

        plain_text = "\n".join(plain_text_parts)

        return subject, html_content, plain_text
