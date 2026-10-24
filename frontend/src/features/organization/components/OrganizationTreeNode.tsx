import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BusinessIcon from "@mui/icons-material/Business";
import DomainIcon from "@mui/icons-material/Domain";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import PublicIcon from "@mui/icons-material/Public";
import SecurityIcon from "@mui/icons-material/Security";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PersonIcon from "@mui/icons-material/Person";
import { HierarchyNode } from "../types/organization.types";
import { getLevelBadgeColor, getLevelBadgeBg } from "../utils/hierarchy";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationTreeNodeProps {
  node: HierarchyNode;
  selectedNodeId: string | null;
  onSelectNode: (node: HierarchyNode) => void;
  expandedMap: Record<string, boolean>;
  onToggleExpand: (nodeId: string) => void;
  searchFilter: string;
}

const getLevelIcon = (level: string) => {
  switch (level) {
    case "MAIN_COMPANY":
      return <BusinessIcon fontSize="small" />;
    case "SUB_COMPANY":
      return <DomainIcon fontSize="small" />;
    case "PROJECT":
      return <WorkOutlineIcon fontSize="small" />;
    case "CIRCLE":
      return <PublicIcon fontSize="small" />;
    case "DOMAIN":
      return <SecurityIcon fontSize="small" />;
    case "DEPARTMENT":
      return <GroupsIcon fontSize="small" />;
    case "SUB_DEPARTMENT":
    case "TEAM":
      return <AccountTreeIcon fontSize="small" />;
    case "USER":
      return <PersonIcon fontSize="small" />;
    default:
      return <AccountTreeIcon fontSize="small" />;
  }
};


export const OrganizationTreeNode: React.FC<OrganizationTreeNodeProps> = ({
  node,
  selectedNodeId,
  onSelectNode,
  expandedMap,
  onToggleExpand,
  searchFilter,
}) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedMap[node.id] ?? false;
  const isSelected = selectedNodeId === node.id;

  // Filter check
  const matchesSearch =
    !searchFilter ||
    node.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    node.code.toLowerCase().includes(searchFilter.toLowerCase());

  const hasMatchingChild = (n: HierarchyNode): boolean => {
    if (!searchFilter) return true;
    if (
      n.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      n.code.toLowerCase().includes(searchFilter.toLowerCase())
    ) {
      return true;
    }
    return Boolean(n.children?.some(hasMatchingChild));
  };

  const shouldRender = matchesSearch || hasMatchingChild(node);
  if (!shouldRender) return null;

  const badgeColor = getLevelBadgeColor(node.level);
  const badgeBg = getLevelBadgeBg(node.level);

  return (
    <Box sx={{ my: 0.5 }}>
      <Box
        id={`tree-node-${node.id}`}
        onClick={() => onSelectNode(node)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 1,
          borderRadius: "10px",
          cursor: "pointer",
          bgcolor: isSelected
            ? "rgba(30, 58, 138, 0.08)"
            : "transparent",
          border: `1px solid ${
            isSelected ? colorTokens.primary.main : "transparent"
          }`,
          transition: "all 0.15s ease-in-out",
          "&:hover": {
            bgcolor: isSelected
              ? "rgba(30, 58, 138, 0.12)"
              : "rgba(0, 0, 0, 0.03)",
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
              sx={{ p: 0.25, color: colorTokens.text.secondary }}
            >
              {isExpanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          ) : (
            <Box sx={{ width: 24 }} />
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: badgeColor,
            }}
          >
            {getLevelIcon(node.level)}
          </Box>

          <Chip
            size="small"
            label={node.badge || node.level}
            sx={{
              fontWeight: 700,
              fontSize: "0.68rem",
              height: 20,
              bgcolor: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
            }}
          />

          <Typography
            variant="body2"
            sx={{
              fontWeight: isSelected ? 700 : 500,
              color: colorTokens.text.primary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.name}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: colorTokens.text.secondary,
              fontSize: "0.75rem",
            }}
          >
            ({node.code})
          </Typography>
        </Stack>

        {hasChildren && (
          <Typography
            variant="caption"
            sx={{
              color: colorTokens.text.secondary,
              fontWeight: 600,
              bgcolor: "rgba(0,0,0,0.04)",
              px: 1,
              py: 0.25,
              borderRadius: "12px",
              fontSize: "0.7rem",
              ml: 1,
              flexShrink: 0,
            }}
          >
            {node.children.length} {node.children.length === 1 ? "child" : "children"}
          </Typography>
        )}
      </Box>

      {hasChildren && isExpanded && (
        <Box
          sx={{
            ml: 2.5,
            pl: 1.5,
            borderLeft: `2px dashed ${colorTokens.workspace.divider}`,
          }}
        >
          {node.children.map((child) => (
            <OrganizationTreeNode
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              expandedMap={expandedMap}
              onToggleExpand={onToggleExpand}
              searchFilter={searchFilter}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
