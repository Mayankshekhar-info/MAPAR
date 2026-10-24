import React, { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PostAddIcon from "@mui/icons-material/PostAdd";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EditIcon from "@mui/icons-material/Edit";
import dayjs from "dayjs";

import { UploadTemplate } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingState } from "../../../components/LoadingState";

interface TemplateListTableProps {
  templates: UploadTemplate[];
  isLoading: boolean;
  canManage?: boolean;
  onViewTemplate: (template: UploadTemplate) => void;
  onDownload: (template: UploadTemplate) => void;
  onUpload: (template: UploadTemplate) => void;
  onNewVersion: (template: UploadTemplate) => void;
  onEditVersion?: (template: UploadTemplate) => void;
  onCreateTemplate: () => void;
}

export const TemplateListTable: React.FC<TemplateListTableProps> = ({
  templates,
  isLoading,
  canManage = true,
  onViewTemplate,
  onDownload,
  onUpload,
  onNewVersion,
  onEditVersion,
  onCreateTemplate,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        search === "" ||
        tpl.name.toLowerCase().includes(search.toLowerCase()) ||
        tpl.code.toLowerCase().includes(search.toLowerCase()) ||
        tpl.data_level.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || tpl.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [templates, search, statusFilter]);

  if (isLoading) {
    return <LoadingState message="Loading configured data templates..." />;
  }

  return (
    <Card
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Table Toolbar */}
      <Box
        sx={{
          p: 2.5,
          bgcolor: colorTokens.workspace.surface,
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Configured Data Templates
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Standardized schemas with dynamic column rules and Excel generators
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: "100%", md: 240 } }}
          />

          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 140 }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="ARCHIVED">Archived</MenuItem>
          </TextField>
        </Stack>
      </Box>

      {/* Templates Table */}
      {filteredTemplates.length === 0 ? (
        <Box sx={{ py: 6, px: 3 }}>
          <EmptyState
            title="No templates created yet"
            description="Create your first reusable dynamic data template to define custom columns and generate Excel sheets."
            action={
              canManage ? (
                <Button variant="contained" color="primary" onClick={onCreateTemplate} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}>
                  + Create Template
                </Button>
              ) : undefined
            }
          />
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Template Name & Code</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Data Level</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Fields</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Batches</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Created By / Date</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow
                  key={template.id}
                  hover
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {template.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontFamily: "monospace" }}>
                        {template.code}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={template.data_level.replace("_", " ")}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        bgcolor: colorTokens.primary.lighter,
                        color: colorTokens.primary.darker,
                        borderRadius: "6px",
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.secondary.dark }}>
                      v{template.latest_version_number}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ViewColumnIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {template.columns_count}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                      {template.batches_count} batches
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: colorTokens.text.primary }}>
                        {template.created_by_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        {dayjs(template.created_at).format("MMM D, YYYY")}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={template.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
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
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                      <Tooltip title="View Template Schema & Column Rules">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => onViewTemplate(template)}
                          sx={{
                            borderRadius: "8px",
                            textTransform: "none",
                            fontSize: "0.78rem",
                            px: 1.25,
                            borderColor: colorTokens.workspace.border,
                            color: colorTokens.text.primary,
                            "&:hover": {
                              borderColor: colorTokens.primary.main,
                              color: colorTokens.primary.main,
                              bgcolor: colorTokens.primary.lighter,
                            },
                          }}
                        >
                          View
                        </Button>
                      </Tooltip>

                      <Tooltip title="Download Dynamic Excel Template (.xlsx)">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadIcon fontSize="small" />}
                          onClick={() => onDownload(template)}
                          sx={{
                            borderRadius: "8px",
                            textTransform: "none",
                            fontSize: "0.78rem",
                            px: 1.25,
                            borderColor: colorTokens.primary.main,
                            color: colorTokens.primary.main,
                          }}
                        >
                          Download
                        </Button>
                      </Tooltip>

                      {canManage ? (
                        <Tooltip title="Upload completed Excel against this template">
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<UploadFileIcon fontSize="small" />}
                            onClick={() => onUpload(template)}
                            sx={{
                              borderRadius: "8px",
                              textTransform: "none",
                              fontSize: "0.78rem",
                              px: 1.5,
                              bgcolor: colorTokens.primary.main,
                            }}
                          >
                            Upload
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip title="View-Only Access: Uploading files is restricted">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled
                              startIcon={<UploadFileIcon fontSize="small" />}
                              sx={{
                                borderRadius: "8px",
                                textTransform: "none",
                                fontSize: "0.78rem",
                                px: 1.5,
                              }}
                            >
                              Upload
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {canManage && onEditVersion && (
                        <Tooltip title={`Edit current version (v${template.latest_version_number}) in place`}>
                          <IconButton
                            size="small"
                            onClick={() => onEditVersion(template)}
                            sx={{ color: colorTokens.text.secondary, "&:hover": { color: colorTokens.primary.main } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {canManage && (
                        <Tooltip title="Create new schema version (v2, v3...)">
                          <IconButton
                            size="small"
                            onClick={() => onNewVersion(template)}
                            sx={{ color: colorTokens.text.secondary }}
                          >
                            <PostAddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
};
