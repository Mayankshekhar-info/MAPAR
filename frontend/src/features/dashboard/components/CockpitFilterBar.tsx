import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { CockpitFiltersData, CockpitFilterState } from "../types/cockpit.types";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { PeriodSelector } from "../../../components/PeriodSelector";

interface CockpitFilterBarProps {
  filters: CockpitFilterState;
  filtersData?: CockpitFiltersData;
  isLoading: boolean;
  onFilterChange: (key: keyof CockpitFilterState, value: any) => void;
  onResetFilters: () => void;
  onExportCsv: () => void;
}

export const CockpitFilterBar: React.FC<CockpitFilterBarProps> = ({
  filters,
  filtersData,
  isLoading,
  onFilterChange,
  onResetFilters,
  onExportCsv,
}) => {
  // Cascading SubCompany options based on selected Company
  const filteredSubCompanies = useMemo(() => {
    if (!filtersData?.sub_companies) return [];
    if (!filters.companyId) return filtersData.sub_companies;
    return filtersData.sub_companies.filter((sc) => !sc.main_company_id || sc.main_company_id === filters.companyId);
  }, [filtersData?.sub_companies, filters.companyId]);

  // Cascading Project options based on selected SubCompany or Company
  const filteredProjects = useMemo(() => {
    if (!filtersData?.projects) return [];
    if (filters.subCompanyId) {
      return filtersData.projects.filter((p) => !p.sub_company_id || p.sub_company_id === filters.subCompanyId);
    }
    if (filters.companyId && filtersData.sub_companies) {
      const validSubCompanyIds = new Set(
        filtersData.sub_companies
          .filter((sc) => sc.main_company_id === filters.companyId)
          .map((sc) => sc.id)
      );
      return filtersData.projects.filter((p) => !p.sub_company_id || validSubCompanyIds.has(p.sub_company_id));
    }
    return filtersData.projects;
  }, [filtersData?.projects, filtersData?.sub_companies, filters.subCompanyId, filters.companyId]);

  // Cascading Circle options based on selected Project
  const filteredCircles = useMemo(() => {
    if (!filtersData?.circles) return [];
    if (!filters.projectId) return filtersData.circles;
    return filtersData.circles.filter((c) => !c.project_id || c.project_id === filters.projectId);
  }, [filtersData?.circles, filters.projectId]);

  // Cascading Domain options based on selected Circle
  const filteredDomains = useMemo(() => {
    if (!filtersData?.domains) return [];
    if (!filters.circleId) return filtersData.domains;
    return filtersData.domains.filter((d) => !d.circle_id || d.circle_id === filters.circleId);
  }, [filtersData?.domains, filters.circleId]);

  const handleCompanyChange = (val: string | number) => {
    const num = val ? Number(val) : undefined;
    onFilterChange("companyId", num);
    onFilterChange("subCompanyId", undefined);
    onFilterChange("projectId", undefined);
    onFilterChange("circleId", undefined);
  };

  const handleSubCompanyChange = (val: string | number) => {
    const num = val ? Number(val) : undefined;
    onFilterChange("subCompanyId", num);
    onFilterChange("projectId", undefined);
    onFilterChange("circleId", undefined);
  };

  const handleProjectChange = (val: string | number) => {
    const num = val ? Number(val) : undefined;
    onFilterChange("projectId", num);
    onFilterChange("circleId", undefined);
  };

  return (
    <Box
      sx={{
        p: 1.5,
        mb: 2,
        bgcolor: "#FFFFFF",
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {/* Dimension Filter Selectors Row (7 tiers) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "repeat(3, 1fr)",
            lg: "repeat(7, 1fr)",
          },
          gap: 1.25,
        }}
      >
        {/* 1. Main Company Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-company-label">Company</InputLabel>
          <Select
            labelId="cockpit-company-label"
            id="cockpit-company-select"
            value={filters.companyId || ""}
            label="Company"
            onChange={(e) => handleCompanyChange(e.target.value as any)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.82rem" }}>
              <em>All Companies</em>
            </MenuItem>
            {(filtersData?.companies || []).map((comp) => (
              <MenuItem key={comp.id} value={comp.id} sx={{ fontSize: "0.82rem" }}>
                {comp.name} {comp.code ? `(${comp.code})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 2. Sub Company Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-subcompany-label">Sub Company</InputLabel>
          <Select
            labelId="cockpit-subcompany-label"
            id="cockpit-subcompany-select"
            value={filters.subCompanyId || ""}
            label="Sub Company"
            onChange={(e) => handleSubCompanyChange(e.target.value as any)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.82rem" }}>
              <em>All Sub Companies</em>
            </MenuItem>
            {filteredSubCompanies.map((sc) => (
              <MenuItem key={sc.id} value={sc.id} sx={{ fontSize: "0.82rem" }}>
                {sc.name} {sc.code ? `(${sc.code})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 3. Project Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-project-label">Project</InputLabel>
          <Select
            labelId="cockpit-project-label"
            id="cockpit-project-select"
            value={filters.projectId || ""}
            label="Project"
            onChange={(e) => handleProjectChange(e.target.value as any)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.82rem" }}>
              <em>All Projects</em>
            </MenuItem>
            {filteredProjects.map((proj) => (
              <MenuItem key={proj.id} value={proj.id} sx={{ fontSize: "0.82rem" }}>
                {proj.name} {proj.code ? `(${proj.code})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 4. Circle Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-circle-label">Circle</InputLabel>
          <Select
            labelId="cockpit-circle-label"
            id="cockpit-circle-select"
            value={filters.circleId || ""}
            label="Circle"
            onChange={(e) => onFilterChange("circleId", e.target.value ? Number(e.target.value) : undefined)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.82rem" }}>
              <em>All Circles</em>
            </MenuItem>
            {filteredCircles.map((cir) => (
              <MenuItem key={cir.id} value={cir.id} sx={{ fontSize: "0.82rem" }}>
                {cir.name} {cir.code ? `(${cir.code})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 5. Domain Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-domain-label">Governance Domain</InputLabel>
          <Select
            labelId="cockpit-domain-label"
            id="cockpit-domain-select"
            value={filters.domainId || ""}
            label="Governance Domain"
            onChange={(e) => onFilterChange("domainId", e.target.value ? Number(e.target.value) : undefined)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.82rem" }}>
              <em>All Domains</em>
            </MenuItem>
            {filteredDomains.map((dom) => (
              <MenuItem key={dom.id} value={dom.id} sx={{ fontSize: "0.82rem" }}>
                {dom.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 6. Reporting Period Filter */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <PeriodSelector
            selectedPeriodId={filters.periodId}
            onPeriodSelect={(period) => onFilterChange("periodId", period.id)}
            fullWidth
            size="small"
          />
        </Box>

        {/* 7. Status Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel id="cockpit-status-label">Status</InputLabel>
          <Select
            labelId="cockpit-status-label"
            id="cockpit-status-select"
            value={filters.status || "ALL"}
            label="Status"
            onChange={(e) => onFilterChange("status", e.target.value)}
            sx={{ fontSize: "0.82rem" }}
          >
            {(filtersData?.statuses || []).map((st) => (
              <MenuItem key={st.value} value={st.value} sx={{ fontSize: "0.82rem" }}>
                {st.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Search & Action Controls Row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <TextField
          id="cockpit-search-input"
          size="small"
          placeholder="Search KPI / Department / Circle / Code..."
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          sx={{
            flex: 1,
            minWidth: 280,
            "& .MuiInputBase-root": {
              fontSize: "0.82rem",
              borderRadius: radiusTokens.md,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: colorTokens.text.secondary }} />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            id="cockpit-reset-filters-btn"
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon fontSize="small" />}
            onClick={onResetFilters}
            sx={{
              borderRadius: radiusTokens.md,
              borderColor: colorTokens.workspace.border,
              color: colorTokens.text.secondary,
              fontSize: "0.78rem",
              textTransform: "none",
              "&:hover": {
                bgcolor: "#F8FAFC",
                borderColor: "#CBD5E1",
              },
            }}
          >
            Reset
          </Button>

          <Button
            id="cockpit-export-csv-btn"
            variant="contained"
            size="small"
            startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
            onClick={onExportCsv}
            sx={{
              borderRadius: radiusTokens.md,
              bgcolor: colorTokens.primary.main,
              color: "#FFFFFF",
              fontSize: "0.78rem",
              textTransform: "none",
              fontWeight: 600,
              boxShadow: "none",
              "&:hover": {
                bgcolor: colorTokens.primary.dark,
                boxShadow: "0 2px 4px rgba(2, 132, 199, 0.25)",
              },
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
