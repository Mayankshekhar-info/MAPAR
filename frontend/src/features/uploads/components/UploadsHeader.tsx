import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import FileDownloadDoneIcon from "@mui/icons-material/FileDownloadDone";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { colorTokens } from "../../../app/theme/tokens";

interface UploadsHeaderProps {
  totalTemplates: number;
  totalBatches: number;
  completedBatches: number;
  canManage?: boolean;
  onCreateTemplate: () => void;
  onUploadExcel: () => void;
}

export const UploadsHeader: React.FC<UploadsHeaderProps> = ({
  totalTemplates,
  totalBatches,
  completedBatches,
  canManage = true,
  onCreateTemplate,
  onUploadExcel,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        alignItems: { xs: "flex-start", lg: "center" },
        justifyContent: "space-between",
        gap: 2,
        pb: 3,
        borderBottom: `1px solid ${colorTokens.workspace.divider}`,
      }}
    >
      <Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
            }}
          >
            <CloudUploadIcon fontSize="medium" />
          </Box>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: colorTokens.text.primary,
                  letterSpacing: "-0.02em",
                }}
              >
                Uploads
              </Typography>
              {!canManage && (
                <Chip
                  icon={<LockOutlinedIcon sx={{ fontSize: "14px !important", color: "#475569 !important" }} />}
                  label="View-Only Access"
                  size="small"
                  sx={{
                    bgcolor: "#F1F5F9",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    border: "1px solid #CBD5E1",
                  }}
                />
              )}
            </Stack>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.25 }}>
              Dynamic Template Builder &bull; Excel Import &bull; Authoritative Hierarchy Validation &bull; Batch History
            </Typography>
          </Box>
        </Stack>

        {/* Dynamic Metric Badges */}
        <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap">
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, textTransform: "uppercase" }}>
              Active Templates:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.primary.main, bgcolor: colorTokens.primary.lighter, px: 1, py: 0.25, borderRadius: "6px" }}>
              {totalTemplates}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, textTransform: "uppercase" }}>
              Batches Processed:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.secondary.dark, bgcolor: colorTokens.secondary.lighter, px: 1, py: 0.25, borderRadius: "6px" }}>
              {totalBatches}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, textTransform: "uppercase" }}>
              Committed Batches:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.status.success.main, bgcolor: colorTokens.status.success.light, px: 1, py: 0.25, borderRadius: "6px" }}>
              {completedBatches}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Primary Actions */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        {canManage ? (
          <>
            <Button
              id="btn-upload-excel"
              variant="outlined"
              color="primary"
              startIcon={<FileDownloadDoneIcon />}
              onClick={onUploadExcel}
              sx={{
                fontWeight: 600,
                borderRadius: "10px",
                px: 2.25,
                py: 1,
                borderColor: colorTokens.primary.main,
                color: colorTokens.primary.main,
                "&:hover": {
                  bgcolor: colorTokens.primary.lighter,
                },
              }}
            >
              Upload Excel File
            </Button>

            <Button
              id="btn-create-template"
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlineIcon />}
              onClick={onCreateTemplate}
              sx={{
                fontWeight: 600,
                borderRadius: "10px",
                px: 2.5,
                py: 1,
                bgcolor: colorTokens.primary.main,
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.28)",
                "&:hover": {
                  bgcolor: colorTokens.primary.dark,
                },
              }}
            >
              + Create Template
            </Button>
          </>
        ) : (
          <Tooltip title="You have view-only access. Creating templates or uploading files is restricted.">
            <span>
              <Chip
                icon={<LockOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                label="Read-Only Mode Enabled"
                variant="outlined"
                sx={{
                  py: 1.5,
                  px: 1,
                  borderRadius: "8px",
                  borderColor: colorTokens.workspace.border,
                  color: colorTokens.text.secondary,
                  fontWeight: 600,
                }}
              />
            </span>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
};
