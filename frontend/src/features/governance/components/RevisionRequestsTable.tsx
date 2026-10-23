import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceTargetRevisionRequest } from "../types/governance.types";

interface RevisionRequestsTableProps {
  requests: GovernanceTargetRevisionRequest[];
  totalCount: number;
  pendingCount: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  search: string;
  isLoading: boolean;
  currentUserId?: number | null;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onStatusFilterChange: (newStatus: string) => void;
  onSearchChange: (newSearch: string) => void;
  onOpenTask: (actionId: number) => void;
  onReview: (request: GovernanceTargetRevisionRequest) => void;
}

export const RevisionRequestsTable: React.FC<RevisionRequestsTableProps> = ({
  requests,
  totalCount,
  pendingCount,
  page,
  pageSize,
  statusFilter,
  search,
  isLoading,
  currentUserId,
  onPageChange,
  onPageSizeChange,
  onStatusFilterChange,
  onSearchChange,
  onOpenTask,
  onReview,
}) => {
  const [searchInput, setSearchInput] = useState(search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchInput);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        backgroundColor: colorTokens.workspace.surface,
        overflow: "hidden",
      }}
    >
      {/* Header & Filter Controls */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: "#F8FAFC",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EventRepeatIcon sx={{ color: colorTokens.primary.main, fontSize: 22 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
            Target Date Revision Requests
          </Typography>
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} Pending`}
              size="small"
              sx={{
                backgroundColor: "#FEF3C7",
                color: "#B45309",
                fontWeight: 800,
                fontSize: "0.75rem",
              }}
            />
          )}
        </Box>

        {/* Status Filter Chips & Search Bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {[
              { id: "ALL", label: "All Requests" },
              { id: "Pending", label: `Pending (${pendingCount})` },
              { id: "Approved", label: "Approved" },
              { id: "Rejected", label: "Rejected" },
            ].map((tab) => (
              <Chip
                key={tab.id}
                label={tab.label}
                clickable
                size="small"
                variant={statusFilter === tab.id ? "filled" : "outlined"}
                onClick={() => onStatusFilterChange(tab.id)}
                sx={{
                  fontWeight: statusFilter === tab.id ? 700 : 500,
                  backgroundColor: statusFilter === tab.id ? colorTokens.primary.main : "transparent",
                  color: statusFilter === tab.id ? "#FFFFFF" : colorTokens.text.secondary,
                  borderColor: colorTokens.workspace.border,
                }}
              />
            ))}
          </Box>

          <Box component="form" onSubmit={handleSearchSubmit} sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search task ID, title, requester, reason..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 260 }}
            />
            <Button
              type="submit"
              variant="outlined"
              size="small"
              sx={{
                borderColor: colorTokens.workspace.border,
                color: colorTokens.text.primary,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              Search
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Requests Table */}
      <TableContainer sx={{ maxHeight: 560 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, color: colorTokens.text.primary, backgroundColor: "#F1F5F9" } }}>
              <TableCell>Action ID & Title</TableCell>
              <TableCell>Circle & Owner</TableCell>
              <TableCell>Requester & Date</TableCell>
              <TableCell>Original Target</TableCell>
              <TableCell>Current Target</TableCell>
              <TableCell>Requested Date</TableCell>
              <TableCell>Reason for Request</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reviewer & Feedback</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: colorTokens.primary.main }} />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6, color: colorTokens.text.muted }}>
                  No target date revision requests found matching current filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((row) => {
                const isSelf = Boolean(currentUserId && row.requested_by?.id === currentUserId);
                return (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      backgroundColor:
                        row.status === "Pending" ? "rgba(254, 243, 199, 0.15)" : "inherit",
                    }}
                  >
                    {/* Action ID & Title */}
                    <TableCell sx={{ minWidth: 160 }}>
                      <Box
                        onClick={() => onOpenTask(row.action_point)}
                        sx={{
                          cursor: "pointer",
                          fontWeight: 700,
                          color: colorTokens.primary.main,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {row.action_id}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: colorTokens.text.secondary,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {row.action_point_title}
                      </Typography>
                    </TableCell>

                    {/* Circle & Owner */}
                    <TableCell sx={{ minWidth: 130 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {row.circle_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        {row.owner_name}
                      </Typography>
                    </TableCell>

                    {/* Requester & Date */}
                    <TableCell sx={{ minWidth: 130 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {row.requested_by?.full_name || row.requested_by?.username || "Assignee"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        {new Date(row.requested_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>

                    {/* Original Target */}
                    <TableCell sx={{ whiteSpace: "nowrap", color: colorTokens.text.muted }}>
                      {row.original_target_date}
                    </TableCell>

                    {/* Current Target */}
                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600, color: colorTokens.text.primary }}>
                      {row.current_target_date}
                    </TableCell>

                    {/* Requested Target Date */}
                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800, color: colorTokens.primary.main }}>
                      {row.requested_target_date}
                    </TableCell>

                    {/* Reason */}
                    <TableCell sx={{ minWidth: 180, maxWidth: 260 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          color: colorTokens.text.primary,
                        }}
                      >
                        {row.reason}
                      </Typography>
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        label={row.status}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          backgroundColor:
                            row.status === "Approved"
                              ? "#DCFCE7"
                              : row.status === "Pending"
                              ? "#FEF3C7"
                              : "#FEE2E2",
                          color:
                            row.status === "Approved"
                              ? "#15803D"
                              : row.status === "Pending"
                              ? "#B45309"
                              : "#B91C1C",
                        }}
                      />
                    </TableCell>

                    {/* Reviewer & Feedback */}
                    <TableCell sx={{ minWidth: 140 }}>
                      {row.reviewed_by ? (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "block" }}>
                            {row.reviewed_by.full_name || row.reviewed_by.username}
                          </Typography>
                          {row.reviewer_comment && (
                            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontStyle: "italic", display: "block" }}>
                              "{row.reviewer_comment}"
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                          Awaiting review
                        </Typography>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                      {row.status === "Pending" ? (
                        isSelf ? (
                          <Tooltip title="You cannot approve your own request (Separation of Duties)">
                            <span>
                              <Button size="small" variant="outlined" disabled sx={{ fontSize: "0.72rem" }}>
                                Own Request
                              </Button>
                            </span>
                          </Tooltip>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => onReview(row)}
                            sx={{
                              backgroundColor: colorTokens.primary.main,
                              "&:hover": { backgroundColor: colorTokens.primary.dark },
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              textTransform: "none",
                              px: 1.5,
                            }}
                          >
                            Review Request
                          </Button>
                        )
                      ) : (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
                          {row.status}
                        </Typography>
                      )}
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
        onPageChange={(_, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Paper>
  );
};
