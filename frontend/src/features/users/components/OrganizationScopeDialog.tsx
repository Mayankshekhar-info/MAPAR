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
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Tooltip from "@mui/material/Tooltip";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CorporateFareOutlinedIcon from "@mui/icons-material/CorporateFareOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { OrganizationScopeItem } from "../types/users.types";
import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption, HierarchyLevel, NodeDetail } from "../../organization/types/organization.types";

interface OrganizationScopeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (scope: OrganizationScopeItem | OrganizationScopeItem[], editIndex: number | null) => void;
  initialScope?: OrganizationScopeItem | null;
  editIndex: number | null;
  existingScopes?: OrganizationScopeItem[];
}

export type ScopeAnchorTier = "CIRCLE" | "MAIN_COMPANY" | "SUB_COMPANY" | "PROJECT" | "DOMAIN" | "DEPARTMENT" | "TEAM";

export const OrganizationScopeDialog: React.FC<OrganizationScopeDialogProps> = ({
  open,
  onClose,
  onSave,
  initialScope,
  editIndex,
  existingScopes = [],
}) => {
  // Target Tier Level to assign
  const [targetLevel, setTargetLevel] = useState<ScopeAnchorTier>("CIRCLE");

  // Cascading IDs
  const [mainCompanyId, setMainCompanyId] = useState<number | "">("");
  const [subCompanyId, setSubCompanyId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [circleId, setCircleId] = useState<number | "">("");
  const [selectedCircleIds, setSelectedCircleIds] = useState<number[]>([]);
  const [domainId, setDomainId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [teamId, setTeamId] = useState<number | "">("");

  // Hierarchy Node Details (Live DB details for Main Company / Sub Company)
  const [companyDetail, setCompanyDetail] = useState<NodeDetail | null>(null);
  const [subCompanyDetail, setSubCompanyDetail] = useState<NodeDetail | null>(null);
  const [loadingHierarchyDetail, setLoadingHierarchyDetail] = useState(false);

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

    setLoading(true);
    // Fetch Main Companies and initial circles in parallel
    Promise.all([
      organizationService.getOptions("MAIN_COMPANY"),
      organizationService.getOptions("CIRCLE"),
    ])
      .then(async ([mcos, allCircles]) => {
        setMainCompanies(mcos);
        setCircles(allCircles);

        if (initialScope) {
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
          setSelectedCircleIds(cId ? [Number(cId)] : []);
          setDomainId(dId);
          setDepartmentId(depId);
          setTeamId(tId);

          // Infer target level from deepest specified node
          if (tId) setTargetLevel("TEAM");
          else if (depId) setTargetLevel("DEPARTMENT");
          else if (dId) setTargetLevel("DOMAIN");
          else if (cId) setTargetLevel("CIRCLE");
          else if (pId) setTargetLevel("PROJECT");
          else if (scId) setTargetLevel("SUB_COMPANY");
          else if (mcId) setTargetLevel("MAIN_COMPANY");
          else setTargetLevel("CIRCLE");

          // Permissions
          const actions = initialScope.actions || [];
          setCanView(initialScope.can_view ?? (actions.length > 0 ? actions.includes("view") : true));
          setCanManage(initialScope.can_manage ?? actions.includes("manage"));
          setCanCreate(initialScope.can_create ?? actions.includes("create"));
          setCanUpdate(initialScope.can_update ?? actions.includes("update"));
          setCanDelete(initialScope.can_delete ?? actions.includes("delete"));

          // Preload child dropdowns sequentially
          if (mcId) {
            organizationService.getNodeDetail("MAIN_COMPANY", mcId as number).then(setCompanyDetail).catch(() => {});
            const scs = await organizationService.getOptions("SUB_COMPANY", mcId as number);
            setSubCompanies(scs);
          } else {
            setCompanyDetail(null);
          }
          if (scId) {
            organizationService.getNodeDetail("SUB_COMPANY", scId as number).then(setSubCompanyDetail).catch(() => {});
            const projs = await organizationService.getOptions("PROJECT", scId as number);
            setProjects(projs);
          } else {
            setSubCompanyDetail(null);
          }
          if (pId) {
            const circs = await organizationService.getOptions("CIRCLE", pId as number);
            setCircles(circs);
          } else if (scId) {
            const circs = await organizationService.getOptions("CIRCLE", null, { subCompanyId: scId as number });
            setCircles(circs);
          } else if (mcId) {
            const circs = await organizationService.getOptions("CIRCLE", null, { companyId: mcId as number });
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
          // Fresh scope defaults: Circle level
          setTargetLevel("CIRCLE");
          setCompanyDetail(null);
          setSubCompanyDetail(null);

          if (mcos.length === 1) {
            setMainCompanyId(mcos[0].id);
            organizationService.getNodeDetail("MAIN_COMPANY", mcos[0].id).then(setCompanyDetail).catch(() => {});
            const [scs, circs] = await Promise.all([
              organizationService.getOptions("SUB_COMPANY", mcos[0].id),
              organizationService.getOptions("CIRCLE", null, { companyId: mcos[0].id }),
            ]);
            setSubCompanies(scs);
            setCircles(circs);
          } else {
            setMainCompanyId("");
            setSubCompanies([]);
          }
          setSubCompanyId("");
          setProjectId("");
          setCircleId("");
          setSelectedCircleIds([]);
          setDomainId("");
          setDepartmentId("");
          setTeamId("");
          setProjects([]);
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

  // Handle Level Change
  const handleLevelChange = (lvl: ScopeAnchorTier) => {
    setTargetLevel(lvl);
    setErrorMsg(null);
  };

  // Cascading Handlers
  const handleMainCompanyChange = async (val: number | "") => {
    setMainCompanyId(val);
    setSubCompanyId("");
    setProjectId("");
    setCircleId("");
    setSelectedCircleIds([]);
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setSubCompanies([]);
    setProjects([]);
    setDomains([]);
    setDepartments([]);
    setTeams([]);
    setCompanyDetail(null);
    setSubCompanyDetail(null);

    if (val) {
      setLoadingHierarchyDetail(true);
      try {
        const [scs, circs, detail] = await Promise.all([
          organizationService.getOptions("SUB_COMPANY", val),
          organizationService.getOptions("CIRCLE", null, { companyId: val }),
          organizationService.getNodeDetail("MAIN_COMPANY", val),
        ]);
        setSubCompanies(scs);
        setCircles(circs);
        setCompanyDetail(detail);
      } catch (e) {
        console.error("Failed to fetch Main Company hierarchy details:", e);
      } finally {
        setLoadingHierarchyDetail(false);
      }
    } else {
      organizationService.getOptions("CIRCLE").then(setCircles);
    }
  };

  const handleSubCompanyChange = async (val: number | "") => {
    setSubCompanyId(val);
    setProjectId("");
    setCircleId("");
    setSelectedCircleIds([]);
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
    setProjects([]);
    setDomains([]);
    setDepartments([]);
    setTeams([]);
    setSubCompanyDetail(null);

    if (val) {
      setLoadingHierarchyDetail(true);
      try {
        const [projs, circs, detail] = await Promise.all([
          organizationService.getOptions("PROJECT", val),
          organizationService.getOptions("CIRCLE", null, { subCompanyId: val }),
          organizationService.getNodeDetail("SUB_COMPANY", val),
        ]);
        setProjects(projs);
        setCircles(circs);
        setSubCompanyDetail(detail);
      } catch (e) {
        console.error("Failed to fetch Sub Company hierarchy details:", e);
      } finally {
        setLoadingHierarchyDetail(false);
      }
    } else if (mainCompanyId) {
      const circs = await organizationService.getOptions("CIRCLE", null, { companyId: mainCompanyId as number });
      setCircles(circs);
    }
  };

  const handleProjectChange = async (val: number | "") => {
    setProjectId(val);
    setCircleId("");
    setSelectedCircleIds([]);
    setDomainId("");
    setDepartmentId("");
    setTeamId("");
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
    } else if (subCompanyId) {
      const circs = await organizationService.getOptions("CIRCLE", null, { subCompanyId: subCompanyId as number });
      setCircles(circs);
    } else if (mainCompanyId) {
      const circs = await organizationService.getOptions("CIRCLE", null, { companyId: mainCompanyId as number });
      setCircles(circs);
    }
  };

  const handleCircleChange = async (val: number | "") => {
    setCircleId(val);
    if (val) {
      setSelectedCircleIds([val]);
    } else {
      setSelectedCircleIds([]);
    }
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

  const toggleCircleSelection = (cId: number) => {
    setSelectedCircleIds((prev) => {
      const exists = prev.includes(cId);
      const updated = exists ? prev.filter((id) => id !== cId) : [...prev, cId];
      if (updated.length === 1) {
        setCircleId(updated[0]);
      } else if (updated.length === 0) {
        setCircleId("");
      }
      return updated;
    });
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

  // Resolve Names and Paths
  const mcName = mainCompanies.find((o) => o.id === mainCompanyId)?.name || initialScope?.main_company_name;
  const scName = subCompanies.find((o) => o.id === subCompanyId)?.name || initialScope?.sub_company_name;
  const pName = projects.find((o) => o.id === projectId)?.name || initialScope?.project_name;
  const cName = circles.find((o) => o.id === circleId)?.name || initialScope?.circle_name;
  const dName = domains.find((o) => o.id === domainId)?.name || initialScope?.domain_name;
  const depName = departments.find((o) => o.id === departmentId)?.name || initialScope?.department_name;
  const tName = teams.find((o) => o.id === teamId)?.name || initialScope?.team_name || initialScope?.sub_department_name;

  // Build breadcrumb parts
  const breadcrumbParts: string[] = [];
  if (mcName) breadcrumbParts.push(mcName);
  if (scName && ["SUB_COMPANY", "PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) breadcrumbParts.push(scName);
  if (pName && ["PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) breadcrumbParts.push(pName);
  if (cName && ["CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) breadcrumbParts.push(cName);
  if (dName && ["DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) breadcrumbParts.push(dName);
  if (depName && ["DEPARTMENT", "TEAM"].includes(targetLevel)) breadcrumbParts.push(depName);
  if (tName && targetLevel === "TEAM") breadcrumbParts.push(tName);

  let previewBreadcrumb = "";
  if (targetLevel === "CIRCLE" && editIndex === null && selectedCircleIds.length > 1) {
    const prefix: string[] = [];
    if (mcName) prefix.push(mcName);
    if (scName) prefix.push(scName);
    if (pName) prefix.push(pName);
    const selectedNames = circles.filter((c) => selectedCircleIds.includes(c.id)).map((c) => c.name);
    previewBreadcrumb = `${prefix.length > 0 ? prefix.join(" → ") + " → " : ""}[${selectedCircleIds.length} Circles: ${selectedNames.join(", ")}]`;
  } else {
    previewBreadcrumb = breadcrumbParts.join(" → ") || "No organizational node selected yet";
  }

  // Compute unified available circles for active scope (direct + descendants without duplicates)
  const availableCirclesForSelect = React.useMemo<CascadingOption[]>(() => {
    if (subCompanyDetail) {
      const list = [...circles];
      ((subCompanyDetail.hierarchy_summary?.project_circles || []) as CascadingOption[]).forEach((c) => {
        if (!list.some((existing) => existing.id === c.id)) {
          list.push(c);
        }
      });
      return list;
    }
    if (companyDetail) {
      const list = [...circles];
      ((companyDetail.hierarchy_summary?.sub_company_circles || []) as CascadingOption[]).forEach((c) => {
        if (!list.some((existing) => existing.id === c.id)) {
          list.push(c);
        }
      });
      return list;
    }
    return circles;
  }, [circles, companyDetail, subCompanyDetail]);

  // Resolve target node anchor name & coverage note
  let targetAnchorName = "";
  let targetCoverageNote = "";

  if (targetLevel === "MAIN_COMPANY") {
    targetAnchorName = mcName || "Main Company";
    targetCoverageNote = `Grants access to the entire organizational tree under ${mcName || "this Main Company"}.`;
  } else if (targetLevel === "SUB_COMPANY") {
    targetAnchorName = scName || "Sub Company";
    targetCoverageNote = `Grants access to ${scName || "this Sub Company"} and all projects, circles, and departments beneath it. Sibling sub-companies are blocked.`;
  } else if (targetLevel === "PROJECT") {
    targetAnchorName = pName || "Project";
    targetCoverageNote = `Grants access to ${pName || "this Project"} and all child circles and descendants. Sibling projects are blocked.`;
  } else if (targetLevel === "CIRCLE") {
    if (editIndex === null && selectedCircleIds.length > 1) {
      targetAnchorName = `${selectedCircleIds.length} Selected Circles`;
      targetCoverageNote = `Strictly confines data access to the ${selectedCircleIds.length} explicitly assigned Circles (${availableCirclesForSelect.filter((c) => selectedCircleIds.includes(c.id)).map((c) => c.name).join(", ")}) and their permitted descendant domains, departments, and teams. Cross-circle data access to unassigned sibling circles is strictly blocked across all dashboards, charts, and queries.`;
    } else {
      targetAnchorName = cName || "Circle";
      targetCoverageNote = `Strictly confines data access to ${cName || "this Circle"} and its descendant domains, departments, and teams. Cross-circle access to sibling circles (e.g. unassigned circles) is blocked across all dashboards, charts, and queries.`;
    }
  } else if (targetLevel === "DOMAIN") {
    targetAnchorName = dName || "Domain";
    targetCoverageNote = `Confines access to ${dName || "this Domain"} and child departments.`;
  } else if (targetLevel === "DEPARTMENT") {
    targetAnchorName = depName || "Department";
    targetCoverageNote = `Confines access to ${depName || "this Department"} and child teams.`;
  } else if (targetLevel === "TEAM") {
    targetAnchorName = tName || "Team";
    targetCoverageNote = `Confines access strictly to ${tName || "this Team"}.`;
  }

  // Save Scope Handler
  const handleSave = () => {
    setErrorMsg(null);

    // Validation based on target level
    if (targetLevel === "MAIN_COMPANY" && !mainCompanyId) {
      setErrorMsg("Please select a Main Company to assign this scope.");
      return;
    }
    if (targetLevel === "SUB_COMPANY" && !subCompanyId) {
      setErrorMsg("Please select a Sub Company to assign this scope.");
      return;
    }
    if (targetLevel === "PROJECT" && !projectId) {
      setErrorMsg("Please select a Project to assign this scope.");
      return;
    }
    if (targetLevel === "CIRCLE") {
      const activeIds = selectedCircleIds.length > 0 ? selectedCircleIds : (circleId ? [Number(circleId)] : []);
      if (activeIds.length === 0) {
        setErrorMsg("Please select at least one Circle (e.g. Odisha Circle) to assign this scope.");
        return;
      }
    }
    if (targetLevel === "DOMAIN" && !domainId) {
      setErrorMsg("Please select a Domain to assign this scope.");
      return;
    }
    if (targetLevel === "DEPARTMENT" && !departmentId) {
      setErrorMsg("Please select a Department to assign this scope.");
      return;
    }
    if (targetLevel === "TEAM" && !teamId) {
      setErrorMsg("Please select a Team / Sub-Department to assign this scope.");
      return;
    }

    if (!canView && !canManage && !canCreate && !canUpdate && !canDelete) {
      setErrorMsg("Please grant at least one permission (e.g. View) for this scope.");
      return;
    }

    const actions: string[] = [];
    if (canView) actions.push("view");
    if (canManage) actions.push("manage");
    if (canCreate) actions.push("create");
    if (canUpdate) actions.push("update");
    if (canDelete) actions.push("delete");

    const effMainId = mainCompanyId ? Number(mainCompanyId) : null;
    const effSubId = ["SUB_COMPANY", "PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && subCompanyId ? Number(subCompanyId) : null;
    const effPrjId = ["PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && projectId ? Number(projectId) : null;
    const effDomId = ["DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && domainId ? Number(domainId) : null;
    const effDepId = ["DEPARTMENT", "TEAM"].includes(targetLevel) && departmentId ? Number(departmentId) : null;
    const effTeamId = targetLevel === "TEAM" && teamId ? Number(teamId) : null;

    // Multi-Circle Scope Creation (when targetLevel === "CIRCLE" and creating new scopes)
    if (targetLevel === "CIRCLE" && editIndex === null) {
      const activeIds = selectedCircleIds.length > 0 ? selectedCircleIds : (circleId ? [Number(circleId)] : []);

      const newScopes: OrganizationScopeItem[] = activeIds.map((cId) => {
        const matchedCir = availableCirclesForSelect.find((c) => c.id === cId) || circles.find((c) => c.id === cId);
        const circleName = matchedCir?.name || `Circle #${cId}`;
        const effCirSubId = matchedCir?.sub_company_id || effSubId;
        const effCirSubName = matchedCir?.sub_company_name || scName;
        const effCirPrjId = matchedCir?.project_id || effPrjId;
        const effCirPrjName = matchedCir?.project_name || pName;

        const parts: string[] = [];
        if (mcName) parts.push(mcName);
        if (effCirSubName) parts.push(effCirSubName);
        if (effCirPrjName) parts.push(effCirPrjName);
        parts.push(circleName);

        return {
          main_company_id: effMainId,
          main_company_name: mcName,
          sub_company_id: effCirSubId,
          sub_company_name: effCirSubName,
          project_id: effCirPrjId,
          project_name: effCirPrjName,
          circle_id: cId,
          circle_name: circleName,
          domain_id: null,
          domain_name: undefined,
          department_id: null,
          department_name: undefined,
          team_id: null,
          team_name: undefined,
          sub_department_id: null,
          sub_department_name: undefined,
          hierarchy_breadcrumb: parts.join(" → "),
          can_view: canView,
          can_manage: canManage,
          can_create: canCreate,
          can_update: canUpdate,
          can_delete: canDelete,
          actions,
        };
      });

      // Filter out scopes for circles already assigned to user
      const existingCircleIds = new Set(
        existingScopes
          .filter((s) => s.circle_id && !s.domain_id && !s.department_id && !s.team_id)
          .map((s) => s.circle_id)
      );

      const duplicates = newScopes.filter((s) => s.circle_id && existingCircleIds.has(s.circle_id));
      if (duplicates.length === newScopes.length) {
        setErrorMsg(`All selected Circle${newScopes.length > 1 ? "s are" : " is"} already assigned to this user.`);
        return;
      }

      const nonDuplicates = newScopes.filter((s) => !s.circle_id || !existingCircleIds.has(s.circle_id));
      onSave(nonDuplicates, null);
      onClose();
      return;
    }

    // Single Scope Creation or Update
    const effCirId = ["CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)
      ? (circleId ? Number(circleId) : (selectedCircleIds[0] || null))
      : null;

    // Check duplicate identical scopes
    const isDuplicate = existingScopes.some((s, idx) => {
      if (editIndex !== null && idx === editIndex) return false;
      return (
        (s.main_company_id || null) === effMainId &&
        (s.sub_company_id || null) === effSubId &&
        (s.project_id || null) === effPrjId &&
        (s.circle_id || null) === effCirId &&
        (s.domain_id || null) === effDomId &&
        (s.department_id || null) === effDepId &&
        (s.team_id || s.sub_department_id || null) === effTeamId
      );
    });

    if (isDuplicate) {
      setErrorMsg("An identical organization access scope is already assigned to this user.");
      return;
    }

    const singleCircleName = circles.find((o) => o.id === effCirId)?.name || initialScope?.circle_name || cName;
    const parts: string[] = [];
    if (mcName) parts.push(mcName);
    if (scName && ["SUB_COMPANY", "PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) parts.push(scName);
    if (pName && ["PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) parts.push(pName);
    if (singleCircleName && ["CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) parts.push(singleCircleName);
    if (dName && ["DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel)) parts.push(dName);
    if (depName && ["DEPARTMENT", "TEAM"].includes(targetLevel)) parts.push(depName);
    if (tName && targetLevel === "TEAM") parts.push(tName);

    const savedScope: OrganizationScopeItem = {
      ...(initialScope?.id ? { id: initialScope.id } : {}),
      main_company_id: effMainId,
      main_company_name: mcName,
      sub_company_id: effSubId,
      sub_company_name: scName,
      project_id: effPrjId,
      project_name: pName,
      circle_id: effCirId,
      circle_name: singleCircleName,
      domain_id: effDomId,
      domain_name: dName,
      department_id: effDepId,
      department_name: depName,
      team_id: effTeamId,
      team_name: tName,
      sub_department_id: effTeamId,
      sub_department_name: tName,
      hierarchy_breadcrumb: parts.join(" → "),
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
            Define the precise organization node and permitted data boundary for this user.
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Step 1: Select Hierarchy Level to Assign */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: colorTokens.text.primary }}>
                1. Select Hierarchy Scope Level
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 1.5 }}>
                Choose the boundary level at which this user operates. Hierarchy inheritance cascades downward strictly.
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {[
                  { id: "CIRCLE", label: "Circle (Multi-Select Allowed)", desc: "e.g. Odisha Circle, Rajasthan Circle" },
                  { id: "MAIN_COMPANY", label: "Main Company", desc: "Whole organization" },
                  { id: "SUB_COMPANY", label: "Sub Company", desc: "e.g. Telecom Infra" },
                  { id: "PROJECT", label: "Project", desc: "e.g. 4G Expansion" },
                  { id: "DOMAIN", label: "Domain", desc: "Operations / Finance" },
                  { id: "DEPARTMENT", label: "Department", desc: "RF Optimization" },
                  { id: "TEAM", label: "Team", desc: "Field Team" },
                ].map((tier) => (
                  <Chip
                    key={tier.id}
                    label={tier.label}
                    onClick={() => handleLevelChange(tier.id as ScopeAnchorTier)}
                    color={targetLevel === tier.id ? "primary" : "default"}
                    variant={targetLevel === tier.id ? "filled" : "outlined"}
                    sx={{
                      fontWeight: targetLevel === tier.id ? 800 : 500,
                      borderRadius: radiusTokens.sm,
                      px: 1,
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Step 2: Cascading Node Pickers based on Level */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: colorTokens.text.primary }}>
                2. Select Organization Node ({targetLevel.replace("_", " ")})
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
                {/* Main Company (Always available as root filter) */}
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Main Company"
                  value={mainCompanyId}
                  onChange={(e) => handleMainCompanyChange(e.target.value ? Number(e.target.value) : "")}
                >
                  <MenuItem value="">
                    <em>-- Select Main Company --</em>
                  </MenuItem>
                  {mainCompanies.map((mc) => (
                    <MenuItem key={mc.id} value={mc.id}>
                      {mc.name} ({mc.code})
                    </MenuItem>
                  ))}
                </TextField>

                {/* Sub Company (If level is SUB_COMPANY or deeper) */}
                {["SUB_COMPANY", "PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Sub Company"
                    value={subCompanyId}
                    disabled={!mainCompanyId && subCompanies.length === 0}
                    onChange={(e) => handleSubCompanyChange(e.target.value ? Number(e.target.value) : "")}
                  >
                    <MenuItem value="">
                      <em>-- All Sub Companies / Direct --</em>
                    </MenuItem>
                    {subCompanies.map((sc) => (
                      <MenuItem key={sc.id} value={sc.id}>
                        {sc.name} ({sc.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Project (If level is PROJECT or deeper) */}
                {["PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Project"
                    value={projectId}
                    disabled={projects.length === 0}
                    onChange={(e) => handleProjectChange(e.target.value ? Number(e.target.value) : "")}
                  >
                    <MenuItem value="">
                      <em>-- All Projects / Direct --</em>
                    </MenuItem>
                    {projects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Domain (If level is DOMAIN or deeper) */}
                {["DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && (
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
                      <em>-- Select Functional Domain --</em>
                    </MenuItem>
                    {domains.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Department (If level is DEPARTMENT or deeper) */}
                {["DEPARTMENT", "TEAM"].includes(targetLevel) && (
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
                      <em>-- Select Department --</em>
                    </MenuItem>
                    {departments.map((dep) => (
                      <MenuItem key={dep.id} value={dep.id}>
                        {dep.name} ({dep.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Team (If level is TEAM) */}
                {targetLevel === "TEAM" && (
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
                      <em>-- Select Team --</em>
                    </MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>

              {/* DYNAMIC HIERARCHY DETAILS PANEL (For Selected Main Company or Sub Company) */}
              {mainCompanyId && (companyDetail || subCompanyDetail) && (
                <Box
                  sx={{
                    mb: 2.5,
                    p: 2,
                    borderRadius: radiusTokens.sm,
                    bgcolor: "#F8FAFC",
                    border: `1px solid ${colorTokens.workspace.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  {/* Header & Badges */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {subCompanyDetail ? (
                        <BusinessOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
                      ) : (
                        <CorporateFareOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
                      )}
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                        {subCompanyDetail
                          ? `${subCompanyDetail.name} (${subCompanyDetail.code})`
                          : `${companyDetail?.name} (${companyDetail?.code})`}
                      </Typography>
                      <Chip
                        size="small"
                        label={subCompanyDetail ? "Sub Company Hierarchy" : "Main Company Hierarchy"}
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          bgcolor: colorTokens.primary.lighter,
                          color: colorTokens.primary.main,
                        }}
                      />
                    </Box>

                    {/* Hierarchy Counts */}
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                      {subCompanyDetail && (
                        <Button
                          size="small"
                          startIcon={<ArrowBackIcon sx={{ fontSize: 13 }} />}
                          onClick={() => handleSubCompanyChange("")}
                          sx={{ height: 22, fontSize: "0.7rem", textTransform: "none", py: 0, px: 1, borderRadius: radiusTokens.xs }}
                        >
                          Back to {companyDetail?.name || "Main Company"}
                        </Button>
                      )}
                      {!subCompanyDetail && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${companyDetail?.hierarchy_summary?.sub_companies_count ?? subCompanies.length} Sub Companies`}
                          sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                        />
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${subCompanyDetail ? (subCompanyDetail.hierarchy_summary?.projects_count ?? projects.length) : (companyDetail?.hierarchy_summary?.projects_count ?? projects.length)} Projects`}
                        sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${subCompanyDetail ? (subCompanyDetail.hierarchy_summary?.direct_circles_count ?? 0) : (companyDetail?.hierarchy_summary?.direct_circles_count ?? circles.length)} Direct Circles`}
                        sx={{
                          height: 22,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: colorTokens.primary.main,
                          borderColor: colorTokens.primary.lighter,
                        }}
                      />
                      {!subCompanyDetail && Boolean(companyDetail?.hierarchy_summary?.sub_company_circles_count) && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${companyDetail?.hierarchy_summary?.sub_company_circles_count} Sub Company Circles`}
                          sx={{
                            height: 22,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#6366F1",
                            borderColor: "#C7D2FE",
                          }}
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Sub Company breakdown if Main Company selected */}
                  {!subCompanyDetail && subCompanies.length > 0 && (
                    <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: radiusTokens.xs, border: "1px solid #E2E8F0" }}>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 0.75 }}>
                        Configured Sub Companies under {companyDetail?.name}:
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {subCompanies.map((sc) => {
                          const summaryItem = companyDetail?.hierarchy_summary?.sub_companies?.find((s: any) => s.id === sc.id);
                          const scProjects = summaryItem?.projects_count ?? 0;
                          const scCircles = summaryItem?.circles_count ?? 0;
                          return (
                            <Chip
                              key={sc.id}
                              size="small"
                              label={`${sc.name} (${sc.code}) • ${scProjects} Proj • ${scCircles} Circles`}
                              onClick={() => handleSubCompanyChange(sc.id)}
                              color={subCompanyId === sc.id ? "primary" : "default"}
                              variant={subCompanyId === sc.id ? "filled" : "outlined"}
                              sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                fontWeight: 600,
                                borderColor: "#CBD5E1",
                                "&:hover": { bgcolor: colorTokens.primary.lighter },
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* Configured Projects if Sub Company selected */}
                  {subCompanyDetail && projects.length > 0 && (
                    <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: radiusTokens.xs, border: "1px solid #E2E8F0" }}>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 0.75 }}>
                        Configured Projects under {subCompanyDetail.name}:
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {projects.map((p) => {
                          const isSel = projectId === p.id;
                          return (
                            <Chip
                              key={p.id}
                              size="small"
                              label={`${p.name} (${p.code})`}
                              onClick={() => handleProjectChange(isSel ? "" : p.id)}
                              color={isSel ? "primary" : "default"}
                              variant={isSel ? "filled" : "outlined"}
                              sx={{ height: 26, fontSize: "0.72rem", cursor: "pointer", fontWeight: 600 }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* Section: Direct Circles belonging strictly to this node */}
                  <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: radiusTokens.xs, border: "1px solid #E2E8F0" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75, flexWrap: "wrap", gap: 1 }}>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                        <span>Direct Circles in {subCompanyDetail ? subCompanyDetail.name : companyDetail?.name} ({subCompanyDetail ? (subCompanyDetail.hierarchy_summary?.direct_circles_count ?? 0) : circles.length}):</span>
                        <Chip
                          size="small"
                          label={`Direct Parent = ${subCompanyDetail ? subCompanyDetail.code : companyDetail?.code}`}
                          sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#ECFDF5", color: "#059669" }}
                        />
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      {(!subCompanyDetail && circles.length === 0) || (subCompanyDetail && (subCompanyDetail.hierarchy_summary?.direct_circles?.length || 0) === 0) ? (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontStyle: "italic" }}>
                          No operational circles configured directly under this {subCompanyDetail ? "Sub Company" : "Main Company"}.
                        </Typography>
                      ) : (
                        (subCompanyDetail ? (subCompanyDetail.hierarchy_summary?.direct_circles || []) : circles).map((cir: any) => {
                          const isSelected = selectedCircleIds.includes(cir.id) || circleId === cir.id;
                          return (
                            <Chip
                              key={cir.id}
                              size="small"
                              label={`${cir.name} (${cir.code})`}
                              color={isSelected ? "primary" : "default"}
                              variant={isSelected ? "filled" : "outlined"}
                              onClick={() => {
                                if (targetLevel === "CIRCLE" && editIndex === null) {
                                  toggleCircleSelection(cir.id);
                                } else {
                                  handleCircleChange(cir.id);
                                }
                              }}
                              sx={{
                                height: 24,
                                fontSize: "0.72rem",
                                fontWeight: isSelected ? 700 : 500,
                                cursor: "pointer",
                              }}
                            />
                          );
                        })
                      )}
                    </Box>
                  </Box>

                  {/* Section: Sub Company & Project Circles (Separated from Direct Main Company Circles) */}
                  {!subCompanyDetail && companyDetail?.hierarchy_summary?.sub_company_circles && companyDetail.hierarchy_summary.sub_company_circles.length > 0 && (
                    <Box sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: radiusTokens.xs, border: "1px dashed #CBD5E1" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "#334155", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                          <span>Sub Company & Project Circles ({companyDetail.hierarchy_summary.sub_company_circles.length}):</span>
                          <Chip
                            size="small"
                            label="Separated from Direct Main Company Circles"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#EEF2FF", color: "#4F46E5" }}
                          />
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem" }}>
                          Belongs to Sub Companies / Projects
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {companyDetail.hierarchy_summary.sub_company_circles.map((scCir: any) => {
                          const isSelected = selectedCircleIds.includes(scCir.id) || circleId === scCir.id;
                          return (
                            <Tooltip
                              key={scCir.id}
                              title={`Belongs to Sub Company: ${scCir.sub_company_name || "Sub Company"}${scCir.project_name ? ` → Project: ${scCir.project_name}` : ""}. Click to select.`}
                            >
                              <Chip
                                size="small"
                                label={`${scCir.name} (${scCir.code}) • ${scCir.sub_company_name}${scCir.project_name ? ` / ${scCir.project_name}` : ""}`}
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                onClick={() => {
                                  if (targetLevel === "CIRCLE" && editIndex === null) {
                                    toggleCircleSelection(scCir.id);
                                  } else {
                                    if (scCir.sub_company_id && subCompanyId !== scCir.sub_company_id) {
                                      handleSubCompanyChange(scCir.sub_company_id);
                                    }
                                    handleCircleChange(scCir.id);
                                  }
                                }}
                                sx={{
                                  height: 24,
                                  fontSize: "0.72rem",
                                  fontWeight: isSelected ? 700 : 500,
                                  borderColor: "#CBD5E1",
                                  cursor: "pointer",
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* Section: Project Circles under Sub Company if Sub Company selected */}
                  {subCompanyDetail && subCompanyDetail.hierarchy_summary?.project_circles && subCompanyDetail.hierarchy_summary.project_circles.length > 0 && (
                    <Box sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: radiusTokens.xs, border: "1px dashed #CBD5E1" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "#334155", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                          <span>Project-Level Circles under {subCompanyDetail.name} ({subCompanyDetail.hierarchy_summary.project_circles.length}):</span>
                          <Chip
                            size="small"
                            label="Project Circles"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#EEF2FF", color: "#4F46E5" }}
                          />
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {subCompanyDetail.hierarchy_summary.project_circles.map((pCir: any) => {
                          const isSelected = selectedCircleIds.includes(pCir.id) || circleId === pCir.id;
                          return (
                            <Tooltip
                              key={pCir.id}
                              title={`Project: ${pCir.project_name || "Project"}. Click to select circle.`}
                            >
                              <Chip
                                size="small"
                                label={`${pCir.name} (${pCir.code})${pCir.project_name ? ` • ${pCir.project_name}` : ""}`}
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                onClick={() => {
                                  if (targetLevel === "CIRCLE" && editIndex === null) {
                                    toggleCircleSelection(pCir.id);
                                  } else {
                                    if (pCir.project_id && projectId !== pCir.project_id) {
                                      handleProjectChange(pCir.project_id);
                                    }
                                    handleCircleChange(pCir.id);
                                  }
                                }}
                                sx={{
                                  height: 24,
                                  fontSize: "0.72rem",
                                  fontWeight: isSelected ? 700 : 500,
                                  borderColor: "#CBD5E1",
                                  cursor: "pointer",
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem" }}>
                    ✓ Dynamic organization hierarchy loaded from parent-child relationships in database. Selecting this company shows strictly its related organization nodes.
                  </Typography>
                </Box>
              )}

              {/* OPERATIONAL CIRCLE PICKER */}
              {targetLevel === "CIRCLE" && editIndex === null ? (
                /* Multi-Select Autocomplete for assigning Multiple Circles to a Single User */
                <Box sx={{ p: 2, bgcolor: "#F8FAFC", borderRadius: radiusTokens.sm, border: `1.5px dashed ${colorTokens.primary.lighter}` }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                        Assign Multiple Circles
                      </Typography>
                      <Chip
                        size="small"
                        color="primary"
                        label={`${selectedCircleIds.length} Selected`}
                        sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800 }}
                      />
                    </Box>

                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedCircleIds(availableCirclesForSelect.map((c) => c.id))}
                        disabled={availableCirclesForSelect.length === 0 || selectedCircleIds.length === availableCirclesForSelect.length}
                        sx={{ fontSize: "0.75rem", textTransform: "none", py: 0.25, px: 1, borderRadius: radiusTokens.xs }}
                      >
                        Select All ({availableCirclesForSelect.length})
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setSelectedCircleIds([])}
                        disabled={selectedCircleIds.length === 0}
                        color="inherit"
                        sx={{ fontSize: "0.75rem", textTransform: "none", py: 0.25, px: 1 }}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>

                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    size="small"
                    options={availableCirclesForSelect}
                    groupBy={(option) => {
                      if (option.is_direct) {
                        return `Direct Circles — ${companyDetail?.name || subCompanyDetail?.name || "Main Company"}`;
                      }
                      if (option.sub_company_name) {
                        return `Sub Company Circles — ${option.sub_company_name}${option.project_name ? ` (${option.project_name})` : ""}`;
                      }
                      if (option.project_name) {
                        return `Project Circles — ${option.project_name}`;
                      }
                      return "Operational Circles";
                    }}
                    value={availableCirclesForSelect.filter((c) => selectedCircleIds.includes(c.id))}
                    getOptionLabel={(option) => `${option.name} (${option.code})${option.region ? ` — ${option.region}` : ""}`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_, newValue) => {
                      setSelectedCircleIds(newValue.map((v) => v.id));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Operational Circles (Multi-Select)"
                        placeholder={selectedCircleIds.length === 0 ? "Select or search multiple Circles to assign..." : ""}
                        helperText="Assign one or more Circles. Each circle is saved as an individual access scope with strict cross-branch data isolation."
                      />
                    )}
                    renderOption={(props, option, { selected }) => (
                      <Box component="li" {...props} key={option.id}>
                        <Checkbox
                          size="small"
                          icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                          checkedIcon={<CheckBoxIcon fontSize="small" />}
                          checked={selected}
                          sx={{ mr: 1 }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {option.name} ({option.code})
                            </Typography>
                            {option.is_direct && (
                              <Chip size="small" label="Direct" sx={{ height: 16, fontSize: "0.6rem", bgcolor: "#ECFDF5", color: "#059669", fontWeight: 700 }} />
                            )}
                            {!option.is_direct && option.sub_company_name && (
                              <Chip size="small" label={option.sub_company_name} sx={{ height: 16, fontSize: "0.6rem", bgcolor: "#EEF2FF", color: "#4F46E5", fontWeight: 700 }} />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                            {option.region ? `Region: ${option.region} • ` : ""}{option.project_name ? `Project: ${option.project_name}` : option.sub_company_name ? `Sub Company: ${option.sub_company_name}` : "Direct Circle"}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option.id}
                          size="small"
                          label={`${option.name} (${option.code})`}
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 600, height: 24 }}
                        />
                      ))
                    }
                  />
                </Box>
              ) : (
                /* Single Circle Selection (when editing an existing scope or choosing parent circle for domain/dept/team) */
                ["CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"].includes(targetLevel) && (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Operational Circle"
                    value={circleId}
                    onChange={(e) => handleCircleChange(e.target.value ? Number(e.target.value) : "")}
                    helperText={targetLevel === "CIRCLE" ? "Select Circle to assign to this scope" : "Select parent Operational Circle"}
                    sx={{ mb: 2 }}
                  >
                    <MenuItem value="">
                      <em>-- Select Operational Circle --</em>
                    </MenuItem>
                    {circles.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name} ({c.code}){c.region ? ` — ${c.region}` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                )
              )}
            </Box>

            {/* Step 3: Real-Time Preview & Boundary Coverage */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#F8FAFC",
                borderRadius: radiusTokens.sm,
                border: `1.5px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 0.5, fontWeight: 700, textTransform: "uppercase" }}>
                Resolved Scope Hierarchy Path:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.primary.main, mb: 1 }}>
                {previewBreadcrumb}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.25, bgcolor: "#ECFDF5", borderRadius: radiusTokens.xs, border: "1px solid #A7F3D0" }}>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: "#047857", mt: 0.1, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: "#065F46", lineHeight: 1.4, fontWeight: 500 }}>
                  <strong>Boundary Rule:</strong> {targetCoverageNote}
                </Typography>
              </Box>
            </Box>

            {/* Step 4: Action Permissions */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: colorTokens.text.primary }}>
                3. Permitted Actions in this Scope
              </Typography>
              <FormGroup row sx={{ gap: 3 }}>
                <FormControlLabel
                  control={<Checkbox checked={canView} onChange={(e) => setCanView(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>View Data</Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>Read dashboard, charts, tables, and task details</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={<Checkbox checked={canManage} onChange={(e) => handleManageToggle(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Manage & Edit</Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>Create, update, and close records within this scope</Typography>
                    </Box>
                  }
                />
              </FormGroup>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: radiusTokens.sm }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            borderRadius: radiusTokens.sm,
            fontWeight: 700,
            bgcolor: colorTokens.primary.main,
            "&:hover": { bgcolor: colorTokens.primary.dark },
          }}
        >
          {editIndex !== null
            ? "Update Scope"
            : targetLevel === "CIRCLE" && selectedCircleIds.length > 1
            ? `Assign ${selectedCircleIds.length} Circles`
            : "Assign Scope"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
