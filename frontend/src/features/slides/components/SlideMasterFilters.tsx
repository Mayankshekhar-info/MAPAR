import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FilterListIcon from "@mui/icons-material/FilterList";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { CockpitFiltersData } from "../../dashboard/types/cockpit.types";
import { SlideFilterState } from "../types/slide.types";

interface SlideMasterFiltersProps {
  filters: SlideFilterState;
  filtersData?: CockpitFiltersData;
  isLoadingFilters: boolean;
  onCompanyChange: (id?: number) => void;
  onProjectChange: (id?: number) => void;
  onCircleChange: (id?: number) => void;
  onDomainChange: (id?: number) => void;
  onPeriodChange: (id?: number) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onResetFilters: () => void;
}

export const SlideMasterFilters: React.FC<SlideMasterFiltersProps> = ({
  filters,
  filtersData,
  isLoadingFilters,
  onCompanyChange,
  onProjectChange,
  onCircleChange,
  onDomainChange,
  onPeriodChange,
  onStatusChange,
  onSearchChange,
  onResetFilters,
}) => {
  const toId = (val: unknown): number | undefined =>
    val === "" || val === undefined || val === null ? undefined : Number(val);

  // Cascading filtered options based on selections
  const availableProjects = React.useMemo(() => {
    if (!filtersData?.projects) return [];
    if (!filters.companyId) return filtersData.projects;
    const subCompanyIds = new Set<number>(
      filtersData.sub_companies
        ?.filter((sc) => sc.main_company_id === filters.companyId)
        .map((sc) => sc.id) || []
    );
    return filtersData.projects.filter((p) => p.sub_company_id != null && subCompanyIds.has(p.sub_company_id));
  }, [filtersData, filters.companyId]);

  const availableCircles = React.useMemo(() => {
    if (!filtersData?.circles) return [];
    if (!filters.projectId) return filtersData.circles;
    return filtersData.circles.filter((c) => c.project_id === filters.projectId);
  }, [filtersData, filters.projectId]);

  return (
    <Card
      sx={{
        p: 2,
        mb: 2.5,
        border: `1px solid ${colorTokens.workspace.border}`,
        borderRadius: radiusTokens.lg,
        boxShadow: shadowTokens.subtle,
        bgcolor: "#FFFFFF",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: colorTokens.text.secondary, mr: 0.5 }}>
          <FilterListIcon sx={{ fontSize: 20 }} />
        </Box>

        {/* 1. Main Company Filter */}
        {filtersData?.companies && filtersData.companies.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150, flex: "1 1 140px" }}>
            <InputLabel id="master-company-label">Company</InputLabel>
            <Select
              labelId="master-company-label"
              id="master-company-select"
              value={filters.companyId ?? ""}
              label="Company"
              onChange={(e) => onCompanyChange(toId(e.target.value))}
              sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
            >
              <MenuItem value="">
                <em>All Companies</em>
              </MenuItem>
              {filtersData.companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* 2. Project Filter */}
        {availableProjects.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150, flex: "1 1 140px" }}>
            <InputLabel id="master-project-label">Project</InputLabel>
            <Select
              labelId="master-project-label"
              id="master-project-select"
              value={filters.projectId ?? ""}
              label="Project"
              onChange={(e) => onProjectChange(toId(e.target.value))}
              sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
            >
              <MenuItem value="">
                <em>All Projects</em>
              </MenuItem>
              {availableProjects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* 3. Circle Filter */}
        <FormControl size="small" sx={{ minWidth: 160, flex: "1 1 150px" }}>
          <InputLabel id="master-circle-label">Circle</InputLabel>
          <Select
            labelId="master-circle-label"
            id="master-circle-select"
            value={filters.circleId ?? ""}
            label="Circle"
            onChange={(e) => onCircleChange(toId(e.target.value))}
            sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
          >
            <MenuItem value="">
              <em>All Circles</em>
            </MenuItem>
            {availableCircles.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({c.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 4. Domain Filter */}
        <FormControl size="small" sx={{ minWidth: 150, flex: "1 1 140px" }}>
          <InputLabel id="master-domain-label">Domain</InputLabel>
          <Select
            labelId="master-domain-label"
            id="master-domain-select"
            value={filters.domainId ?? ""}
            label="Domain"
            onChange={(e) => onDomainChange(toId(e.target.value))}
            sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
          >
            <MenuItem value="">
              <em>All Domains</em>
            </MenuItem>
            {filtersData?.domains?.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 5. Reporting Period Filter */}
        <FormControl size="small" sx={{ minWidth: 150, flex: "1 1 140px" }}>
          <InputLabel id="master-period-label">Period</InputLabel>
          <Select
            labelId="master-period-label"
            id="master-period-select"
            value={filters.periodId ?? ""}
            label="Period"
            onChange={(e) => onPeriodChange(toId(e.target.value))}
            sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
          >
            {filtersData?.periods?.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} {p.is_current ? "(Current)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 6. Status Filter */}
        <FormControl size="small" sx={{ minWidth: 130, flex: "1 1 120px" }}>
          <InputLabel id="master-status-label">Status</InputLabel>
          <Select
            labelId="master-status-label"
            id="master-status-select"
            value={filters.status}
            label="Status"
            onChange={(e) => onStatusChange(e.target.value)}
            sx={{ borderRadius: radiusTokens.md, fontSize: "0.85rem" }}
          >
            {filtersData?.statuses?.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            )) || [
              <MenuItem key="ALL" value="ALL">All Statuses</MenuItem>,
              <MenuItem key="GREEN" value="GREEN">Optimal (Green)</MenuItem>,
              <MenuItem key="AMBER" value="AMBER">Warning (Amber)</MenuItem>,
              <MenuItem key="RED" value="RED">Critical (Red)</MenuItem>,
            ]}
          </Select>
        </FormControl>

        {/* 7. Search Input */}
        <TextField
          size="small"
          placeholder="Search Resource, Metric or Circle..."
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            flex: "1 1 180px",
            minWidth: 180,
            "& .MuiOutlinedInput-root": {
              borderRadius: radiusTokens.md,
              fontSize: "0.85rem",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: colorTokens.text.muted }} />
              </InputAdornment>
            ),
            endAdornment: filters.search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange("")}>
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* 8. Reset Filters */}
        <Button
          variant="text"
          size="small"
          onClick={onResetFilters}
          startIcon={<RestartAltIcon />}
          sx={{
            color: colorTokens.text.secondary,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            borderRadius: radiusTokens.md,
            "&:hover": {
              bgcolor: colorTokens.workspace.borderSubtle,
              color: colorTokens.primary.main,
            },
          }}
        >
          Reset
        </Button>
      </Box>
    </Card>
  );
};
