import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "../api/notificationsService";
import {
  UpdateSMTPConfigurationPayload,
} from "../types/notifications.types";

export const NOTIFICATION_KEYS = {
  config: ["notifications", "config"] as const,
  schedule: ["notifications", "schedule"] as const,
  logs: (params?: any) => ["notifications", "logs", params] as const,
};

export function useSMTPConfig() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.config,
    queryFn: notificationsService.getSMTPConfig,
  });
}

export function useUpdateSMTPConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSMTPConfigurationPayload) => notificationsService.updateSMTPConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.config });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (payload?: any) => notificationsService.testConnection(payload),
  });
}

export function useSendTestEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { recipient_email: string; recipient_name?: string }) =>
      notificationsService.sendTestEmail(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "logs"] });
    },
  });
}

export function useScheduleOverview() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.schedule,
    queryFn: notificationsService.getScheduleOverview,
    refetchInterval: 60000, // Refresh status every minute
  });
}

export function useDeliveryLogs(params?: {
  page?: number;
  status?: string;
  notification_type?: string;
  search?: string;
  action_id?: string;
}) {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.logs(params),
    queryFn: () => notificationsService.getDeliveryLogs(params),
  });
}

export function useTriggerReminders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { slot?: string; force?: boolean; dry_run?: boolean }) =>
      notificationsService.triggerReminders(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.schedule });
      queryClient.invalidateQueries({ queryKey: ["notifications", "logs"] });
    },
  });
}
