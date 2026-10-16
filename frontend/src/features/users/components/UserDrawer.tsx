import React, { useState, useEffect } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { UserListItem, CreateUserPayload, UpdateUserPayload } from "../types/users.types";
import { useCreateUser, useUpdateUser } from "../hooks/useUsers";
import { useRolesList } from "../../roles/hooks/useRoles";
import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption } from "../../organization/types/organization.types";

interface UserDrawerProps {
  open: boolean;
  onClose: () => void;
  userToEdit?: UserListItem | null;
  initialHierarchy?: {
    main_company_id?: number | null;
    sub_company_id?: number | null;
    project_id?: number | null;
    circle_id?: number | null;
    domain_id?: number | null;
    department_id?: number | null;
    team_id?: number | null;
    sub_department_id?: number | null;
  } | null;
}

export const UserDrawer: React.FC<UserDrawerProps> = ({ open, onClose, userToEdit, initialHierarchy }) => {
  const isEditing = Boolean(userToEdit);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [status, setStatus] = useState("ACTIVE");

  // Cascading organization selection (All 7 Levels)
  const [mainCompanyId, setMainCompanyId] = useState<number | "">("");
  const [subCompanyId, setSubCompanyId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [circleId, setCircleId] = useState<number | "">("");
  const [domainId, setDomainId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [teamId, setTeamId] = useState<number | "">("");

  // Options state
  const [mainCompanies, setMainCompanies] = useState<CascadingOption[]>([]);
  const [subCompanies, setSubCompanies] = useState<CascadingOption[]>([]);
  const [projects, setProjects] = useState<CascadingOption[]>([]);
  const [circles, setCircles] = useState<CascadingOption[]>([]);
  const [domains, setDomains] = useState<CascadingOption[]>([]);
  const [departments, setDepartments] = useState<CascadingOption[]>([]);
  const [teams, setTeams] = useState<CascadingOption[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: rolesData, isLoading: loadingRoles } = useRolesList({ status: "ACTIVE" });
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  // Load Main Companies on open
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      organizationService.getOptions("MAIN_COMPANY").then(setMainCompanies).catch(() => {});
    }
  }, [open]);

  // Load Sub Companies when Main Company changes
  useEffect(() => {
    if (mainCompanyId) {
      setLoadingOrg(true);
      organizationService.getOptions("SUB_COMPANY", mainCompanyId as number)
        .then((opts) => {
          setSubCompanies(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setSubCompanies([]);
      setProjects([]);
      setCircles([]);
      setDomains([]);
      setDepartments([]);
      setTeams([]);
    }
  }, [mainCompanyId]);

  // Load Projects when Sub Company changes
  useEffect(() => {
    if (subCompanyId) {
      setLoadingOrg(true);
      organizationService.getOptions("PROJECT", subCompanyId as number)
        .then((opts) => {
          setProjects(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setProjects([]);
      setCircles([]);
      setDomains([]);
      setDepartments([]);
      setTeams([]);
    }
  }, [subCompanyId]);

  // Load Circles when Project changes
  useEffect(() => {
    if (projectId) {
      setLoadingOrg(true);
      organizationService.getOptions("CIRCLE", projectId as number)
        .then((opts) => {
          setCircles(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setCircles([]);
      setDomains([]);
      setDepartments([]);
      setTeams([]);
    }
  }, [projectId]);

  // Load Domains when Circle changes
  useEffect(() => {
    if (circleId) {
      setLoadingOrg(true);
      organizationService.getOptions("DOMAIN", circleId as number)
        .then((opts) => {
          setDomains(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setDomains([]);
      setDepartments([]);
      setTeams([]);
    }
  }, [circleId]);

  // Load Departments when Domain changes
  useEffect(() => {
    if (domainId) {
      setLoadingOrg(true);
      organizationService.getOptions("DEPARTMENT", domainId as number)
        .then((opts) => {
          setDepartments(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setDepartments([]);
      setTeams([]);
    }
  }, [domainId]);

  // Load Teams when Department changes
  useEffect(() => {
    if (departmentId) {
      setLoadingOrg(true);
      organizationService.getOptions("SUB_DEPARTMENT", departmentId as number)
        .then((opts) => {
          setTeams(opts);
          setLoadingOrg(false);
        })
        .catch(() => setLoadingOrg(false));
    } else {
      setTeams([]);
    }
  }, [departmentId]);

  // Initialize form when userToEdit or initialHierarchy changes
  useEffect(() => {
    if (userToEdit) {
      setFirstName(userToEdit.first_name || "");
      setLastName(userToEdit.last_name || "");
      setUsername(userToEdit.username || "");
      setEmail(userToEdit.email || "");
      setPassword("");
      setDesignation(userToEdit.designation || "");
      setDepartment(userToEdit.department || "");
      setStatus(userToEdit.status || "ACTIVE");
      setCircleId(userToEdit.circle_id || "");
      const tid = userToEdit.team_id || userToEdit.sub_department_id;
      if (tid) setTeamId(tid);

      // Resolve full hierarchy from hierarchy_context if available
      const ctx = userToEdit.hierarchy_context;
      if (ctx) {
        if (ctx.main_company_id) setMainCompanyId(ctx.main_company_id);
        if (ctx.sub_company_id) setSubCompanyId(ctx.sub_company_id);
        if (ctx.project_id) setProjectId(ctx.project_id);
        if (ctx.circle_id) setCircleId(ctx.circle_id);
        if (ctx.domain_id) setDomainId(ctx.domain_id);
        if (ctx.department_id) setDepartmentId(ctx.department_id);
      }

      // Find role id matching role code
      if (rolesData) {
        const matched = rolesData.find((r) => r.code === userToEdit.role);
        if (matched) setRoleId(matched.id);
      }
    } else if (initialHierarchy) {
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setDesignation("");
      setDepartment("");
      setRoleId("");
      setStatus("ACTIVE");

      if (initialHierarchy.main_company_id) setMainCompanyId(initialHierarchy.main_company_id);
      if (initialHierarchy.sub_company_id) setSubCompanyId(initialHierarchy.sub_company_id);
      if (initialHierarchy.project_id) setProjectId(initialHierarchy.project_id);
      if (initialHierarchy.circle_id) setCircleId(initialHierarchy.circle_id);
      if (initialHierarchy.domain_id) setDomainId(initialHierarchy.domain_id);
      if (initialHierarchy.department_id) setDepartmentId(initialHierarchy.department_id);
      const tid = initialHierarchy.team_id || initialHierarchy.sub_department_id;
      if (tid) setTeamId(tid);
    } else {
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setDesignation("");
      setDepartment("");
      setRoleId("");
      setStatus("ACTIVE");
      setMainCompanyId("");
      setSubCompanyId("");
      setProjectId("");
      setCircleId("");
      setDomainId("");
      setDepartmentId("");
      setTeamId("");
    }
  }, [userToEdit, initialHierarchy, rolesData]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const selectedRole = rolesData?.find((r) => r.id === roleId);
    const resolvedDept = department || (departments.find((d) => d.id === departmentId)?.name || "");

    if (isEditing && userToEdit) {
      const payload: UpdateUserPayload = {
        first_name: firstName,
        last_name: lastName,
        email,
        designation,
        department: resolvedDept,
        status,
        circle_id: circleId ? (circleId as number) : null,
        sub_department_id: teamId ? (teamId as number) : null,
        team_id: teamId ? (teamId as number) : null,
      };
      if (roleId) {
        payload.role_id = roleId as number;
        if (selectedRole) payload.role = selectedRole.code;
      }
      if (password) {
        payload.password = password;
      }

      updateUserMutation.mutate(
        { userId: userToEdit.id, payload },
        {
          onSuccess: () => onClose(),
          onError: (err: any) => {
            const msg = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to update user.";
            setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
          },
        }
      );
    } else {
      if (!username || !email || !password) {
        setErrorMsg("Username, Email, and Password are required for new accounts.");
        return;
      }

      const payload: CreateUserPayload = {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        designation,
        department: resolvedDept,
        status,
        circle_id: circleId ? (circleId as number) : null,
        sub_department_id: teamId ? (teamId as number) : null,
        team_id: teamId ? (teamId as number) : null,
        role_id: roleId ? (roleId as number) : undefined,
        role: selectedRole ? selectedRole.code : "VIEWER",
      };

      createUserMutation.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err: any) => {
          const msg = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to create user.";
          setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
        },
      });
    }
  };

  const isSaving = createUserMutation.isPending || updateUserMutation.isPending;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}>
      <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 2, borderBottom: `1px solid ${colorTokens.workspace.border}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: radiusTokens.md,
                bgcolor: colorTokens.primary.lighter,
                color: colorTokens.primary.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isEditing ? <EditOutlinedIcon /> : <PersonAddOutlinedIcon />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "1.1rem" }}>
                {isEditing ? "Edit User Account" : "Create User Account"}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                {isEditing ? `Modifying credentials and scopes for ${userToEdit?.username}` : "Provision credentials, enterprise role, and hierarchy scope"}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Form Body */}
        <Box component="form" onSubmit={handleSubmit} sx={{ flex: 1, overflowY: "auto", py: 2.5 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.sm }}>
              {errorMsg}
            </Alert>
          )}

          {/* Section 1: Basic Information */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.primary.main, mb: 1.5 }}>
            1. Basic Information
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <TextField
              label="First Name"
              size="small"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Last Name"
              size="small"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <TextField
              label="Username"
              size="small"
              required
              disabled={isEditing}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
            />
            <TextField
              label="Email Address"
              size="small"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <TextField
              label={isEditing ? "New Password (Leave blank to keep)" : "Password *"}
              size="small"
              type="password"
              required={!isEditing}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Account Status"
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
              <MenuItem value="INVITED">Invited</MenuItem>
              <MenuItem value="SUSPENDED">Suspended</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <TextField
              label="Designation"
              size="small"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Operations Manager"
              fullWidth
            />
            <TextField
              label="Department"
              size="small"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Field Operations"
              fullWidth
            />
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Section 2: Enterprise Role */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.primary.main, mb: 1.5 }}>
            2. Enterprise Role Assignment
          </Typography>

          <TextField
            select
            label="Assigned Role"
            size="small"
            required
            value={roleId}
            onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))}
            fullWidth
            disabled={loadingRoles}
            helperText="Determines what permissions and capabilities this user has"
            sx={{ mb: 2.5 }}
          >
            {(rolesData || []).map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>{r.code}</Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <Divider sx={{ my: 2.5 }} />

          {/* Section 3: Organization Hierarchy Scope */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.primary.main }}>
              3. Organization Scope (Cascading Assignment)
            </Typography>
            {loadingOrg && <CircularProgress size={16} />}
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 2 }}>
            Select cascading tiers to anchor this user to the organization hierarchy. Data is dynamically fetched from Organization APIs.
          </Typography>

          {/* Tier 1: Main Company */}
          <TextField
            select
            label="Main Company"
            size="small"
            value={mainCompanyId}
            onChange={(e) => {
              setMainCompanyId(e.target.value === "" ? "" : Number(e.target.value));
              setSubCompanyId("");
              setProjectId("");
              setCircleId("");
              setDomainId("");
              setDepartmentId("");
              setTeamId("");
            }}
            fullWidth
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Main Company...</em>
            </MenuItem>
            {mainCompanies.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({c.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 2: Sub Company */}
          <TextField
            select
            label="Sub Company"
            size="small"
            value={subCompanyId}
            onChange={(e) => {
              setSubCompanyId(e.target.value === "" ? "" : Number(e.target.value));
              setProjectId("");
              setCircleId("");
              setDomainId("");
              setDepartmentId("");
              setTeamId("");
            }}
            fullWidth
            disabled={!mainCompanyId}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Sub Company...</em>
            </MenuItem>
            {subCompanies.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 3: Project */}
          <TextField
            select
            label="Project"
            size="small"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value === "" ? "" : Number(e.target.value));
              setCircleId("");
              setDomainId("");
              setDepartmentId("");
              setTeamId("");
            }}
            fullWidth
            disabled={!subCompanyId}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Project...</em>
            </MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} ({p.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 4: Circle */}
          <TextField
            select
            label="Circle"
            size="small"
            value={circleId}
            onChange={(e) => {
              setCircleId(e.target.value === "" ? "" : Number(e.target.value));
              setDomainId("");
              setDepartmentId("");
              setTeamId("");
            }}
            fullWidth
            disabled={!projectId && !isEditing}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Circle...</em>
            </MenuItem>
            {circles.map((cir) => (
              <MenuItem key={cir.id} value={cir.id}>
                {cir.name} ({cir.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 5: Domain */}
          <TextField
            select
            label="Domain"
            size="small"
            value={domainId}
            onChange={(e) => {
              setDomainId(e.target.value === "" ? "" : Number(e.target.value));
              setDepartmentId("");
              setTeamId("");
            }}
            fullWidth
            disabled={!circleId && !isEditing}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Domain...</em>
            </MenuItem>
            {domains.map((dom) => (
              <MenuItem key={dom.id} value={dom.id}>
                {dom.name} ({dom.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 6: Department */}
          <TextField
            select
            label="Department"
            size="small"
            value={departmentId}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              setDepartmentId(val);
              setTeamId("");
              if (val) {
                const found = departments.find((d) => d.id === val);
                if (found && !department) setDepartment(found.name);
              }
            }}
            fullWidth
            disabled={!domainId && !isEditing}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select Department...</em>
            </MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </MenuItem>
            ))}
          </TextField>

          {/* Tier 7: Team */}
          <TextField
            select
            label="Team (Sub-Department — Operational Assignment)"
            size="small"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))}
            fullWidth
            disabled={!departmentId && !isEditing}
            helperText={userToEdit?.team_name ? `Current team: ${userToEdit.team_name}` : undefined}
          >
            <MenuItem value="">
              <em>Select Team / Sub-Department...</em>
            </MenuItem>
            {teams.map((tm) => (
              <MenuItem key={tm.id} value={tm.id}>
                {tm.name} ({tm.code})
              </MenuItem>
            ))}
          </TextField>

        </Box>

        {/* Footer Actions */}
        <Box sx={{ pt: 2, borderTop: `1px solid ${colorTokens.workspace.border}`, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={onClose} disabled={isSaving} sx={{ borderRadius: radiusTokens.sm }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
            }}
          >
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Create User"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
