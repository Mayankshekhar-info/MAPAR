import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

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

  // Resolve scope anchor level
  let anchorLevel = "CIRCLE";
  let anchorName = scope.circle_name || "Circle";
  let coverageNote = "Access is strictly confined to this Circle and its descendant domains, departments, and teams. Cross-circle data from sibling circles (e.g. Rajasthan, Maharashtra) is blocked on all dashboards, lists, charts, and API endpoints.";

  if (scope.team_id || scope.sub_department_id) {
    anchorLevel = "TEAM";
    anchorName = scope.team_name || scope.sub_department_name || "Team";
    coverageNote = "Access is strictly confined to this specialized Team/Sub-department.";
  } else if (scope.department_id) {
    anchorLevel = "DEPARTMENT";
    anchorName = scope.department_name || "Department";
    coverageNote = "Access is confined to this Department and its child Teams.";
  } else if (scope.domain_id) {
    anchorLevel = "DOMAIN";
    anchorName = scope.domain_name || "Domain";
    coverageNote = "Access is confined to this Domain and its child Departments and Teams.";
  } else if (scope.circle_id) {
    anchorLevel = "CIRCLE";
    anchorName = scope.circle_name || "Circle";
    coverageNote = `Access is strictly confined to ${scope.circle_name || "this Circle"} and its descendant domains, departments, and teams. Sibling circles and unrelated organizations are blocked.`;
  } else if (scope.project_id) {
    anchorLevel = "PROJECT";
    anchorName = scope.project_name || "Project";
    coverageNote = `Access is permitted to ${scope.project_name || "this Project"} and all child circles and descendants beneath it.`;
  } else if (scope.sub_company_id) {
    anchorLevel = "SUB_COMPANY";
    anchorName = scope.sub_company_name || "Sub Company";
    coverageNote = `Access is permitted to ${scope.sub_company_name || "this Sub Company"} and all projects, circles, and departments beneath it.`;
  } else if (scope.main_company_id) {
    anchorLevel = "MAIN_COMPANY";
    anchorName = scope.main_company_name || "Main Company";
    coverageNote = `Access is permitted across the entire organization tree under ${scope.main_company_name || "this Main Company"}.`;
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
    view: "View Data",
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: radiusTokens.xs,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccountTreeOutlinedIcon sx={{ fontSize: 17 }} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Scope #{index + 1}: {anchorName}
            </Typography>
            <Chip
              label={anchorLevel.replace("_", " ")}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 800,
                fontFamily: "monospace",
                bgcolor: anchorLevel === "CIRCLE" ? "#E0F2FE" : "#F1F5F9",
                color: anchorLevel === "CIRCLE" ? "#0369A1" : "#475569",
                border: `1px solid ${anchorLevel === "CIRCLE" ? "#BAE6FD" : "#E2E8F0"}`,
              }}
            />
          </Box>
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
          mb: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 0.75, fontWeight: 700, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.05em" }}>
          Full Hierarchy Path:
        </Typography>
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75}>
          {steps.map((step, sIdx) => (
            <React.Fragment key={sIdx}>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.35,
                  bgcolor: sIdx === steps.length - 1 ? colorTokens.primary.lighter : "#FFFFFF",
                  border: `1px solid ${sIdx === steps.length - 1 ? colorTokens.primary.light : "#E2E8F0"}`,
                  borderRadius: radiusTokens.xs,
                  color: sIdx === steps.length - 1 ? colorTokens.primary.main : colorTokens.text.primary,
                  fontWeight: sIdx === steps.length - 1 ? 800 : 500,
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

      {/* Boundary Explanation Notice */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          p: 1.25,
          bgcolor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: radiusTokens.xs,
          mb: 1.5,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16, color: "#15803D", mt: 0.1, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: "#166534", lineHeight: 1.4, fontWeight: 500 }}>
          {coverageNote}
        </Typography>
      </Box>

      {/* Access Permissions / Actions */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SecurityOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary }}>
            Permitted Actions:
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
