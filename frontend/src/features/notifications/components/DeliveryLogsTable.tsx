import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RefreshIcon from "@mui/icons-material/Refresh";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { EmailDeliveryRecord, PaginatedDeliveryLogs } from "../types/notifications.types";

interface Props {
  logsData: PaginatedDeliveryLogs | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (newPage: number) => void;
  statusFilter: string;
  onStatusFilterChange: (newStatus: string) => void;
  typeFilter: string;
  onTypeFilterChange: (newType: string) => void;
  search: string;
  onSearchChange: (newSearch: string) => void;
  onRefresh: () => void;
}

export const DeliveryLogsTable: React.FC<Props> = ({
  logsData,
  isLoading,
  page,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  onRefresh,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<EmailDeliveryRecord | null>(null);

  const getStatusChip = (status: string) => {
    switch (status) {
      case "SENT":
        return <Chip icon={<CheckCircleIcon />} label="Sent" color="success" size="small" sx={{ fontWeight: 600 }} />;
      case "RETRYING":
        return <Chip icon={<AutorenewIcon />} label="Retrying" color="warning" size="small" sx={{ fontWeight: 600 }} />;
      case "FAILED":
        return <Chip icon={<ErrorIcon />} label="Failed" color="error" size="small" sx={{ fontWeight: 600 }} />;
      default:
        return <Chip icon={<HourglassEmptyIcon />} label="Pending" size="small" sx={{ fontWeight: 600 }} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "TASK_ASSIGNMENT":
        return "Task Assignment";
      case "TASK_REASSIGNMENT":
        return "Reassignment";
      case "TASK_REMINDER":
        return "Weekly Reminder";
      case "TEST_EMAIL":
        return "Test Email";
      default:
        return type;
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: shadowTokens.subtle,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
            Email Delivery & Audit Log
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Complete audit trail of automated assignment notifications and recurring scheduled reminders.
          </Typography>
        </Box>
        <IconButton onClick={onRefresh} color="primary" size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search by Action ID, recipient, subject..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <TextField
          size="small"
          select
          label="Status"
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="SENT">Sent</MenuItem>
          <MenuItem value="FAILED">Failed</MenuItem>
          <MenuItem value="RETRYING">Retrying</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
        </TextField>
        <TextField
          size="small"
          select
          label="Notification Type"
          value={typeFilter}
          onChange={e => onTypeFilterChange(e.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All Notification Types</MenuItem>
          <MenuItem value="TASK_ASSIGNMENT">Task Assignment</MenuItem>
          <MenuItem value="TASK_REASSIGNMENT">Task Reassignment</MenuItem>
          <MenuItem value="TASK_REMINDER">Weekly Reminder</MenuItem>
          <MenuItem value="TEST_EMAIL">Test Email</MenuItem>
        </TextField>
      </Stack>

      <TableContainer sx={{ border: `1px solid ${colorTokens.workspace.border}`, borderRadius: radiusTokens.sm }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Action ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Recipient</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Attempts</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : !logsData?.results || logsData.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: colorTokens.text.secondary }}>
                  No email delivery records found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              logsData.results.map(record => (
                <TableRow key={record.id} hover>
                  <TableCell>{getStatusChip(record.status)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
                      {getTypeLabel(record.notification_type)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#2563eb", fontSize: 13 }}>
                      {record.action_id || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                      {record.recipient_email}
                    </Typography>
                    {record.cc_emails && record.cc_emails.length > 0 && (
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                        CC: {record.cc_emails.length} address(es)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>
                      {record.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                      {record.attempts}/{record.max_attempts}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 12, color: colorTokens.text.secondary }}>
                      {record.sent_at ? new Date(record.sent_at).toLocaleString() : new Date(record.created_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Delivery Audit Details">
                      <IconButton size="small" onClick={() => setSelectedRecord(record)}>
                        <InfoOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={logsData?.count || 0}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={20}
        rowsPerPageOptions={[20]}
      />

      {/* Record Detail Dialog */}
      <Dialog
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Delivery Record Details</DialogTitle>
        <DialogContent dividers>
          {selectedRecord && (
            <Stack spacing={1.5} sx={{ fontSize: 13 }}>
              <Box>
                <strong>Idempotency Key:</strong>
                <Typography variant="body2" sx={{ fontFamily: "monospace", bgcolor: "#f1f5f9", p: 0.5, borderRadius: 1 }}>
                  {selectedRecord.idempotency_key}
                </Typography>
              </Box>
              <Box>
                <strong>Recipient:</strong> {selectedRecord.recipient_name} ({selectedRecord.recipient_email})
              </Box>
              <Box>
                <strong>Mandatory CC Addresses:</strong>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {selectedRecord.cc_emails.map(cc => (
                    <Chip key={cc} label={cc} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Box>
                <strong>Subject:</strong> {selectedRecord.subject}
              </Box>
              <Box>
                <strong>Status:</strong> {selectedRecord.status} (Attempts: {selectedRecord.attempts}/{selectedRecord.max_attempts})
              </Box>
              {selectedRecord.scheduled_slot && (
                <Box>
                  <strong>Scheduled Slot:</strong> {selectedRecord.scheduled_slot}
                </Box>
              )}
              {selectedRecord.error_message && (
                <Box>
                  <strong style={{ color: "#dc2626" }}>Error Details:</strong>
                  <Typography variant="body2" sx={{ color: "#dc2626", bgcolor: "#fef2f2", p: 1, borderRadius: 1, mt: 0.5 }}>
                    {selectedRecord.error_message}
                  </Typography>
                </Box>
              )}
              <Box>
                <strong>Summary:</strong>
                <Typography variant="body2" sx={{ whiteSpace: "pre-line", bgcolor: "#f8fafc", p: 1, borderRadius: 1, mt: 0.5 }}>
                  {selectedRecord.body_summary}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRecord(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};
