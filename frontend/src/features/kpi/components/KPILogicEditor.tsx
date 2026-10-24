import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Alert,
  Paper,
  IconButton,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
  Tooltip,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CodeIcon from "@mui/icons-material/Code";
import ViewListIcon from "@mui/icons-material/ViewList";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import LayersIcon from "@mui/icons-material/Layers";

import { DatasetField, KPIFilter, KPIParameter, KPITestLogicResult } from "../types/kpi";
import { kpiService } from "../api/kpiService";

interface KPILogicEditorProps {
  datasetId: number | null;
  datasetName?: string;
  fields: DatasetField[];
  naturalLanguageRule?: string;
  onChangeNaturalLanguageRule?: (val: string) => void;
  logicExpression: string;
  onChangeLogicExpression: (val: string) => void;
  filters: KPIFilter[];
  onChangeFilters: (filters: KPIFilter[]) => void;
  parameters: KPIParameter[];
  onChangeParameters: (params: KPIParameter[]) => void;
  groupBy?: string[];
  onChangeGroupBy?: (val: string[]) => void;
  presentationConfig?: Record<string, any>;
  onChangePresentationConfig?: (cfg: Record<string, any>) => void;
  formulaExpression: string;
  onChangeFormulaExpression: (val: string) => void;
  calculationType: string;
  onChangeCalculationType: (val: any) => void;
  hierarchyLevel?: string;
  hierarchyId?: number | null;
  unit?: string;
}

const COMMON_AGGREGATIONS = [
  { label: "SUM([Field])", template: "SUM([Field])" },
  { label: "AVG([Field])", template: "AVG([Field])" },
  { label: "COUNT()", template: "COUNT()" },
  { label: "MIN([Field])", template: "MIN([Field])" },
  { label: "MAX([Field])", template: "MAX([Field])" },
  { label: "COUNT_DISTINCT([Field])", template: "COUNT_DISTINCT([Field])" },
];

