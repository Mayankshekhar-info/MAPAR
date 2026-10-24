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
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { UserListItem } from "../types/users.types";

interface UsersTableProps {
  users: UserListItem[];
  onEditUser: (user: UserListItem) => void;
  onViewAccess: (user: UserListItem) => void;
  onToggleStatus: (user: UserListItem) => void;
  isToggling?: boolean;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  onEditUser,
  onViewAccess,
  onToggleStatus,
}) => {
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
            <TableCell sx={{ minWidth: 200 }}>USER / IDENTITY</TableCell>
            <TableCell sx={{ minWidth: 180 }}>EMAIL</TableCell>
            <TableCell sx={{ minWidth: 220 }}>ORGANIZATION SCOPE</TableCell>
            <TableCell sx={{ minWidth: 150 }}>ENTERPRISE ROLE</TableCell>
            <TableCell align="center" sx={{ minWidth: 100 }}>STATUS</TableCell>
            <TableCell align="center" sx={{ minWidth: 120 }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => {
            const isActive = u.is_active && u.status === "ACTIVE";
            return (
              <TableRow
                key={u.id}
                hover
                sx={{
                  "&:hover": { bgcolor: colorTokens.workspace.background },
                  "& td": { py: 1.25 },
                }}
              >
                {/* Identity */}
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {u.full_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem" }}>
                      @{u.username} {u.designation ? `• ${u.designation}` : ""}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Email */}
                <TableCell>
                  <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                    {u.email}
                  </Typography>
                </TableCell>

                {/* Organization Scope */}
                <TableCell>
                  {u.organization_scope ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {u.circle_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                        {u.organization_scope}
                      </Typography>
                    </Box>
                  ) : (
                    <Chip
                      label="Unrestricted / Corporate"
                      size="small"
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        bgcolor: colorTokens.workspace.background,
                        border: `1px solid ${colorTokens.workspace.border}`,
                      }}
                    />
                  )}
                </TableCell>

                {/* Role */}
                <TableCell>
                  <Chip
                    label={u.role_name}
                    size="small"
                    sx={{
                      bgcolor: colorTokens.primary.lighter,
                      color: colorTokens.primary.darker,
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      borderRadius: radiusTokens.xs,
                      border: `1px solid ${colorTokens.primary.light}`,
                    }}
                  />
                </TableCell>

                {/* Status */}
                <TableCell align="center">
                  <Chip
                    label={u.status}
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
                    <Tooltip title="Configure Access & Scope">
                      <IconButton size="small" onClick={() => onViewAccess(u)} sx={{ color: colorTokens.primary.main }}>
                        <VpnKeyOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit User Account">
                      <IconButton size="small" onClick={() => onEditUser(u)} sx={{ color: colorTokens.text.secondary }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={isActive ? "Deactivate Account" : "Activate Account"}>
                      <IconButton
                        size="small"
                        onClick={() => onToggleStatus(u)}
                        sx={{ color: isActive ? colorTokens.status.success.main : colorTokens.text.muted }}
                      >
                        {isActive ? <ToggleOnIcon fontSize="medium" /> : <ToggleOffIcon fontSize="medium" />}
                      </IconButton>
                    </Tooltip>
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
