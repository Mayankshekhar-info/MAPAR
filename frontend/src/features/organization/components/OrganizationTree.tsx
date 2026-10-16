import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import BusinessIcon from "@mui/icons-material/Business";
import { HierarchyNode } from "../types/organization.types";
import { OrganizationTreeNode } from "./OrganizationTreeNode";
import { EmptyState } from "../../../components/EmptyState/EmptyState";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationTreeProps {
  tree: HierarchyNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: HierarchyNode) => void;
  searchFilter: string;
  onAddCompany: () => void;
}

export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
  searchFilter,
  onAddCompany,
}) => {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // Auto-expand all top-level nodes on first load or when searching
  useEffect(() => {
    if (tree && tree.length > 0) {
      const initial: Record<string, boolean> = {};
      const expandAllRecursive = (nodes: HierarchyNode[]) => {
        nodes.forEach((n) => {
          initial[n.id] = true;
          if (n.children && n.children.length > 0) {
            expandAllRecursive(n.children);
          }
        });
      };

      if (searchFilter) {
        expandAllRecursive(tree);
      } else {
        // Expand root and 2nd level by default
        tree.forEach((root) => {
          initial[root.id] = true;
          root.children?.forEach((child) => {
            initial[child.id] = true;
          });
        });
      }
      setExpandedMap((prev) => ({ ...prev, ...initial }));
    }
  }, [tree, searchFilter]);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const expandRec = (nodes: HierarchyNode[]) => {
      nodes.forEach((n) => {
        allExpanded[n.id] = true;
        if (n.children && n.children.length > 0) {
          expandRec(n.children);
        }
      });
    };
    expandRec(tree);
    setExpandedMap(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedMap({});
  };

  if (!tree || tree.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: "14px",
          border: `1px solid ${colorTokens.workspace.divider}`,
          bgcolor: colorTokens.workspace.surface,
          minHeight: 450,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState
          title="No Organization Structure Created Yet"
          description="Your enterprise organization hierarchy begins with creating a Main Company. All subsidiaries, projects, circles, and departments will be organized under it."
          action={
            <Button
              variant="contained"
              color="primary"
              startIcon={<BusinessIcon />}
              onClick={onAddCompany}
              sx={{ fontWeight: 600, borderRadius: "10px", mt: 2 }}
            >
              + Create Main Company
            </Button>
          }
        />
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.divider}`,
        bgcolor: colorTokens.workspace.surface,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 520,
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: "rgba(0, 0, 0, 0.02)",
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: colorTokens.text.secondary,
            fontSize: "0.75rem",
          }}
        >
          Hierarchy Explorer ({tree.length} Root {tree.length === 1 ? "Company" : "Companies"})
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="text"
            startIcon={<UnfoldMoreIcon fontSize="small" />}
            onClick={handleExpandAll}
            sx={{ fontSize: "0.75rem", color: colorTokens.text.secondary }}
          >
            Expand All
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<UnfoldLessIcon fontSize="small" />}
            onClick={handleCollapseAll}
            sx={{ fontSize: "0.75rem", color: colorTokens.text.secondary }}
          >
            Collapse All
          </Button>
        </Stack>
      </Box>

      <Box
        id="organization-tree-container"
        sx={{
          p: 2,
          overflowY: "auto",
          maxHeight: 650,
          flex: 1,
        }}
      >
        {tree.map((node) => (
          <OrganizationTreeNode
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            expandedMap={expandedMap}
            onToggleExpand={handleToggleExpand}
            searchFilter={searchFilter}
          />
        ))}
      </Box>
    </Paper>
  );
};
