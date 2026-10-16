import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { ColumnBuilderCard } from "./ColumnBuilderCard";
import { TemplatePreviewTable } from "./TemplatePreviewTable";
import { TemplateBuilderState } from "../hooks/useTemplateBuilder";
import { ColumnDataTypeOption, HierarchyLevelOption } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";

interface TemplateBuilderProps {
  builder: ReturnType<typeof import("../hooks/useTemplateBuilder").useTemplateBuilder>;
  hierarchyLevels: HierarchyLevelOption[];
  dataTypes: ColumnDataTypeOption[];
  isSaving: boolean;
  canManage?: boolean;
  title?: string;
  subtitle?: string;
  saveButtonLabel?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  builder,
  hierarchyLevels,
  dataTypes,
  isSaving,
  canManage = true,
  title = "Create Data Template",
  subtitle = "Configure custom columns, hierarchy validation rules, and Excel layout",
  saveButtonLabel = "Save Template",
  onSave,
  onCancel,
}) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Top Header & Navigation */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={onCancel}
            sx={{ color: colorTokens.text.secondary }}
          >
            Back to Templates
          </Button>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              {subtitle}
            </Typography>
          </Box>
        </Stack>

        <Button
          id="btn-save-template"
          variant="contained"
          color="primary"
          startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          disabled={isSaving || !canManage || Boolean(builder.validationError)}
          onClick={onSave}
          sx={{
            fontWeight: 600,
            borderRadius: "10px",
            px: 3,
            py: 1.1,
            bgcolor: colorTokens.primary.main,
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.28)",
          }}
        >
          {isSaving ? `${saveButtonLabel}...` : saveButtonLabel}
        </Button>
      </Box>

      {/* View-Only Banner */}
      {!canManage && (
        <Alert severity="info" sx={{ borderRadius: "10px" }}>
          <strong>View-Only Mode:</strong> You have read-only permissions for templates. Creating or modifying schemas is disabled.
        </Alert>
      )}

      {/* Validation Banner if any */}
      {builder.validationError && (
        <Alert severity="warning" sx={{ borderRadius: "10px" }}>
          {builder.validationError}
        </Alert>
      )}

      {/* Section 1: Template Metadata Card */}
      <Card
        sx={{
          p: 3,
          borderRadius: "14px",
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
          Template Metadata &amp; Organization Level
        </Typography>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2.5 }}>
          Define the identity and target organizational tier for this ingestion schema
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1.5fr" },
            gap: 2.5,
          }}
        >
          <TextField
            label="Template Name"
            required
            size="small"
            placeholder="e.g. Monthly Circle Resource Roster"
            value={builder.name}
            onChange={(e) => builder.setName(e.target.value)}
          />

          <TextField
            label="Template Code (Optional)"
            size="small"
            placeholder="Auto-generated if blank"
            value={builder.code}
            onChange={(e) => builder.setCode(e.target.value)}
            helperText="Machine-safe unique identifier"
          />

          <TextField
            select
            label="Data Level (Hierarchy Tier)"
            required
            size="small"
            value={builder.dataLevel}
            onChange={(e) => builder.setDataLevel(e.target.value)}
            helperText="Hierarchy tier governing this template"
          >
            {hierarchyLevels.map((lvl) => (
              <MenuItem key={lvl.key} value={lvl.key}>
                {lvl.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ mt: 2.5 }}>
          <TextField
            label="Template Description"
            size="small"
            multiline
            rows={2}
            fullWidth
            placeholder="Describe the operational purpose, required frequency, and guidelines for this data template..."
            value={builder.description}
            onChange={(e) => builder.setDescription(e.target.value)}
          />
        </Box>
      </Card>

      {/* Section 2: Dynamic Column Builder */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Configurable Columns ({builder.columns.length})
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              The order below corresponds directly to columns A, B, C... in the generated Excel file
            </Typography>
          </Box>

          <Button
            id="btn-add-column"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={builder.addColumn}
            sx={{
              fontWeight: 600,
              borderRadius: "10px",
              borderColor: colorTokens.primary.main,
              color: colorTokens.primary.main,
            }}
          >
            + Add Column
          </Button>
        </Box>

        {/* List of Column Cards */}
        <Stack spacing={2}>
          {builder.columns.map((col, index) => (
            <ColumnBuilderCard
              key={index}
              index={index}
              totalColumns={builder.columns.length}
              column={col}
              dataTypes={dataTypes}
              hierarchyLevels={hierarchyLevels}
              onUpdate={builder.updateColumn}
              onRemove={builder.removeColumn}
              onMoveUp={builder.moveColumnUp}
              onMoveDown={builder.moveColumnDown}
            />
          ))}
        </Stack>
      </Box>

      {/* Section 3: Live Template Preview Table */}
      <TemplatePreviewTable columns={builder.columns} />
    </Box>
  );
};
