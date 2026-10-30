import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import SettingsIcon from "@mui/icons-material/Settings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HistoryIcon from "@mui/icons-material/History";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

import { colorTokens } from "../../../app/theme/tokens";
import {
  useSMTPConfig,
  useUpdateSMTPConfig,
  useTestConnection,
  useSendTestEmail,
  useScheduleOverview,
  useDeliveryLogs,
  useTriggerReminders,
  useUpdateWeeklySchedule,
} from "../hooks/useNotifications";
import { SMTPConfigCard } from "../components/SMTPConfigCard";
import { ScheduleStatusCard } from "../components/ScheduleStatusCard";
import { DeliveryLogsTable } from "../components/DeliveryLogsTable";
import { TestEmailDialog } from "../components/TestEmailDialog";

export const NotificationsAdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Filter states for delivery logs
  const [logPage, setLogPage] = useState(0);
  const [logStatus, setLogStatus] = useState("");
  const [logType, setLogType] = useState("");
  const [logSearch, setLogSearch] = useState("");

  // Queries
  const { data: smtpConfig, isLoading: loadingConfig } = useSMTPConfig();
  const { data: scheduleOverview, isLoading: loadingSchedule } = useScheduleOverview();
  const {
    data: deliveryLogs,
    isLoading: loadingLogs,
    refetch: refetchLogs,
  } = useDeliveryLogs({
    page: logPage + 1,
    status: logStatus,
    notification_type: logType,
    search: logSearch,
  });

  // Mutations
  const updateConfigMutation = useUpdateSMTPConfig();
  const testConnectionMutation = useTestConnection();
  const sendTestEmailMutation = useSendTestEmail();
  const triggerRemindersMutation = useTriggerReminders();
  const updateScheduleMutation = useUpdateWeeklySchedule();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, margin: "0 auto" }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
          <NotificationsActiveIcon sx={{ color: "#2563eb", fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            System Alerts & Notification Settings
          </Typography>
          <Chip
            size="small"
            label={smtpConfig?.is_enabled ? "Alerts Active" : "Alerts Paused"}
            color={smtpConfig?.is_enabled ? "success" : "default"}
            sx={{ fontWeight: 600 }}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
          Enterprise SMTP configuration, automatic task assignment alerts, and scheduled weekend reminder workflows.
        </Typography>
      </Box>

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<SettingsIcon fontSize="small" />} iconPosition="start" label="SMTP Server Settings" />
          <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label="Recurring Reminder Schedule" />
          <Tab
            icon={<HistoryIcon fontSize="small" />}
            iconPosition="start"
            label={`Delivery Audit Log (${deliveryLogs?.count ?? 0})`}
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <SMTPConfigCard
          config={smtpConfig}
          isLoading={loadingConfig}
          onSave={payload => updateConfigMutation.mutateAsync(payload)}
          onTestConnection={configOverride => testConnectionMutation.mutateAsync(configOverride)}
          onOpenSendTestModal={() => setTestModalOpen(true)}
          isSaving={updateConfigMutation.isPending}
        />
      )}

      {activeTab === 1 && (
        <ScheduleStatusCard
          overview={scheduleOverview}
          isLoading={loadingSchedule}
          onTriggerNow={params => triggerRemindersMutation.mutateAsync(params)}
          isTriggering={triggerRemindersMutation.isPending}
          onUpdateSchedule={schedule => updateScheduleMutation.mutateAsync({ schedule })}
        />
      )}

      {activeTab === 2 && (
        <DeliveryLogsTable
          logsData={deliveryLogs}
          isLoading={loadingLogs}
          page={logPage}
          onPageChange={setLogPage}
          statusFilter={logStatus}
          onStatusFilterChange={setLogStatus}
          typeFilter={logType}
          onTypeFilterChange={setLogType}
          search={logSearch}
          onSearchChange={setLogSearch}
          onRefresh={refetchLogs}
        />
      )}

      {/* Test Email Dialog */}
      <TestEmailDialog
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        onSend={payload => sendTestEmailMutation.mutateAsync(payload)}
      />
    </Box>
  );
};
