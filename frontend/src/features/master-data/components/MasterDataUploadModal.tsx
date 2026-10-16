import React, { useState, useMemo, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { MasterDataFilterState, MasterDataMeta, UploadMasterDataPayload } from "../types/masterData.types";
import { uploadsService } from "../../uploads/api/uploadsService";

interface MasterDataUploadModalProps {
  open: boolean;
  meta?: MasterDataMeta;
  currentFilters: MasterDataFilterState;
  isUploading: boolean;
  onClose: () => void;
  onUpload: (payload: UploadMasterDataPayload) => Promise<any>;
}

export const MasterDataUploadModal: React.FC<MasterDataUploadModalProps> = ({
  open,
  meta,
  currentFilters,
  isUploading,
  onClose,
  onUpload,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">(
    currentFilters.templateId || (meta?.templates?.[0]?.id ?? "")
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">(currentFilters.companyId || "");
  const [selectedSubCompanyId, setSelectedSubCompanyId] = useState<number | "">(currentFilters.subCompanyId || "");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(currentFilters.projectId || "");
  const [selectedCircleId, setSelectedCircleId] = useState<number | "">(currentFilters.circleId || "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | "">(currentFilters.departmentId || "");
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | "">(currentFilters.periodId || "");
  const [importMode, setImportMode] = useState<"append" | "update_or_create" | "replace">("append");
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Sync initial state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTemplateId(currentFilters.templateId || (meta?.templates?.[0]?.id ?? ""));
      setSelectedCompanyId(currentFilters.companyId || "");
      setSelectedSubCompanyId(currentFilters.subCompanyId || "");
      setSelectedProjectId(currentFilters.projectId || "");
      setSelectedCircleId(currentFilters.circleId || "");
      setSelectedDepartmentId(currentFilters.departmentId || "");
      setSelectedPeriodId(currentFilters.periodId || "");
      setFile(null);
      setErrorMsg(null);
    }
  }, [open, currentFilters, meta]);

  // Cascading sub-companies based on company
  const modalSubCompanies = useMemo(() => {
    if (!meta?.sub_companies) return [];
    if (!selectedCompanyId) return meta.sub_companies;
    return meta.sub_companies.filter((sc) => !sc.main_company_id || sc.main_company_id === selectedCompanyId);
  }, [meta?.sub_companies, selectedCompanyId]);

  // Cascading projects based on sub-company or company
  const modalProjects = useMemo(() => {
    if (!meta?.projects) return [];
    if (selectedSubCompanyId) {
      return meta.projects.filter((p) => p.sub_company_id === selectedSubCompanyId);
    }
    if (selectedCompanyId) {
      const scIds = new Set(
        meta.sub_companies?.filter((sc) => sc.main_company_id === selectedCompanyId).map((sc) => sc.id) || []
      );
      return meta.projects.filter((p) => !p.sub_company_id || scIds.has(p.sub_company_id));
    }
    return meta.projects;
  }, [meta?.projects, meta?.sub_companies, selectedSubCompanyId, selectedCompanyId]);

  // Cascading circles based on project
  const modalCircles = useMemo(() => {
    if (!meta?.circles) return [];
    if (!selectedProjectId) return meta.circles;
    return meta.circles.filter((c) => !c.project_id || c.project_id === selectedProjectId);
  }, [meta?.circles, selectedProjectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xlsm")) {
        setErrorMsg("Invalid file format. Please upload an Excel workbook (.xlsx).");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setErrorMsg(null);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      setIsDownloadingTemplate(true);
      await uploadsService.downloadTemplateExcel(Number(selectedTemplateId));
    } catch (err: any) {
      setErrorMsg("Failed to download template: " + (err.message || "Unknown error"));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select an Excel file to upload.");
      return;
    }
    if (!selectedTemplateId) {
      setErrorMsg("Please select a target dataset / template.");
      return;
    }

    try {
      await onUpload({
        file,
        template_id: Number(selectedTemplateId),
        company_id: selectedCompanyId ? Number(selectedCompanyId) : null,
        sub_company_id: selectedSubCompanyId ? Number(selectedSubCompanyId) : null,
        project_id: selectedProjectId ? Number(selectedProjectId) : null,
        circle_id: selectedCircleId ? Number(selectedCircleId) : null,
        department_id: selectedDepartmentId ? Number(selectedDepartmentId) : null,
        reporting_period_id: selectedPeriodId ? Number(selectedPeriodId) : null,
        import_mode: importMode,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err.message || "Upload processing failed.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle component="div" sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Upload Master Data Excel
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Select hierarchy context, choose an import mode, and upload your operational spreadsheet.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: "24px !important", overflowY: "auto" }}>
          <Box sx={{ pt: 1 }}>
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: "8px" }} onClose={() => setErrorMsg(null)}>
                {errorMsg}
              </Alert>
            )}

            <Stack spacing={2.5}>
              {/* Template Selection */}
              <FormControl size="small" fullWidth required error={!meta?.templates?.length}>
                <InputLabel id="modal-template-select-label">Target Dataset / Template</InputLabel>
                <Select
                  labelId="modal-template-select-label"
                  value={selectedTemplateId}
                  label="Target Dataset / Template"
                  onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")}
                >
                  {meta?.templates && meta.templates.length > 0 ? (
                    meta.templates.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      <em>No datasets/templates configured</em>
                    </MenuItem>
                  )}
                </Select>
                {(!meta?.templates || meta.templates.length === 0) && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    No active datasets found. Please create or configure a template in Upload Templates.
                  </Typography>
                )}
              </FormControl>

              {/* Hierarchy Assignment */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.secondary", mt: 0.5 }}>
                Organizational Scope
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {/* Company */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-co-label">Company</InputLabel>
                  <Select
                    labelId="modal-co-label"
                    value={selectedCompanyId}
                    label="Company"
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedCompanyId(val);
                      setSelectedSubCompanyId("");
                      setSelectedProjectId("");
                      setSelectedCircleId("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {meta?.companies?.map((co) => (
                      <MenuItem key={co.id} value={co.id}>
                        {co.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Sub-Company */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-subco-label">Sub-Company</InputLabel>
                  <Select
                    labelId="modal-subco-label"
                    value={selectedSubCompanyId}
                    label="Sub-Company"
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedSubCompanyId(val);
                      setSelectedProjectId("");
                      setSelectedCircleId("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {modalSubCompanies.map((sc) => (
                      <MenuItem key={sc.id} value={sc.id}>
                        {sc.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Project */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-prj-label">Project</InputLabel>
                  <Select
                    labelId="modal-prj-label"
                    value={selectedProjectId}
                    label="Project"
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedProjectId(val);
                      setSelectedCircleId("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {modalProjects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Circle */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-cir-label">Circle</InputLabel>
                  <Select
                    labelId="modal-cir-label"
                    value={selectedCircleId}
                    label="Circle"
                    onChange={(e) => setSelectedCircleId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {modalCircles.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Department */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-dept-label">Department</InputLabel>
                  <Select
                    labelId="modal-dept-label"
                    value={selectedDepartmentId}
                    label="Department"
                    onChange={(e) => setSelectedDepartmentId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {meta?.departments?.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Reporting Period */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="modal-period-label">Reporting Period</InputLabel>
                  <Select
                    labelId="modal-period-label"
                    value={selectedPeriodId}
                    label="Reporting Period"
                    onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <MenuItem value="">
                      <em>Not Specified</em>
                    </MenuItem>
                    {meta?.reporting_periods?.map((rp) => (
                      <MenuItem key={rp.id} value={rp.id}>
                        {rp.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Import Mode Policy */}
              <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", backgroundColor: "action.hover" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Duplicate & Import Policy:
                </Typography>
                <RadioGroup value={importMode} onChange={(e) => setImportMode(e.target.value as any)}>
                  <FormControlLabel
                    value="append"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2"><strong>Add new records</strong> — append all rows into the dataset</Typography>}
                  />
                  <FormControlLabel
                    value="update_or_create"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2"><strong>Update matching records</strong> — upsert by business identifier</Typography>}
                  />
                  <FormControlLabel
                    value="replace"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2"><strong>Replace existing records</strong> — overwrite previous active batches for this context</Typography>}
                  />
                </RadioGroup>
              </Box>

              {/* File Dropzone */}
              <Box
                sx={{
                  p: 3,
                  border: "2px dashed",
                  borderColor: file ? "primary.main" : "divider",
                  borderRadius: "10px",
                  textAlign: "center",
                  backgroundColor: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "grey.50"),
                }}
              >
                <input
                  type="file"
                  id="master-data-file-input"
                  accept=".xlsx,.xlsm"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <label htmlFor="master-data-file-input" style={{ cursor: "pointer" }}>
                  <CloudUploadIcon sx={{ fontSize: 40, color: file ? "primary.main" : "text.secondary", mb: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {file ? file.name : "Click to select or drag and drop Excel workbook"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Supported formats: .xlsx, .xlsm
                  </Typography>
                </label>
              </Box>

              {/* Template Download Help */}
              {selectedTemplateId && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  sx={{ textTransform: "none", alignSelf: "flex-start", fontWeight: 600 }}
                >
                  {isDownloadingTemplate ? "Downloading Template..." : "Download Excel Template for this Dataset"}
                </Button>
              )}
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={!file || isUploading}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            {isUploading ? "Validating & Ingesting..." : "Upload & Validate"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
