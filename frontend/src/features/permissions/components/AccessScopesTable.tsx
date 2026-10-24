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
import CircularProgress from "@mui/material/CircularProgress";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PublicIcon from "@mui/icons-material/Public";
import ApartmentIcon from "@mui/icons-material/Apartment";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { AccessScopeListItem } from "../types/scopes.types";

interface AccessScopesTableProps {
  scopes: AccessScopeListItem[];
  loading?: boolean;
  onDelete?: (scope: AccessScopeListItem) => void;
  onDeleteScope?: (scope: AccessScopeListItem) => void;
  onConfigureUser?: (scope: AccessScopeListItem) => void;
}

export const AccessScopesTable: React.FC<AccessScopesTableProps> = ({
  scopes,
  loading = false,
  onDelete,
  onDeleteScope,
  onConfigureUser,
}) => {
  const handleDelete = (s: AccessScopeListItem) => {
    if (onDelete) onDelete(s);
    else if (onDeleteScope) onDeleteScope(s);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

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
            <TableCell sx={{ minWidth: 150 }}>ENTERPRISE ROLE</TableCell>
            <TableCell sx={{ minWidth: 140 }}>SCOPE LEVEL</TableCell>
            <TableCell sx={{ minWidth: 320 }}>AUTHORIZED ORGANIZATION PATH</TableCell>
            <TableCell align="center" sx={{ minWidth: 90 }}>STATUS</TableCell>
            <TableCell align="center" sx={{ minWidth: 90 }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {scopes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ py: 6, textAlign: "center" }}>
                <AccountTreeOutlinedIcon sx={{ fontSize: 36, color: colorTokens.text.muted, mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  No Access Scopes Found
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  Select a user from the dropdown above to configure their organization scopes.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            scopes.map((s) => {
              const isGlobal = s.scope_type === "GLOBAL" || s.scope_type === "CORPORATE";
              const displayBreadcrumb = s.hierarchy_breadcrumb || (s.circles && s.circles[0]?.hierarchy_breadcrumb) || s.scope_type_display;
              const displayLevel = s.anchor_level || s.scope_type;

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

                  {/* Scope Level */}
                  <TableCell>
                    <Chip
                      icon={isGlobal ? <PublicIcon sx={{ fontSize: "14px !important" }} /> : <ApartmentIcon sx={{ fontSize: "14px !important" }} />}
                      label={displayLevel.replace("_", " ")}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        borderRadius: radiusTokens.xs,
                        bgcolor: isGlobal ? "#EEF2FF" : "#F8FAFC",
                        color: isGlobal ? "#4F46E5" : colorTokens.text.primary,
                        border: `1px solid ${colorTokens.workspace.border}`,
                      }}
                    />
                  </TableCell>

                  {/* Authorized Hierarchy Path */}
                  <TableCell>
                    {isGlobal ? (
                      <Typography variant="body2" sx={{ color: colorTokens.primary.main, fontWeight: 600 }}>
                        All Companies, Projects & Circles (Unrestricted)
                      </Typography>
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: "0.82rem", color: colorTokens.text.primary, fontWeight: 500 }}>
                          {displayBreadcrumb}
                        </Typography>
                      </Box>
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
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                      {onConfigureUser && (
                        <Tooltip title="Configure Organization Scope">
                          <IconButton size="small" onClick={() => onConfigureUser(s)} sx={{ color: colorTokens.primary.main }}>
                            <ApartmentIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Revoke Scope">
                        <IconButton size="small" onClick={() => handleDelete(s)} sx={{ color: colorTokens.status.error.main }}>
                          <DeleteOutlineIcon fontSize="small" />
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
    </Box>
  );
};
