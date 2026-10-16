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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PublicIcon from "@mui/icons-material/Public";
import ApartmentIcon from "@mui/icons-material/Apartment";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { AccessScopeListItem } from "../types/scopes.types";

interface AccessScopesTableProps {
  scopes: AccessScopeListItem[];
  onDeleteScope: (scope: AccessScopeListItem) => void;
}

export const AccessScopesTable: React.FC<AccessScopesTableProps> = ({ scopes, onDeleteScope }) => {
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
            <TableCell sx={{ minWidth: 200 }}>USER & IDENTITY</TableCell>
            <TableCell sx={{ minWidth: 150 }}>ROLE</TableCell>
            <TableCell sx={{ minWidth: 140 }}>SCOPE TYPE</TableCell>
            <TableCell sx={{ minWidth: 300 }}>AUTHORIZED ORGANIZATION SCOPE</TableCell>
            <TableCell align="center" sx={{ minWidth: 90 }}>STATUS</TableCell>
            <TableCell align="center" sx={{ minWidth: 80 }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {scopes.map((s) => {
            const isGlobal = s.scope_type === "GLOBAL" || s.scope_type === "CORPORATE";
            return (
              <TableRow
                key={s.id}
                hover
                sx={{
                  "&:hover": { bgcolor: colorTokens.workspace.background },
                  "& td": { py: 1.25 },
                }}
              >
                {/* User */}
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {s.full_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem" }}>
                      @{s.username} • {s.email}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Role */}
                <TableCell>
                  <Chip
                    label={s.role_name}
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

                {/* Scope Type */}
                <TableCell>
                  <Chip
                    icon={isGlobal ? <PublicIcon sx={{ fontSize: "14px !important" }} /> : <ApartmentIcon sx={{ fontSize: "14px !important" }} />}
                    label={s.scope_type_display}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      borderRadius: radiusTokens.xs,
                      bgcolor: isGlobal ? "#EEF2FF" : colorTokens.workspace.background,
                      color: isGlobal ? "#4F46E5" : colorTokens.text.primary,
                      border: `1px solid ${colorTokens.workspace.border}`,
                    }}
                  />
                </TableCell>

                {/* Authorized Hierarchy */}
                <TableCell>
                  {isGlobal ? (
                    <Typography variant="body2" sx={{ color: colorTokens.primary.main, fontWeight: 600 }}>
                      All Companies, Projects & Circles (Unrestricted)
                    </Typography>
                  ) : s.circles.length > 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {s.circles.map((c) => (
                        <Box key={c.circle_id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip
                            label={c.circle_code}
                            size="small"
                            sx={{ height: 18, fontSize: "0.64rem", fontWeight: 700 }}
                          />
                          <Typography variant="body2" sx={{ fontSize: "0.8rem", color: colorTokens.text.secondary }}>
                            {c.hierarchy_breadcrumb}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      No specific circle assignments.
                    </Typography>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell align="center">
                  <Chip
                    label={s.is_active ? "Active" : "Inactive"}
                    size="small"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      borderRadius: radiusTokens.xs,
                      bgcolor: s.is_active ? "#DCFCE7" : "#FEE2E2",
                      color: s.is_active ? "#15803D" : "#B91C1C",
                      border: `1px solid ${s.is_active ? "#86EFAC" : "#FCA5A5"}`,
                    }}
                  />
                </TableCell>

                {/* Actions */}
                <TableCell align="center">
                  <Tooltip title="Revoke Access Scope">
                    <IconButton size="small" onClick={() => onDeleteScope(s)} sx={{ color: colorTokens.status.error.main }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};
