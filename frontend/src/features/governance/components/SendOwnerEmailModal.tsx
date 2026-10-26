import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BlockIcon from "@mui/icons-material/Block";
import SendIcon from "@mui/icons-material/Send";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { governanceService } from "../api/governanceService";
import { OwnerEmailPreviewResponse, OwnerEmailSendResponse } from "../types/governance.types";

interface SendOwnerEmailModalProps {
  open: boolean;
  onClose: () => void;
  ownerId: number | null;
  ownerName: string;
  fallbackEmail?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const SendOwnerEmailModal: React.FC<SendOwnerEmailModalProps> = ({
  open,
  onClose,
  ownerId,
  ownerName,
  fallbackEmail,
  onSuccess,
  onError,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<OwnerEmailPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<OwnerEmailSendResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreviewData(null);
      setPreviewError(null);
      setSendResult(null);
      setSendError(null);
      setIsSending(false);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);
    setSendResult(null);
    setSendError(null);

    governanceService
      .getOwnerEmailPreview(ownerId || 0, ownerName)
      .then((res) => {
        setPreviewData(res);
        setLoadingPreview(false);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || "Failed to load owner email preview.";
        setPreviewError(msg);
        setLoadingPreview(false);
      });
  }, [open, ownerId, ownerName]);

  const handleSend = async () => {
    if (!previewData || !previewData.has_eligible_tasks || isSending) return;

    setIsSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      const response = await governanceService.sendOwnerEmail(ownerId || 0, {
        owner_name: ownerName,
      });

      if (response.success) {
        setSendResult(response);
        setIsSending(false);
        if (onSuccess) {
          onSuccess(response.message || `Consolidated email sent to ${response.recipient_email}`);
        }
      } else {
        const errorMsg = response.message || "Failed to dispatch email.";
        setSendError(errorMsg);
        setIsSending(false);
        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || "An unexpected error occurred while sending email.";
      setSendError(errorMsg);
      setIsSending(false);
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const recipientDisplayEmail = previewData?.recipient_email || fallbackEmail || "No email registered";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isSending) onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
        },
      }}
    >
      <DialogTitle
        sx={{
          py: 2,
          px: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: radiusTokens.md,
            bgcolor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colorTokens.primary.main,
          }}
        >
          <EmailOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem", color: colorTokens.text.primary }}>
            Send Consolidated Action Tasks Email
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            One single email sent to the assigned owner containing all active non-closed tasks
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loadingPreview ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 5, gap: 1.5 }}>
            <CircularProgress size={36} sx={{ color: colorTokens.primary.main }} />
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Evaluating assigned tasks and recipient details...
            </Typography>
          </Box>
        ) : previewError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {previewError}
          </Alert>
        ) : sendResult ? (
          <Box sx={{ py: 2 }}>
            <Alert
              severity="success"
              icon={<CheckCircleOutlineIcon sx={{ fontSize: 24 }} />}
              sx={{
                mb: 2,
                borderRadius: radiusTokens.md,
                border: "1px solid #BBF7D0",
                bgcolor: "#F0FDF4",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Email Successfully Dispatched!
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "#166534" }}>
                {sendResult.message}
              </Typography>
            </Alert>

            <Box
              sx={{
                p: 2,
                bgcolor: "#F8FAFC",
                borderRadius: radiusTokens.md,
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 0.5 }}>
                DELIVERY DETAILS
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.85rem", mb: 0.5 }}>
                <strong>Recipient:</strong> {sendResult.recipient_name} ({sendResult.recipient_email})
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.85rem", mb: 0.5 }}>
                <strong>Included Tasks:</strong> {sendResult.task_count} action points
              </Typography>
              {sendResult.closed_excluded_count !== undefined && sendResult.closed_excluded_count > 0 && (
                <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "#64748B" }}>
                  <strong>Closed Tasks Excluded:</strong> {sendResult.closed_excluded_count}
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sendError && (
              <Alert severity="error" sx={{ borderRadius: radiusTokens.sm }}>
                {sendError}
              </Alert>
            )}

            {/* Recipient Information Card */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#F8FAFC",
                borderRadius: radiusTokens.md,
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 1, letterSpacing: "0.04em" }}
              >
                TARGET RECIPIENT
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                <PersonOutlineIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.92rem" }}>
                  {previewData?.recipient_name || ownerName}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pl: 0.5 }}>
                <EmailOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
                <Typography
                  variant="body2"
                  sx={{
                    color: previewData?.has_valid_email ? colorTokens.text.secondary : "#DC2626",
                    fontWeight: 500,
                    fontSize: "0.85rem",
                  }}
                >
                  {recipientDisplayEmail}
                </Typography>
              </Box>

              <Box sx={{ mt: 1, pt: 1, borderTop: "1px dashed #E2E8F0" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.75rem" }}>
                  <strong>CC:</strong> Configured governance review recipients (including shakti.singh@pratap.co.in)
                </Typography>
              </Box>
            </Box>

            {/* Eligibility & Summary Metrics */}
            {previewData && !previewData.has_eligible_tasks ? (
              <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{
                  borderRadius: radiusTokens.md,
                  bgcolor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  No Eligible Tasks to Send
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                  {previewData.no_eligible_reason || "This action owner has no active non-closed tasks to review."}
                </Typography>
                {previewData.closed_tasks_excluded_count > 0 && (
                  <Typography variant="body2" sx={{ fontSize: "0.82rem", mt: 0.5, fontWeight: 600 }}>
                    Notice: All {previewData.closed_tasks_excluded_count} assigned task(s) are in Closed status and were excluded from email dispatch.
                  </Typography>
                )}
              </Alert>
            ) : (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 1, letterSpacing: "0.04em" }}
                >
                  EMAIL CONTENT BREAKDOWN
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: radiusTokens.sm,
                      bgcolor: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#1E40AF", fontWeight: 700, display: "block" }}>
                      ELIGIBLE ACTIVE TASKS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D4ED8", mt: 0.25 }}>
                      {previewData?.eligible_task_count ?? 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#3B82F6", fontSize: "0.72rem" }}>
                      Included in 1 single email
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: radiusTokens.sm,
                      bgcolor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700, display: "block" }}>
                      CLOSED TASKS EXCLUDED
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#475569", mt: 0.25 }}>
                      {previewData?.closed_tasks_excluded_count ?? 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.72rem" }}>
                      Filtered out automatically
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                  {previewData && previewData.overdue_count > 0 && (
                    <Chip
                      icon={<WarningAmberIcon sx={{ fontSize: "14px !important", color: "#DC2626 !important" }} />}
                      label={`${previewData.overdue_count} Overdue`}
                      size="small"
                      sx={{ bgcolor: "#FEF2F2", color: "#DC2626", fontWeight: 700, fontSize: "0.75rem", border: "1px solid #FECACA" }}
                    />
                  )}
                  {previewData && previewData.high_priority_count > 0 && (
                    <Chip
                      label={`${previewData.high_priority_count} High Priority`}
                      size="small"
                      sx={{ bgcolor: "#FFFBEB", color: "#D97706", fontWeight: 700, fontSize: "0.75rem", border: "1px solid #FDE68A" }}
                    />
                  )}
                </Box>

                {previewData && previewData.action_ids.length > 0 && (
                  <Box sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: radiusTokens.sm, border: "1px solid #E2E8F0" }}>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600, display: "block", mb: 0.5 }}>
                      Action Points included in this email:
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {previewData.action_ids.map((aid) => (
                        <Chip
                          key={aid}
                          label={aid}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            height: 22,
                            bgcolor: "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            color: "#334155",
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Button
          onClick={onClose}
          disabled={isSending}
          sx={{
            color: colorTokens.text.secondary,
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          {sendResult ? "Close" : "Cancel"}
        </Button>

        {!sendResult && (
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!previewData?.has_eligible_tasks || isSending || loadingPreview}
            startIcon={
              isSending ? <CircularProgress size={16} sx={{ color: "#FFFFFF" }} /> : <SendIcon sx={{ fontSize: 16 }} />
            }
            sx={{
              bgcolor: colorTokens.primary.main,
              color: "#FFFFFF",
              fontWeight: 700,
              textTransform: "none",
              px: 2.5,
              borderRadius: radiusTokens.sm,
              boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
              "&:hover": {
                bgcolor: colorTokens.primary.dark,
              },
              "&.Mui-disabled": {
                bgcolor: "#E2E8F0",
                color: "#94A3B8",
              },
            }}
          >
            {isSending ? "Sending Consolidated Email..." : "Send Email"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
