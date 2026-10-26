import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { governanceService } from "../api/governanceService";
import {
  StatusMatrixEmailPreviewResponse,
  StatusMatrixEmailSendResponse,
} from "../types/governance.types";

interface SendMatrixEmailModalProps {
  open: boolean;
  onClose: () => void;
  reportingWeek?: string;
  circleId?: number | null;
}

export const SendMatrixEmailModal: React.FC<SendMatrixEmailModalProps> = ({
  open,
  onClose,
  reportingWeek,
  circleId,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<StatusMatrixEmailPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<StatusMatrixEmailSendResponse | null>(null);
  const [overrideEmail, setOverrideEmail] = useState("");
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  useEffect(() => {
    if (open) {
      setSendResult(null);
      setPreviewError(null);
      setLoadingPreview(true);
      governanceService
        .getStatusMatrixEmailPreview({ reporting_week: reportingWeek, circle_id: circleId })
        .then((data) => {
          setPreviewData(data);
          setLoadingPreview(false);
        })
        .catch((err) => {
          setPreviewError(err?.response?.data?.message || err?.message || "Failed to load recipient preview.");
          setLoadingPreview(false);
        });
    } else {
      setPreviewData(null);
      setSendResult(null);
      setOverrideEmail("");
      setShowOverrideInput(false);
    }
  }, [open, reportingWeek, circleId]);

  const handleSendEmails = async () => {
    setSending(true);
    setPreviewError(null);
    try {
      const res = await governanceService.sendStatusMatrixEmails({
        reporting_week: reportingWeek,
        circle_id: circleId,
        override_recipient_email: overrideEmail.trim() || undefined,
      });
      setSendResult(res);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Failed to dispatch matrix emails.";
      setPreviewError(errMsg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #102A71 0%, #173B96 60%, #1D4ED8 100%)",
          color: "#FFFFFF",
          p: 2.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmailOutlinedIcon sx={{ color: "#FFFFFF", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2 }}>
              Send Action Status Matrix Emails
            </Typography>
            <Typography variant="caption" sx={{ color: "#C7D2FE", fontSize: "0.75rem" }}>
              Consolidated Action Owner Notification &bull; PAGMS Governance
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={sending}
          size="small"
          sx={{ color: "rgba(255, 255, 255, 0.8)", "&:hover": { color: "#FFFFFF" } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: "#FAFAFA" }}>
        {/* Loading state for preview */}
        {loadingPreview && (
          <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress size={36} sx={{ color: colorTokens.primary.main }} />
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Analyzing Action Status Matrix and grouping tasks by recipient...
            </Typography>
          </Box>
        )}

        {/* Error message */}
        {previewError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {previewError}
          </Alert>
        )}

        {/* Results Screen after Send */}
        {sendResult && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert
              severity={sendResult.failed_count === 0 ? "success" : "warning"}
              icon={sendResult.failed_count === 0 ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
              sx={{ fontWeight: 600 }}
            >
              {sendResult.message}
            </Alert>

            {/* Metrics Breakdown */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5 }}>
              <Paper sx={{ p: 1.5, textAlign: "center", borderRadius: radiusTokens.md, backgroundColor: "#FFFFFF" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700 }}>
                  TOTAL RECIPIENTS
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                  {sendResult.total_recipients}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, textAlign: "center", borderRadius: radiusTokens.md, backgroundColor: "#EFF6FF" }}>
                <Typography variant="caption" sx={{ color: "#1D4ED8", fontWeight: 700 }}>
                  EMAILS SENT
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#1D4ED8" }}>
                  {sendResult.sent_count}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, textAlign: "center", borderRadius: radiusTokens.md, backgroundColor: sendResult.failed_count > 0 ? "#FEE2E2" : "#F8FAFC" }}>
                <Typography variant="caption" sx={{ color: sendResult.failed_count > 0 ? "#DC2626" : colorTokens.text.muted, fontWeight: 700 }}>
                  FAILED
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: sendResult.failed_count > 0 ? "#DC2626" : colorTokens.text.muted }}>
                  {sendResult.failed_count}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, textAlign: "center", borderRadius: radiusTokens.md, backgroundColor: "#F8FAFC" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700 }}>
                  TASKS INCLUDED
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                  {sendResult.total_tasks}
                </Typography>
              </Paper>
            </Box>

            {/* Individual Delivery Breakdown Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mt: 1 }}>
              Delivery Details:
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E2E8F0", borderRadius: radiusTokens.md, maxHeight: 240 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#F1F5F9" }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#F1F5F9" }} align="center">Tasks</TableCell>
                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#F1F5F9" }}>Action IDs</TableCell>
                    <TableCell sx={{ fontWeight: 700, backgroundColor: "#F1F5F9" }} align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sendResult.results.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.recipient_name}</Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>{r.recipient_email}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={`${r.task_count} tasks`} size="small" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {r.action_ids.slice(0, 4).map((aid) => (
                            <Chip key={aid} label={aid} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                          ))}
                          {r.action_ids.length > 4 && (
                            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                              +{r.action_ids.length - 4} more
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {r.status === "SENT" ? (
                          <Chip label="SENT" size="small" sx={{ backgroundColor: "#DCFCE7", color: "#166534", fontWeight: 700 }} />
                        ) : r.status === "SKIPPED" ? (
                          <Chip label="SKIPPED" size="small" sx={{ backgroundColor: "#FEF3C7", color: "#B45309", fontWeight: 700 }} />
                        ) : (
                          <Chip label="FAILED" size="small" sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700 }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Confirmation Screen before Send */}
        {!loadingPreview && !sendResult && previewData && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Explanatory Info Card */}
            <Alert
              severity="info"
              icon={<InfoOutlinedIcon sx={{ color: "#1D4ED8" }} />}
              sx={{
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#1E3A8A",
                "& .MuiAlert-message": { fontSize: "0.82rem", lineHeight: 1.5 },
              }}
            >
              <strong>1 Consolidated Email Per User:</strong> Each action owner will receive a single formatted PAGMS Governance email containing all tasks currently assigned to them. Duplicate accounts with identical emails are automatically merged.
            </Alert>

            {/* Summary KPI Cards */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid #BFDBFE",
                  borderRadius: radiusTokens.md,
                  backgroundColor: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "#EFF6FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PeopleAltOutlinedIcon sx={{ color: "#2563EB", fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#2563EB", fontWeight: 800, textTransform: "uppercase", fontSize: "0.7rem" }}>
                    TOTAL RECIPIENTS
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    {previewData.distinct_recipients_count}
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid #FED7AA",
                  borderRadius: radiusTokens.md,
                  backgroundColor: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "#FFF7ED",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AssignmentOutlinedIcon sx={{ color: "#EA580C", fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#EA580C", fontWeight: 800, textTransform: "uppercase", fontSize: "0.7rem" }}>
                    ACTIVE TASKS
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    {previewData.total_tasks_count}
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid #FECACA",
                  borderRadius: radiusTokens.md,
                  backgroundColor: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "#FEF2F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <WarningAmberIcon sx={{ color: "#DC2626", fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#DC2626", fontWeight: 800, textTransform: "uppercase", fontSize: "0.7rem" }}>
                    OVERDUE TASKS
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#991B1B" }}>
                    {previewData.total_overdue_count}
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {/* Recipients List Table */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
                Eligible Action Owners ({previewData.distinct_recipients_count}):
              </Typography>
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  border: "1px solid #E2E8F0",
                  borderRadius: radiusTokens.md,
                  maxHeight: 220,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: "#F8FAFC" }}>Action Owner</TableCell>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: "#F8FAFC" }}>Email Address</TableCell>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: "#F8FAFC" }} align="center">Tasks Assigned</TableCell>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: "#F8FAFC" }}>Action Points Included</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.recipients.map((rec, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                          {rec.recipient_name}
                        </TableCell>
                        <TableCell sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem" }}>
                          {rec.recipient_email}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${rec.task_count} task${rec.task_count > 1 ? "s" : ""}`}
                            size="small"
                            sx={{
                              backgroundColor: rec.overdue_count > 0 ? "#FEE2E2" : "#EFF6FF",
                              color: rec.overdue_count > 0 ? "#DC2626" : "#1D4ED8",
                              fontWeight: 700,
                              fontSize: "0.72rem",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {rec.action_ids.map((aid) => (
                              <Chip
                                key={aid}
                                label={aid}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.7rem", height: 20 }}
                              />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Controlled Test Override (Expandable) */}
            <Box sx={{ borderTop: "1px solid #E2E8F0", pt: 1.5 }}>
              {!showOverrideInput ? (
                <Button
                  size="small"
                  onClick={() => setShowOverrideInput(true)}
                  sx={{ textTransform: "none", fontSize: "0.75rem", color: colorTokens.text.secondary }}
                >
                  + Testing / Controlled Recipient Account Options
                </Button>
              ) : (
                <Box sx={{ backgroundColor: "#F1F5F9", p: 1.5, borderRadius: radiusTokens.sm }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "block", mb: 0.5 }}>
                    Controlled Test Recipient Override:
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="e.g. test.account@pratap.co.in"
                    value={overrideEmail}
                    onChange={(e) => setOverrideEmail(e.target.value)}
                    helperText="Leave empty to send directly to real Action Owners. If specified, all generated emails will be safely routed to this test email address."
                    sx={{ backgroundColor: "#FFFFFF" }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, backgroundColor: "#FFFFFF", borderTop: "1px solid #E2E8F0" }}>
        {sendResult ? (
          <Button
            variant="contained"
            onClick={onClose}
            sx={{
              backgroundColor: colorTokens.primary.main,
              color: "#FFFFFF",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: radiusTokens.sm,
            }}
          >
            Close
          </Button>
        ) : (
          <>
            <Button
              onClick={onClose}
              disabled={sending}
              sx={{ textTransform: "none", color: colorTokens.text.secondary, fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSendEmails}
              disabled={sending || loadingPreview || !previewData || previewData.distinct_recipients_count === 0}
              startIcon={sending ? <CircularProgress size={16} sx={{ color: "#FFFFFF" }} /> : <SendIcon />}
              sx={{
                backgroundColor: colorTokens.primary.main,
                color: "#FFFFFF",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: radiusTokens.sm,
                px: 2.5,
                "&:hover": {
                  backgroundColor: colorTokens.primary.dark,
                },
              }}
            >
              {sending
                ? "Dispatching Emails..."
                : `Confirm & Send ${previewData ? `(${previewData.distinct_recipients_count} Recipients)` : ""}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
