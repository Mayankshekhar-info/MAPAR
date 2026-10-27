import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import UpdateOutlinedIcon from "@mui/icons-material/UpdateOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import dayjs from "dayjs";

import { colorTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint, GovernanceFilterParams, GovernanceMetadata } from "../types/governance.types";

interface GovernanceTableProps {
  actions: GovernanceActionPoint[];
  totalCount: number;
  filters: GovernanceFilterParams;
  metadata?: GovernanceMetadata;
  isLoading?: boolean;
  selectedTaskIds?: number[];
  onToggleSelectTask?: (id: number) => void;
  onSelectAllTasks?: (ids: number[]) => void;
  onOpenBulkModal?: () => void;
  onFilterChange: (newFilters: Partial<GovernanceFilterParams>) => void;
  onSelectAction: (action: GovernanceActionPoint) => void;
  onEditAction?: (action: GovernanceActionPoint) => void;
  onReviseTarget: (action: GovernanceActionPoint) => void;
  onUploadEvidence: (action: GovernanceActionPoint) => void;
  onOpenWeeklyModal?: (action: GovernanceActionPoint) => void;
}

export const GovernanceTable: React.FC<GovernanceTableProps> = ({
  actions,
  totalCount,
  filters,
  metadata,
  isLoading,
  selectedTaskIds = [],
  onToggleSelectTask,
  onSelectAllTasks,
  onOpenBulkModal,
  onFilterChange,
  onSelectAction,
  onEditAction,
  onReviseTarget,
  onUploadEvidence,
  onOpenWeeklyModal,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const allSelected = actions.length > 0 && actions.every((a) => selectedTaskIds.includes(a.id));
  const someSelected = actions.some((a) => selectedTaskIds.includes(a.id)) && !allSelected;

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = Array.from(new Set([...selectedTaskIds, ...actions.map((n) => n.id)]));
      onSelectAllTasks?.(newSelected);
    } else {
      const currentActionIds = new Set(actions.map((a) => a.id));
      const newSelected = selectedTaskIds.filter((id) => !currentActionIds.has(id));
      onSelectAllTasks?.(newSelected);
    }
  };

  const handleRowClick = (action: GovernanceActionPoint) => {
    if (onSelectAction) {
      onSelectAction(action);
    } else {
      const mode = location.pathname.startsWith("/audit")
        ? "audit"
        : location.pathname.startsWith("/documents")
        ? "documents"
        : "governance";
      navigate(`/${mode}/tasks/${action.id}`);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <Chip
            label="Open"
            size="small"
            sx={{
              backgroundColor: "#EFF6FF",
              color: "#1D4ED8",
              fontWeight: 600,
              fontSize: "0.74rem",
              borderRadius: "6px",
              border: "1px solid #BFDBFE",
            }}
          />
        );
      case "WIP":
        return (
          <Chip
            label="WIP"
            size="small"
            sx={{
              backgroundColor: "#FEF3C7",
              color: "#B45309",
              fontWeight: 600,
              fontSize: "0.74rem",
              borderRadius: "6px",
              border: "1px solid #FDE68A",
            }}
          />
        );
      case "Closed":
        return (
          <Chip
            label="Closed"
            size="small"
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#047857",
              fontWeight: 600,
              fontSize: "0.74rem",
              borderRadius: "6px",
              border: "1px solid #A7F3D0",
            }}
          />
        );
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const getEvidenceStatusChip = (evidenceStatus: string, required: boolean) => {
    if (!required) {
      return (
        <Chip
          label="Optional"
          size="small"
          sx={{
            backgroundColor: "#F1F5F9",
            color: "#64748B",
            fontSize: "0.7rem",
            height: "22px",
          }}
        />
      );
    }
    switch (evidenceStatus) {
      case "Accepted":
        return (
          <Chip
            label="Accepted"
            size="small"
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#047857",
              fontWeight: 700,
              fontSize: "0.7rem",
              height: "22px",
              border: "1px solid #A7F3D0",
            }}
          />
        );
      case "Pending Review":
        return (
          <Chip
            label="Pending Review"
            size="small"
            sx={{
              backgroundColor: "#FEF3C7",
              color: "#B45309",
              fontWeight: 600,
              fontSize: "0.7rem",
              height: "22px",
              border: "1px solid #FDE68A",
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
              fontSize: "0.7rem",
              height: "22px",
              border: "1px solid #FCA5A5",
            }}
          />
        );
      default:
        return (
          <Chip
            label="Not Submitted"
            size="small"
            sx={{
              backgroundColor: "#F8FAFC",
              color: "#64748B",
              fontSize: "0.7rem",
              height: "22px",
              border: "1px solid #E2E8F0",
            }}
          />
        );
    }
  };

  const getPriorityChip = (priority: string) => {
    switch (priority) {
      case "High":
        return (
          <Chip
            icon={<PriorityHighIcon sx={{ fontSize: "14px !important", color: "#DC2626 !important" }} />}
            label="High"
            size="small"
            sx={{
              backgroundColor: "#FEE2E2",
              color: "#B91C1C",
              fontWeight: 600,
              fontSize: "0.72rem",
              borderRadius: "6px",
            }}
          />
        );
      case "Medium":
        return (
          <Chip
            label="Medium"
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
      case "Low":
        return (
          <Chip
            label="Low"
            size="small"
            sx={{
              backgroundColor: "#F1F5F9",
              color: "#475569",
              fontWeight: 600,
              fontSize: "0.72rem",
              borderRadius: "6px",
            }}
          />
        );
      default:
        return <Chip label={priority} size="small" />;
    }
  };

  const getBucketChip = (bucket: string, days: number) => {
    let color = "#475569";
    let bg = "#F1F5F9";
    if (bucket === "30+ Days") {
      color = "#DC2626";
      bg = "#FEE2E2";
    } else if (bucket === "16-30 Days") {
      color = "#EA580C";
      bg = "#FFEDD5";
    } else if (bucket === "8-15 Days") {
      color = "#D97706";
      bg = "#FEF3C7";
    }

    return (
      <Tooltip title={`${days} days since raised`} arrow>
        <Chip
          label={bucket}
          size="small"
          sx={{
            backgroundColor: bg,
            color: color,
            fontWeight: 600,
            fontSize: "0.72rem",
            borderRadius: "6px",
          }}
        />
      </Tooltip>
    );
  };

  const isReviewView = [
    "assigned_for_review",
    "review_submitted",
    "assigned_to_me",
    "pending_reviews",
    "submitted_reviews",
  ].includes(filters.view_mode || "");

  const getReviewStatusChip = (reviewStatus?: string) => {
    switch (reviewStatus) {
      case "Approved":
        return (
          <Chip
            label="Approved"
            size="small"
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#047857",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
              border: "1px solid #A7F3D0",
            }}
          />
        );
      case "Review Submitted":
        return (
          <Chip
            label="Review Submitted"
            size="small"
            sx={{
              backgroundColor: "#EFF6FF",
              color: "#1E40AF",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
              border: "1px solid #BFDBFE",
            }}
          />
        );
      case "Review Assigned":
      case "Pending Review":
        return (
          <Chip
            label={reviewStatus || "Pending Review"}
            size="small"
            sx={{
              backgroundColor: "#FEF3C7",
              color: "#B45309",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
              border: "1px solid #FDE68A",
            }}
          />
        );
      case "Rework Required":
        return (
          <Chip
            label="Rework Required"
            size="small"
            sx={{
              backgroundColor: "#FEF2F2",
              color: "#991B1B",
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: "6px",
              border: "1px solid #FECACA",
            }}
          />
        );
      default:
        return (
          <Chip
            label={reviewStatus || "Pending Review"}
            size="small"
            sx={{
              backgroundColor: "#F1F5F9",
              color: "#475569",
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
        borderRadius: "12px",
        border: `1px solid ${colorTokens.workspace.border}`,
        overflow: "hidden",
        backgroundColor: colorTokens.workspace.surface,
      }}
    >
      {/* Top Filter and Search Bar */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#FAFAFA",
        }}
      >
        {/* Search Input */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: "1 1 240px", maxWidth: 360 }}>
          <TextField
            size="small"
            placeholder="Search Action ID, deliverable, owner..."
            value={filters.search || ""}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
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

        {/* Filter Dropdowns & Bulk Actions */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          {/* Bulk Update Trigger */}
          {selectedTaskIds.length > 0 && onOpenBulkModal && (
            <Button
              variant="contained"
              size="small"
              startIcon={<DynamicFeedIcon />}
              onClick={onOpenBulkModal}
              sx={{
                backgroundColor: colorTokens.primary.main,
                "&:hover": { backgroundColor: colorTokens.primary.dark },
                borderRadius: "8px",
                fontWeight: 600,
                textTransform: "none",
                fontSize: "0.78rem",
              }}
            >
              Bulk Update ({selectedTaskIds.length})
            </Button>
          )}

          {/* Circle Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="circle-filter-label" sx={{ fontSize: "0.82rem" }}>
              Circle
            </InputLabel>
            <Select
              labelId="circle-filter-label"
              value={filters.circle_id || "ALL"}
              label="Circle"
              sx={{ borderRadius: "8px", backgroundColor: "#FFF", fontSize: "0.82rem" }}
              onChange={(e) =>
                onFilterChange({
                  circle_id: e.target.value === "ALL" ? undefined : Number(e.target.value),
                  page: 1,
                })
              }
            >
              <MenuItem value="ALL">All Circles</MenuItem>
              {metadata?.circles.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="status-filter-label" sx={{ fontSize: "0.82rem" }}>
              Status
            </InputLabel>
            <Select
              labelId="status-filter-label"
              value={filters.status || "ALL"}
              label="Status"
              sx={{ borderRadius: "8px", backgroundColor: "#FFF", fontSize: "0.82rem" }}
              onChange={(e) =>
                onFilterChange({
                  status: e.target.value === "ALL" ? undefined : e.target.value,
                  page: 1,
                })
              }
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="Open">Open</MenuItem>
              <MenuItem value="WIP">WIP</MenuItem>
              <MenuItem value="Closed">Closed</MenuItem>
            </Select>
          </FormControl>

          {/* Evidence Status Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="evidence-filter-label" sx={{ fontSize: "0.82rem" }}>
              Evidence Status
            </InputLabel>
            <Select
              labelId="evidence-filter-label"
              value={filters.evidence_status || "ALL"}
              label="Evidence Status"
              sx={{ borderRadius: "8px", backgroundColor: "#FFF", fontSize: "0.82rem" }}
              onChange={(e) =>
                onFilterChange({
                  evidence_status: e.target.value === "ALL" ? undefined : e.target.value,
                  page: 1,
                })
              }
            >
              <MenuItem value="ALL">All Evidence</MenuItem>
              <MenuItem value="Not Submitted">Not Submitted</MenuItem>
              <MenuItem value="Pending Review">Pending Review</MenuItem>
              <MenuItem value="Accepted">Accepted</MenuItem>
              <MenuItem value="Rework Required">Rework Required</MenuItem>
            </Select>
          </FormControl>

          {/* Priority Filter */}
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="priority-filter-label" sx={{ fontSize: "0.82rem" }}>
              Priority
            </InputLabel>
            <Select
              labelId="priority-filter-label"
              value={filters.priority || "ALL"}
              label="Priority"
              sx={{ borderRadius: "8px", backgroundColor: "#FFF", fontSize: "0.82rem" }}
              onChange={(e) =>
                onFilterChange({
                  priority: e.target.value === "ALL" ? undefined : e.target.value,
                  page: 1,
                })
              }
            >
              <MenuItem value="ALL">All Priorities</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </Select>
          </FormControl>

          {/* Bucket Filter */}
          {metadata?.buckets && metadata.buckets.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="bucket-filter-label" sx={{ fontSize: "0.82rem" }}>
                Bucket
              </InputLabel>
              <Select
                labelId="bucket-filter-label"
                value={filters.bucket || "ALL"}
                label="Bucket"
                sx={{ borderRadius: "8px", backgroundColor: "#FFF", fontSize: "0.82rem" }}
                onChange={(e) =>
                  onFilterChange({
                    bucket: e.target.value === "ALL" ? undefined : e.target.value,
                    page: 1,
                  })
                }
              >
                <MenuItem value="ALL">All Buckets</MenuItem>
                {metadata.buckets.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {/* Main Action Table */}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            {isReviewView ? (
              <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: "#F8FAFC", color: colorTokens.text.secondary, fontSize: "0.78rem" } }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={handleSelectAllClick}
                    inputProps={{ "aria-label": "select all tasks" }}
                  />
                </TableCell>
                <TableCell>Action ID</TableCell>
                <TableCell>Circle</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Action Point / Title</TableCell>
                <TableCell>Assigned Owner</TableCell>
                <TableCell>Assigned Reviewer</TableCell>
                <TableCell>Assignment Date</TableCell>
                <TableCell>Review Status</TableCell>
                <TableCell sx={{ minWidth: 240 }}>Latest Submitted Findings</TableCell>
                <TableCell>Target Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            ) : (
              <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: "#F8FAFC", color: colorTokens.text.secondary, fontSize: "0.78rem" } }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={handleSelectAllClick}
                    inputProps={{ "aria-label": "select all tasks" }}
                  />
                </TableCell>
                <TableCell>Action ID</TableCell>
                <TableCell>Circle</TableCell>
                <TableCell>Function</TableCell>
                <TableCell>Bucket</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Action Point / Deliverable</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Target Date</TableCell>
                <TableCell>Progress %</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Evidence Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Ageing</TableCell>
                <TableCell align="center">Escalation</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {actions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isReviewView ? 11 : 15} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: colorTokens.text.muted }}>
                    {isLoading ? "Loading action points..." : "No governance action points found."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : isReviewView ? (
              actions.map((row) => {
                const isItemSelected = selectedTaskIds.includes(row.id);
                const reviewerName = row.assigned_reviewer?.full_name || row.active_review?.reviewer_name || "—";
                const reviewerEmail = row.assigned_reviewer?.email || row.active_review?.reviewer_email;
                const assignmentDate = row.active_review?.assigned_at
                  ? dayjs(row.active_review.assigned_at).format("DD MMM YYYY")
                  : "—";
                const findings = row.active_review?.review_notes;
                const recommendations = row.active_review?.recommendations;

                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isItemSelected}
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "#F8FAFC" },
                    }}
                    onClick={() => handleRowClick(row)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        onChange={() => onToggleSelectTask?.(row.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colorTokens.primary.main, fontSize: "0.8rem" }}>
                      {row.action_id}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={row.circle?.name || ""} arrow>
                        <Chip
                          label={row.circle?.code || "—"}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            backgroundColor: "#F1F5F9",
                            borderRadius: "4px",
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 360, wordBreak: "break-word" }}>
                      <Tooltip title={row.action_point} placement="top-start" arrow enterDelay={400}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: colorTokens.text.primary,
                            fontSize: "0.82rem",
                            lineHeight: 1.35,
                          }}
                        >
                          {row.action_point}
                        </Typography>
                      </Tooltip>
                      {row.key_deliverable && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 0.25 }}>
                          Deliverable: {row.key_deliverable}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.8rem" }}>
                        {row.owner?.full_name || row.owner_name_override || "Unassigned"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem", color: colorTokens.text.primary }}>
                        {reviewerName}
                      </Typography>
                      {reviewerEmail && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem", display: "block" }}>
                          {reviewerEmail}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                      {assignmentDate}
                    </TableCell>
                    <TableCell>
                      {getReviewStatusChip(row.review_workflow_status || row.active_review?.status)}
                    </TableCell>
                    <TableCell sx={{ minWidth: 240, maxWidth: 380, wordBreak: "break-word" }}>
                      {findings || recommendations ? (
                        <Box>
                          {findings && (
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: "0.78rem",
                                color: colorTokens.text.primary,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                lineHeight: 1.35,
                              }}
                            >
                              {findings}
                            </Typography>
                          )}
                          {recommendations && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#0369A1",
                                fontWeight: 600,
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                mt: 0.25,
                              }}
                            >
                              Rec: {recommendations}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontStyle: "italic" }}>
                          Pending reviewer submission
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", fontWeight: 600 }}>
                      {row.current_target_date}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        {onEditAction && !location.pathname.startsWith("/audit") && !location.pathname.startsWith("/documents") && (
                          <Tooltip title="Edit Task" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onEditAction(row)}
                              sx={{ color: colorTokens.primary.main }}
                            >
                              <EditOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Full Task Page" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleRowClick(row)}
                            sx={{ color: colorTokens.primary.main }}
                          >
                            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              actions.map((row) => {
                const isItemSelected = selectedTaskIds.includes(row.id);

                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isItemSelected}
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "#F8FAFC" },
                      backgroundColor: row.is_escalated ? "rgba(254, 242, 242, 0.4)" : "inherit",
                    }}
                    onClick={() => handleRowClick(row)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        onChange={() => onToggleSelectTask?.(row.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colorTokens.primary.main, fontSize: "0.8rem" }}>
                      {row.action_id}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={row.circle?.name || ""} arrow>
                        <Chip
                          label={row.circle?.code || "—"}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            backgroundColor: "#F1F5F9",
                            borderRadius: "4px",
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                      {row.function_area}
                    </TableCell>
                    <TableCell>
                      {row.bucket ? (
                        <Chip
                          label={row.bucket}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            backgroundColor: "#EFF6FF",
                            color: "#1D4ED8",
                            border: "1px solid #DBEAFE",
                            borderRadius: "4px",
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 360, wordBreak: "break-word" }}>
                      <Tooltip title={row.action_point} placement="top-start" arrow enterDelay={400}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: colorTokens.text.primary,
                            fontSize: "0.82rem",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.35,
                          }}
                        >
                          {row.action_point}
                        </Typography>
                      </Tooltip>
                      {row.key_deliverable && (
                        <Tooltip title={row.key_deliverable} placement="top-start" arrow enterDelay={400}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: colorTokens.text.muted,
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "0.74rem",
                              mt: 0.25,
                            }}
                          >
                            Deliverable: {row.key_deliverable}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.8rem" }}>
                        {row.owner?.full_name || row.owner_name_override || "Unassigned"}
                      </Typography>
                      {row.owner?.email && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                          {row.owner.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "0.78rem",
                            fontWeight: row.is_overdue ? 700 : 500,
                            color: row.is_overdue ? colorTokens.status.error.main : colorTokens.text.primary,
                          }}
                        >
                          {row.current_target_date}
                        </Typography>
                        {row.revision_count > 0 && (
                          <Tooltip title={`Revised ${row.revision_count} times (Initial: ${row.target_closure_date})`} arrow>
                            <Chip
                              label={`R${row.revision_count}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                backgroundColor: "#FEF3C7",
                                color: "#B45309",
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.78rem", color: row.current_progress_percent && row.current_progress_percent >= 100 ? colorTokens.status.success.main : colorTokens.text.primary }}>
                        {row.current_progress_percent || 0}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-start" }}>
                        {getStatusChip(row.status)}
                        {row.review_workflow_status && row.review_workflow_status !== "None" && (
                          <Chip
                            label={row.review_workflow_status}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.68rem",
                              height: 20,
                              bgcolor:
                                row.review_workflow_status === "Approved"
                                  ? "#F0FDF4"
                                  : row.review_workflow_status === "Rework Required"
                                  ? "#FEF2F2"
                                  : row.review_workflow_status === "Awaiting Final Approval"
                                  ? "#F0F9FF"
                                  : "#EFF6FF",
                              color:
                                row.review_workflow_status === "Approved"
                                  ? "#166534"
                                  : row.review_workflow_status === "Rework Required"
                                  ? "#991B1B"
                                  : row.review_workflow_status === "Awaiting Final Approval"
                                  ? "#0369A1"
                                  : "#1D4ED8",
                              border: `1px solid ${
                                row.review_workflow_status === "Approved"
                                  ? "#BBF7D0"
                                  : row.review_workflow_status === "Rework Required"
                                  ? "#FECACA"
                                  : row.review_workflow_status === "Awaiting Final Approval"
                                  ? "#BAE6FD"
                                  : "#BFDBFE"
                              }`,
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{getEvidenceStatusChip(row.evidence_status, row.evidence_required)}</TableCell>
                    <TableCell>{getPriorityChip(row.priority)}</TableCell>
                    <TableCell>{getBucketChip(row.ageing_bucket, row.ageing_days)}</TableCell>
                    <TableCell align="center">
                      {row.is_escalated ? (
                        <Tooltip title="Escalated to Business Head (>30 Days Active)" arrow>
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: "14px !important", color: "#DC2626 !important" }} />}
                            label="YES"
                            size="small"
                            sx={{
                              backgroundColor: "#FEE2E2",
                              color: "#DC2626",
                              fontWeight: 700,
                              fontSize: "0.68rem",
                              height: 22,
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                          No
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        {onOpenWeeklyModal && (
                          <Tooltip title="Log Weekly Update" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onOpenWeeklyModal(row)}
                              sx={{ color: colorTokens.primary.main }}
                            >
                              <EventRepeatIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Upload Proof / Evidence" arrow>
                          <IconButton
                            size="small"
                            onClick={() => onUploadEvidence(row)}
                            sx={{ color: colorTokens.primary.main }}
                          >
                            <CloudUploadOutlinedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            location.pathname.startsWith("/audit")
                              ? "Request Target Date Revision"
                              : "Revise Target Date"
                          }
                          arrow
                        >
                          <IconButton
                            size="small"
                            onClick={() => onReviseTarget(row)}
                            sx={{ color: colorTokens.text.secondary }}
                          >
                            <UpdateOutlinedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        {onEditAction && !location.pathname.startsWith("/audit") && !location.pathname.startsWith("/documents") && (
                          <Tooltip title="Edit Task" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onEditAction(row)}
                              sx={{ color: colorTokens.primary.main }}
                            >
                              <EditOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Full Task Page" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleRowClick(row)}
                            sx={{ color: colorTokens.primary.main }}
                          >
                            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
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
        page={(filters.page || 1) - 1}
        rowsPerPage={filters.page_size || 25}
        onPageChange={(_, newPage) => onFilterChange({ page: newPage + 1 })}
        onRowsPerPageChange={(e) =>
          onFilterChange({ page_size: parseInt(e.target.value, 10), page: 1 })
        }
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
};
