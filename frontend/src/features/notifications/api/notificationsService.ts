import { api } from "../../../services/api";
import {
  SMTPConfiguration,
  UpdateSMTPConfigurationPayload,
  ScheduleOverview,
  PaginatedDeliveryLogs,
} from "../types/notifications.types";

export const notificationsService = {
  getSMTPConfig: async (): Promise<SMTPConfiguration> => {
    const res = await api.get("/notifications/smtp/");
    return res.data.configuration;
  },

  updateSMTPConfig: async (payload: UpdateSMTPConfigurationPayload): Promise<SMTPConfiguration> => {
    const res = await api.post("/notifications/smtp/", payload);
    return res.data.configuration;
  },

  testConnection: async (payload?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    smtp_password?: string;
    smtp_security?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await api.post("/notifications/smtp/test-connection/", payload || {});
    return res.data;
  },

  sendTestEmail: async (payload: {
    recipient_email: string;
    recipient_name?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await api.post("/notifications/smtp/send-test/", payload);
    return res.data;
  },

  getScheduleOverview: async (): Promise<ScheduleOverview> => {
    const res = await api.get("/notifications/schedule/");
    return res.data.overview;
  },

  getDeliveryLogs: async (params?: {
    page?: number;
    status?: string;
    notification_type?: string;
    search?: string;
    action_id?: string;
  }): Promise<PaginatedDeliveryLogs> => {
    const res = await api.get("/notifications/logs/", { params });
    return res.data;
  },

  triggerReminders: async (payload?: {
    slot?: string;
    force?: boolean;
    dry_run?: boolean;
  }): Promise<{ success: boolean; result: any }> => {
    const res = await api.post("/notifications/reminders/trigger/", payload || {});
    return res.data;
  },
};
