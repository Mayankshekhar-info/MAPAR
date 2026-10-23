import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import TablePagination from "@mui/material/TablePagination";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceEvidenceItem } from "../types/governance.types";
import { governanceService } from "../api/governanceService";

interface MyEvidenceTableProps {
  evidenceList: GovernanceEvidenceItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  search: string;
  isLoading?: boolean;
  selectedEvidenceIds?: number[];
  onToggleSelectEvidence?: (id: number) => void;
  onSelectAllEvidence?: (ids: number[]) => void;
  onOpenBulkReviewModal?: () => void;
  onSearchChange: (search: string) => void;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onSelectActionById: (actionId: number) => void;
  onReviewItem?: (item: GovernanceEvidenceItem) => void;
}

export const MyEvidenceTable: React.FC<MyEvidenceTableProps> = ({
  evidenceList,
  totalCount,
  page,
  pageSize,
  search,
  isLoading,
  selectedEvidenceIds = [],
  onToggleSelectEvidence,
  onSelectAllEvidence,
  onOpenBulkReviewModal,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onSelectActionById,
  onReviewItem,
}) => {
  const navigate = useNavigate();

  const allSelected = evidenceList.length > 0 && evidenceList.every((e) => selectedEvidenceIds.includes(e.id));
  const someSelected = evidenceList.some((e) => selectedEvidenceIds.includes(e.id)) && !allSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = Array.from(new Set([...selectedEvidenceIds, ...evidenceList.map((x) => x.id)]));
      onSelectAllEvidence?.(allIds);
    } else {
      const currentIds = new Set(evidenceList.map((x) => x.id));
      const remaining = selectedEvidenceIds.filter((id) => !currentIds.has(id));
      onSelectAllEvidence?.(remaining);
    }
  };

  const handleDownload = async (item: GovernanceEvidenceItem) => {
    try {
      await governanceService.downloadEvidence(item.id, item.file_name);
    } catch {
      alert("Failed to download file.");
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case "Accepted":
        return (
          <Chip
            label="Accepted"
            size="small"
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#047857",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
            }}
          />
        );
      case "Rework Required":
        return (
          <Chip
            label="Rework Required"
            size="small"
            sx={{
              backgroundColor: "#FEE2E2",
              color: "#B91C1C",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
            }}
          />
        );
      default:
        return (
          <Chip
            label="Pending Review"
            size="small"
            sx={{
              backgroundColor: "#FEF3C7",
              color: "#B45309",
              fontWeight: 600,
              fontSize: "0.72rem",
              borderRadius: "6px",
            }}
          />
        );
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: `${radiusTokens.md}px`,
        border: `1px solid ${colorTokens.workspace.border}`,
        overflow: "hidden",
        backgroundColor: colorTokens.workspace.surface,
      }}
    >
      {/* Search and Bulk Action Toolbar */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          backgroundColor: "#FAFAFA",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: "1 1 240px", maxWidth: 360 }}>
          <TextField
            size="small"
            placeholder="Search evidence file, task ID, title..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colorTokens.text.secondary, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            fullWidth
            sx={{
              backgroundColor: "#FFF",
              "& .MuiOutlinedInput-root": { borderRadius: "8px" },
            }}
          />
        </Box>

        {selectedEvidenceIds.length > 0 && onOpenBulkReviewModal && (
          <Button
            variant="contained"
            size="small"
            startIcon={<DynamicFeedIcon />}
            onClick={onOpenBulkReviewModal}
            sx={{
              backgroundColor: colorTokens.primary.main,
              "&:hover": { backgroundColor: colorTokens.primary.dark },
              borderRadius: "8px",
              fontWeight: 600,
              textTransform: "none",
              fontSize: "0.78rem",
            }}
          >
            Bulk Review ({selectedEvidenceIds.length})
          </Button>
        )}
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  fontWeight: 700,
                  backgroundColor: "#F8FAFC",
                  color: colorTokens.text.secondary,
                  fontSize: "0.78rem",
                },
              }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Task ID</TableCell>
              <TableCell>Action Point</TableCell>
              <TableCell>Evidence Title</TableCell>
              <TableCell>File Name</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Submitted On</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reviewed By</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {evidenceList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: colorTokens.text.muted }}>
                    {isLoading ? "Loading evidence records..." : "No evidence records found."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              evidenceList.map((item) => {
                const isSelected = selectedEvidenceIds.includes(item.id);

                return (
                  <TableRow
                    key={item.id}
                    hover
                    selected={isSelected}
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "#F8FAFC" },
                    }}
                    onClick={() => {
                      if (onSelectActionById) {
                        onSelectActionById(item.action_point);
                      } else {
                        navigate(`/documents/tasks/${item.action_point}`);
                      }
                    }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        color="primary"
                        checked={isSelected}
                        onChange={() => onToggleSelectEvidence?.(item.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colorTokens.primary.main, fontSize: "0.8rem" }}>
                      {item.action_id}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.action_point_title}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>
                      {item.title} <Typography component="span" variant="caption" sx={{ color: colorTokens.text.muted }}>v{item.version}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                      {item.file_name}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.76rem", color: colorTokens.text.muted }}>
                      {(item.file_size / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                      {new Date(item.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusChip(item.status)}</TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                      {item.reviewed_by?.full_name || "—"}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        <Tooltip title="Download File">
                          <IconButton size="small" onClick={() => handleDownload(item)}>
                            <DownloadOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
                          </IconButton>
                        </Tooltip>
                        {onReviewItem && (
                          <Tooltip title="Review Evidence">
                            <IconButton size="small" onClick={() => onReviewItem(item)}>
                              <FactCheckIcon sx={{ fontSize: 18, color: colorTokens.text.secondary }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Task Detail Page">
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (onSelectActionById) {
                                onSelectActionById(item.action_point);
                              } else {
                                navigate(`/documents/tasks/${item.action_point}`);
                              }
                            }}
                          >
                            <VisibilityOutlinedIcon sx={{ fontSize: 18, color: colorTokens.text.secondary }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalCount}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
};
