import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Chip,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { KPIDefinition } from "../types/kpi";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingState } from "../../../components/LoadingState";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

interface KPIDefinitionTableProps {
  definitions: KPIDefinition[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (kpi: KPIDefinition) => void;
  onDuplicate: (kpi: KPIDefinition) => void;
  onDelete: (kpi: KPIDefinition) => void;
}

export const KPIDefinitionTable: React.FC<KPIDefinitionTableProps> = ({
  definitions,
  isLoading,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [hierarchyFilter, setHierarchyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return definitions.filter((k) => {
      const s = search.toLowerCase();
      const matchesSearch =
        !s ||
        k.code.toLowerCase().includes(s) ||
        k.name.toLowerCase().includes(s) ||
        k.description?.toLowerCase().includes(s) ||
        k.formula_expression?.toLowerCase().includes(s);

      const matchesHierarchy =
        hierarchyFilter === "ALL" || k.hierarchy_level === hierarchyFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && k.is_active) ||
        (statusFilter === "INACTIVE" && !k.is_active);

      return matchesSearch && matchesHierarchy && matchesStatus;
    });
  }, [definitions, search, hierarchyFilter, statusFilter]);

  if (isLoading) {
    return <LoadingState message="Loading KPI definitions..." />;
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      {/* Filter Toolbar */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search code, name, or formula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: "100%", sm: 260 } }}
          />

          <TextField
            select
            size="small"
            label="Hierarchy Level"
            value={hierarchyFilter}
            onChange={(e) => setHierarchyFilter(e.target.value)}
            sx={{ width: 160 }}
          >
            <MenuItem value="ALL">All Levels</MenuItem>
            <MenuItem value="MAIN_COMPANY">Main Company</MenuItem>
            <MenuItem value="SUB_COMPANY">Sub Company</MenuItem>
            <MenuItem value="PROJECT">Project</MenuItem>
            <MenuItem value="CIRCLE">Circle</MenuItem>
            <MenuItem value="DOMAIN">Domain</MenuItem>
            <MenuItem value="DEPARTMENT">Department</MenuItem>
            <MenuItem value="SUB_DEPARTMENT">Sub Department</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 130 }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onCreate}
          sx={{ fontWeight: 600 }}
        >
          New KPI Definition
        </Button>
      </Box>

      {/* Table */}
      {filtered.length === 0 ? (
        <Box sx={{ p: 4 }}>
          <EmptyState
            title="No KPI Definitions Found"
            description="Create a new dynamic KPI definition or adjust search filters."
            icon={<AssessmentOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />}
          />
        </Box>
      ) : (
        <TableContainer>
          <Table size="medium">
            <TableHead sx={{ bgcolor: "action.hover" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>KPI Code & Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Source Dataset</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Calculation Method</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Hierarchy Level</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Target & Unit</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((kpi) => (
                <TableRow key={kpi.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                      {kpi.code}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      {kpi.name}
                    </Typography>
                    {kpi.description && (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                        {kpi.description}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {kpi.source_dataset_name || "Derived / System"}
                    </Typography>
                    {kpi.parameters?.length > 0 && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {kpi.parameters.length} parameter{kpi.parameters.length > 1 ? "s" : ""}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={kpi.calculation_type.replace(/_/g, " ")}
                      variant="outlined"
                      sx={{ fontSize: "0.72rem", fontWeight: 600 }}
                    />
                    {kpi.formula_expression && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontFamily: "monospace",
                          color: "text.secondary",
                          mt: 0.5,
                        }}
                      >
                        {kpi.formula_expression}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={kpi.hierarchy_level}
                      sx={{ fontSize: "0.72rem", fontWeight: 600 }}
                    />
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.3, fontWeight: 500 }}>
                      {kpi.hierarchy_node_name || "Dynamic Scope"}
                    </Typography>
                    <Chip
                      size="small"
                      label={kpi.visualization_type || "CARD"}
                      variant="outlined"
                      color="primary"
                      sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600, mt: 0.5 }}
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {kpi.target_value !== null && kpi.target_value !== undefined
                        ? `${kpi.target_value} ${kpi.unit}`
                        : `— ${kpi.unit}`}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <StatusChip
                      status={kpi.is_active ? "success" : "neutral"}
                      label={kpi.is_active ? "ACTIVE" : "INACTIVE"}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Edit KPI">
                      <IconButton size="small" onClick={() => onEdit(kpi)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate KPI">
                      <IconButton size="small" onClick={() => onDuplicate(kpi)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete KPI">
                      <IconButton size="small" color="error" onClick={() => onDelete(kpi)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
};
