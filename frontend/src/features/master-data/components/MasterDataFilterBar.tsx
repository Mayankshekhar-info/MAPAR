import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { MasterDataFilterState, MasterDataMeta } from "../types/masterData.types";

interface MasterDataFilterBarProps {
  meta?: MasterDataMeta;
  filters: MasterDataFilterState;
  onFilterChange: (updates: Partial<MasterDataFilterState>) => void;
  onReset: () => void;
  onOpenUpload: () => void;
  onExport: () => void;
  isExporting?: boolean;
}

export const MasterDataFilterBar: React.FC<MasterDataFilterBarProps> = ({
  meta,
  filters,
  onFilterChange,
  onReset,
  onOpenUpload,
  onExport,
  isExporting = false,
}) => {
  // Cascading sub-companies based on company
  const filteredSubCompanies = useMemo(() => {
    if (!meta?.sub_companies) return [];
    if (!filters.companyId) return meta.sub_companies;
    return meta.sub_companies.filter((sc) => !sc.main_company_id || sc.main_company_id === filters.companyId);
  }, [meta?.sub_companies, filters.companyId]);

  // Cascading projects based on sub_company or company
  const filteredProjects = useMemo(() => {
    if (!meta?.projects) return [];
    if (filters.subCompanyId) {
      return meta.projects.filter((p) => p.sub_company_id === filters.subCompanyId);
    }
    if (filters.companyId) {
      const subCompanyIds = new Set(
        meta.sub_companies?.filter((sc) => sc.main_company_id === filters.companyId).map((sc) => sc.id) || []
      );
      return meta.projects.filter((p) => !p.sub_company_id || subCompanyIds.has(p.sub_company_id));
    }
    return meta.projects;
  }, [meta?.projects, meta?.sub_companies, filters.subCompanyId, filters.companyId]);

  // Cascading circles based on project
  const filteredCircles = useMemo(() => {
    if (!meta?.circles) return [];
    if (!filters.projectId) return meta.circles;
    return meta.circles.filter((c) => !c.project_id || c.project_id === filters.projectId);
  }, [meta?.circles, filters.projectId]);

  return (
    <Card
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Organizational Context & Dataset Selection
        </Typography>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={onReset}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
          >
            Reset Filters
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={onExport}
            disabled={isExporting}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={onOpenUpload}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, boxShadow: "none" }}
          >
            Upload Excel
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
            lg: "repeat(7, 1fr)",
          },
          gap: 2,
        }}
      >
        {/* 1. Company */}
        <FormControl size="small" fullWidth>
          <InputLabel id="company-filter-label">1. Company</InputLabel>
          <Select
            labelId="company-filter-label"
            value={filters.companyId || ""}
            label="1. Company"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ companyId: val, subCompanyId: null, projectId: null, circleId: null, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Companies</em>
            </MenuItem>
            {meta?.companies?.map((co) => (
              <MenuItem key={co.id} value={co.id}>
                {co.name} ({co.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 2. Sub-Company */}
        <FormControl size="small" fullWidth>
          <InputLabel id="subcompany-filter-label">2. Sub-Company</InputLabel>
          <Select
            labelId="subcompany-filter-label"
            value={filters.subCompanyId || ""}
            label="2. Sub-Company"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ subCompanyId: val, projectId: null, circleId: null, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Sub-Companies</em>
            </MenuItem>
            {filteredSubCompanies.map((sc) => (
              <MenuItem key={sc.id} value={sc.id}>
                {sc.name} ({sc.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 3. Project */}
        <FormControl size="small" fullWidth>
          <InputLabel id="project-filter-label">3. Project</InputLabel>
          <Select
            labelId="project-filter-label"
            value={filters.projectId || ""}
            label="3. Project"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ projectId: val, circleId: null, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Projects</em>
            </MenuItem>
            {filteredProjects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} ({p.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 4. Circle */}
        <FormControl size="small" fullWidth>
          <InputLabel id="circle-filter-label">4. Circle</InputLabel>
          <Select
            labelId="circle-filter-label"
            value={filters.circleId || ""}
            label="4. Circle"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ circleId: val, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Circles</em>
            </MenuItem>
            {filteredCircles.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({c.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 5. Department */}
        <FormControl size="small" fullWidth>
          <InputLabel id="department-filter-label">5. Department</InputLabel>
          <Select
            labelId="department-filter-label"
            value={filters.departmentId || ""}
            label="5. Department"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ departmentId: val, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Departments</em>
            </MenuItem>
            {meta?.departments?.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name} ({d.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 6. Reporting Period */}
        <FormControl size="small" fullWidth>
          <InputLabel id="period-filter-label">6. Reporting Period</InputLabel>
          <Select
            labelId="period-filter-label"
            value={filters.periodId || ""}
            label="6. Reporting Period"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ periodId: val, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Periods</em>
            </MenuItem>
            {meta?.reporting_periods?.map((rp) => (
              <MenuItem key={rp.id} value={rp.id}>
                {rp.name} {rp.is_current ? "(Current)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 6. Template / Dataset */}
        <FormControl size="small" fullWidth>
          <InputLabel id="template-filter-label">Dataset / Template</InputLabel>
          <Select
            labelId="template-filter-label"
            value={filters.templateId || ""}
            label="Dataset / Template"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onFilterChange({ templateId: val, page: 0 });
            }}
          >
            <MenuItem value="">
              <em>All Datasets</em>
            </MenuItem>
            {meta?.templates?.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Card>
  );
};
