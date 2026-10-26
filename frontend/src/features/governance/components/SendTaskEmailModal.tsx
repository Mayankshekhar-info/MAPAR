import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { SimpleUser } from "../types/governance.types";
import { governanceService } from "../api/governanceService";
import { useSendUrgentFollowUpEmail } from "../hooks/useGovernance";

export interface SendTaskEmailTargetTask {
  id: number;
  action_id: string;
  action_point: string;
  owner_name?: string;
  owner?: { id: number; full_name?: string; email?: string } | null;
  priority?: string;
  status?: string;
  bucket?: string;
}

interface SendTaskEmailModalProps {
  open: boolean;
  onClose: () => void;
  task: SendTaskEmailTargetTask | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const SendTaskEmailModal: React.FC<SendTaskEmailModalProps> = ({
  open,
  onClose,
  task,
  onSuccess,
  onError,
}) => {
  const [recipientMode, setRecipientMode] = useState<"owner" | "other">("owner");
  const [userOptions, setUserOptions] = useState<SimpleUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SimpleUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const sendEmailMutation = useSendUrgentFollowUpEmail();
  const isSending = sendEmailMutation.isPending;

  // Load application users from database when modal opens or query changes
  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setSelectedUser(null);
      setSearchQuery("");
      setRecipientMode("owner");
      return;
    }

    let active = true;
    setIsSearchingUsers(true);

    const timer = setTimeout(() => {
      governanceService
        .getHierarchyUsers(undefined, undefined, searchQuery.trim() || undefined)
        .then((users) => {
          if (active) {
            setUserOptions(Array.isArray(users) ? users : []);
            setIsSearchingUsers(false);
          }
        })
        .catch(() => {
          if (active) {
            setUserOptions([]);
            setIsSearchingUsers(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, searchQuery]);

  if (!task) return null;

  const ownerDisplayName = task.owner?.full_name || task.owner_name || "Assigned Owner";
  const ownerEmail = task.owner?.email || "";

  const handleSend = async () => {
    if (isSending) return;
    setFeedback(null);

    const recipientUserId = recipientMode === "other" && selectedUser ? selectedUser.id : undefined;

    if (recipientMode === "other" && !selectedUser) {
      setFeedback({ type: "error", message: "Please select an application user from the list." });
      return;
    }

    try {
      const res = await sendEmailMutation.mutateAsync({
        actionId: task.id,
        recipientUserId,
      });

      if (res.success) {
        const successMsg =
          res.message ||
          (recipientMode === "other" && selectedUser
            ? `Email alert for ${task.action_id} sent to ${selectedUser.full_name} (${selectedUser.email}).`
            : `Email alert for ${task.action_id} sent to ${ownerDisplayName}.`);
        setFeedback({ type: "success", message: successMsg });
        if (onSuccess) onSuccess(successMsg);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const errorMsg = res.message || "Failed to send email alert.";
        setFeedback({ type: "error", message: errorMsg });
        if (onError) onError(errorMsg);
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send email alert. Please check network and email configuration.";
      setFeedback({ type: "error", message: errMsg });
      if (onError) onError(errMsg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <EmailOutlinedIcon sx={{ color: colorTokens.primary.main, fontSize: 24 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
          Send Governance Task Email Alert
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {/* Task Overview Card */}
        <Box
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            backgroundColor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
              {task.action_id}
            </Typography>
            {task.priority && (
              <Chip
                label={`${task.priority} Priority`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  backgroundColor: task.priority === "High" ? "#FEE2E2" : "#FEF3C7",
                  color: task.priority === "High" ? "#DC2626" : "#D97706",
                }}
              />
            )}
            {task.status && (
              <Chip
                label={task.status}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  backgroundColor: task.status === "Closed" ? "#ECFDF5" : "#EFF6FF",
                  color: task.status === "Closed" ? "#047857" : "#1D4ED8",
                }}
              />
            )}
            {task.bucket && (
              <Chip
                label={task.bucket}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  backgroundColor: "#EFF6FF",
                  color: "#1D4ED8",
                }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontWeight: 500, lineHeight: 1.45 }}>
            {task.action_point}
          </Typography>
        </Box>

        {/* Recipient Selection */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
          Select Recipient
        </Typography>

        <FormControl component="fieldset" sx={{ width: "100%", mb: 2 }}>
          <RadioGroup
            value={recipientMode}
            onChange={(e) => setRecipientMode(e.target.value as "owner" | "other")}
          >
            <FormControlLabel
              value="owner"
              control={<Radio size="small" />}
              label={
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                    Assigned Task Owner
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    {ownerDisplayName} {ownerEmail ? `(${ownerEmail})` : "(Email mapped from profile)"}
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="other"
              control={<Radio size="small" />}
              label={
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                    Send to Any Application User
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Select any registered MAPAR user to dispatch task details to their email
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {/* User Search & Selection Dropdown */}
        {recipientMode === "other" && (
          <Box sx={{ mb: 2.5, pl: 4 }}>
            <Autocomplete
              options={userOptions}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              inputValue={searchQuery}
              onInputChange={(_, newInputValue) => setSearchQuery(newInputValue)}
              getOptionLabel={(option) => `${option.full_name || option.username} (${option.email || "No email"})`}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              loading={isSearchingUsers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search user by name, username, or email"
                  placeholder="Type to filter registered users..."
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearchingUsers ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: "flex", flexDirection: "column", py: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonOutlineIcon sx={{ fontSize: 16, color: colorTokens.text.secondary }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {option.full_name || option.username}
                      </Typography>
                      {option.role && (
                        <Chip label={option.role} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary, ml: 3 }}>
                      {option.email || "No email registered"}
                    </Typography>
                  </Box>
                </li>
              )}
            />

            {selectedUser && !selectedUser.email && (
              <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: "0.78rem" }}>
                This user does not have a registered email address in their profile.
              </Alert>
            )}
          </Box>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <Alert severity={feedback.type} sx={{ mt: 2, borderRadius: radiusTokens.md }}>
            {feedback.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={isSending}
          sx={{ textTransform: "none", color: colorTokens.text.secondary }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={isSending || (recipientMode === "other" && (!selectedUser || !selectedUser.email))}
          startIcon={isSending ? <CircularProgress size={14} color="inherit" /> : <EmailOutlinedIcon />}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            backgroundColor: colorTokens.primary.main,
            "&:hover": { backgroundColor: colorTokens.primary.dark },
          }}
        >
          {isSending ? "Sending Email..." : "Send Email"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
