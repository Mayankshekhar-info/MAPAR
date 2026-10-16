import React, { useState, useRef, useMemo, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DateRangeIcon from "@mui/icons-material/DateRange";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalculateIcon from "@mui/icons-material/Calculate";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import LayersIcon from "@mui/icons-material/Layers";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

import { UploadTemplate, ReportingPeriodOption, CompatibleKPI, ImportBatch } from "../types/uploads.types";
import { useCompatibleKPIs } from "../hooks/useImportBatches";
import { colorTokens } from "../../../app/theme/tokens";

interface UploadDropzoneModalProps {
  open: boolean;
  templates: UploadTemplate[];
  reportingPeriods: ReportingPeriodOption[];
  preselectedTemplate?: UploadTemplate | null;
  isUploading: boolean;
  onClose: () => void;
  onUpload: (
    file: File,
    templateId: number,
    reportingPeriodId?: number | null,
    periodConfig?: {
      periodType?: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM" | null;
      reportingDate?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    },
    kpiId?: number | null
  ) => Promise<void>;
}

const STEPS = [
  "File & Template",
  "Reporting Period",
  "Select KPI",
  "Validation & Preview",
  "Process & Results",
];

export const UploadDropzoneModal: React.FC<UploadDropzoneModalProps> = ({
  open,
  templates,
  reportingPeriods,
  preselectedTemplate,
  isUploading,
  onClose,
  onUpload,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: File & Template State
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(
    preselectedTemplate?.id || (templates.length > 0 ? templates[0].id : 0)
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 2: Reporting Period State
  const [periodMode, setPeriodMode] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "EXISTING">("DAILY");
  const [reportingDate, setReportingDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [weekReferenceDate, setWeekReferenceDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [weekStartDate, setWeekStartDate] = useState<string>(
    dayjs().startOf("isoWeek").format("YYYY-MM-DD")
  );
  const [weekEndDate, setWeekEndDate] = useState<string>(
    dayjs().endOf("isoWeek").format("YYYY-MM-DD")
  );
  const [monthReferenceDate, setMonthReferenceDate] = useState<string>(dayjs().format("YYYY-MM"));
  const [selectedExistingPeriodId, setSelectedExistingPeriodId] = useState<number | "">("");

  // Step 3: KPI Selection State
  const [selectedKPIId, setSelectedKPIId] = useState<number | null>(null);
  const [kpiSearch, setKPISearch] = useState("");

  // Step 5: Execution Result State
  const [executionResult, setExecutionResult] = useState<ImportBatch | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch compatible KPIs for selected template
  const { data: compatibleKPIs = [], isLoading: isLoadingKPIs } = useCompatibleKPIs(selectedTemplateId);

  // Sync preselected template when opened
  useEffect(() => {
    if (preselectedTemplate) {
      setSelectedTemplateId(preselectedTemplate.id);
    } else if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [preselectedTemplate, templates, selectedTemplateId]);

  // Recalculate ISO-8601 week boundaries when week reference date changes
  const handleWeekReferenceDateChange = (dateStr: string) => {
    setWeekReferenceDate(dateStr);
    const parsed = dayjs(dateStr);
    if (parsed.isValid()) {
      setWeekStartDate(parsed.startOf("isoWeek").format("YYYY-MM-DD"));
      setWeekEndDate(parsed.endOf("isoWeek").format("YYYY-MM-DD"));
    }
  };

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  const filteredKPIs = useMemo(() => {
    if (!kpiSearch.trim()) return compatibleKPIs;
    const q = kpiSearch.toLowerCase();
    return compatibleKPIs.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.code.toLowerCase().includes(q) ||
        (k.description && k.description.toLowerCase().includes(q))
    );
  }, [compatibleKPIs, kpiSearch]);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xlsm")) {
      setErrorMsg("Invalid file type. Only Excel workbooks (.xlsx, .xlsm) are accepted.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg("File size exceeds 50MB limit.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (activeStep === 0) {
      if (!selectedFile) {
        setErrorMsg("Please upload an Excel workbook to proceed.");
        return;
      }
      if (!selectedTemplateId) {
        setErrorMsg("Please select a target template.");
        return;
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrorMsg(null);
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  const handleExecuteUpload = async () => {
    if (!selectedFile || !selectedTemplateId) return;
    setErrorMsg(null);

    let periodConfig: {
      periodType?: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM" | null;
      reportingDate?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    } | undefined = undefined;

    let periodIdToPass: number | null = null;

    if (periodMode === "DAILY") {
      periodConfig = {
        periodType: "DAILY",
        reportingDate: reportingDate,
        startDate: reportingDate,
        endDate: reportingDate,
      };
    } else if (periodMode === "WEEKLY") {
      periodConfig = {
        periodType: "WEEKLY",
        startDate: weekStartDate,
        endDate: weekEndDate,
      };
    } else if (periodMode === "MONTHLY") {
      const parsedMonth = dayjs(monthReferenceDate);
      const start = parsedMonth.startOf("month").format("YYYY-MM-DD");
      const end = parsedMonth.endOf("month").format("YYYY-MM-DD");
      periodConfig = {
        periodType: "MONTHLY",
        startDate: start,
        endDate: end,
      };
    } else if (periodMode === "EXISTING" && selectedExistingPeriodId) {
      periodIdToPass = Number(selectedExistingPeriodId);
    }

    try {
      await onUpload(
        selectedFile,
        selectedTemplateId,
        periodIdToPass,
        periodConfig,
        selectedKPIId
      );
      // Success will automatically close and route to batch detail page
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err.message || "Failed to execute upload and KPI processing.");
    }
  };

  const resetModal = () => {
    setActiveStep(0);
    setSelectedFile(null);
    setSelectedKPIId(null);
    setErrorMsg(null);
    setExecutionResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={isUploading ? undefined : resetModal} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          m: 0,
          p: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloudUploadIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, lineHeight: 1.2 }}>
              Upload Business Data &amp; Execute KPI Workflow
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Native 5-Step Pipeline &bull; Primary Business Data Ingestion &bull; Automated Validation
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={resetModal} disabled={isUploading} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 2.5, pb: 1, bgcolor: colorTokens.workspace.surface }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  "& .MuiStepLabel-label": {
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5, minHeight: 380 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ borderRadius: "8px" }} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {/* STEP 1: File and Template */}
        {activeStep === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: colorTokens.text.primary }}>
                Step 1: Choose Target Template &amp; Attach Excel Workbook
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Select which configured business data schema matches your upload.
              </Typography>
            </Box>


            <TextField
              select
              label="Target Excel Template"
              required
              size="small"
              fullWidth
              value={selectedTemplateId || ""}
              onChange={(e) => {
                setSelectedTemplateId(Number(e.target.value));
                setSelectedKPIId(null);
              }}
              disabled={isUploading}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} (v{t.latest_version_number}) [{t.data_level}] &bull; {t.columns_count} columns
                </MenuItem>
              ))}
            </TextField>

            {/* Drag & Drop Zone */}
            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 3.5,
                border: `2px dashed ${
                  isDragOver
                    ? colorTokens.primary.main
                    : selectedFile
                    ? colorTokens.status.success.main
                    : colorTokens.workspace.border
                }`,
                borderRadius: "14px",
                bgcolor: isDragOver
                  ? colorTokens.primary.lighter
                  : colorTokens.workspace.background,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                accept=".xlsx,.xlsm"
                style={{ display: "none" }}
              />

              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  bgcolor: selectedFile ? colorTokens.status.success.light : colorTokens.primary.lighter,
                  color: selectedFile ? colorTokens.status.success.main : colorTokens.primary.main,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 1,
                }}
              >
                {selectedFile ? <InsertDriveFileIcon fontSize="medium" /> : <CloudUploadIcon fontSize="medium" />}
              </Box>

              {selectedFile ? (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click or drop another file to replace
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    Drag &amp; drop completed Excel file here
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Supports .xlsx, .xlsm workbooks up to 50MB
                  </Typography>
                </Box>
              )}
            </Box>

            {selectedTemplate && (
              <Box sx={{ p: 1.5, bgcolor: colorTokens.workspace.background, borderRadius: "8px", border: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: colorTokens.text.primary, display: "block", mb: 0.5 }}>
                  Selected Template Summary:
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  {selectedTemplate.description || "Active production schema"} &bull; Hierarchy Level: <strong>{selectedTemplate.data_level}</strong>
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* STEP 2: Reporting Period */}
        {activeStep === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: colorTokens.text.primary }}>
                Step 2: Configure Business Reporting Period
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Distinguish the file upload timestamp from the business data reporting period. Choose Daily, Weekly, or Monthly.
              </Typography>
            </Box>

            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontSize: "0.8rem", fontWeight: 700, color: colorTokens.text.secondary, mb: 1 }}>
                Reporting Period Frequency:
              </FormLabel>
              <RadioGroup
                row
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as any)}
              >
                <FormControlLabel value="DAILY" control={<Radio size="small" />} label="Daily Date" />
                <FormControlLabel value="WEEKLY" control={<Radio size="small" />} label="Weekly (ISO-8601)" />
                <FormControlLabel value="MONTHLY" control={<Radio size="small" />} label="Monthly" />
                <FormControlLabel value="EXISTING" control={<Radio size="small" />} label="Existing Period" />
              </RadioGroup>
            </FormControl>

            {/* Daily Date Selector */}
            {periodMode === "DAILY" && (
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: "10px" }}>
                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    Select Daily Reporting Date:
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    value={reportingDate}
                    onChange={(e) => setReportingDate(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarTodayIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Associates uploaded records with this explicit business operational date."
                  />
                  <Box sx={{ p: 1, bgcolor: "#F0F9FF", borderRadius: "6px", border: "1px solid #BAE6FD" }}>
                    <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 600 }}>
                      Reporting Period Name: Daily: {reportingDate}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            )}

            {/* Weekly Selector */}
            {periodMode === "WEEKLY" && (
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: "10px" }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mb: 0.5 }}>
                      Select Any Day in the Target Week:
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      Automatically calculates ISO-8601 week boundaries (Monday start to Sunday end).
                    </Typography>
                  </Box>

                  <TextField
                    type="date"
                    size="small"
                    value={weekReferenceDate}
                    onChange={(e) => handleWeekReferenceDateChange(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DateRangeIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <TextField
                      label="Week Start (Monday)"
                      size="small"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Week End (Sunday)"
                      size="small"
                      type="date"
                      value={weekEndDate}
                      onChange={(e) => setWeekEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>

                  <Box sx={{ p: 1, bgcolor: "#FEF3C7", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                    <Typography variant="caption" sx={{ color: "#B45309", fontWeight: 700 }}>
                      Consistent Week Boundaries: {weekStartDate} to {weekEndDate}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            )}

            {/* Monthly Selector */}
            {periodMode === "MONTHLY" && (
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: "10px" }}>
                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    Select Reporting Month:
                  </Typography>
                  <TextField
                    type="month"
                    size="small"
                    value={monthReferenceDate}
                    onChange={(e) => setMonthReferenceDate(e.target.value)}
                    helperText="Calculates the 1st to last calendar day of the selected month."
                  />
                  <Box sx={{ p: 1, bgcolor: "#EDE9FE", borderRadius: "6px", border: "1px solid #DDD6FE" }}>
                    <Typography variant="caption" sx={{ color: "#6D28D9", fontWeight: 600 }}>
                      Month Range: {dayjs(monthReferenceDate).startOf("month").format("YYYY-MM-DD")} to {dayjs(monthReferenceDate).endOf("month").format("YYYY-MM-DD")}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            )}

            {/* Existing Period Selector */}
            {periodMode === "EXISTING" && (
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: "10px" }}>
                <TextField
                  select
                  label="Select Canonical Reporting Period"
                  size="small"
                  fullWidth
                  value={selectedExistingPeriodId}
                  onChange={(e) => setSelectedExistingPeriodId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <MenuItem value="">
                    <em>Select from registered periods</em>
                  </MenuItem>
                  {reportingPeriods.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} [{p.period_type}] {p.is_current ? "(Current)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
              </Card>
            )}
          </Box>
        )}

        {/* STEP 3: KPI Selection */}
        {activeStep === 2 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: colorTokens.text.primary }}>
                Step 3: Select Compatible KPI for Immediate Calculation (Optional)
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Choose which active KPI definition will process this uploaded dataset. Field compatibility is verified dynamically against your template.
              </Typography>
            </Box>

            <TextField
              placeholder="Search active KPIs by name or code..."
              size="small"
              value={kpiSearch}
              onChange={(e) => setKPISearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                  </InputAdornment>
                ),
              }}
            />

            {isLoadingKPIs ? (
              <LinearProgress />
            ) : filteredKPIs.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: "8px" }}>
                No active KPI definitions found. You can proceed with standard upload validation and execute KPIs later.
              </Alert>
            ) : (
              <Box sx={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
                {/* Option to skip KPI execution */}
                <Card
                  variant="outlined"
                  onClick={() => setSelectedKPIId(null)}
                  sx={{
                    p: 1.5,
                    cursor: "pointer",
                    borderRadius: "10px",
                    bgcolor: selectedKPIId === null ? colorTokens.primary.lighter : "inherit",
                    border: selectedKPIId === null ? `2px solid ${colorTokens.primary.main}` : undefined,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        Skip KPI Calculation for Now
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Validate and stage uploaded records only. KPIs can be executed at any time.
                      </Typography>
                    </Box>
                    <Chip label="Upload Only" size="small" />
                  </Stack>
                </Card>

                {filteredKPIs.map((kpi) => {
                  const isSelected = selectedKPIId === kpi.id;
                  return (
                    <Card
                      key={kpi.id}
                      variant="outlined"
                      onClick={() => setSelectedKPIId(kpi.id)}
                      sx={{
                        p: 1.5,
                        cursor: "pointer",
                        borderRadius: "10px",
                        bgcolor: isSelected ? colorTokens.primary.lighter : "inherit",
                        border: isSelected ? `2px solid ${colorTokens.primary.main}` : undefined,
                        opacity: kpi.is_compatible ? 1 : 0.85,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                              {kpi.name} ({kpi.code})
                            </Typography>
                            {kpi.is_direct_source && (
                              <Chip label="Direct Source" size="small" sx={{ fontSize: "0.62rem", height: 18, bgcolor: "#E0F2FE", color: "#0369A1" }} />
                            )}
                          </Stack>
                          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mt: 0.25 }}>
                            {kpi.description || "Configured calculation logic"} &bull; Level: <strong>{kpi.hierarchy_level}</strong> &bull; Unit: <strong>{kpi.unit}</strong>
                          </Typography>
                          {kpi.missing_columns && kpi.missing_columns.length > 0 && (
                            <Typography variant="caption" sx={{ color: colorTokens.status.error.main, fontWeight: 600, display: "block", mt: 0.5 }}>
                              Missing Columns: {kpi.missing_columns.join(", ")}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={kpi.is_compatible ? "Compatible" : "Missing Columns"}
                          size="small"
                          icon={kpi.is_compatible ? <CheckCircleOutlineIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.68rem",
                            bgcolor: kpi.is_compatible ? colorTokens.status.success.light : colorTokens.status.warning.light,
                            color: kpi.is_compatible ? colorTokens.status.success.main : colorTokens.status.warning.main,
                          }}
                        />
                      </Stack>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* STEP 4: Validation & Preview */}
        {activeStep === 3 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: colorTokens.text.primary }}>
                Step 4: Review Configuration &amp; Dataset Schema Preview
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Inspect your upload package details before executing authoritative server validation and calculation.
              </Typography>
            </Box>

            <Card variant="outlined" sx={{ p: 2.5, borderRadius: "12px", bgcolor: colorTokens.workspace.background }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, textTransform: "uppercase", fontWeight: 700 }}>
                      Selected Workbook
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {selectedFile?.name} ({(selectedFile ? selectedFile.size / 1024 : 0).toFixed(1)} KB)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, textTransform: "uppercase", fontWeight: 700 }}>
                      Target Template
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {selectedTemplate?.name} (v{selectedTemplate?.latest_version_number})
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, pt: 1, borderTop: `1px solid ${colorTokens.workspace.divider}` }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, textTransform: "uppercase", fontWeight: 700 }}>
                      Reporting Period
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.primary.main }}>
                      {periodMode === "DAILY"
                        ? `Daily: ${reportingDate}`
                        : periodMode === "WEEKLY"
                        ? `Weekly: ${weekStartDate} to ${weekEndDate}`
                        : periodMode === "MONTHLY"
                        ? `Monthly: ${monthReferenceDate}`
                        : selectedExistingPeriodId
                        ? `Period ID: ${selectedExistingPeriodId}`
                        : "Template Default"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, textTransform: "uppercase", fontWeight: 700 }}>
                      Assigned KPI
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {selectedKPIId
                        ? compatibleKPIs.find((k) => k.id === selectedKPIId)?.name || `KPI #${selectedKPIId}`
                        : "None (Upload & Validate Only)"}
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Card>

            <Alert severity="info" sx={{ borderRadius: "8px" }}>
              <strong>Execution Pipeline:</strong> Authoritative backend checks will verify header structure, row-by-row types, circle permissions, and uniqueness. If a KPI is assigned, its business rules will execute directly on the valid staged records.
            </Alert>
          </Box>
        )}

        {/* STEP 5: In-progress indicator during upload */}
        {isUploading && (
          <Box sx={{ width: "100%", mt: 2, textAlign: "center" }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ color: colorTokens.primary.main, fontWeight: 700, mt: 1.5 }}>
              Processing uploaded workbook and evaluating KPI rules...
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Executing authoritative row validation, hierarchy scope filtering, and calculation engine.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: `1px solid ${colorTokens.workspace.divider}`, justifyContent: "space-between" }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || isUploading}
          startIcon={<ArrowBackIcon />}
          sx={{ color: colorTokens.text.secondary }}
        >
          Back
        </Button>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={resetModal} disabled={isUploading} sx={{ color: colorTokens.text.secondary }}>
            Cancel
          </Button>

          {activeStep < 3 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<ArrowForwardIcon />}
              disabled={activeStep === 0 && (!selectedFile || !selectedTemplateId)}
              sx={{
                fontWeight: 600,
                borderRadius: "10px",
                px: 2.5,
                bgcolor: colorTokens.primary.main,
              }}
            >
              Next Step
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              disabled={!selectedFile || !selectedTemplateId || isUploading}
              onClick={handleExecuteUpload}
              startIcon={<CalculateIcon />}
              sx={{
                fontWeight: 600,
                borderRadius: "10px",
                px: 3,
                bgcolor: colorTokens.primary.main,
              }}
            >
              {isUploading ? "Processing..." : "Validate & Process Actual Data"}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
