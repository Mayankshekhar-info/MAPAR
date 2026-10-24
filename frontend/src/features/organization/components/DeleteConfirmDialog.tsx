import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { NodeDetail } from "../types/organization.types";
import { HIERARCHY_CONFIG } from "../utils/hierarchy";
import { colorTokens } from "../../../app/theme/tokens";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  nodeDetail: NodeDetail;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onClose,
  nodeDetail,
  onConfirm,
  isDeleting,
}) => {
  const cfg = HIERARCHY_CONFIG[nodeDetail.level];
  const hasChildren = Boolean(nodeDetail.children_count && nodeDetail.children_count > 0);
  const childLevelCfg = cfg?.child_level ? HIERARCHY_CONFIG[cfg.child_level] : null;

  return (
    <Dialog
      open={open}
      onClose={isDeleting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberIcon color={hasChildren ? "warning" : "error"} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            {hasChildren ? "Deletion Blocked" : `Delete ${cfg?.name || "Node"}?`}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ py: 2 }}>
        {hasChildren ? (
          <Alert severity="warning" sx={{ borderRadius: "10px" }}>
            <strong>Cannot delete &quot;{nodeDetail.name}&quot;</strong>: It currently contains{" "}
            <strong>
              {nodeDetail.children_count} {childLevelCfg?.plural_name || "child items"}
            </strong>
            . To maintain organizational data integrity, you must first delete or reassign all
            child nodes.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: colorTokens.text.primary }}>
              Are you sure you want to delete <strong>{nodeDetail.name}</strong> (
              <span style={{ fontFamily: "monospace" }}>{nodeDetail.code}</span>)?
            </Typography>
            <Alert severity="error" sx={{ borderRadius: "10px" }}>
              This action cannot be undone. All audit trails and historical associations will be
              permanently updated.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isDeleting} sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>
          {hasChildren ? "Understood" : "Cancel"}
        </Button>
        {!hasChildren && (
          <Button
            id="btn-confirm-delete-node"
            variant="contained"
            color="error"
            onClick={onConfirm}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 600, borderRadius: "10px", px: 2.5 }}
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
