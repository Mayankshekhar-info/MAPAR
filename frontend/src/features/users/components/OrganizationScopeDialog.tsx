import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { OrganizationScopeItem } from "../types/users.types";
import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption } from "../../organization/types/organization.types";

interface OrganizationScopeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (scope: OrganizationScopeItem, editIndex: number | null) => void;
  initialScope?: OrganizationScopeItem | null;
  editIndex: number | null;
  existingScopes?: OrganizationScopeItem[];
}

export const OrganizationScopeDialog: React.FC<OrganizationScopeDialogProps> = ({
  open,
  onClose,
  onSave,
  initialScope,
  editIndex,
  existingScopes = [],
}) => {
  // Cascading selections
  const [mainCompanyId, setMainCompanyId] = useState<number | "">("");
  const [subCompanyId, setSubCompanyId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [circleId, setCircleId] = useState<number | "">("");
  const [domainId, setDomainId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [teamId, setTeamId] = useState<number | "">("");

  // Options
  const [mainCompanies, setMainCompanies] = useState<CascadingOption[]>([]);
  const [subCompanies, setSubCompanies] = useState<CascadingOption[]>([]);
  const [projects, setProjects] = useState<CascadingOption[]>([]);
  const [circles, setCircles] = useState<CascadingOption[]>([]);
  const [domains, setDomains] = useState<CascadingOption[]>([]);
  const [departments, setDepartments] = useState<CascadingOption[]>([]);
  const [teams, setTeams] = useState<CascadingOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Permission flags
  const [canView, setCanView] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);

    // Load root Main Companies
    setLoading(true);
    organizationService
      .getOptions("MAIN_COMPANY")
      .then(async (mcos) => {
        setMainCompanies(mcos);

        if (initialScope) {
          // Populate existing scope values
          const mcId = initialScope.main_company_id || "";
          const scId = initialScope.sub_company_id || "";
          const pId = initialScope.project_id || "";
          const cId = initialScope.circle_id || "";
          const dId = initialScope.domain_id || "";
          const depId = initialScope.department_id || "";
          const tId = initialScope.team_id || initialScope.sub_department_id || "";

          setMainCompanyId(mcId);
          setSubCompanyId(scId);
          setProjectId(pId);
          setCircleId(cId);
          setDomainId(dId);
          setDepartmentId(depId);
          setTeamId(tId);

          // Permissions
          const actions = initialScope.actions || [];
          setCanView(initialScope.can_view ?? (actions.length > 0 ? actions.includes("view") : true));
          setCanManage(initialScope.can_manage ?? actions.includes("manage"));
          setCanCreate(initialScope.can_create ?? actions.includes("create"));
          setCanUpdate(initialScope.can_update ?? actions.includes("update"));
          setCanDelete(initialScope.can_delete ?? actions.includes("delete"));

          // Preload child dropdowns sequentially
          if (mcId) {
            const scs = await organizationService.getOptions("SUB_COMPANY", mcId as number);
            setSubCompanies(scs);
          }
          if (scId) {
            const projs = await organizationService.getOptions("PROJECT", scId as number);
            setProjects(projs);
          }
          if (pId) {
            const circs = await organizationService.getOptions("CIRCLE", pId as number);
            setCircles(circs);
          }
          if (cId) {
            const doms = await organizationService.getOptions("DOMAIN", cId as number);
            setDomains(doms);
          }
          if (dId) {
            const depts = await organizationService.getOptions("DEPARTMENT", dId as number);
            setDepartments(depts);
          }
          if (depId) {
            const tms = await organizationService.getOptions("SUB_DEPARTMENT", depId as number);
            setTeams(tms);
          }
        } else {
          // Fresh Scope creation
          if (mcos.length === 1) {
            setMainCompanyId(mcos[0].id);
            const scs = await organizationService.getOptions("SUB_COMPANY", mcos[0].id);
            setSubCompanies(scs);
          } else {
            setMainCompanyId("");
            setSubCompanies([]);
          }
          setSubCompanyId("");
          setProjectId("");
          setCircleId("");
          setDomainId("");
          setDepartmentId("");
          setTeamId("");
          setProjects([]);
          setCircles([]);
          setDomains([]);
          setDepartments([]);
          setTeams([]);

          setCanView(true);
          setCanManage(false);
          setCanCreate(false);
          setCanUpdate(false);
          setCanDelete(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load root organization options:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, initialScope]);

  // Cascading Handlers
  const handleMainCompanyChange = async (val: number | "") => {
    setMainCompanyId(val);
    setSubCompanyId("");
    setProjectId("");
    setCircleId("");
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setSubCompanies([]);
    setProjects([]);
    setCircles([]);
    setDomains([]);
    setDepartments([]);
    setTeams([]);

    if (val) {
      try {
        const scs = await organizationService.getOptions("SUB_COMPANY", val);
        setSubCompanies(scs);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSubCompanyChange = async (val: number | "") => {
    setSubCompanyId(val);
    setProjectId("");
    setCircleId("");
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setProjects([]);
    setCircles([]);
    setDomains([]);
    setDepartments([]);
    setTeams([]);

    if (val) {
      try {
        const projs = await organizationService.getOptions("PROJECT", val);
        setProjects(projs);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleProjectChange = async (val: number | "") => {
    setProjectId(val);
    setCircleId("");
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setCircles([]);
    setDomains([]);
    setDepartments([]);
    setTeams([]);

    if (val) {
      try {
        const circs = await organizationService.getOptions("CIRCLE", val);
        setCircles(circs);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCircleChange = async (val: number | "") => {
    setCircleId(val);
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setDomains([]);
    setDepartments([]);
    setTeams([]);

    if (val) {
      try {
        const doms = await organizationService.getOptions("DOMAIN", val);
        setDomains(doms);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDomainChange = async (val: number | "") => {
    setDomainId(val);
    setDepartmentId("");
    setTeamId("");
    setDepartments([]);
    setTeams([]);

    if (val) {
      try {
        const depts = await organizationService.getOptions("DEPARTMENT", val);
        setDepartments(depts);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDepartmentChange = async (val: number | "") => {
    setDepartmentId(val);
    setTeamId("");
    setTeams([]);

    if (val) {
      try {
        const tms = await organizationService.getOptions("SUB_DEPARTMENT", val);
        setTeams(tms);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Manage checkbox auto-selects view/update/create
  const handleManageToggle = (checked: boolean) => {
    setCanManage(checked);
    if (checked) {
      setCanView(true);
      setCanCreate(true);
      setCanUpdate(true);
    }
  };

  // Build breadcrumb string and names
  const handleSave = () => {
    setErrorMsg(null);

    // Validate that at least one organizational tier is selected
    if (!mainCompanyId && !circleId && !departmentId) {
      setErrorMsg("Please select at least a Main Company, Circle, or Department to define this access scope.");
      return;
    }

    if (!canView && !canManage && !canCreate && !canUpdate && !canDelete) {
      setErrorMsg("Please grant at least one access right (e.g. View) for this scope.");
      return;
    }

    // Resolve labels
    const mcName = mainCompanies.find((o) => o.id === mainCompanyId)?.name || initialScope?.main_company_name;
    const scName = subCompanies.find((o) => o.id === subCompanyId)?.name || initialScope?.sub_company_name;
    const pName = projects.find((o) => o.id === projectId)?.name || initialScope?.project_name;
    const cName = circles.find((o) => o.id === circleId)?.name || initialScope?.circle_name;
    const dName = domains.find((o) => o.id === domainId)?.name || initialScope?.domain_name;
    const depName = departments.find((o) => o.id === departmentId)?.name || initialScope?.department_name;
    const tName = teams.find((o) => o.id === teamId)?.name || initialScope?.team_name || initialScope?.sub_department_name;

    const parts = [mcName, scName, pName, cName, dName, depName, tName].filter(Boolean) as string[];
    const breadcrumb = parts.join(" → ");

    // Check duplicate identical scopes (excluding the current one being edited)
    const isDuplicate = existingScopes.some((s, idx) => {
      if (editIndex !== null && idx === editIndex) return false;
      const sMc = s.main_company_id || null;
      const sSc = s.sub_company_id || null;
      const sP = s.project_id || null;
      const sC = s.circle_id || null;
      const sD = s.domain_id || null;
      const sDep = s.department_id || null;
      const sT = s.team_id || s.sub_department_id || null;

      const curMc = mainCompanyId ? Number(mainCompanyId) : null;
      const curSc = subCompanyId ? Number(subCompanyId) : null;
      const curP = projectId ? Number(projectId) : null;
      const curC = circleId ? Number(circleId) : null;
      const curD = domainId ? Number(domainId) : null;
      const curDep = departmentId ? Number(departmentId) : null;
      const curT = teamId ? Number(teamId) : null;

      return (
        sMc === curMc &&
        sSc === curSc &&
        sP === curP &&
        sC === curC &&
        sD === curD &&
        sDep === curDep &&
        sT === curT
      );
    });

    if (isDuplicate) {
      setErrorMsg("An identical organization access scope is already assigned to this user.");
      return;
    }

    const actions: string[] = [];
    if (canView) actions.push("view");
    if (canManage) actions.push("manage");
    if (canCreate) actions.push("create");
    if (canUpdate) actions.push("update");
    if (canDelete) actions.push("delete");

    const savedScope: OrganizationScopeItem = {
      ...(initialScope?.id ? { id: initialScope.id } : {}),
      main_company_id: mainCompanyId ? Number(mainCompanyId) : null,
      main_company_name: mcName,
      sub_company_id: subCompanyId ? Number(subCompanyId) : null,
      sub_company_name: scName,
      project_id: projectId ? Number(projectId) : null,
      project_name: pName,
      circle_id: circleId ? Number(circleId) : null,
      circle_name: cName,
      domain_id: domainId ? Number(domainId) : null,
      domain_name: dName,
      department_id: departmentId ? Number(departmentId) : null,
      department_name: depName,
      team_id: teamId ? Number(teamId) : null,
      team_name: tName,
      sub_department_id: teamId ? Number(teamId) : null,
      sub_department_name: tName,
      hierarchy_breadcrumb: breadcrumb,
      can_view: canView,
      can_manage: canManage,
      can_create: canCreate,
      can_update: canUpdate,
      can_delete: canDelete,
      actions,
    };

    onSave(savedScope, editIndex);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: radiusTokens.sm,
            bgcolor: colorTokens.primary.lighter,
            color: colorTokens.primary.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccountTreeOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
            {editIndex !== null ? "Edit Organization Access Scope" : "Add Organization Access Scope"}
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            Select the organizational boundary and assign specific action permissions.
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2.5 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.sm }} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: colorTokens.text.primary }}>
              1. Cascading Organization Hierarchy (WHERE)
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 3 }}>
              {/* Main Company */}
              <TextField
                select
                fullWidth
                size="small"
                label="Main Company"
                value={mainCompanyId}
                onChange={(e) => handleMainCompanyChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / Select Main Company --</em>
                </MenuItem>
                {mainCompanies.map((mc) => (
                  <MenuItem key={mc.id} value={mc.id}>
                    {mc.name} ({mc.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Sub Company */}
              <TextField
                select
                fullWidth
                size="small"
                label="Sub Company"
                value={subCompanyId}
                disabled={!mainCompanyId || subCompanies.length === 0}
                onChange={(e) => handleSubCompanyChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Sub Companies --</em>
                </MenuItem>
                {subCompanies.map((sc) => (
                  <MenuItem key={sc.id} value={sc.id}>
                    {sc.name} ({sc.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Project */}
              <TextField
                select
                fullWidth
                size="small"
                label="Project"
                value={projectId}
                disabled={!subCompanyId || projects.length === 0}
                onChange={(e) => handleProjectChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Projects --</em>
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Circle */}
              <TextField
                select
                fullWidth
                size="small"
                label="Circle"
                value={circleId}
                disabled={!projectId || circles.length === 0}
                onChange={(e) => handleCircleChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Circles --</em>
                </MenuItem>
                {circles.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Domain */}
              <TextField
                select
                fullWidth
                size="small"
                label="Domain"
                value={domainId}
                disabled={!circleId || domains.length === 0}
                onChange={(e) => handleDomainChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Domains --</em>
                </MenuItem>
                {domains.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Department */}
              <TextField
                select
                fullWidth
                size="small"
                label="Department"
                value={departmentId}
                disabled={!domainId || departments.length === 0}
                onChange={(e) => handleDepartmentChange(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Departments --</em>
                </MenuItem>
                {departments.map((dep) => (
                  <MenuItem key={dep.id} value={dep.id}>
                    {dep.name} ({dep.code})
                  </MenuItem>
                ))}
              </TextField>

              {/* Team / Sub-Department */}
              <TextField
                select
                fullWidth
                size="small"
                label="Team / Sub-Department"
                value={teamId}
                disabled={!departmentId || teams.length === 0}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
              >
                <MenuItem value="">
                  <em>-- None / All Teams --</em>
                </MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Divider sx={{ my: 2.5 }} />

            {/* Scope Permissions */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <SecurityOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                2. Scope Access Rights (WHAT actions inside this boundary)
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: radiusTokens.sm,
                bgcolor: "#F8FAFC",
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <FormGroup row sx={{ gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canView}
                      onChange={(e) => setCanView(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        View
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Read-only visibility for records in this scope
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canManage}
                      onChange={(e) => handleManageToggle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Manage
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Full management authority in this scope
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canCreate}
                      onChange={(e) => setCanCreate(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Create
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Add new entries
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canUpdate}
                      onChange={(e) => setCanUpdate(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Update
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Edit existing records
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canDelete}
                      onChange={(e) => setCanDelete(e.target.checked)}
                      color="error"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Delete
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                        Remove records
                      </Typography>
                    </Box>
                  }
                />
              </FormGroup>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: radiusTokens.sm }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{ bgcolor: colorTokens.primary.main, borderRadius: radiusTokens.sm }}
        >
          {editIndex !== null ? "Save Changes" : "Apply Access Scope"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
