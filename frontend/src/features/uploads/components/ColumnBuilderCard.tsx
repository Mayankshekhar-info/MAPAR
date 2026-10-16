import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { UploadTemplateColumn, ColumnDataTypeOption, HierarchyLevelOption } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";

interface ColumnBuilderCardProps {
  index: number;
  totalColumns: number;
  column: UploadTemplateColumn;
  dataTypes: ColumnDataTypeOption[];
  hierarchyLevels: HierarchyLevelOption[];
  onUpdate: (index: number, updates: Partial<UploadTemplateColumn>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export const ColumnBuilderCard: React.FC<ColumnBuilderCardProps> = ({
  index,
  totalColumns,
  column,
  dataTypes,
  hierarchyLevels,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  return (
    <Card
      sx={{
        p: 2.5,
        borderRadius: "12px",
        border: `1px solid ${colorTokens.workspace.border}`,
        bgcolor: colorTokens.workspace.surface,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        position: "relative",
      }}
    >
      {/* Card Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            label={`Column ${index + 1}`}
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.darker,
              borderRadius: "6px",
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
            {column.display_label || `Column ${index + 1}`}
          </Typography>
          {column.is_required && (
            <Chip
              label="Required"
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 600,
                bgcolor: colorTokens.status.warning.light,
                color: colorTokens.status.warning.main,
              }}
            />
          )}
          {column.is_unique && (
            <Chip
              label="Unique"
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 600,
                bgcolor: colorTokens.status.info.light,
                color: colorTokens.status.info.main,
              }}
            />
          )}
        </Stack>

        {/* Reordering and Removal Controls */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Move column left/up in Excel">
            <span>
              <IconButton
                size="small"
                disabled={index === 0}
                onClick={() => onMoveUp(index)}
                sx={{ color: colorTokens.text.secondary }}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Move column right/down in Excel">
            <span>
              <IconButton
                size="small"
                disabled={index === totalColumns - 1}
                onClick={() => onMoveDown(index)}
                sx={{ color: colorTokens.text.secondary }}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Remove column">
            <span>
              <IconButton
                size="small"
                disabled={totalColumns <= 1}
                onClick={() => onRemove(index)}
                sx={{ color: colorTokens.status.error.main }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Field Inputs Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1.2fr 1.2fr 1fr" },
          gap: 2,
        }}
      >
        <TextField
          label="Excel Header (Display Label)"
          required
          size="small"
          value={column.display_label}
          onChange={(e) => onUpdate(index, { display_label: e.target.value })}
          placeholder="e.g. Employee Code"
          helperText="Header text rendered in generated Excel file"
        />

        <TextField
          label="System Identifier (Key)"
          size="small"
          value={column.name}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          placeholder="e.g. employee_code"
          helperText="Internal programmatic mapping key"
        />

        <TextField
          select
          label="Data Type"
          size="small"
          value={column.data_type}
          onChange={(e) =>
            onUpdate(index, {
              data_type: e.target.value as any,
              validation_rules:
                e.target.value === "REFERENCE"
                  ? { reference_level: "CIRCLE" }
                  : {},
            })
          }
        >
          {dataTypes.map((dt) => (
            <MenuItem key={dt.key} value={dt.key}>
              {dt.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Hierarchy Reference Option (if REFERENCE type) */}
      {column.data_type === "REFERENCE" && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: colorTokens.workspace.background, borderRadius: "8px" }}>
          <TextField
            select
            label="MAPAR Organization Reference Tier"
            size="small"
            fullWidth
            value={column.validation_rules?.reference_level || "CIRCLE"}
            onChange={(e) =>
              onUpdate(index, {
                validation_rules: {
                  ...column.validation_rules,
                  reference_level: e.target.value,
                },
              })
            }
            helperText="Uploaded code will be validated against this live organization entity"
          >
            {hierarchyLevels.map((lvl) => (
              <MenuItem key={lvl.key} value={lvl.key}>
                {lvl.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      {/* Constraints and Toggles */}
      <Box
        sx={{
          mt: 2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={3} alignItems="center">
          <FormControlLabel
            control={
              <Checkbox
                checked={column.is_required}
                onChange={(e) => onUpdate(index, { is_required: e.target.checked })}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500, color: colorTokens.text.primary }}>
                Required Field
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={column.is_unique}
                onChange={(e) => onUpdate(index, { is_unique: e.target.checked })}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500, color: colorTokens.text.primary }}>
                Enforce Uniqueness (No Duplicates)
              </Typography>
            }
          />
        </Stack>

        <TextField
          label="Field Description / Hint"
          size="small"
          value={column.description}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          placeholder="Guidance printed on Excel instruction tab"
          sx={{ width: { xs: "100%", md: 340 } }}
        />
      </Box>
    </Card>
  );
};
