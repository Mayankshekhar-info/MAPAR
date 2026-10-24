import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { useAssignScope } from "../hooks/useScopes";
import { useUsersList } from "../../users/hooks/useUsers";
import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption } from "../../organization/types/organization.types";

interface AssignScopeModalProps {
  open: boolean;
  onClose: () => void;
  preselectedUserId?: number | null;
}

export const AssignScopeModal: React.FC<AssignScopeModalProps> = ({
  open,
  onClose,
  preselectedUserId,
}) => {
  const [userId, setUserId] = useState<number | "">("");
  const [scopeType, setScopeType] = useState<"GLOBAL" | "CORPORATE" | "COMPANY" | "PROJECT" | "CIRCLE" | "DOMAIN" | "DEPARTMENT">("CIRCLE");

  // Cascading hierarchy
  const [mainCompanyId, setMainCompanyId] = useState<number | "">("");
  const [subCompanyId, setSubCompanyId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [circleId, setCircleId] = useState<number | "">("");
  const [domainId, setDomainId] = useState<number | "">("");

  const [mainCompanies, setMainCompanies] = useState<CascadingOption[]>([]);
  const [subCompanies, setSubCompanies] = useState<CascadingOption[]>([]);
  const [projects, setProjects] = useState<CascadingOption[]>([]);
  const [circles, setCircles] = useState<CascadingOption[]>([]);
  const [domains, setDomains] = useState<CascadingOption[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: usersData, isLoading: loadingUsers } = useUsersList({ page_size: 100 });
  const assignMutation = useAssignScope();

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setUserId(preselectedUserId || "");
      setScopeType("CIRCLE");
      setMainCompanyId("");
      setSubCompanyId("");
      setProjectId("");
      setCircleId("");
      setDomainId("");
      organizationService.getOptions("MAIN_COMPANY").then(setMainCompanies).catch(() => {});
    }
  }, [open, preselectedUserId]);

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
    }
  }, [mainCompanyId]);

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
    }
  }, [subCompanyId]);

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
    }
  }, [projectId]);

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
    }
  }, [circleId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!userId) {
      setErrorMsg("Please select a target user.");
      return;
    }

    if (scopeType === "CIRCLE" && !circleId) {
      setErrorMsg("Please select a target operational Circle.");
      return;
    }

    if (scopeType === "DOMAIN" && !domainId) {
      setErrorMsg("Please select a target Domain.");
      return;
    }

    assignMutation.mutate(
      {
        user_id: userId as number,
        scope_type: scopeType,
        circle_ids: circleId ? [circleId as number] : [],
        domain_ids: domainId ? [domainId as number] : [],
      },
      {
        onSuccess: () => onClose(),
        onError: (err: any) => {
          const msg = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to assign scope.";
          setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
        },
      }
    );
  };

  const isSaving = assignMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
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
            <VpnKeyOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
              Assign Access Scope
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              Define WHERE this user is authorized to view and operate on data
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.sm }}>
            {errorMsg}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {/* User selector */}
          <TextField
            select
            label="Target User"
            size="small"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
            fullWidth
            disabled={loadingUsers || Boolean(preselectedUserId)}
            sx={{ mb: 2.5 }}
          >
            {usersData?.results.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.full_name} (@{u.username}) • {u.role_name}
              </MenuItem>
            ))}
          </TextField>

          {/* Scope Type */}
          <TextField
            select
            label="Scope Classification"
            size="small"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as any)}
            fullWidth
            helperText="Global/Corporate grants multi-circle visibility; Circle restricts to a single plant/site"
            sx={{ mb: 2.5 }}
          >
            <MenuItem value="CIRCLE">Circle Level (Restricted to specific Circle)</MenuItem>
            <MenuItem value="DOMAIN">Domain Level (Restricted to specific Domain)</MenuItem>
            <MenuItem value="CORPORATE">Corporate Level (Cross-Company visibility)</MenuItem>
            <MenuItem value="GLOBAL">Global (Complete unrestricted visibility)</MenuItem>
          </TextField>

          {scopeType !== "GLOBAL" && scopeType !== "CORPORATE" && (
            <>
              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.primary.main }}>
                  Cascading Hierarchy Selection
                </Typography>
                {loadingOrg && <CircularProgress size={16} />}
              </Box>

              {/* Main Company */}
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
                }}
                fullWidth
                sx={{ mb: 2 }}
              >
                <MenuItem value=""><em>Select Main Company...</em></MenuItem>
                {mainCompanies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                ))}
              </TextField>

              {/* Sub Company */}
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
                }}
                fullWidth
                disabled={!mainCompanyId}
                sx={{ mb: 2 }}
              >
                <MenuItem value=""><em>Select Sub Company...</em></MenuItem>
                {subCompanies.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
                ))}
              </TextField>

              {/* Project */}
              <TextField
                select
                label="Project"
                size="small"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value === "" ? "" : Number(e.target.value));
                  setCircleId("");
                  setDomainId("");
                }}
                fullWidth
                disabled={!subCompanyId}
                sx={{ mb: 2 }}
              >
                <MenuItem value=""><em>Select Project...</em></MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>
                ))}
              </TextField>

              {/* Circle */}
              <TextField
                select
                label="Operational Circle *"
                size="small"
                required={scopeType === "CIRCLE" || scopeType === "DOMAIN"}
                value={circleId}
                onChange={(e) => {
                  setCircleId(e.target.value === "" ? "" : Number(e.target.value));
                  setDomainId("");
                }}
                fullWidth
                disabled={!projectId}
                sx={{ mb: scopeType === "DOMAIN" ? 2 : 0 }}
              >
                <MenuItem value=""><em>Select Operational Circle...</em></MenuItem>
                {circles.map((cir) => (
                  <MenuItem key={cir.id} value={cir.id}>{cir.name} ({cir.code})</MenuItem>
                ))}
              </TextField>

              {/* Domain if Domain level */}
              {scopeType === "DOMAIN" && (
                <TextField
                  select
                  label="Domain *"
                  size="small"
                  required
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value === "" ? "" : Number(e.target.value))}
                  fullWidth
                  disabled={!circleId}
                >
                  <MenuItem value=""><em>Select Domain...</em></MenuItem>
                  {domains.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>
                  ))}
                </TextField>
              )}
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={isSaving} sx={{ borderRadius: radiusTokens.sm }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            bgcolor: colorTokens.primary.main,
            "&:hover": { bgcolor: colorTokens.primary.dark },
            borderRadius: radiusTokens.sm,
            fontWeight: 700,
          }}
        >
          {isSaving ? "Assigning..." : "Assign Scope"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
