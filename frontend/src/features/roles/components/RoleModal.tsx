import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { RoleListItem, CreateRolePayload, UpdateRolePayload } from "../types/roles.types";
import { usePermissionMatrix, useCreateRole, useUpdateRole, useRoleDetail } from "../hooks/useRoles";

interface RoleModalProps {
  open: boolean;
  onClose: () => void;
  roleToEdit?: RoleListItem | null;
}

export const RoleModal: React.FC<RoleModalProps> = ({ open, onClose, roleToEdit }) => {
  const isEditing = Boolean(roleToEdit);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: matrix, isLoading: loadingMatrix } = usePermissionMatrix();
  const { data: detailData, isLoading: loadingDetail } = useRoleDetail(roleToEdit?.id);

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      if (roleToEdit) {
        setName(roleToEdit.name);
        setCode(roleToEdit.code);
        setDescription(roleToEdit.description || "");
        setRiskLevel(roleToEdit.risk_level);
        setStatus(roleToEdit.status);
      } else {
        setName("");
        setCode("");
        setDescription("");
        setRiskLevel("MEDIUM");
        setStatus("ACTIVE");
        setSelectedPermissionIds(new Set());
      }
    }
  }, [open, roleToEdit]);

  useEffect(() => {
    if (isEditing && detailData?.granted_permission_ids) {
      setSelectedPermissionIds(new Set(detailData.granted_permission_ids));
    }
  }, [isEditing, detailData]);

  const handleTogglePermission = (id: number) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleModuleAll = (modulePermIds: number[]) => {
    const allSelected = modulePermIds.every((id) => selectedPermissionIds.has(id));
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        modulePermIds.forEach((id) => next.delete(id));
      } else {
        modulePermIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const permission_ids = Array.from(selectedPermissionIds);

    if (isEditing && roleToEdit) {
      const payload: UpdateRolePayload = {
        name,
        description,
        risk_level: riskLevel,
        status,
        permission_ids,
      };

      updateMutation.mutate(
        { roleId: roleToEdit.id, payload },
        {
          onSuccess: () => onClose(),
          onError: (err: any) => {
            const msg = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to update role.";
            setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
          },
        }
      );
    } else {
      if (!name || !code) {
        setErrorMsg("Role Name and Code are required.");
        return;
      }

      const payload: CreateRolePayload = {
        name,
        code: code.trim().toUpperCase(),
        description,
        risk_level: riskLevel,
        status,
        permission_ids,
      };

      createMutation.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err: any) => {
          const msg = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to create role.";
          setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
        },
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md, maxHeight: "90vh" } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SecurityOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
              {isEditing ? "Edit Enterprise Role" : "Create Enterprise Role"}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              Define role metadata and assign granular application capabilities
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.sm }}>
            {errorMsg}
          </Alert>
        )}

        {/* Section 1: Role Metadata */}
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 2, mb: 2 }}>
            <TextField
              label="Role Name"
              size="small"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Regional Operations Lead"
              fullWidth
            />
            <TextField
              label="Role Code"
              size="small"
              required
              disabled={isEditing}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. REG_OPS_LEAD"
              helperText={isEditing ? "Unique system identifier" : "Upper-case identifier"}
              fullWidth
            />
          </Box>

          <TextField
            label="Description"
            size="small"
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe role responsibilities, sign-off limits, and operational scope..."
            fullWidth
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 3 }}>
            <TextField
              select
              label="Risk Classification"
              size="small"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value as any)}
              fullWidth
            >
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="CRITICAL">Critical</MenuItem>
            </TextField>

            <TextField
              select
              label="Status"
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              fullWidth
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
          </Box>
        </Box>

        {/* Section 2: Dynamic Permission Matrix */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Permission Matrix
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              Dynamically discovered capabilities across MAPAR modules ({selectedPermissionIds.size} selected)
            </Typography>
          </Box>

          <Chip
            label={`${selectedPermissionIds.size} Permissions Selected`}
            color="primary"
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        {loadingMatrix || loadingDetail ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {matrix?.map((mod) => {
              const modPermIds = mod.permissions.map((p) => p.id);
              const allChecked = modPermIds.length > 0 && modPermIds.every((id) => selectedPermissionIds.has(id));
              const someChecked = modPermIds.some((id) => selectedPermissionIds.has(id)) && !allChecked;

              return (
                <Card
                  key={mod.module_id}
                  variant="outlined"
                  sx={{
                    borderRadius: radiusTokens.sm,
                    borderColor: allChecked ? colorTokens.primary.light : colorTokens.workspace.border,
                    bgcolor: allChecked ? "#F0F9FF" : "#FFFFFF",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Box
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
                      bgcolor: colorTokens.workspace.background,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        size="small"
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => handleToggleModuleAll(modPermIds)}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        {mod.module_name}
                      </Typography>
                      <Chip
                        label={mod.module_code}
                        size="small"
                        sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      {mod.permissions.filter((p) => selectedPermissionIds.has(p.id)).length} of {mod.permissions.length} actions
                    </Typography>
                  </Box>

                  <Box sx={{ p: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 1 }}>
                    {mod.permissions.map((p) => {
                      const isChecked = selectedPermissionIds.has(p.id);
                      return (
                        <FormControlLabel
                          key={p.id}
                          control={
                            <Checkbox
                              size="small"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(p.id)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: isChecked ? 700 : 500 }}>
                                {p.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", fontSize: "0.68rem" }}>
                                {p.code}
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0 }}
                        />
                      );
                    })}
                  </Box>
                </Card>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" onClick={onClose} disabled={isSaving} sx={{ borderRadius: radiusTokens.sm }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            bgcolor: colorTokens.primary.main,
            "&:hover": { bgcolor: colorTokens.primary.dark },
            borderRadius: radiusTokens.sm,
            fontWeight: 700,
          }}
        >
          {isSaving ? "Saving..." : isEditing ? "Save Role Changes" : "Create Enterprise Role"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
