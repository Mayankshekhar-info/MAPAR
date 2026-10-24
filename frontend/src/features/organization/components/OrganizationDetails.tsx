import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { NodeDetail, HierarchyLevel } from "../types/organization.types";
import { HIERARCHY_CONFIG, getLevelBadgeColor, getLevelBadgeBg, getAddChildButtonLabel } from "../utils/hierarchy";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationDetailsProps {
  nodeDetail?: NodeDetail | null;
  isLoading: boolean;
  onEdit: () => void;
  onAddChild: (childLevel?: HierarchyLevel) => void;
  onDelete: () => void;
}

export const OrganizationDetails: React.FC<OrganizationDetailsProps> = ({
  nodeDetail,
  isLoading,
  onEdit,
  onAddChild,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: "14px",
          border: `1px solid ${colorTokens.workspace.divider}`,
          bgcolor: colorTokens.workspace.surface,
          spaceY: 2,
        }}
      >
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "10px", my: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: "10px" }} />
      </Paper>
    );
  }

  if (!nodeDetail) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: "14px",
          border: `1px solid ${colorTokens.workspace.divider}`,
          bgcolor: colorTokens.workspace.surface,
          textAlign: "center",
          height: "100%",
          minHeight: 450,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: "rgba(0, 0, 0, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colorTokens.text.secondary,
            mb: 2,
          }}
        >
          <ArrowForwardIosIcon fontSize="medium" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
          Select a Hierarchy Node
        </Typography>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.5, maxWidth: 300 }}>
          Click any company, project, circle, domain, or department in the tree explorer to view its complete details, child elements, and actions.
        </Typography>
      </Paper>
    );
  }

  const badgeColor = getLevelBadgeColor(nodeDetail.level);
  const badgeBg = getLevelBadgeBg(nodeDetail.level);
  const addChildLabel = getAddChildButtonLabel(nodeDetail.level);
  const canAddChild = Boolean(nodeDetail.allowed_child_level);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.divider}`,
        bgcolor: colorTokens.workspace.surface,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 520,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          bgcolor: "rgba(0, 0, 0, 0.02)",
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Chip
            size="small"
            label={HIERARCHY_CONFIG[nodeDetail.level]?.name || nodeDetail.level}
            sx={{
              fontWeight: 700,
              fontSize: "0.72rem",
              height: 22,
              bgcolor: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
            }}
          />
          <StatusChip
            status={nodeDetail.status === "ACTIVE" ? "success" : "neutral"}
            label={nodeDetail.status}
          />
        </Stack>

        <Typography
          id="detail-node-name"
          variant="h5"
          sx={{
            fontWeight: 700,
            color: colorTokens.text.primary,
            mt: 1.5,
          }}
        >
          {nodeDetail.name}
        </Typography>
        <Typography
          id="detail-node-code"
          variant="body2"
          sx={{
            fontFamily: "monospace",
            color: colorTokens.text.secondary,
            fontWeight: 600,
            mt: 0.25,
          }}
        >
          Code: {nodeDetail.code}
        </Typography>
      </Box>

      {/* Body Details */}
      <Box sx={{ p: 2.5, overflowY: "auto", flex: 1, spaceY: 3 }}>
        {/* Description */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
            Description
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, mt: 0.5, fontStyle: nodeDetail.description ? "normal" : "italic" }}>
            {nodeDetail.description || "No description provided."}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Parent Entity */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
            Parent Organization
          </Typography>
          {nodeDetail.parent ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mt: 1,
                bgcolor: "rgba(0,0,0,0.02)",
                border: `1px solid ${colorTokens.workspace.divider}`,
                borderRadius: "10px",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                {nodeDetail.parent.name}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                {nodeDetail.parent.level.replace("_", " ")} &bull; {nodeDetail.parent.code}
              </Typography>
            </Paper>
          ) : (
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.5 }}>
              Top-Level Root Organization (No Parent)
            </Typography>
          )}
        </Box>

        {/* Hierarchy Overview Summary */}
        {nodeDetail.hierarchy_summary && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase", display: "block", mb: 1 }}>
              Organization Hierarchy Metrics
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: "rgba(0,0,0,0.02)",
                border: `1px solid ${colorTokens.workspace.divider}`,
                borderRadius: "10px",
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {nodeDetail.hierarchy_summary.sub_companies_count !== undefined && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${nodeDetail.hierarchy_summary.sub_companies_count} Sub Companies`}
                  sx={{ fontWeight: 600, fontSize: "0.72rem" }}
                />
              )}
              {nodeDetail.hierarchy_summary.projects_count !== undefined && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${nodeDetail.hierarchy_summary.projects_count} Projects`}
                  sx={{ fontWeight: 600, fontSize: "0.72rem" }}
                />
              )}
              {nodeDetail.hierarchy_summary.direct_circles_count !== undefined && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${nodeDetail.hierarchy_summary.direct_circles_count} Direct Circles`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem", color: "#059669", borderColor: "#A7F3D0" }}
                />
              )}
              {Boolean(nodeDetail.hierarchy_summary.sub_company_circles_count) && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${nodeDetail.hierarchy_summary.sub_company_circles_count} Sub Company Circles`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem", color: "#6366F1", borderColor: "#C7D2FE" }}
                />
              )}
              {nodeDetail.hierarchy_summary.project_circles_count !== undefined && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${nodeDetail.hierarchy_summary.project_circles_count} Project Circles`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem", color: "#2563EB", borderColor: "#BFDBFE" }}
                />
              )}
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Children Elements */}
        <Box sx={{ mb: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
              Direct Children ({nodeDetail.children_count})
            </Typography>
            {canAddChild && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={() => onAddChild()}
                  sx={{ fontSize: "0.72rem", fontWeight: 700, p: 0.5 }}
                >
                  {addChildLabel}
                </Button>
                {nodeDetail.level === "MAIN_COMPANY" && (
                  <Button
                    id="btn-detail-add-circle-top"
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => onAddChild("CIRCLE")}
                    sx={{ fontSize: "0.72rem", fontWeight: 700, p: 0.5 }}
                  >
                    + Add Circle
                  </Button>
                )}
              </Stack>
            )}
          </Stack>

          {nodeDetail.children && nodeDetail.children.length > 0 ? (
            <Stack spacing={1} sx={{ maxHeight: 180, overflowY: "auto" }}>
              {nodeDetail.children.map((child) => (
                <Paper
                  key={child.id}
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: "8px",
                    bgcolor: "rgba(0,0,0,0.02)",
                    border: `1px solid ${colorTokens.workspace.divider}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {child.name}
                      </Typography>
                      {child.level && (nodeDetail.level === "MAIN_COMPANY" || nodeDetail.level === "SUB_COMPANY") && (
                        <Chip
                          size="small"
                          label={child.level === "SUB_COMPANY" ? "Sub Company" : child.level === "PROJECT" ? "Project" : "Direct Circle"}
                          sx={{
                            height: 18,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            bgcolor: child.level === "SUB_COMPANY" ? "#EEF2FF" : child.level === "PROJECT" ? "#EFF6FF" : "#ECFDF5",
                            color: child.level === "SUB_COMPANY" ? "#4F46E5" : child.level === "PROJECT" ? "#2563EB" : "#059669",
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", color: colorTokens.text.secondary }}>
                      {child.level === "USER" ? `@${child.code}` : child.code}
                    </Typography>
                  </Box>
                  <StatusChip
                    status={child.status === "ACTIVE" ? "success" : "neutral"}
                    label={child.status}
                    size="small"
                  />
                </Paper>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontStyle: "italic" }}>
              {nodeDetail.allowed_child_level === "USER"
                ? "No users assigned."
                : nodeDetail.allowed_child_level
                ? `No ${(HIERARCHY_CONFIG[nodeDetail.allowed_child_level]?.plural_name || "child elements").toLowerCase()} found.`
                : "No child elements."}
            </Typography>
          )}
        </Box>


        {/* Audit History */}
        {nodeDetail.audits && nodeDetail.audits.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
                Recent Activity &bull; Audit Trail
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {nodeDetail.audits.map((a, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <HistoryIcon sx={{ fontSize: 14, color: colorTokens.text.muted }} />
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      <strong>{a.action}</strong> by {a.user} at {new Date(a.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* Action Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${colorTokens.workspace.divider}`,
          bgcolor: "rgba(0,0,0,0.02)",
        }}
      >
        <Stack direction="row" spacing={1.5}>
          {canAddChild && (
            <>
              <Button
                id="btn-detail-add-child"
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => onAddChild()}
                sx={{ fontWeight: 600, borderRadius: "10px", py: 1 }}
              >
                {addChildLabel}
              </Button>
              {nodeDetail.level === "MAIN_COMPANY" && (
                <Button
                  id="btn-detail-add-circle"
                  fullWidth
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => onAddChild("CIRCLE")}
                  sx={{ fontWeight: 600, borderRadius: "10px", py: 1 }}
                >
                  + Add Circle
                </Button>
              )}
            </>
          )}
          <Button
            id="btn-detail-edit"
            variant="outlined"
            color="primary"
            startIcon={<EditIcon />}
            onClick={onEdit}
            sx={{ fontWeight: 600, borderRadius: "10px", minWidth: 90 }}
          >
            Edit
          </Button>
          <Button
            id="btn-detail-delete"
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={onDelete}
            sx={{ fontWeight: 600, borderRadius: "10px", minWidth: 90 }}
          >
            Delete
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};
