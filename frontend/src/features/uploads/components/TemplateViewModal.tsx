import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SchemaIcon from "@mui/icons-material/Schema";
import PreviewIcon from "@mui/icons-material/Preview";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import dayjs from "dayjs";

import { UploadTemplate, UploadTemplateColumn, UploadTemplateVersion } from "../types/uploads.types";
import { useTemplateDetail, useDeleteTemplateVersion } from "../hooks/useTemplates";
import { TemplatePreviewTable } from "./TemplatePreviewTable";
import { LoadingState } from "../../../components/LoadingState";
import { colorTokens } from "../../../app/theme/tokens";

interface TemplateViewModalProps {
  open: boolean;
  template: UploadTemplate | null;
  onClose: () => void;
  onDownloadExcel?: (template: UploadTemplate) => void;
}

export const TemplateViewModal: React.FC<TemplateViewModalProps> = ({
  open,
  template,
  onClose,
  onDownloadExcel,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<UploadTemplateVersion | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

  const { data: detailTemplate, isLoading } = useTemplateDetail(template?.id || 0);
  const deleteVersionMutation = useDeleteTemplateVersion(template?.id || 0);

  const handleEditVersion = (ver: UploadTemplateVersion) => {
    if (!template) return;
    onClose();
    navigate(`/uploads/templates/create?templateId=${template.id}&editVersionId=${ver.id}`);
  };

  const handleConfirmDeleteVersion = async () => {
    if (!versionToDelete || !template) return;
    try {
      await deleteVersionMutation.mutateAsync(versionToDelete.id);
      setToastMessage(`Version v${versionToDelete.version_number} deleted successfully.`);
      setToastSeverity("success");
      setVersionToDelete(null);
      if (selectedVersionId === versionToDelete.id && detailTemplate?.versions) {
        const remaining = detailTemplate.versions.filter((v) => v.id !== versionToDelete.id);
        if (remaining.length > 0) {
          setSelectedVersionId(remaining[0].id);
        }
      }
    } catch (err: any) {
      setToastMessage(err?.response?.data?.message || err.message || "Failed to delete version.");
      setToastSeverity("error");
    }
  };

  // Sync selected version
  React.useEffect(() => {
    if (detailTemplate?.versions && detailTemplate.versions.length > 0) {
      setSelectedVersionId(detailTemplate.versions[0].id);
    }
  }, [detailTemplate]);

  if (!open || !template) return null;

  const currentVersion =
    detailTemplate?.versions?.find((v) => v.id === selectedVersionId) ||
    detailTemplate?.versions?.[0];

  const columns: UploadTemplateColumn[] = currentVersion?.columns || [];

  const formatValidationRules = (rules?: Record<string, unknown>) => {
    if (!rules || Object.keys(rules).length === 0) return "—";
    const parts: string[] = [];
    if (rules.min_value !== undefined) parts.push(`Min: ${rules.min_value}`);
    if (rules.max_value !== undefined) parts.push(`Max: ${rules.max_value}`);
    if (rules.min_length !== undefined) parts.push(`Min Len: ${rules.min_length}`);
    if (rules.max_length !== undefined) parts.push(`Max Len: ${rules.max_length}`);
    if (rules.reference_level) parts.push(`Hierarchy Ref: ${rules.reference_level}`);
    if (Array.isArray(rules.allowed_values) && rules.allowed_values.length > 0) {
      parts.push(`Allowed: [${rules.allowed_values.join(", ")}]`);
    }
    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  const getDataTypeColor = (dt: string) => {
    switch (dt) {
      case "INTEGER":
      case "DECIMAL":
      case "PERCENTAGE":
        return { bg: "#E0F2FE", color: "#0369A1" };
      case "DATE":
        return { bg: "#FEF3C7", color: "#B45309" };
      case "BOOLEAN":
        return { bg: "#EDE9FE", color: "#6D28D9" };
      case "REFERENCE":
        return { bg: "#DCFCE7", color: "#15803D" };
      default:
        return { bg: "#F1F5F9", color: "#475569" };
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          m: 0,
          p: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          bgcolor: colorTokens.workspace.surface,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "10px",
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
            }}
          >
            <VisibilityIcon fontSize="medium" />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                {template.name}
              </Typography>
              <Chip
                label={template.code}
                size="small"
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  bgcolor: colorTokens.workspace.background,
                  border: `1px solid ${colorTokens.workspace.border}`,
                }}
              />
              <Chip
                label={template.status}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  bgcolor:
                    template.status === "ACTIVE"
                      ? colorTokens.status.success.light
                      : colorTokens.secondary.lighter,
                  color:
                    template.status === "ACTIVE"
                      ? colorTokens.status.success.main
                      : colorTokens.secondary.main,
                  borderRadius: "6px",
                }}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Data Level: <strong>{template.data_level}</strong> &bull; Target Entity: <strong>{template.target_entity}</strong> &bull; Created by {template.created_by_name} on {dayjs(template.created_at).format("MMM D, YYYY")}
            </Typography>
          </Box>
        </Stack>

        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ py: 6 }}>
            <LoadingState message="Loading template details and column schema..." />
          </Box>
        ) : (
          <Box>
            {/* Version Bar & Tabs */}
            <Box
              sx={{
                px: 3,
                pt: 1.5,
                bgcolor: colorTokens.workspace.surface,
                borderBottom: `1px solid ${colorTokens.workspace.divider}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, val) => setActiveTab(val)}
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab icon={<SchemaIcon fontSize="small" />} iconPosition="start" label={`Columns Schema (${columns.length})`} />
                <Tab icon={<PreviewIcon fontSize="small" />} iconPosition="start" label="Live Table Preview" />
                <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label={`Versions (${detailTemplate?.versions?.length || 1})`} />
              </Tabs>

              {detailTemplate?.versions && detailTemplate.versions.length > 1 && (
                <TextField
                  select
                  size="small"
                  label="Version"
                  value={selectedVersionId || ""}
                  onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                  sx={{ width: 140, mb: 1 }}
                >
                  {detailTemplate.versions.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      Version {v.version_number} {v.is_active ? "(Active)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>

            {/* Template Description */}
            {template.description && (
              <Box sx={{ px: 3, py: 1.5, bgcolor: colorTokens.workspace.background, borderBottom: `1px solid ${colorTokens.workspace.divider}` }}>
                <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                  <strong>Description:</strong> {template.description}
                </Typography>
              </Box>
            )}

            {/* Tab 0: Columns Schema */}
            {activeTab === 0 && (
              <Box sx={{ p: 2.5 }}>
                <TableContainer sx={{ border: `1px solid ${colorTokens.workspace.border}`, borderRadius: "10px", maxHeight: 420 }}>
                  <Table stickyHeader size="small">
                    <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 50 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Display Header</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Internal Field Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Data Type</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Required</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Unique</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Default Value</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Validation Rules &amp; Hierarchy</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {columns.map((col, idx) => {
                        const dtStyle = getDataTypeColor(col.data_type);
                        return (
                          <TableRow key={col.id || col.name || idx} hover>
                            <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>
                              {col.column_order !== undefined ? col.column_order + 1 : idx + 1}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                              {col.display_label}
                            </TableCell>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.82rem", color: colorTokens.text.muted }}>
                              {col.name}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={col.data_type}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  bgcolor: dtStyle.bg,
                                  color: dtStyle.color,
                                  borderRadius: "4px",
                                }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {col.is_required ? (
                                <Tooltip title="Mandatory field (cannot be blank)">
                                  <Chip
                                    label="Required"
                                    size="small"
                                    sx={{ bgcolor: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: "0.68rem" }}
                                  />
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                                  Optional
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {col.is_unique ? (
                                <Tooltip title="Unique constraint enforced">
                                  <CheckCircleIcon sx={{ fontSize: 18, color: colorTokens.status.success.main }} />
                                </Tooltip>
                              ) : (
                                <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.82rem", color: colorTokens.text.secondary }}>
                              {col.default_value || "—"}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.82rem", color: colorTokens.text.secondary }}>
                              {formatValidationRules(col.validation_rules)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Tab 1: Live Table Preview */}
            {activeTab === 1 && (
              <Box sx={{ p: 2.5 }}>
                <TemplatePreviewTable columns={columns} />
              </Box>
            )}

            {/* Tab 2: Version History */}
            {activeTab === 2 && (
              <Box sx={{ p: 2.5 }}>
                <TableContainer sx={{ border: `1px solid ${colorTokens.workspace.border}`, borderRadius: "10px" }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Columns</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Changelog / Notes</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Created Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailTemplate?.versions?.map((ver) => (
                        <TableRow key={ver.id} hover>
                          <TableCell sx={{ fontWeight: 700, color: colorTokens.secondary.dark }}>
                            v{ver.version_number}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={ver.is_active ? "Active" : "Archived"}
                              size="small"
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                bgcolor: ver.is_active ? colorTokens.status.success.light : colorTokens.workspace.divider,
                                color: ver.is_active ? colorTokens.status.success.main : colorTokens.text.secondary,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{ver.columns?.length || 0}</TableCell>
                          <TableCell sx={{ color: colorTokens.text.secondary }}>
                            {ver.changelog || "Initial template creation"}
                          </TableCell>
                          <TableCell>{ver.created_by_name}</TableCell>
                          <TableCell sx={{ color: colorTokens.text.muted }}>
                            {dayjs(ver.created_at).format("MMM D, YYYY HH:mm")}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                              <Tooltip title={`Edit version v${ver.version_number} without creating a new version`}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<EditIcon fontSize="small" />}
                                  onClick={() => handleEditVersion(ver)}
                                  sx={{
                                    borderRadius: "6px",
                                    textTransform: "none",
                                    fontSize: "0.75rem",
                                    py: 0.25,
                                    px: 1,
                                    borderColor: colorTokens.primary.main,
                                    color: colorTokens.primary.main,
                                    "&:hover": {
                                      bgcolor: colorTokens.primary.lighter,
                                    },
                                  }}
                                >
                                  Edit
                                </Button>
                              </Tooltip>

                              <Tooltip
                                title={
                                  (detailTemplate?.versions?.length || 0) <= 1
                                    ? "Cannot delete the only version of a template."
                                    : `Delete version v${ver.version_number}`
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={(detailTemplate?.versions?.length || 0) <= 1}
                                    onClick={() => setVersionToDelete(ver)}
                                    sx={{
                                      p: 0.5,
                                      border: `1px solid ${colorTokens.workspace.border}`,
                                      borderRadius: "6px",
                                      "&:hover": { bgcolor: "#FEE2E2" },
                                    }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: `1px solid ${colorTokens.workspace.divider}`, justifyContent: "space-between" }}>
        <Box>
          {onDownloadExcel && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={() => onDownloadExcel(template)}
              sx={{
                borderRadius: "8px",
                textTransform: "none",
                fontWeight: 600,
                borderColor: colorTokens.primary.main,
                color: colorTokens.primary.main,
              }}
            >
              Download Excel Workbook (.xlsx)
            </Button>
          )}
        </Box>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{
            borderRadius: "8px",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            bgcolor: colorTokens.workspace.border,
            color: colorTokens.text.primary,
            "&:hover": { bgcolor: colorTokens.workspace.divider },
          }}
        >
          Close
        </Button>
      </DialogActions>

      {/* Delete Version Confirmation Dialog */}
      <Dialog
        open={Boolean(versionToDelete)}
        onClose={() => setVersionToDelete(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "14px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="error" />
          <Typography variant="h6" fontWeight={700}>
            Delete Version v{versionToDelete?.version_number}?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, mb: 1.5 }}>
            Are you sure you want to delete <strong>Version v{versionToDelete?.version_number}</strong> of template <strong>{template.name}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
            This action cannot be undone. Only this selected version and any data uploaded specifically for it will be removed. All other versions and templates will remain completely intact.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, justifyContent: "space-between" }}>
          <Button
            onClick={() => setVersionToDelete(null)}
            disabled={deleteVersionMutation.isPending}
            sx={{ textTransform: "none", color: colorTokens.text.secondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteVersionMutation.isPending}
            onClick={handleConfirmDeleteVersion}
            startIcon={deleteVersionMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700 }}
          >
            {deleteVersionMutation.isPending ? "Deleting..." : "Delete Version"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Local Notification Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setToastMessage(null)} severity={toastSeverity} sx={{ borderRadius: "10px" }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};
