import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { OrganizationScopeItem } from "../types/users.types";

interface OrganizationScopeCardProps {
  scope: OrganizationScopeItem;
  index: number;
  onEdit?: (scope: OrganizationScopeItem, index: number) => void;
  onRemove?: (index: number) => void;
  readOnly?: boolean;
}

export const OrganizationScopeCard: React.FC<OrganizationScopeCardProps> = ({
  scope,
  index,
  onEdit,
  onRemove,
  readOnly = false,
}) => {
  // Build breadcrumb steps array
  const steps: string[] = [];
  if (scope.hierarchy_breadcrumb && scope.hierarchy_breadcrumb.includes(" → ")) {
    scope.hierarchy_breadcrumb.split(" → ").forEach((p) => steps.push(p.trim()));
  } else {
    if (scope.main_company_name) steps.push(scope.main_company_name);
    if (scope.sub_company_name) steps.push(scope.sub_company_name);
    if (scope.project_name) steps.push(scope.project_name);
    if (scope.circle_name) steps.push(scope.circle_name);
    if (scope.domain_name) steps.push(scope.domain_name);
    if (scope.department_name) steps.push(scope.department_name);
    if (scope.team_name || scope.sub_department_name) {
      steps.push(scope.team_name || scope.sub_department_name || "");
    }
  }

  // Fallback if no steps resolved
  if (steps.length === 0) {
    steps.push(scope.hierarchy_breadcrumb || "All Authorized Descendants");
  }

  const actions = scope.actions && scope.actions.length > 0
    ? scope.actions
    : [
        scope.can_view ? "view" : null,
        scope.can_manage ? "manage" : null,
        scope.can_create ? "create" : null,
        scope.can_update ? "update" : null,
        scope.can_delete ? "delete" : null,
      ].filter(Boolean) as string[];

  const actionLabels: Record<string, string> = {
    view: "View",
    manage: "Manage",
    create: "Create",
    update: "Update",
    delete: "Delete",
  };

  const actionColors: Record<string, { bg: string; color: string; border: string }> = {
    view: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    manage: { bg: "#FAF5FF", color: "#7E22CE", border: "#E9D5FF" },
    create: { bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
    update: { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
    delete: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  };

  return (
    <Card
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: radiusTokens.md,
        border: `1.5px solid ${colorTokens.workspace.border}`,
        bgcolor: "#FFFFFF",
        boxShadow: shadowTokens.card,
        position: "relative",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          borderColor: colorTokens.primary.main,
          boxShadow: shadowTokens.modal,
        },
      }}
    >
      {/* Header bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: radiusTokens.xs,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccountTreeOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.01em" }}>
            Organization Access Scope #{index + 1}
          </Typography>
        </Box>

        {!readOnly && (
          <Stack direction="row" spacing={1}>
            {onEdit && (
              <Button
                size="small"
                variant="text"
                startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={() => onEdit(scope, index)}
                sx={{
                  color: colorTokens.primary.main,
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  textTransform: "none",
                  py: 0.25,
                  px: 1,
                  borderRadius: radiusTokens.xs,
                  "&:hover": { bgcolor: colorTokens.primary.lighter },
                }}
              >
                Edit
              </Button>
            )}
            {onRemove && (
              <Button
                size="small"
                variant="text"
                startIcon={<DeleteOutlineOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={() => onRemove(index)}
                sx={{
                  color: colorTokens.status.error.main,
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  textTransform: "none",
                  py: 0.25,
                  px: 1,
                  borderRadius: radiusTokens.xs,
                  "&:hover": { bgcolor: "#FEE2E2" },
                }}
              >
                Remove
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {/* Cascading Hierarchy Path */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "#F8FAFC",
          borderRadius: radiusTokens.sm,
          border: `1px solid ${colorTokens.workspace.border}`,
          mb: 2,
        }}
      >
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75}>
          {steps.map((step, sIdx) => (
            <React.Fragment key={sIdx}>
              <Box
                sx={{
                  px: 1,
                  py: 0.35,
                  bgcolor: sIdx === steps.length - 1 ? colorTokens.primary.lighter : "#FFFFFF",
                  border: `1px solid ${sIdx === steps.length - 1 ? colorTokens.primary.light : "#E2E8F0"}`,
                  borderRadius: radiusTokens.xs,
                  color: sIdx === steps.length - 1 ? colorTokens.primary.main : colorTokens.text.primary,
                  fontWeight: sIdx === steps.length - 1 ? 700 : 500,
                  fontSize: "0.8rem",
                }}
              >
                {step}
              </Box>
              {sIdx < steps.length - 1 && (
                <Typography sx={{ color: colorTokens.text.muted, fontSize: "0.85rem", fontWeight: 700 }}>
                  →
                </Typography>
              )}
            </React.Fragment>
          ))}
        </Stack>
      </Box>

      {/* Access Permissions / Actions */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SecurityOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary }}>
            Access Rights:
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          {["view", "manage", "create", "update", "delete"].map((act) => {
            const hasAct = actions.includes(act);
            const style = actionColors[act] || { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
            return (
              <Chip
                key={act}
                size="small"
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {hasAct && <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />}
                    <span>{actionLabels[act] || act}</span>
                  </Box>
                }
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: hasAct ? 700 : 400,
                  bgcolor: hasAct ? style.bg : "#F8FAFC",
                  color: hasAct ? style.color : "#94A3B8",
                  border: `1px solid ${hasAct ? style.border : "#E2E8F0"}`,
                  borderRadius: radiusTokens.xs,
                  opacity: hasAct ? 1 : 0.6,
                }}
              />
            );
          })}
        </Stack>
      </Box>
    </Card>
  );
};
