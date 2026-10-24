export interface SMTPConfiguration {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  has_password: boolean;
  masked_password: string;
  smtp_security: "STARTTLS" | "SSL" | "NONE";
  from_email: string;
  from_name: string;
  is_enabled: boolean;
  cc_addresses: string[];
  frontend_base_url: string;
  updated_at: string | null;
}

export interface UpdateSMTPConfigurationPayload {
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_security?: "STARTTLS" | "SSL" | "NONE";
  from_email?: string;
  from_name?: string;
  is_enabled?: boolean;
  cc_addresses?: string[];
  frontend_base_url?: string;
}

export interface ScheduleOverview {
  current_ist_time: string;
  current_day: string;
  is_within_permitted_window: boolean;
  matching_slot: string | null;
  schedule_matrix: Record<string, string[]>;
  eligible_unclosed_tasks: number;
  overdue_tasks: number;
  past_7_days_sent: number;
  past_7_days_failed: number;
  past_7_days_retrying: number;
}

export interface EmailDeliveryRecord {
  id: number;
  idempotency_key: string;
  notification_type: "TASK_ASSIGNMENT" | "TASK_REASSIGNMENT" | "TASK_REMINDER" | "TEST_EMAIL" | string;
  action_id: string;
  recipient_email: string;
  recipient_name: string;
  cc_emails: string[];
  subject: string;
  body_summary: string;
  status: "PENDING" | "SENT" | "FAILED" | "RETRYING";
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  error_message: string;
  scheduled_slot: string;
  created_at: string;
}

export interface PaginatedDeliveryLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: EmailDeliveryRecord[];
}
