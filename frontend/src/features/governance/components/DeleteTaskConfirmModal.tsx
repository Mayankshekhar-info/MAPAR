import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface DeleteTaskConfirmModalProps {
  open: boolean;
  taskIdentifier: string;
  taskTitle: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTaskConfirmModal: React.FC<DeleteTaskConfirmModalProps> = ({
  open,
  taskIdentifier,
  taskTitle,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.md,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#FEE2E2",
            color: colorTokens.status.error.main,
            flexShrink: 0,
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "1.1rem" }}>
            Delete Task
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            This action cannot be undone
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 1.5 }}>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2 }}>
          Are you sure you want to permanently delete task{" "}
          <strong style={{ color: colorTokens.text.primary }}>{taskIdentifier}</strong>?
        </Typography>

        <Box
          sx={{
            p: 1.5,
            backgroundColor: "#F8FAFC",
            borderRadius: radiusTokens.sm,
            border: "1px solid #E2E8F0",
            mb: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 0.25, fontWeight: 600 }}>
            Task Description:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, wordBreak: "break-word" }}>
            {taskTitle}
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: colorTokens.status.error.main, display: "block", lineHeight: 1.4 }}>
          Deleting this task will permanently remove it along with all related target revisions, weekly updates, and review records.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={isLoading}
          sx={{
            color: colorTokens.text.secondary,
            borderColor: colorTokens.workspace.border,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: radiusTokens.sm,
            "&:hover": {
              borderColor: colorTokens.text.secondary,
              backgroundColor: "#F8FAFC",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          sx={{
            backgroundColor: colorTokens.status.error.main,
            color: "#fff",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: radiusTokens.sm,
            "&:hover": {
              backgroundColor: "#DC2626",
            },
          }}
        >
          {isLoading ? "Deleting..." : "Confirm Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

