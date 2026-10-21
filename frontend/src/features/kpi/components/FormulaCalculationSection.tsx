import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Button,
  Chip,
  Paper,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import FunctionsIcon from "@mui/icons-material/Functions";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  KPIComparisonItem,
  KPIComparisonRule,
  DatasetInfo,
  DatasetField,
  KPIFormulaPreviewResponse,
} from "../types/kpi";
import { kpiService } from "../api/kpiService";

interface FormulaCalculationSectionProps {
  comparison: KPIComparisonItem;
  rule: KPIComparisonRule;
  availableTemplates: DatasetInfo[];
  selectedTemplateId: number | null;
  onSelectTemplate: (templateId: number) => void;
  availableColumns: DatasetField[];
  onUpdateRule: (field: string, value: any) => void;
  onUpdateComparison: (field: string, value: any) => void;
}

const COMMON_UNITS = [
  "%",
  "Percentage (%)",
  "Minutes",
  "Hours",
  "Seconds",
  "Count",
  "Units",
];

const FORMULA_FUNCTIONS = ["ROUND", "MIN", "MAX", "ABS"];
const FORMULA_OPERATORS = ["+", "-", "*", "/", "(", ")"];

export const FormulaCalculationSection: React.FC<FormulaCalculationSectionProps> = ({
  comparison,
  rule,
  availableTemplates,
  selectedTemplateId,
  onSelectTemplate,
  availableColumns,
  onUpdateRule,
  onUpdateComparison,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<KPIFormulaPreviewResponse | null>(null);
  const [newConstKey, setNewConstKey] = useState("");
  const [newConstVal, setNewConstVal] = useState("");

  const formulaExpr = rule.formula_expression ?? "";
  const inputCol = rule.input_column || rule.achieved_data_column || "";
  const inputUnit = rule.input_unit || "Minutes";
  const outputCol = rule.output_column_name || "Uptime";
  const outputUnit = rule.output_unit || comparison.unit || "%";
  const decimalPrecision = rule.decimal_precision ?? 2;
  const constants = rule.constants || {};

  // Insert token into formula
  const handleInsertToken = (token: string) => {
    const updated = formulaExpr ? `${formulaExpr} ${token}` : token;
    onUpdateRule("formula_expression", updated);
  };

  // Add / remove constant
  const handleAddConstant = () => {
    if (!newConstKey.trim() || isNaN(Number(newConstVal))) return;
    const cleanKey = newConstKey.trim().replace(/\s+/g, "_");
    const updated = { ...constants, [cleanKey]: Number(newConstVal) };
    onUpdateRule("constants", updated);
    setNewConstKey("");
    setNewConstVal("");
  };

  const handleRemoveConstant = (key: string) => {
    const updated = { ...constants };
    delete updated[key];
    onUpdateRule("constants", updated);
  };

  // Apply Uptime from Downtime Example Preset
  const handleApplyUptimePreset = () => {
    // Find a downtime column or default to current inputCol
    const dtCol = availableColumns.find((c) => /down|downtime/i.test(c.name || c.label))?.name || "Downtime";
    onUpdateRule("formula_expression", "((Total_Time - Downtime) / Total_Time) * 100");
    onUpdateRule("input_column", dtCol);
    onUpdateRule("input_unit", "Minutes");
    onUpdateRule("output_column_name", "Uptime");
    onUpdateRule("output_unit", "%");
    onUpdateRule("decimal_precision", 2);
    onUpdateRule("constants", { Total_Time: 1440 });
    onUpdateRule("achieved_data_column", "Uptime");
    onUpdateComparison("unit", "%");
    if (!rule.standard_value) {
      onUpdateRule("standard_value", 98.8);
    }
  };

  // Run live preview against backend engine
  const handleRunPreview = useCallback(async () => {
    if (!formulaExpr.trim()) {
      setPreviewData(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await kpiService.previewFormula({
        formula: formulaExpr,
        dataset_id: selectedTemplateId,
        input_column: inputCol,
        constants: constants,
        decimal_precision: decimalPrecision,
        input_unit: inputUnit,
        output_unit: outputUnit,
        limit: 5,
      });
      setPreviewData(res);
    } catch (err: any) {
      setPreviewData({
        is_valid: false,
        error: err.response?.data?.error || err.message || "Failed to validate formula",
        has_actual_data: false,
        samples: [],
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [formulaExpr, selectedTemplateId, inputCol, constants, decimalPrecision, inputUnit, outputUnit]);

  // Debounced auto-preview when key inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formulaExpr.trim()) {
        handleRunPreview();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formulaExpr, selectedTemplateId, inputCol, constants, decimalPrecision, inputUnit, outputUnit, handleRunPreview]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        bgcolor: "#fcfdfe",
        borderColor: "divider",
        mt: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FunctionsIcon color="primary" sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
              Mathematical Calculation & Formula Engine
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Calculate daily performance dynamically from uploaded Excel templates without altering raw source data.
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<AutoAwesomeIcon fontSize="small" />}
          onClick={handleApplyUptimePreset}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Preset: Daily Uptime (1440m - Downtime)
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Step 1: Select Upload Template */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="1. Select Upload Template"
            value={selectedTemplateId || ""}
            onChange={(e) => onSelectTemplate(Number(e.target.value))}
            helperText={
              availableTemplates.length === 0
                ? "No templates found in Uploads. Please create one in Uploads section."
                : "Select the template containing daily records"
            }
          >
            {availableTemplates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} ({t.code || `ID: ${t.id}`})
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Step 2: Select Input Column */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="2. Select Input Column"
            value={inputCol}
            onChange={(e) => {
              onUpdateRule("input_column", e.target.value);
              if (!rule.achieved_data_column) {
                onUpdateRule("achieved_data_column", e.target.value);
              }
            }}
            helperText="Raw data column to feed into formula (e.g. Downtime)"
          >
            {availableColumns.map((col) => (
              <MenuItem key={col.id || col.name} value={col.name}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span>{col.label || col.name}</span>
                  <Chip size="small" label={col.data_type} variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Units: Input Unit & Output Unit */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Input Unit"
            value={inputUnit}
            onChange={(e) => onUpdateRule("input_unit", e.target.value)}
            helperText="Unit of the uploaded input column (e.g. Minutes)"
          >
            {COMMON_UNITS.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Output Unit"
            value={outputUnit}
            onChange={(e) => {
              onUpdateRule("output_unit", e.target.value);
              onUpdateComparison("unit", e.target.value);
            }}
            helperText="Unit of the calculated result (e.g. Percentage (%))"
          >
            {COMMON_UNITS.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Mathematical Formula Expression */}
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            label="Mathematical Formula Expression"
            value={formulaExpr}
            onChange={(e) => onUpdateRule("formula_expression", e.target.value)}
            placeholder="e.g. ((Total_Time - Downtime) / Total_Time) * 100"
            helperText="Standard math operators (+, -, *, /), parentheses, functions (ROUND, MIN, MAX, ABS), columns, and constants."
          />
          {/* Quick Helper Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1, alignItems: "center" }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mr: 0.5 }}>
              Insert:
            </Typography>
            {/* Columns */}
            {availableColumns.slice(0, 6).map((c) => (
              <Chip
                key={c.name}
                size="small"
                label={c.name}
                onClick={() => handleInsertToken(c.name)}
                color="primary"
                variant="outlined"
                sx={{ cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}
              />
            ))}
            {/* Operators */}
            {FORMULA_OPERATORS.map((op) => (
              <Chip
                key={op}
                size="small"
                label={op}
                onClick={() => handleInsertToken(op)}
                sx={{ cursor: "pointer", fontWeight: 700 }}
              />
            ))}
            {/* Functions */}
            {FORMULA_FUNCTIONS.map((fn) => (
              <Chip
                key={fn}
                size="small"
                label={`${fn}()`}
                onClick={() => handleInsertToken(`${fn}()`)}
                color="secondary"
                variant="outlined"
                sx={{ cursor: "pointer", fontWeight: 600 }}
              />
            ))}
          </Box>
        </Grid>

        {/* Numeric Constants */}
        <Grid size={{ xs: 12 }}>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#fff", borderRadius: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
              Configurable Numeric Constants & Benchmarks (e.g. Total_Time = 1440 Minutes)
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1 }}>
              {Object.entries(constants).map(([k, v]) => (
                <Chip
                  key={k}
                  label={`${k} = ${v}`}
                  onDelete={() => handleRemoveConstant(k)}
                  color="default"
                  variant="outlined"
                  deleteIcon={<DeleteOutlineIcon />}
                />
              ))}
              {Object.keys(constants).length === 0 && (
                <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                  No constants defined yet.
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Constant Name (e.g. Total_Time)"
                value={newConstKey}
                onChange={(e) => setNewConstKey(e.target.value)}
                sx={{ width: 220 }}
              />
              <TextField
                size="small"
                type="number"
                placeholder="Value (e.g. 1440)"
                value={newConstVal}
                onChange={(e) => setNewConstVal(e.target.value)}
                sx={{ width: 140 }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddConstant}
                disabled={!newConstKey.trim() || isNaN(Number(newConstVal))}
              >
                Add Constant
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Output Column Configuration */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Calculated Output Column Name"
            value={outputCol}
            onChange={(e) => {
              onUpdateRule("output_column_name", e.target.value);
              onUpdateRule("achieved_data_column", e.target.value);
            }}
            placeholder="e.g. Uptime"
            helperText="Logical column name for the calculated daily metric"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Decimal Precision & Rounding"
            value={decimalPrecision}
            onChange={(e) => onUpdateRule("decimal_precision", Number(e.target.value))}
            helperText="Standard rounding (Half Up) to N decimal places"
          />
        </Grid>

        {/* Live Validation, Preview & Sample Calculations */}
        <Grid size={{ xs: 12 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: previewData?.is_valid ? "#f6fdf8" : "#fffbfa",
              borderColor: previewData?.is_valid ? "success.light" : "grey.300",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {loadingPreview ? (
                  <CircularProgress size={18} />
                ) : previewData?.is_valid ? (
                  <CheckCircleOutlineIcon color="success" />
                ) : (
                  <ErrorOutlineIcon color="error" />
                )}
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Formula Verification & Live Preview
                </Typography>
                {previewData && (
                  <Chip
                    size="small"
                    label={previewData.is_valid ? "Valid Expression" : "Syntax / Schema Error"}
                    color={previewData.is_valid ? "success" : "error"}
                    variant="outlined"
                  />
                )}
              </Box>
              <IconButton size="small" onClick={handleRunPreview} title="Revalidate">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Error Display */}
            {previewData && !previewData.is_valid && (
              <Alert severity="error" sx={{ my: 1, py: 0.5 }}>
                {previewData.error}
              </Alert>
            )}

            {/* Explanation Display */}
            {previewData?.is_valid && previewData.explanation && (
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5, fontStyle: "italic" }}>
                {previewData.explanation}
              </Typography>
            )}

            {/* Target Comparison Preview */}
            {rule.standard_value !== undefined && rule.standard_value !== null && rule.standard_value !== "" && (
              <Box sx={{ p: 1, bgcolor: "#fff", borderRadius: 1, border: "1px solid #e0e0e0", mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                  Target Comparison Benchmark:
                </Typography>
                <Typography variant="body2">
                  Standard Value: <strong>{rule.standard_value} {outputUnit}</strong> | Direction:{" "}
                  <strong>{rule.performance_direction || "Higher is Better"}</strong>
                </Typography>
              </Box>
            )}

            {/* Actual Uploaded Records Preview Table */}
            {previewData?.is_valid && (
              <>
                {previewData.has_actual_data && previewData.samples.length > 0 ? (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", mb: 0.5, display: "block" }}>
                      Sample Calculation on Actual Uploaded Records ({previewData.template_name}):
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: "grey.100" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Row #</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>
                              Uploaded Input ({inputCol || "Input"})
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>
                              Calculated Output ({outputCol})
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewData.samples.map((s) => (
                            <TableRow key={s.row_number}>
                              <TableCell>{s.row_number}</TableCell>
                              <TableCell>
                                {Object.entries(s.inputs).map(([k, v]) => (
                                  <span key={k}>
                                    {k}: <strong>{String(v)}</strong> {inputUnit}
                                  </span>
                                ))}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: s.error ? "error.main" : "primary.main" }}>
                                {s.calculated_value !== null ? `${s.calculated_value} ${outputUnit}` : "—"}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={s.status}
                                  color={s.status === "SUCCESS" ? "success" : "warning"}
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    Formula is mathematically valid. No uploaded records found for this template yet. Once files are
                    uploaded via the Uploads section, daily calculated results will be generated automatically.
                  </Alert>
                )}
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
};
