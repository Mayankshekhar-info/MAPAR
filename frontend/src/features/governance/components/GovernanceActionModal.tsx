import React, { useEffect, useState, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ClearIcon from "@mui/icons-material/Clear";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  GovernanceActionPoint,
  GovernanceMetadata,
  CreateActionPayload,
  UpdateActionPayload,
  SimpleUser,
} from "../types/governance.types";
import { useHierarchyUsers } from "../hooks/useGovernance";

interface GovernanceActionModalProps {
  open: boolean;
  action?: GovernanceActionPoint | null;
  metadata?: GovernanceMetadata;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateActionPayload | UpdateActionPayload) => Promise<void>;
  onRequireEvidence?: (action: GovernanceActionPoint) => void;
}

export const GovernanceActionModal: React.FC<GovernanceActionModalProps> = ({
  open,
  action,
  metadata,
  isLoading,
  onClose,
  onSubmit,
  onRequireEvidence,
}) => {
  const isEdit = Boolean(action);

  // Hierarchy level state
  const [hierarchyLevel, setHierarchyLevel] = useState<string>("CIRCLE");
  const [circleId, setCircleId] = useState<number | "">("");
  const [functionArea, setFunctionArea] = useState<string>("Operations");
  const [bucket, setBucket] = useState<string>("");
  const [actionPoint, setActionPoint] = useState<string>("");
  const [keyDeliverable, setKeyDeliverable] = useState<string>("");
  const [ownerId, setOwnerId] = useState<number | "">("");
  const [selectedUser, setSelectedUser] = useState<SimpleUser | null>(null);
  const [ownerInputText, setOwnerInputText] = useState<string>("");
  const [raisedDate, setRaisedDate] = useState<string>("");
  const [targetClosureDate, setTargetClosureDate] = useState<string>("");
  const [status, setStatus] = useState<"Open" | "WIP" | "Closed">("Open");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [actualClosureDate, setActualClosureDate] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch users dynamically based on hierarchy node
  const { data: scopedUsers } = useHierarchyUsers(
    hierarchyLevel,
    circleId ? Number(circleId) : null
  );

  // Combine and deduplicate users across metadata and scopedUsers
  const allAvailableUsers = useMemo(() => {
    const userMap = new Map<number, SimpleUser>();
    (metadata?.users || []).forEach((u) => userMap.set(u.id, u));
    (scopedUsers || []).forEach((u) => userMap.set(u.id, u));
    return Array.from(userMap.values());
  }, [metadata?.users, scopedUsers]);

  // Client-side identity resolution helper
  const resolveUserFromText = (text: string): { user: SimpleUser | null; isAmbiguous: boolean } => {
    const clean = text.trim();
    if (!clean) return { user: null, isAmbiguous: false };

    // 1. Exact numeric ID (#10 or 10)
    const numId = Number(clean.replace(/^#/, ""));
    if (!isNaN(numId) && numId > 0) {
      const match = allAvailableUsers.find((u) => u.id === numId);
      if (match) return { user: match, isAmbiguous: false };
    }

    // 2. Exact email (case-insensitive)
    const cleanEmail = clean.toLowerCase();
    const emailMatches = allAvailableUsers.filter(
      (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
    );
    if (emailMatches.length === 1) return { user: emailMatches[0], isAmbiguous: false };

    // 3. Exact username (case-insensitive)
    const cleanUsername = clean.toLowerCase().replace(/^@/, "");
    const usernameMatches = allAvailableUsers.filter(
      (u) => u.username && u.username.trim().toLowerCase() === cleanUsername
    );
    if (usernameMatches.length === 1) return { user: usernameMatches[0], isAmbiguous: false };

    // 4. Exact full name
    const nameMatches = allAvailableUsers.filter(
      (u) => u.full_name && u.full_name.trim().toLowerCase() === clean.toLowerCase()
    );
    if (nameMatches.length === 1) return { user: nameMatches[0], isAmbiguous: false };

    // 5. Partial matches across id, email, username, full_name
    const partials = allAvailableUsers.filter((u) => {
      const q = clean.toLowerCase();
      return (
        String(u.id) === q ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.full_name && u.full_name.toLowerCase().includes(q))
      );
    });

    if (partials.length === 1) {
      return { user: partials[0], isAmbiguous: false };
    }
    if (partials.length > 1) {
      return { user: null, isAmbiguous: true };
    }

    return { user: null, isAmbiguous: false };
  };

  useEffect(() => {
    if (action) {
      setHierarchyLevel(action.hierarchy_level || "CIRCLE");
      setCircleId(action.circle?.id || "");
      setFunctionArea(action.function_area || "Operations");
      setBucket(action.bucket || "");
      setActionPoint(action.action_point || "");
      setKeyDeliverable(action.key_deliverable || "");
      if (action.owner) {
        setSelectedUser(action.owner);
        setOwnerId(action.owner.id);
      } else {
        setSelectedUser(null);
        setOwnerId("");
      }
      setOwnerInputText("");
      setRaisedDate(action.raised_date || "");
      setTargetClosureDate(action.current_target_date || action.target_closure_date || "");
      setStatus(action.status);
      setPriority(action.priority);
      setActualClosureDate(action.actual_closure_date || "");
      setLastUpdate(action.last_update || "");
    } else {
      setHierarchyLevel("CIRCLE");
      setCircleId(metadata?.circles[0]?.id || "");
      setFunctionArea("Operations");
      setBucket("");
      setActionPoint("");
      setKeyDeliverable("");
      setSelectedUser(null);
      setOwnerId("");
      setOwnerInputText("");
      const today = new Date().toISOString().split("T")[0];
      setRaisedDate(today);
      const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      setTargetClosureDate(twoWeeksLater);
      setStatus("Open");
      setPriority("Medium");
      setActualClosureDate("");
      setLastUpdate("");
    }
    setErrorMsg(null);
  }, [action, open, metadata]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!circleId) {
      setErrorMsg("Please select an organization Circle.");
      return;
    }
    if (!actionPoint.trim()) {
      setErrorMsg("Action Point / Task Title is required.");
      return;
    }
    if (!isEdit && !targetClosureDate) {
      setErrorMsg("Target Closure Date is required.");
      return;
    }

    // Resolve owner identity
    let finalOwnerId: number | null = null;
    if (selectedUser) {
      finalOwnerId = selectedUser.id;
    } else if (ownerInputText.trim()) {
      const resolution = resolveUserFromText(ownerInputText);
      if (resolution.user) {
        finalOwnerId = resolution.user.id;
      } else if (resolution.isAmbiguous) {
        setErrorMsg(
          `Multiple users match "${ownerInputText}". Please click and select the exact user from the dropdown list.`
        );
        return;
      } else {
        setErrorMsg(
          `User "${ownerInputText}" was not found. Please enter a valid User ID, username, or registered email.`
        );
        return;
      }
    }

    const selectedCircle = metadata?.circles.find((c) => c.id === Number(circleId));
    const pathStr = selectedCircle?.name || "";
    if (isEdit && action && status === "Closed" && action.evidence_required && action.evidence_status !== "Accepted") {
      if (onRequireEvidence) {
        onRequireEvidence(action);
        onClose();
        return;
      }
    }

    try {
      if (isEdit) {
        await onSubmit({
          circle_id: Number(circleId),
          hierarchy_level: hierarchyLevel,
          hierarchy_node_id: Number(circleId),
          hierarchy_path: pathStr,
          function_area: functionArea,
          bucket: bucket.trim(),
          action_point: actionPoint.trim(),
          key_deliverable: keyDeliverable.trim(),
          owner_id: finalOwnerId,
          raised_date: raisedDate,
          status,
          priority,
          actual_closure_date: status === "Closed" ? (actualClosureDate || new Date().toISOString().split("T")[0]) : null,
          last_update: lastUpdate.trim(),
        });
      } else {
        await onSubmit({
          circle_id: Number(circleId),
          hierarchy_level: hierarchyLevel,
          hierarchy_node_id: Number(circleId),
          hierarchy_path: pathStr,
          function_area: functionArea,
          bucket: bucket.trim(),
          action_point: actionPoint.trim(),
          key_deliverable: keyDeliverable.trim(),
          owner_id: finalOwnerId,
          raised_date: raisedDate,
          target_closure_date: targetClosureDate,
          status,
          priority,
          actual_closure_date: status === "Closed" ? actualClosureDate : null,
          last_update: lastUpdate.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      const respError = err?.response?.data?.errors;
      if (typeof respError === "string") {
        setErrorMsg(respError);
      } else if (typeof respError === "object") {
        setErrorMsg(Object.values(respError).flat().join(" "));
      } else {
        setErrorMsg(err?.message || "Failed to save action point.");
      }
    }
  };

  const hierarchyLevels = metadata?.hierarchy_levels || [
    { code: "MAIN_COMPANY", label: "Main Company" },
    { code: "SUB_COMPANY", label: "Sub Company" },
    { code: "PROJECT", label: "Project" },
    { code: "CIRCLE", label: "Circle" },
    { code: "DOMAIN", label: "Domain" },
    { code: "DEPARTMENT", label: "Department" },
    { code: "SUB_DEPARTMENT", label: "Sub Department" },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AccountTreeIcon sx={{ color: colorTokens.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            {isEdit ? `Edit Task — ${action?.action_id}` : "Create Governance & Action Task"}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
          Assign governance tasks across any permitted organization hierarchy tier
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* Section 1: Dynamic Organization Hierarchy Scope */}
          <Box sx={{ p: 2, borderRadius: radiusTokens.sm, backgroundColor: colorTokens.workspace.background, border: `1px solid ${colorTokens.workspace.border}` }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, textTransform: "uppercase", display: "block", mb: 1.5 }}>
              Organization Scope & Eligible Assignment
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="hierarchy-level-label">Hierarchy Tier</InputLabel>
                <Select
                  labelId="hierarchy-level-label"
                  label="Hierarchy Tier"
                  value={hierarchyLevel}
                  onChange={(e) => setHierarchyLevel(e.target.value)}
                >
                  {hierarchyLevels.map((lvl) => (
                    <MenuItem key={lvl.code} value={lvl.code}>
                      {lvl.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth required>
                <InputLabel id="circle-label">Circle / Operational Node</InputLabel>
                <Select
                  labelId="circle-label"
                  label="Circle / Operational Node"
                  value={circleId}
                  onChange={(e) => setCircleId(e.target.value as number)}
                >
                  {metadata?.circles.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} ({c.code}) — {c.region}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Dynamic Assigned Owner with Autocomplete & Identity Resolution */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mb: 1 }}>
                Task Assignee / Action Owner
              </Typography>
              <Autocomplete
                size="small"
                options={allAvailableUsers}
                value={selectedUser}
                inputValue={ownerInputText}
                onInputChange={(_, newInputValue) => {
                  setOwnerInputText(newInputValue);
                }}
                onChange={(_, newValue: SimpleUser | null) => {
                  setSelectedUser(newValue);
                  setOwnerId(newValue ? newValue.id : "");
                  if (newValue) {
                    setErrorMsg(null);
                  }
                }}
                getOptionLabel={(option) =>
                  `${option.full_name} (@${option.username}) — ${option.email} [ID: #${option.id}]`
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, state) => {
                  const input = state.inputValue.trim().toLowerCase().replace(/^#/, "");
                  if (!input) return options;
                  return options.filter((u) => {
                    return (
                      String(u.id).includes(input) ||
                      (u.username && u.username.toLowerCase().includes(input)) ||
                      (u.email && u.email.toLowerCase().includes(input)) ||
                      (u.full_name && u.full_name.toLowerCase().includes(input)) ||
                      (u.role && u.role.toLowerCase().includes(input))
                    );
                  });
                }}
                renderOption={(props, option) => {
                  const isScoped = scopedUsers?.some((su) => su.id === option.id);
                  return (
                    <Box
                      component="li"
                      {...props}
                      key={option.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1,
                        px: 1.5,
                        borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
                        "&:hover": { backgroundColor: "#F0F9FF" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            backgroundColor: colorTokens.primary.light || "#E0F2FE",
                            color: colorTokens.primary.main,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          {option.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                            {option.full_name}{" "}
                            <Typography component="span" variant="caption" sx={{ color: colorTokens.text.secondary }}>
                              (@{option.username})
                            </Typography>
                          </Typography>
                          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                            {option.email}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {isScoped && (
                          <Chip label="Circle Scoped" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                        )}
                        <Chip label={`ID: #${option.id}`} size="small" variant="filled" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                        <Chip label={option.role} size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Assignee by User ID, Username, or Email"
                    placeholder="Type User ID (e.g. 10), email (e.g. amit.barman@pratap.co.in), or username..."
                    helperText="Enter or select a registered user. Canonical User ID will be linked to the task."
                  />
                )}
              />

              {/* Verified Assigned User Card */}
              {selectedUser ? (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    borderRadius: radiusTokens.sm,
                    backgroundColor: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CheckCircleIcon sx={{ color: "#16A34A", fontSize: 24 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#15803D" }}>
                        Resolved Assignee: {selectedUser.full_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#166534", display: "block" }}>
                        Database ID: <strong>#{selectedUser.id}</strong> &bull; Username: <strong>@{selectedUser.username}</strong> &bull; Email: <strong>{selectedUser.email}</strong> &bull; Role: <strong>{selectedUser.role}</strong>
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    startIcon={<ClearIcon />}
                    onClick={() => {
                      setSelectedUser(null);
                      setOwnerId("");
                    }}
                    sx={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    Unassign
                  </Button>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, mt: 0.5, display: "block" }}>
                  Eligible users can be assigned via their User ID, registered email, or username. Tasks without an owner remain unassigned.
                </Typography>
              )}
            </Box>
          </Box>

          {/* Section 2: Task Details */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="function-area-label">Function / Area</InputLabel>
              <Select
                labelId="function-area-label"
                label="Function / Area"
                value={functionArea}
                onChange={(e) => setFunctionArea(e.target.value)}
              >
                {(metadata?.function_areas || [
                  "Operations",
                  "SCM",
                  "Sales",
                  "Finance",
                  "HR",
                  "IT/Systems",
                  "Compliance/Legal",
                  "Other",
                ]).map((fa) => (
                  <MenuItem key={fa} value={fa}>
                    {fa}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel id="priority-label">Priority</InputLabel>
              <Select
                labelId="priority-label"
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Bucket"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. Audit Finding, Statutory Compliance, Vendor Review..."
            helperText="Classification bucket (distinct from dynamic Ageing duration bucket)"
          />

          <TextField
            label="Task Action Point / Title"
            value={actionPoint}
            onChange={(e) => setActionPoint(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            required
            placeholder="Describe the governance action required..."
          />

          <TextField
            label="Key Deliverable / Expected Outcome"
            value={keyDeliverable}
            onChange={(e) => setKeyDeliverable(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            placeholder="Specify clear tangible deliverables or expected output..."
          />

          {/* Section 3: Dates & Status */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
            <TextField
              label="Raised Date"
              type="date"
              value={raisedDate}
              onChange={(e) => setRaisedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
              required
            />

            {!isEdit && (
              <TextField
                label="Target Closure Date"
                type="date"
                value={targetClosureDate}
                onChange={(e) => setTargetClosureDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
                required
              />
            )}

            <FormControl size="small" fullWidth>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="WIP">WIP</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {isEdit && (
            <TextField
              label="Latest Progress Notes"
              value={lastUpdate}
              onChange={(e) => setLastUpdate(e.target.value)}
              multiline
              rows={2}
              fullWidth
              size="small"
              placeholder="Latest status or progress notes..."
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={isLoading} sx={{ color: colorTokens.text.secondary }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            sx={{
              backgroundColor: colorTokens.primary.main,
              "&:hover": { backgroundColor: colorTokens.primary.dark },
              borderRadius: radiusTokens.sm,
              fontWeight: 600,
            }}
          >
            {isLoading ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