export const KPILogicEditor: React.FC<KPILogicEditorProps> = ({
  datasetId,
  datasetName,
  fields,
  naturalLanguageRule = "",
  onChangeNaturalLanguageRule,
  logicExpression,
  onChangeLogicExpression,
  filters,
  onChangeFilters,
  parameters,
  onChangeParameters,
  groupBy = [],
  onChangeGroupBy,
  presentationConfig = {},
  onChangePresentationConfig,
  formulaExpression,
  onChangeFormulaExpression,
  calculationType,
  onChangeCalculationType,
  hierarchyLevel,
  hierarchyId,
  unit = "Units",
}) => {
  const [editorTab, setEditorTab] = useState<"NATURAL_LANGUAGE" | "EXPRESSION" | "VISUAL">("NATURAL_LANGUAGE");
  const [isTesting, setIsTesting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [testResult, setTestResult] = useState<KPITestLogicResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [translationSuccess, setTranslationSuccess] = useState<string | null>(null);

  // Helper to format filters and formula into readable logic expression
  const generateReadableFromVisual = (
    currentFilters: KPIFilter[],
    currentFormula: string,
    currentParams: KPIParameter[],
    currentGroupBy: string[] = []
  ) => {
    const lines: string[] = [];
    if (currentFilters && currentFilters.length > 0) {
      lines.push("FILTER records WHERE");
      currentFilters.forEach((f, idx) => {
        const prefix = idx === 0 ? "    " : `    ${f.conjunction || "AND"} `;
        const isNum = f.value && !isNaN(Number(f.value));
        const valStr = isNum || f.operator === "IS_EMPTY" || f.operator === "IS_NOT_EMPTY"
          ? f.value
          : `"${f.value}"`;
        const opSymbol =
          f.operator === "EQUALS" ? "="
          : f.operator === "NOT_EQUALS" ? "!="
          : f.operator === "GREATER_THAN" ? ">"
          : f.operator === "LESS_THAN" ? "<"
          : f.operator === "GREATER_EQUAL" ? ">="
          : f.operator === "LESS_EQUAL" ? "<="
          : f.operator;
        if (f.operator === "IS_EMPTY" || f.operator === "IS_NOT_EMPTY") {
          lines.push(`${prefix}[${f.field_name}] ${opSymbol}`);
        } else {
          lines.push(`${prefix}[${f.field_name}] ${opSymbol} ${valStr}`);
        }
      });
      lines.push("");
    }

    if (currentGroupBy && currentGroupBy.length > 0) {
      lines.push("GROUP BY:");
      currentGroupBy.forEach((g) => {
        lines.push(`    [${g}]`);
      });
      lines.push("");
    }

    let calcStr = currentFormula;
    if (currentParams && currentParams.length > 0) {
      currentParams.forEach((p) => {
        if (p.source_column && calcStr.includes(p.name)) {
          calcStr = calcStr.split(p.name).join(`${p.aggregation}([${p.source_column}])`);
        }
      });
    }

    lines.push("CALCULATE:");
    lines.push(`    ${calcStr.trim() ? calcStr.trim() : "COUNT()"}`);
    return lines.join("\n");
  };

  const handleInsertToken = (token: string) => {
    if (!logicExpression) {
      onChangeLogicExpression(token);
    } else {
      onChangeLogicExpression(`${logicExpression} ${token}`);
    }
  };

  const handleInsertField = (fieldName: string) => {
    if (editorTab === "NATURAL_LANGUAGE") {
      if (onChangeNaturalLanguageRule) {
        onChangeNaturalLanguageRule(naturalLanguageRule ? `${naturalLanguageRule} ${fieldName}` : fieldName);
      }
    } else {
      handleInsertToken(`[${fieldName}]`);
    }
  };

  const handleInsertAggregation = (aggTemplate: string) => {
    const firstNumField = fields.find((f) => f.data_type === "DECIMAL" || f.data_type === "INTEGER") || fields[0];
    const fieldName = firstNumField ? firstNumField.name : "Field";
    const replaced = aggTemplate.replace("[Field]", `[${fieldName}]`);
    handleInsertToken(replaced);
  };

  const handleAddVisualFilter = () => {
    const defaultField = fields[0]?.name || "Field";
    const newFilters: KPIFilter[] = [
      ...filters,
      {
        field_name: defaultField,
        operator: "EQUALS",
        value: "",
        conjunction: filters.length > 0 ? "AND" : undefined,
      },
    ];
    onChangeFilters(newFilters);
    onChangeLogicExpression(generateReadableFromVisual(newFilters, formulaExpression, parameters, groupBy));
  };

  const handleUpdateVisualFilter = (index: number, key: keyof KPIFilter, val: any) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [key]: val };
    onChangeFilters(updated);
    onChangeLogicExpression(generateReadableFromVisual(updated, formulaExpression, parameters, groupBy));
  };

  const handleRemoveVisualFilter = (index: number) => {
    const updated = filters.filter((_, idx) => idx !== index);
    if (updated.length > 0 && updated[0].conjunction) {
      delete updated[0].conjunction;
    }
    onChangeFilters(updated);
    onChangeLogicExpression(generateReadableFromVisual(updated, formulaExpression, parameters, groupBy));
  };

  const handleToggleGroupBy = (fieldName: string) => {
    let updated: string[];
    if (groupBy.includes(fieldName)) {
      updated = groupBy.filter((g) => g !== fieldName);
    } else {
      updated = [...groupBy, fieldName];
    }
    if (onChangeGroupBy) {
      onChangeGroupBy(updated);
    }
    onChangeLogicExpression(generateReadableFromVisual(filters, formulaExpression, parameters, updated));
  };

  // Natural Language Translation Pipeline
  const handleTranslateNaturalLanguage = async () => {
    if (!naturalLanguageRule.trim()) return;
    setIsTranslating(true);
    setTranslationSuccess(null);
    setTestError(null);

    try {
      const res = await kpiService.testLogic({
        dataset_id: datasetId,
        natural_language_rule: naturalLanguageRule,
        hierarchy_level: hierarchyLevel,
        hierarchy_id: hierarchyId,
        unit,
      });

      if (res.interpreted_expression) {
        onChangeLogicExpression(res.interpreted_expression);
      }
      if (res.parsed_filters && res.parsed_filters.length > 0) {
        onChangeFilters(res.parsed_filters as any);
      }
      if (res.parsed_parameters && res.parsed_parameters.length > 0) {
        onChangeParameters(res.parsed_parameters as any);
      }
      if (res.group_by && res.group_by.length > 0 && onChangeGroupBy) {
        onChangeGroupBy(res.group_by);
      }
      if (res.rewritten_formula) {
        onChangeFormulaExpression(res.rewritten_formula);
      }

      setTestResult(res);
      setTranslationSuccess(
        res.natural_language_summary
          ? `Rule interpreted successfully: ${res.natural_language_summary}`
          : "Natural language rule converted to executable logic."
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Translation failed";
      setTestError(`Natural language interpretation error: ${msg}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRunAdHocTest = async () => {
    if (!datasetId) {
      setTestError("Please select a source dataset first before testing logic.");
      return;
    }

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await kpiService.testLogic({
        dataset_id: datasetId,
        natural_language_rule: naturalLanguageRule.trim() || undefined,
        logic_expression: logicExpression.trim() || undefined,
        formula_expression: formulaExpression.trim() || undefined,
        filters,
        parameters,
        group_by: groupBy,
        presentation_config: presentationConfig,
        calculation_type: calculationType,
        hierarchy_level: hierarchyLevel,
        hierarchy_id: hierarchyId,
        unit,
      });
      setTestResult(res);
      if (!res.success && res.error) {
        setTestError(res.error);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Execution failed";
      setTestError(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const columnColors = presentationConfig?.column_colors || {};

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Editor Header & Mode Switcher */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Tabs
          value={editorTab}
          onChange={(_, val) => setEditorTab(val)}
          sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600, py: 0.5 } }}
        >
          <Tab
            icon={<ChatBubbleOutlineIcon fontSize="small" />}
            iconPosition="start"
            label="Plain English Business Rule"
            value="NATURAL_LANGUAGE"
          />
          <Tab
            icon={<ViewListIcon fontSize="small" />}
            iconPosition="start"
            label="Visual Rule Builder"
            value="VISUAL"
          />
          <Tab
            icon={<CodeIcon fontSize="small" />}
            iconPosition="start"
            label="Expression Code"
            value="EXPRESSION"
          />
        </Tabs>

        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={isTesting ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
          onClick={handleRunAdHocTest}
          disabled={isTesting || !datasetId}
          sx={{ fontWeight: 600, textTransform: "none", px: 2.5, py: 0.8 }}
        >
          {isTesting ? "Executing on Real Data..." : "Test Logic on Real Uploaded Records"}
        </Button>
      </Box>

      {/* Discovered Schema Chips from Uploads */}
      {fields.length > 0 && (
        <Box sx={{ bgcolor: "background.paper", p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
              DISCOVERED DATASET FIELDS (CLICK TO INSERT):
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {fields.length} available columns
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", gap: 0.6 }}>
            {fields.map((f) => {
              const assignedColor = columnColors[f.name];
              return (
                <Chip
                  key={f.name}
                  label={f.name}
                  size="small"
                  onClick={() => handleInsertField(f.name)}
                  sx={{
                    fontFamily: "monospace",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.76rem",
                    bgcolor: assignedColor ? `${assignedColor}22` : undefined,
                    borderColor: assignedColor || undefined,
                    borderWidth: assignedColor ? 1 : 0,
                    borderStyle: "solid",
                    color: assignedColor || undefined,
                    "&:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      {/* TAB 1: Natural-Language Plain English Rule Editor */}
      {editorTab === "NATURAL_LANGUAGE" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Write Business Rules in Plain English:
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={isTranslating ? <CircularProgress size={14} color="inherit" /> : <AutoFixHighIcon />}
              onClick={handleTranslateNaturalLanguage}
              disabled={isTranslating || !naturalLanguageRule.trim()}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Translate & Validate English Rule
            </Button>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={3.5}
            InputLabelProps={{ shrink: true }}
            placeholder="e.g. From the selected uploaded dataset, consider only records where Site On Air Status is Active and O&M Status is Open. Group the matching records by Circle Name. Count the matching sites and calculate the total outage minutes for each circle."
            value={naturalLanguageRule}
            onChange={(e) => {
              if (onChangeNaturalLanguageRule) {
                onChangeNaturalLanguageRule(e.target.value);
              }
            }}
            helperText="Write plain English business logic. The system resolves referenced fields, conditions, groupings, and calculations against the uploaded dataset."
            sx={{
              "& .MuiInputBase-input": { fontSize: "0.92rem", lineHeight: 1.5 },
            }}
          />

          {/* Inspiration Rule Presets */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
              Example Rule Presets:
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label="Site Status & Total Outage"
              onClick={() => {
                const sample = "From the selected uploaded dataset, consider only records where Site On Air Status is Active and O&M Status is Open. Group the matching records by Circle Name. Count the matching sites and calculate the total outage minutes for each circle.";
                if (onChangeNaturalLanguageRule) onChangeNaturalLanguageRule(sample);
              }}
              sx={{ cursor: "pointer", fontSize: "0.74rem" }}
            />
            <Chip
              size="small"
              variant="outlined"
              label="Average Uptime by Circle"
              onClick={() => {
                const sample = "Consider only records where Site Type is Macro. Group the matching records by Circle Name. Calculate average uptime for each circle.";
                if (onChangeNaturalLanguageRule) onChangeNaturalLanguageRule(sample);
              }}
              sx={{ cursor: "pointer", fontSize: "0.74rem" }}
            />
            <Chip
              size="small"
              variant="outlined"
              label="High Outage Sites Filter"
              onClick={() => {
                const sample = "Consider records where Outage min > 60. Group by District. Count the matching records.";
                if (onChangeNaturalLanguageRule) onChangeNaturalLanguageRule(sample);
              }}
              sx={{ cursor: "pointer", fontSize: "0.74rem" }}
            />
          </Box>

          {translationSuccess && (
            <Alert severity="success" sx={{ py: 0.5, fontSize: "0.85rem", borderRadius: 1.5 }}>
              {translationSuccess}
            </Alert>
          )}

          {/* Confirmed / Interpreted Expression Preview */}
          {logicExpression && (
            <Box sx={{ p: 1.5, bgcolor: "grey.50", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>
                INTERPRETED EXECUTABLE MAPAR EXPRESSION:
              </Typography>
              <Typography
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  m: 0,
                  color: "primary.main",
                  fontWeight: 600,
                  whiteSpace: "pre-wrap",
                }}
              >
                {logicExpression}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* TAB 2: Visual Rule Builder */}
      {editorTab === "VISUAL" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Row-Level Filter Conditions */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Row-Level Filter Conditions:
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddVisualFilter}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Add Condition
            </Button>
          </Box>

          {filters.length === 0 ? (
            <Alert severity="info" sx={{ py: 0.5, fontSize: "0.84rem", borderRadius: 1.5 }}>
              No filter conditions applied. All rows within the authorized scope will be processed.
            </Alert>
          ) : (
            <Stack spacing={1.2}>
              {filters.map((flt, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                    p: 1.2,
                    bgcolor: "background.paper",
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    flexWrap: "wrap",
                  }}
                >
                  {idx > 0 && (
                    <TextField
                      select
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      value={flt.conjunction || "AND"}
                      onChange={(e) => handleUpdateVisualFilter(idx, "conjunction", e.target.value)}
                      sx={{ width: 90 }}
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </TextField>
                  )}
                  {idx === 0 && (
                    <Typography variant="body2" sx={{ fontWeight: 700, width: 70, color: "text.secondary" }}>
                      WHERE
                    </Typography>
                  )}

                  <TextField
                    select
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    label="Field"
                    value={flt.field_name}
                    onChange={(e) => handleUpdateVisualFilter(idx, "field_name", e.target.value)}
                    sx={{ minWidth: 180, flex: 1 }}
                  >
                    {fields.map((f) => (
                      <MenuItem key={f.name} value={f.name}>
                        {f.display_label || f.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    label="Operator"
                    value={flt.operator}
                    onChange={(e) => handleUpdateVisualFilter(idx, "operator", e.target.value)}
                    sx={{ width: 150 }}
                  >
                    <MenuItem value="EQUALS">Equals (=)</MenuItem>
                    <MenuItem value="NOT_EQUALS">Not Equals (!=)</MenuItem>
                    <MenuItem value="GREATER_THAN">Greater Than (&gt;)</MenuItem>
                    <MenuItem value="LESS_THAN">Less Than (&lt;)</MenuItem>
                    <MenuItem value="GREATER_EQUAL">At Least (&gt;=)</MenuItem>
                    <MenuItem value="LESS_EQUAL">At Most (&lt;=)</MenuItem>
                    <MenuItem value="CONTAINS">Contains</MenuItem>
                    <MenuItem value="STARTS_WITH">Starts With</MenuItem>
                    <MenuItem value="ENDS_WITH">Ends With</MenuItem>
                    <MenuItem value="IS_EMPTY">Is Empty / Blank</MenuItem>
                    <MenuItem value="IS_NOT_EMPTY">Is Not Empty</MenuItem>
                  </TextField>

                  {flt.operator !== "IS_EMPTY" && flt.operator !== "IS_NOT_EMPTY" && (
                    <TextField
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      label="Comparison Value"
                      value={flt.value}
                      onChange={(e) => handleUpdateVisualFilter(idx, "value", e.target.value)}
                      placeholder='e.g. Active, Open, 100'
                      sx={{ flex: 1, minWidth: 150 }}
                    />
                  )}

                  <IconButton size="small" color="error" onClick={() => handleRemoveVisualFilter(idx)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          {/* Grouping Fields Configuration */}
          <Box sx={{ mt: 1, p: 1.5, bgcolor: "background.paper", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <LayersIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Grouping Columns (Multi-Field Group By):
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
              Select fields to break down KPI results into grouped categories (e.g. Circle Name, District, Site Type):
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", gap: 0.8 }}>
              {fields.map((f) => {
                const isGrouped = groupBy.includes(f.name);
                return (
                  <Chip
                    key={f.name}
                    label={f.name}
                    size="small"
                    color={isGrouped ? "primary" : "default"}
                    variant={isGrouped ? "filled" : "outlined"}
                    onClick={() => handleToggleGroupBy(f.name)}
                    sx={{ fontWeight: 600, cursor: "pointer" }}
                  />
                );
              })}
            </Stack>
          </Box>
        </Box>
      )}

      {/* TAB 3: Readable Free-Form Expression Code Editor */}
      {editorTab === "EXPRESSION" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Quick Snippets & Operators Toolbar */}
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mr: 0.5 }}>
              Quick Insert:
            </Typography>
            {COMMON_AGGREGATIONS.map((agg) => (
              <Chip
                key={agg.label}
                label={agg.label}
                size="small"
                variant="outlined"
                onClick={() => handleInsertAggregation(agg.template)}
                sx={{ cursor: "pointer", fontFamily: "monospace", fontSize: "0.74rem" }}
              />
            ))}
            {["AND", "OR", "=", "!=", ">", "<", ">=", "<=", "CONTAINS"].map((tok) => (
              <Chip
                key={tok}
                label={tok}
                size="small"
                onClick={() => handleInsertToken(tok)}
                sx={{ cursor: "pointer", fontWeight: 700, fontFamily: "monospace", fontSize: "0.74rem" }}
              />
            ))}
          </Box>

          <TextField
            fullWidth
            multiline
            rows={5.5}
            InputLabelProps={{ shrink: true }}
            placeholder={`FILTER records WHERE\n    [Site On Air Status] = "Active"\nGROUP BY:\n    [Circle Name]\nCALCULATE:\n    SUM([Outage min])`}
            value={logicExpression}
            onChange={(e) => onChangeLogicExpression(e.target.value)}
            helperText="Write filter conditions in FILTER records WHERE ... GROUP BY ... CALCULATE: ... syntax."
            sx={{
              fontFamily: "monospace",
              "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "0.88rem", lineHeight: 1.5 },
            }}
          />
        </Box>
      )}

      {/* Test Logic Feedback & Real Data Execution Grid */}
      {testError && (
        <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ borderRadius: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Logic Execution Error:
          </Typography>
          <Typography variant="body2">{testError}</Typography>
        </Alert>
      )}

      {testResult && testResult.success && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "success.light",
            bgcolor: "rgba(16, 185, 129, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 1.8,
          }}
        >
          {/* Metric Summary Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleOutlineIcon color="success" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "success.dark" }}>
                Logic Successfully Verified on Actual Uploaded Data
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`Matching Records: ${testResult.records_considered}`}
                color="primary"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label={`Calculated Value: ${testResult.calculated_value !== null ? testResult.calculated_value : "N/A"} ${testResult.unit || unit}`}
                color="success"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Box>

          {/* Grouped Results Table (if grouped_results present) */}
          {testResult.grouped_results && testResult.grouped_results.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8, color: "text.primary" }}>
                Grouped Breakdown by {testResult.grouped_results[0]?.group_field || "Category"}:
              </Typography>
              <Table size="small" sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper", borderRadius: 1.5 }}>
                <TableHead sx={{ bgcolor: "grey.100" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Category / Group</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Records Count</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Calculated Metric</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResult.grouped_results.map((gr, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontWeight: 600 }}>{gr.group_key}</TableCell>
                      <TableCell align="right">{gr.records_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                        {gr.calculated_value !== null ? gr.calculated_value : "—"} {unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Matching Uploaded Records Preview Table */}
          {testResult.refined_records_preview && testResult.refined_records_preview.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.6 }}>
                MATCHING UPLOADED RECORDS PREVIEW (FIRST {testResult.refined_records_preview.length} ROWS):
              </Typography>
              <Box sx={{ overflowX: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.5, maxHeight: 220 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {Object.keys(testResult.refined_records_preview[0]).slice(0, 10).map((col) => {
                        const colColor = columnColors[col];
                        return (
                          <TableCell
                            key={col}
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                              bgcolor: colColor ? `${colColor}22` : "grey.100",
                              color: colColor || "text.primary",
                              borderBottom: colColor ? `2px solid ${colColor}` : undefined,
                            }}
                          >
                            {col}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {testResult.refined_records_preview.map((row, rIdx) => (
                      <TableRow key={rIdx} hover>
                        {Object.keys(row).slice(0, 10).map((col) => (
                          <TableCell key={col} sx={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                            {String(row[col] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};
