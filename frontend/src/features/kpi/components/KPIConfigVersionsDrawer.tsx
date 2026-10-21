import React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useKPIConfigVersions } from "../hooks/useKPIFormulaUpload";
import { KPIConfigVersion } from "../types/kpi";

interface KPIConfigVersionsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const KPIConfigVersionsDrawer: React.FC<KPIConfigVersionsDrawerProps> = ({
  open,
  onClose,
}) => {
  const { data: versions = [], isLoading, isError, error } = useKPIConfigVersions();

  if (!open) return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <HistoryIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            KPI Configuration Versions
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Audit history of approved KPI formula configuration workbooks stored in PostgreSQL.
      </Typography>

      <Divider sx={{ mb: 2.5 }} />

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as any)?.message || "Failed to load version history."}
        </Alert>
      )}

      {!isLoading && versions.length === 0 && (
        <Alert severity="info">
          No configuration versions recorded yet. Upload a KPI formula workbook to create Version 1.
        </Alert>
      )}

      <Stack spacing={2}>
        {versions.map((ver: KPIConfigVersion) => (
          <Card key={ver.id} variant="outlined" sx={{ borderRadius: 2, borderColor: ver.status === "ACTIVE" ? "primary.main" : "divider" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Version {ver.version_number}
                </Typography>
                <Chip
                  icon={ver.status === "ACTIVE" ? <CheckCircleIcon fontSize="small" /> : undefined}
                  label={ver.status}
                  color={ver.status === "ACTIVE" ? "primary" : "default"}
                  size="small"
                  variant={ver.status === "ACTIVE" ? "filled" : "outlined"}
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Scope: <strong>{ver.scope_type}</strong>
                {ver.company_name ? ` • Company: ${ver.company_name}` : ""}
                {ver.project_name ? ` • Project: ${ver.project_name}` : ""}
              </Typography>

              <Typography variant="body2" sx={{ mb: 1 }}>
                {ver.changelog || "Initial approved configuration."}
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                <Chip label={`${ver.total_kpis} KPIs Defined`} size="small" variant="outlined" />
                {ver.activated_at && (
                  <Chip
                    label={`Activated ${new Date(ver.activated_at).toLocaleDateString()}`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {ver.created_by_name && (
                  <Chip label={`By ${ver.created_by_name}`} size="small" variant="outlined" />
                )}
              </Box>

              {ver.file_hash && (
                <Typography variant="caption" sx={{ display: "block", mt: 1.5, fontFamily: "monospace", color: "text.disabled", wordBreak: "break-all" }}>
                  SHA-256: {ver.file_hash}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Drawer>
  );
};
