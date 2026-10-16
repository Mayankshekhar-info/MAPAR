import React from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { RoleListItem } from "../types/roles.types";

interface RolesTableProps {
  roles: RoleListItem[];
  onEditRole: (role: RoleListItem) => void;
  onDeleteRole: (role: RoleListItem) => void;
}

export const RolesTable: React.FC<RolesTableProps> = ({ roles, onEditRole, onDeleteRole }) => {
  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                bgcolor: colorTokens.workspace.background,
                color: colorTokens.text.secondary,
                fontWeight: 700,
                fontSize: "0.74rem",
                letterSpacing: "0.03em",
                borderBottom: `2px solid ${colorTokens.workspace.border}`,
                py: 1.5,
              },
            }}
          >
            <TableCell sx={{ minWidth: 220 }}>ROLE NAME & CODE</TableCell>
            <TableCell sx={{ minWidth: 260 }}>DESCRIPTION</TableCell>
            <TableCell sx={{ minWidth: 120 }}>TYPE</TableCell>
            <TableCell align="center" sx={{ minWidth: 130 }}>PERMISSIONS</TableCell>
            <TableCell align="center" sx={{ minWidth: 110 }}>USERS</TableCell>
            <TableCell align="center" sx={{ minWidth: 100 }}>STATUS</TableCell>
            <TableCell align="center" sx={{ minWidth: 100 }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map((r) => {
            const isActive = r.status === "ACTIVE";
            const isSystem = r.role_type === "SYSTEM";

            return (
              <TableRow
                key={r.id}
                hover
                sx={{
                  "&:hover": { bgcolor: colorTokens.workspace.background },
                  "& td": { py: 1.25 },
                }}
              >
                {/* Role Name */}
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {r.name}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", color: colorTokens.text.muted, fontSize: "0.72rem" }}>
                      {r.code}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Description */}
                <TableCell>
                  <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.82rem", maxWidth: 300, whiteSpace: "normal" }}>
                    {r.description || "No description provided."}
                  </Typography>
                </TableCell>

                {/* Role Type */}
                <TableCell>
                  <Chip
                    label={isSystem ? "SYSTEM" : "CUSTOM"}
                    size="small"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      borderRadius: radiusTokens.xs,
                      bgcolor: isSystem ? "#EEF2FF" : "#F8FAFC",
                      color: isSystem ? "#4F46E5" : colorTokens.text.secondary,
                      border: `1px solid ${isSystem ? "#C7D2FE" : colorTokens.workspace.border}`,
                    }}
                  />
                </TableCell>

                {/* Permissions Count */}
                <TableCell align="center">
                  <Chip
                    label={`${r.permissions_count} actions`}
                    size="small"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      bgcolor: colorTokens.primary.lighter,
                      color: colorTokens.primary.darker,
                    }}
                  />
                </TableCell>

                {/* Users Count */}
                <TableCell align="center">
                  <Chip
                    label={`${r.users_count} user${r.users_count === 1 ? "" : "s"}`}
                    size="small"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      bgcolor: colorTokens.workspace.background,
                      border: `1px solid ${colorTokens.workspace.border}`,
                    }}
                  />
                </TableCell>

                {/* Status */}
                <TableCell align="center">
                  <Chip
                    label={r.status}
                    size="small"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      borderRadius: radiusTokens.xs,
                      bgcolor: isActive ? "#DCFCE7" : "#FEE2E2",
                      color: isActive ? "#15803D" : "#B91C1C",
                      border: `1px solid ${isActive ? "#86EFAC" : "#FCA5A5"}`,
                    }}
                  />
                </TableCell>

                {/* Actions */}
                <TableCell align="center">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    <Tooltip title="Configure Role & Permissions">
                      <IconButton size="small" onClick={() => onEditRole(r)} sx={{ color: colorTokens.text.secondary }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {!isSystem && (
                      <Tooltip title={r.users_count > 0 ? "Cannot delete role with assigned users" : "Delete Custom Role"}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onDeleteRole(r)}
                            disabled={r.users_count > 0}
                            sx={{ color: colorTokens.status.error.main }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};
