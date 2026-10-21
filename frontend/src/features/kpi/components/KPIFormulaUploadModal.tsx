import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  IconButton,
  FormControlLabel,
  Switch,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useKPIFormulaUpload } from "../hooks/useKPIFormulaUpload";
import { KPIFormulaPreviewRow } from "../types/kpi";
import { useOrganizationTree } from "../../organization/hooks/useOrganization";
import { HierarchyNode } from "../../organization/types/organization.types";

interface KPIFormulaUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = ["Upload Workbook", "Confirm Mapping", "Preview & Validate", "Scope & Activate"];

export const KPIFormulaUploadModal: React.FC<KPIFormulaUploadModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [scopeType, setScopeType] = useState<"ENTERPRISE" | "COMPANY" | "PROJECT" | "CIRCLE">("ENTERPRISE");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [selectedCircleId, setSelectedCircleId] = useState<number | "">("");
  const [isInheritanceAllowed, setIsInheritanceAllowed] = useState(true);
  const [changelog, setChangelog] = useState("");
  const [filterValidOnly, setFilterValidOnly] = useState(false);

  // Fetch organization tree for dynamic scoped hierarchy selection
  const { data: tree = [] } = useOrganizationTree();
  const companies = tree.filter((n) => n.level === "MAIN_COMPANY");

  // Auto-select single company if available
  React.useEffect(() => {
    if (companies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].raw_id);
    }
  }, [companies, selectedCompanyId]);

  const getProjectsForCompany = (compRawId?: number | ""): HierarchyNode[] => {
    if (!compRawId) return [];
    const compNode = companies.find((c) => c.raw_id === compRawId);
    if (!compNode) return [];
    const projs: HierarchyNode[] = [];
    const traverse = (node: HierarchyNode) => {
      if (node.level === "PROJECT") {
        projs.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(compNode);
    return projs;
  };

  const availableProjects = getProjectsForCompany(selectedCompanyId);

  const getCirclesForProject = (projRawId?: number | ""): HierarchyNode[] => {
    if (!projRawId) return [];
    const projNode = availableProjects.find((p) => p.raw_id === projRawId);
    if (!projNode) return [];
    const circs: HierarchyNode[] = [];
    const traverse = (node: HierarchyNode) => {
      if (node.level === "CIRCLE") {
        circs.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(projNode);
    return circs;
  };

  const availableCircles = getCirclesForProject(selectedProjectId);

  const isScopeSelectionValid = () => {
    if (scopeType === "ENTERPRISE") return true;
    if (scopeType === "COMPANY") return Boolean(selectedCompanyId);
    if (scopeType === "PROJECT") return Boolean(selectedCompanyId && selectedProjectId);
    if (scopeType === "CIRCLE") return Boolean(selectedCompanyId && selectedProjectId && selectedCircleId);
    return true;
  };

  const {
    selectedFile,
    setSelectedFile,
    parseResult,
    customMapping,
    setCustomMapping,
    selectedSheet,
    setSelectedSheet,
    parseMutation,
    activateMutation,
    downloadTemplate,
    resetUploadState,
    isParsing,
    isActivating,
  } = useKPIFormulaUpload();

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    parseMutation.mutate(
      { file },
      {
        onSuccess: () => {
          setActiveStep(1);
        },
      }
    );
  };

  const handleReParseWithMapping = () => {
    if (!selectedFile) return;
    parseMutation.mutate(
      { file: selectedFile, mapping: customMapping, sheet: selectedSheet },
      {
        onSuccess: () => {
          setActiveStep(2);
        },
      }
    );
  };

  const handleActivate = () => {
    if (!parseResult) return;
    if (!isScopeSelectionValid()) return;

    // Activate only valid rows
    const approved = parseResult.preview_rows.filter((r) => r.is_valid);
    activateMutation.mutate(
      {
        approved_kpis: approved,
        scope_type: scopeType,
        company_id: selectedCompanyId ? Number(selectedCompanyId) : null,
        project_id: selectedProjectId ? Number(selectedProjectId) : null,
        circle_id: selectedCircleId ? Number(selectedCircleId) : null,
        is_inheritance_allowed: isInheritanceAllowed,
        changelog: changelog || `Approved and activated ${approved.length} KPI definitions via Excel engine.`,
      },
      {
        onSuccess: () => {
          if (onSuccess) onSuccess();
          handleClose();
        },
      }
    );
  };

  const handleClose = () => {
    setActiveStep(0);
    resetUploadState();
    onClose();
  };

  if (!open) return null;

  const sheetNames = parseResult?.sheet_names || [];
  const availableHeaders: string[] = parseResult?.available_headers || (parseResult as any)?.headers || [];
  const previewRows = parseResult?.preview_rows || [];

  const displayRows = previewRows.filter((r) =>
    filterValidOnly ? r.is_valid : true
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ m: 0, p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Universal KPI Formula Configuration Engine
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload Excel definitions, preview mathematical AST formulas, and activate versioned KPI catalogs
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 1, pb: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers sx={{ p: 3, minHeight: 420 }}>
        {/* Step 0: Upload File & Sheet Selection */}
        {activeStep === 0 && (
          <Stack spacing={3}>
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadTemplate}
                  sx={{ fontWeight: 600 }}
                >
                  Download Template
                </Button>
              }
            >
              Upload an authorized Excel (.xlsx) file containing KPI codes, formula expressions, source column mappings, and RAG thresholds.
            </Alert>

            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              sx={{
                border: "2px dashed",
                borderColor: "primary.main",
                borderRadius: 2,
                p: 5,
                textAlign: "center",
                bgcolor: "action.hover",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": { bgcolor: "action.selected" },
              }}
              onClick={() => document.getElementById("kpi-formula-file-input")?.click()}
            >
              <input
                id="kpi-formula-file-input"
                type="file"
                accept=".xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {selectedFile ? selectedFile.name : "Click to browse or drag & drop KPI Excel workbook"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Supports multi-sheet workbooks (.xlsx) with AST safe expression sandbox validation
              </Typography>
            </Box>

            {isParsing && (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="body2">Analyzing workbook sheets, headers, and formulas...</Typography>
              </Box>
            )}

            {parseMutation.isError && (
              <Alert severity="error">
                {(parseMutation.error as any)?.message || "Failed to parse uploaded Excel file."}
              </Alert>
            )}
          </Stack>
        )}

        {/* Step 1: Confirm Column Mapping */}
        {activeStep === 1 && parseResult && (
          <Stack spacing={2.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Detected Worksheet & Header Mapping
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Confirm the columns corresponding to required KPI configuration fields
                </Typography>
              </Box>

              {sheetNames.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Active Worksheet</InputLabel>
                  <Select
                    value={selectedSheet}
                    label="Active Worksheet"
                    onChange={(e) => setSelectedSheet(e.target.value)}
                  >
                    {sheetNames.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1.5 }}>
                FIELD ASSIGNMENTS
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                {[
                  { field: "code", label: "KPI Code *" },
                  { field: "name", label: "KPI Name *" },
                  { field: "formula_expression", label: "Formula Expression *" },
                  { field: "calculation_type", label: "Calculation Type" },
                  { field: "aggregation_method", label: "Aggregation Method" },
                  { field: "unit", label: "Measurement Unit" },
                  { field: "direction", label: "Performance Direction" },
                  { field: "target_value", label: "Target Value" },
                  { field: "threshold_green", label: "Green Threshold %" },
                  { field: "threshold_amber", label: "Amber Threshold %" },
                  { field: "source_dataset", label: "Source Dataset" },
                  { field: "cleaning_rules", label: "Cleaning Rules" },
                ].map(({ field, label }) => (
                  <FormControl key={field} size="small" fullWidth>
                    <InputLabel>{label}</InputLabel>
                    <Select
                      value={customMapping[field] || ""}
                      label={label}
                      onChange={(e) =>
                        setCustomMapping((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                    >
                      <MenuItem value="">
                        <em>(Not mapped)</em>
                      </MenuItem>
                      {availableHeaders.map((h: string) => (
                        <MenuItem key={h} value={h}>
                          {h}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ))}
              </Box>
            </Paper>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                onClick={handleReParseWithMapping}
                disabled={isParsing}
                startIcon={isParsing ? <CircularProgress size={16} /> : <ArrowForwardIcon />}
              >
                Apply Mapping & Validate
              </Button>
            </Box>
          </Stack>
        )}

        {/* Step 2: Preview & Validate Rows */}
        {activeStep === 2 && parseResult && (
          <Stack spacing={2}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Chip
                  icon={<CheckCircleOutlineIcon fontSize="small" />}
                  label={`${parseResult.valid_count} Valid`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
                {parseResult.error_count > 0 && (
                  <Chip
                    icon={<ErrorOutlineIcon fontSize="small" />}
                    label={`${parseResult.error_count} Errors`}
                    color="error"
                    variant="outlined"
                    size="small"
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  Total Rows: {parseResult.total_rows}
                </Typography>
              </Stack>

              <Button
                size="small"
                variant={filterValidOnly ? "contained" : "outlined"}
                onClick={() => setFilterValidOnly((prev) => !prev)}
              >
                {filterValidOnly ? "Show All Rows" : "Filter Valid Only"}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340, borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>KPI Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>KPI Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Formula / Logic</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type / Agg</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target / RAG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Issues / Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayRows.map((r: KPIFormulaPreviewRow) => (
                    <TableRow key={r.row_index} sx={{ bgcolor: r.is_valid ? "inherit" : "error.lighter" }}>
                      <TableCell>{r.row_index}</TableCell>
                      <TableCell>
                        {r.is_valid ? (
                          <Chip label="Valid" color="success" size="small" />
                        ) : (
                          <Chip label="Invalid" color="error" size="small" />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{r.code || "—"}</TableCell>
                      <TableCell>{r.name || "—"}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem", maxWidth: 220 }}>
                        {r.formula_expression || "—"}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                          {r.calculation_type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.aggregation_method} ({r.unit})
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          Target: {r.target_value ?? "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          G: ≥{r.threshold_green}% | A: ≥{r.threshold_amber}%
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        {r.errors && r.errors.length > 0 && (
                          <Typography variant="caption" color="error.main" sx={{ display: "block", fontWeight: 600 }}>
                            {r.errors.join("; ")}
                          </Typography>
                        )}
                        {r.warnings && r.warnings.length > 0 && (
                          <Typography variant="caption" color="warning.main" sx={{ display: "block" }}>
                            {r.warnings.join("; ")}
                          </Typography>
                        )}
                        {r.is_valid && r.warnings.length === 0 && (
                          <Typography variant="caption" color="success.main">
                            Ready to activate
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}

        {/* Step 3: Scope & Activate */}
        {activeStep === 3 && parseResult && (
          <Stack spacing={3}>
            <Alert severity="success" icon={<VerifiedIcon />}>
              Ready to store approved configuration into PostgreSQL with immutable version tracking.
              A total of <strong>{parseResult.valid_count}</strong> valid KPI definitions will be activated.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                ORGANIZATION GOVERNANCE & OVERRIDE SCOPE
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  select
                  size="small"
                  label="Configuration Scope"
                  value={scopeType}
                  onChange={(e) => {
                    const newScope = e.target.value as any;
                    setScopeType(newScope);
                    if (newScope === "ENTERPRISE") {
                      setSelectedProjectId("");
                      setSelectedCircleId("");
                    } else if (newScope === "COMPANY") {
                      setSelectedProjectId("");
                      setSelectedCircleId("");
                    } else if (newScope === "PROJECT") {
                      setSelectedCircleId("");
                    }
                  }}
                  fullWidth
                  helperText={
                    scopeType === "ENTERPRISE"
                      ? "Enterprise defaults apply to all companies unless overridden at Company or Project level."
                      : scopeType === "COMPANY"
                      ? "Company configurations apply strictly to the selected company and its authorized descendants."
                      : scopeType === "PROJECT"
                      ? "Project overrides apply strictly to the assigned project and cannot affect other projects."
                      : "Circle overrides apply strictly to the assigned circle node."
                  }
                >
                  <MenuItem value="ENTERPRISE">Enterprise Default (All Companies & Projects)</MenuItem>
                  <MenuItem value="COMPANY">Company-Level Configuration</MenuItem>
                  <MenuItem value="PROJECT">Project-Specific Override</MenuItem>
                  <MenuItem value="CIRCLE">Circle-Specific Override</MenuItem>
                </TextField>

                {/* Company Picker (Required for COMPANY, PROJECT, CIRCLE) */}
                {scopeType !== "ENTERPRISE" && (
                  <TextField
                    select
                    size="small"
                    label="Assigned Company *"
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(Number(e.target.value) || "");
                      setSelectedProjectId("");
                      setSelectedCircleId("");
                    }}
                    fullWidth
                    required
                  >
                    {companies.map((c) => (
                      <MenuItem key={c.raw_id} value={c.raw_id}>
                        {c.name} ({c.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Project Picker (Required for PROJECT, CIRCLE) */}
                {(scopeType === "PROJECT" || scopeType === "CIRCLE") && (
                  <TextField
                    select
                    size="small"
                    label="Assigned Project *"
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(Number(e.target.value) || "");
                      setSelectedCircleId("");
                    }}
                    fullWidth
                    required
                    disabled={!selectedCompanyId || availableProjects.length === 0}
                    helperText={
                      !selectedCompanyId
                        ? "Select a company first"
                        : availableProjects.length === 0
                        ? "No projects found in selected company"
                        : ""
                    }
                  >
                    {availableProjects.map((p) => (
                      <MenuItem key={p.raw_id} value={p.raw_id}>
                        {p.name} ({p.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Circle Picker (Required for CIRCLE) */}
                {scopeType === "CIRCLE" && (
                  <TextField
                    select
                    size="small"
                    label="Assigned Circle *"
                    value={selectedCircleId}
                    onChange={(e) => setSelectedCircleId(Number(e.target.value) || "")}
                    fullWidth
                    required
                    disabled={!selectedProjectId || availableCircles.length === 0}
                    helperText={
                      !selectedProjectId
                        ? "Select a project first"
                        : availableCircles.length === 0
                        ? "No circles found in selected project"
                        : ""
                    }
                  >
                    {availableCircles.map((c) => (
                      <MenuItem key={c.raw_id} value={c.raw_id}>
                        {c.name} ({c.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Explicit Inheritance Switch */}
                {scopeType !== "CIRCLE" && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isInheritanceAllowed}
                        onChange={(e) => setIsInheritanceAllowed(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Allow Eligible Descendants to Inherit Formulas
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          When enabled, child hierarchy nodes can inherit these formulas unless explicitly overridden.
                        </Typography>
                      </Box>
                    }
                  />
                )}

                <TextField
                  label="Version Changelog / Audit Note"
                  placeholder="e.g. FY26 Q4 Master Operational KPI Formula Workbook release"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
              </Stack>
            </Paper>

            {!isScopeSelectionValid() && (
              <Alert severity="warning">
                Please select the required hierarchy node (
                {scopeType === "COMPANY"
                  ? "Company"
                  : scopeType === "PROJECT"
                  ? "Company and Project"
                  : "Company, Project, and Circle"}
                ) to bind this configuration before activating.
              </Alert>
            )}

            {activateMutation.isError && (
              <Alert severity="error">
                {(activateMutation.error as any)?.message || "Activation failed."}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, justifyContent: "space-between" }}>
        <Button
          onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
          disabled={activeStep === 0 || isActivating || isParsing}
          startIcon={<ArrowBackIcon />}
        >
          Back
        </Button>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={handleClose} disabled={isActivating || isParsing} color="inherit">
            Cancel
          </Button>

          {activeStep < 3 && (
            <Button
              variant="contained"
              onClick={() => setActiveStep((prev) => prev + 1)}
              disabled={
                (activeStep === 0 && !parseResult) ||
                (activeStep === 2 && (!parseResult || parseResult.valid_count === 0)) ||
                isParsing
              }
              endIcon={<ArrowForwardIcon />}
            >
              Next Step
            </Button>
          )}

          {activeStep === 3 && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleActivate}
              disabled={isActivating || !parseResult || parseResult.valid_count === 0 || !isScopeSelectionValid()}
              startIcon={isActivating ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}
              sx={{ fontWeight: 700 }}
            >
              {isActivating ? "Activating..." : `Activate ${parseResult?.valid_count || 0} KPIs`}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
