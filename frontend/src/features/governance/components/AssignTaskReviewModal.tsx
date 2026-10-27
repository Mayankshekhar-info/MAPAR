import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { SimpleUser } from "../types/governance.types";
import { governanceService } from "../api/governanceService";
import { useAssignTaskReview } from "../hooks/useGovernance";

interface AssignTaskReviewModalProps {
  open: boolean;
  onClose: () => void;
  actionId: number;
  actionIdDisplay: string;
  actionPointTitle: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const AssignTaskReviewModal: React.FC<AssignTaskReviewModalProps> = ({
  open,
  onClose,
  actionId,
  actionIdDisplay,
  actionPointTitle,
  onSuccess,
  onError,
}) => {
  const [userOptions, setUserOptions] = useState<SimpleUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SimpleUser | null>(null);
  const [instructions, setInstructions] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const assignMutation = useAssignTaskReview();
  const isAssigning = assignMutation.isPending;

  useEffect(() => {
    if (!open) {
      setSelectedUser(null);
      setInstructions("");
      setSearchQuery("");
      setFormError(null);
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

  const handleSubmit = async () => {
    if (!selectedUser) {
      setFormError("Please select an application user to assign as the reviewer.");
      return;
    }

    setFormError(null);

    try {
      const res = await assignMutation.mutateAsync({
        actionId,
        payload: {
          reviewer_id: selectedUser.id,
          instructions: instructions.trim(),
        },
      });

      const reviewerName = selectedUser.full_name || selectedUser.username;
      const successMsg = res.message || `Task assigned for review to ${reviewerName}.`;
      if (onSuccess) onSuccess(successMsg);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.reviewer || err?.response?.data?.message || err?.message || "Failed to assign task for review.";
      setFormError(msg);
      if (onError) onError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isAssigning) onClose();
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
          <FactCheckIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem", color: colorTokens.text.primary }}>
            Assign Task for Review
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            {actionIdDisplay} &bull; {actionPointTitle}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {formError && (
          <Alert severity="error" sx={{ borderRadius: radiusTokens.sm }}>
            {formError}
          </Alert>
        )}

        <Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, mb: 1, display: "block" }}>
            SELECT REVIEWER *
          </Typography>
          <Autocomplete
            options={userOptions}
            getOptionLabel={(opt) => `${opt.full_name || opt.username} (${opt.email || opt.role || "User"})`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedUser}
            onChange={(_, val) => {
              setSelectedUser(val);
              if (val) setFormError(null);
            }}
            inputValue={searchQuery}
            onInputChange={(_, newInputValue) => setSearchQuery(newInputValue)}
            loading={isSearchingUsers}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search reviewer by name, username, or email..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <PersonOutlineIcon sx={{ color: colorTokens.text.muted, mr: 1, fontSize: 18 }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {isSearchingUsers ? <CircularProgress size={16} sx={{ color: colorTokens.primary.main }} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ py: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    {option.full_name || option.username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    {option.email ? `${option.email} • ` : ""}
                    Role: {option.role}
                  </Typography>
                </Box>
              </Box>
            )}
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, mb: 1, display: "block" }}>
            REVIEW INSTRUCTIONS / GUIDELINES (OPTIONAL)
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            size="small"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Specify areas for reviewer attention, checklists, or questions..."
          />
        </Box>

        <Alert severity="info" sx={{ borderRadius: radiusTokens.sm, fontSize: "0.82rem" }}>
          The selected reviewer will be notified via email with task details and an inspection link. Core task status (Open/WIP/Closed) will remain separate and unchanged.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
        <Button
          onClick={onClose}
          disabled={isAssigning}
          sx={{ color: colorTokens.text.secondary, textTransform: "none", fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedUser || isAssigning}
          startIcon={isAssigning ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <FactCheckIcon sx={{ fontSize: 18 }} />}
          sx={{
            bgcolor: colorTokens.primary.main,
            color: "#FFFFFF",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: radiusTokens.sm,
            px: 2.5,
            "&:hover": { bgcolor: colorTokens.primary.dark },
          }}
        >
          {isAssigning ? "Assigning..." : "Assign for Review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
