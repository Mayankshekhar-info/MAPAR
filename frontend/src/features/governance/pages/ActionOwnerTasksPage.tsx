import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import dayjs from "dayjs";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { governanceService } from "../api/governanceService";
import { GovernanceActionPoint } from "../types/governance.types";
import { SendOwnerEmailModal } from "../components/SendOwnerEmailModal";

interface ActionOwnerTasksPageProps {
  mode?: "governance" | "audit" | "documents";
}

export const ActionOwnerTasksPage: React.FC<ActionOwnerTasksPageProps> = ({ mode = "governance" }) => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const nameParam = searchParams.get("name") || "";
  const usernameParam = searchParams.get("username") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<GovernanceActionPoint[]>([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const parsedOwnerId = ownerId && ownerId !== "0" && !isNaN(Number(ownerId)) ? Number(ownerId) : null;

  const fetchOwnerActions = () => {
    setLoading(true);
    setError(null);

    const filterPayload = parsedOwnerId
      ? { owner_id: parsedOwnerId, page_size: 150 }
      : { owner_name: nameParam || undefined, page_size: 150 };

    governanceService
      .getActions(filterPayload)
      .then((res) => {
        setActions(res.results || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || "Failed to load assigned tasks for this action owner.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOwnerActions();
  }, [parsedOwnerId, nameParam]);

  // Derive Owner display info from query params or task records
  const ownerDisplayName = useMemo(() => {
    if (nameParam) return nameParam;
    if (actions.length > 0) {
      const first = actions[0];
      if (first.owner) {
        if (first.owner.full_name) return first.owner.full_name;
        const nameFromParts = `${(first.owner as any).first_name || ""} ${(first.owner as any).last_name || ""}`.trim();
        if (nameFromParts) return nameFromParts;
        if (first.owner.username) return first.owner.username;
      }
      if (first.owner_name_override) return first.owner_name_override;
    }
    return usernameParam ? usernameParam : "Action Owner";
  }, [actions, nameParam, usernameParam]);

  const ownerInitials = useMemo(() => {
    if (!ownerDisplayName) return "AO";
    const parts = ownerDisplayName.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return ownerDisplayName.slice(0, 2).toUpperCase();
  }, [ownerDisplayName]);

  const ownerEmail = useMemo(() => {
    const actWithEmail = actions.find((a) => a.owner?.email);
    return actWithEmail?.owner?.email || "";
  }, [actions]);

  const ownerCircle = useMemo(() => {
    const actWithCircle = actions.find((a) => a.circle?.name);
    return actWithCircle?.circle?.name || "";
  }, [actions]);

  // Handle name clean display
  const ownerHandle = useMemo(() => {
    if (usernameParam && usernameParam.toLowerCase() !== ownerDisplayName.toLowerCase() && !usernameParam.includes(" ")) {
      return `@${usernameParam}`;
    }
    return null;
  }, [usernameParam, ownerDisplayName]);

  // Derived KPI statistics from actual database records
  const kpiStats = useMemo(() => {
    const total = actions.length;
    const open = actions.filter((a) => a.status === "Open").length;
    const wip = actions.filter((a) => a.status === "WIP").length;
    const closed = actions.filter((a) => a.status === "Closed").length;
    const overdue = actions.filter((a) => a.is_overdue && a.status !== "Closed").length;
    const highPri = actions.filter((a) => a.priority === "High" && a.status !== "Closed").length;
    const avgProgress =
      total > 0
        ? Math.round(actions.reduce((acc, curr) => acc + (curr.current_progress_percent || 0), 0) / total)
        : 0;
    const completionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    return { total, open, wip, closed, overdue, highPri, avgProgress, completionRate };
  }, [actions]);

  // Filtered task records
  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "OVERDUE") {
          if (!act.is_overdue || act.status === "Closed") return false;
        } else if (statusFilter === "OPEN_WIP") {
          if (act.status !== "Open" && act.status !== "WIP") return false;
        } else if (act.status !== statusFilter) {
          return false;
        }
      }
      if (priorityFilter !== "ALL" && act.priority !== priorityFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const idMatch = act.action_id.toLowerCase().includes(q);
        const titleMatch = act.action_point.toLowerCase().includes(q);
        const delivMatch = (act.key_deliverable || "").toLowerCase().includes(q);
        const circleMatch = (act.circle?.name || "").toLowerCase().includes(q);
        if (!idMatch && !titleMatch && !delivMatch && !circleMatch) return false;
      }
      return true;
    });
  }, [actions, statusFilter, priorityFilter, searchTerm]);

  const handleRowClick = (actionId: number) => {
    navigate(`/${mode}/tasks/${actionId}`);
  };

  const handleBackToMatrix = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(`/${mode}`);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
      {/* Top Breadcrumb & Action Bar */}
      <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={handleBackToMatrix}
            size="small"
            sx={{
              color: colorTokens.text.secondary,
              fontWeight: 600,
              fontSize: "0.82rem",
              textTransform: "none",
              borderRadius: radiusTokens.sm,
              px: 1.5,
              py: 0.6,
              bgcolor: "#FFFFFF",
              border: `1px solid ${colorTokens.workspace.border}`,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
              "&:hover": {
                bgcolor: colorTokens.workspace.borderSubtle,
                borderColor: colorTokens.primary.light,
                color: colorTokens.primary.main,
              },
            }}
          >
            Back to Action Status Matrix
          </Button>

          <Breadcrumbs
            separator={<NavigateNextIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />}
            sx={{ display: { xs: "none", md: "flex" }, fontSize: "0.82rem" }}
          >
            <Link
              underline="hover"
              color="inherit"
              onClick={handleBackToMatrix}
              sx={{ cursor: "pointer", color: colorTokens.text.secondary }}
            >
              Action Status Matrix
            </Link>
            <Typography sx={{ color: colorTokens.text.primary, fontWeight: 700, fontSize: "0.82rem" }}>
              {ownerDisplayName}
            </Typography>
          </Breadcrumbs>
        </Box>

        <Tooltip title="Refresh Owner Tasks" arrow>
          <IconButton
            size="small"
            onClick={fetchOwnerActions}
            sx={{
              bgcolor: "#FFFFFF",
              border: `1px solid ${colorTokens.workspace.border}`,
              color: colorTokens.text.secondary,
              "&:hover": { bgcolor: colorTokens.workspace.borderSubtle, color: colorTokens.primary.main },
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Owner Profile Banner (Professional Enterprise Surface) */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          mb: 3,
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2.5 }}>
          {/* Left: Avatar & Identity Details */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: "14px",
                bgcolor: "#EFF6FF",
                border: "1.5px solid #BFDBFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colorTokens.primary.main,
                fontWeight: 800,
                fontSize: "1.25rem",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.12)",
                flexShrink: 0,
              }}
            >
              {ownerInitials}
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 0.5 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.02em",
                    fontSize: { xs: "1.2rem", sm: "1.35rem" },
                  }}
                >
                  {ownerDisplayName}
                </Typography>

                <Chip
                  label="Action Owner"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    height: 24,
                    bgcolor: "#F0F9FF",
                    color: "#0369A1",
                    border: "1px solid #BAE6FD",
                  }}
                />

                {ownerCircle && (
                  <Chip
                    icon={<PlaceOutlinedIcon sx={{ fontSize: "14px !important", color: "#64748B !important" }} />}
                    label={ownerCircle}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      height: 24,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      border: "1px solid #E2E8F0",
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                {ownerHandle && (
                  <Typography variant="body2" sx={{ color: colorTokens.primary.main, fontWeight: 600, fontSize: "0.82rem" }}>
                    {ownerHandle}
                  </Typography>
                )}
                {ownerEmail && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <EmailOutlinedIcon sx={{ fontSize: 14, color: colorTokens.text.muted }} />
                    <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.82rem" }}>
                      {ownerEmail}
                    </Typography>
                  </Box>
                )}
                <Typography variant="body2" sx={{ color: colorTokens.text.muted, fontSize: "0.82rem" }}>
                  Assigned Action Items &bull; Governance & Execution Tracking
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right: Key Status Chips */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Chip
              icon={<AssignmentOutlinedIcon sx={{ fontSize: "15px !important", color: "#0284C7 !important" }} />}
              label={`${kpiStats.total} Total Tasks`}
              size="small"
              sx={{
                bgcolor: "#F0F9FF",
                color: "#0369A1",
                fontWeight: 700,
                fontSize: "0.78rem",
                height: 30,
                px: 0.5,
                border: "1px solid #BAE6FD",
              }}
            />

            {kpiStats.overdue > 0 ? (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: "15px !important", color: "#DC2626 !important" }} />}
                label={`${kpiStats.overdue} Overdue`}
                size="small"
                sx={{
                  bgcolor: "#FEF2F2",
                  color: "#DC2626",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  height: 30,
                  px: 0.5,
                  border: "1px solid #FECACA",
                }}
              />
            ) : (
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ fontSize: "15px !important", color: "#16A34A !important" }} />}
                label="Zero Overdue"
                size="small"
                sx={{
                  bgcolor: "#F0FDF4",
                  color: "#16A34A",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  height: 30,
                  px: 0.5,
                  border: "1px solid #BBF7D0",
                }}
              />
            )}

            <Chip
              label={`${kpiStats.avgProgress}% Avg Progress`}
              size="small"
              sx={{
                bgcolor: "#F8FAFC",
                color: "#334155",
                fontWeight: 700,
                fontSize: "0.78rem",
                height: 30,
                px: 0.5,
                border: "1px solid #E2E8F0",
              }}
            />

            <Button
              variant="contained"
              size="small"
              startIcon={<EmailOutlinedIcon sx={{ fontSize: 17 }} />}
              onClick={() => setIsEmailModalOpen(true)}
              sx={{
                bgcolor: colorTokens.primary.main,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.82rem",
                textTransform: "none",
                borderRadius: radiusTokens.sm,
                px: 2,
                py: 0.65,
                boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
                "&:hover": {
                  bgcolor: colorTokens.primary.dark,
                  boxShadow: "0 4px 8px rgba(2, 132, 199, 0.3)",
                },
              }}
            >
              Send Email
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Interactive KPI Cards (Matches GovernanceMetricsBar styling) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        {/* Card 1: Total Tasks */}
        <Card
          elevation={0}
          onClick={() => setStatusFilter("ALL")}
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: "1.5px solid",
            borderColor: statusFilter === "ALL" ? colorTokens.primary.main : "#E2E8F0",
            bgcolor: statusFilter === "ALL" ? "#F0F9FF" : "#FFFFFF",
            boxShadow: statusFilter === "ALL" ? "0 0 0 2px rgba(2, 132, 199, 0.18)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: colorTokens.primary.light,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#64748B", letterSpacing: "0.04em" }}>
              TOTAL TASKS
            </Typography>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colorTokens.primary.main,
              }}
            >
              <AssignmentOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {kpiStats.total}
          </Typography>
          <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.72rem", mt: 0.5, display: "block" }}>
            all authorized circles
          </Typography>
        </Card>

        {/* Card 2: Open / WIP */}
        <Card
          elevation={0}
          onClick={() => setStatusFilter((prev) => (prev === "OPEN_WIP" ? "ALL" : "OPEN_WIP"))}
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: "1.5px solid",
            borderColor: statusFilter === "OPEN_WIP" ? "#0284C7" : "#E2E8F0",
            bgcolor: statusFilter === "OPEN_WIP" ? "#F0F9FF" : "#FFFFFF",
            boxShadow: statusFilter === "OPEN_WIP" ? "0 0 0 2px rgba(2, 132, 199, 0.18)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "#93C5FD",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#0369A1", letterSpacing: "0.04em" }}>
              OPEN / WIP
            </Typography>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: "#F0F9FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0284C7",
              }}
            >
              <PlayCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0284C7", lineHeight: 1.1 }}>
            {kpiStats.open + kpiStats.wip}
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.72rem", mt: 0.5, display: "block" }}>
            {kpiStats.open} open, {kpiStats.wip} in progress
          </Typography>
        </Card>

        {/* Card 3: Overdue */}
        <Card
          elevation={0}
          onClick={() => setStatusFilter((prev) => (prev === "OVERDUE" ? "ALL" : "OVERDUE"))}
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: "1.5px solid",
            borderColor:
              statusFilter === "OVERDUE"
                ? "#DC2626"
                : kpiStats.overdue > 0
                ? "#FECACA"
                : "#E2E8F0",
            bgcolor: statusFilter === "OVERDUE" ? "#FEF2F2" : kpiStats.overdue > 0 ? "#FFFDFD" : "#FFFFFF",
            boxShadow: statusFilter === "OVERDUE" ? "0 0 0 2px rgba(220, 38, 38, 0.18)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "#FCA5A5",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, color: kpiStats.overdue > 0 ? "#DC2626" : "#64748B", letterSpacing: "0.04em" }}
            >
              OVERDUE
            </Typography>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: kpiStats.overdue > 0 ? "#FEE2E2" : "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: kpiStats.overdue > 0 ? "#DC2626" : "#94A3B8",
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: kpiStats.overdue > 0 ? "#DC2626" : "#64748B", lineHeight: 1.1 }}
          >
            {kpiStats.overdue}
          </Typography>
          <Typography variant="caption" sx={{ color: kpiStats.overdue > 0 ? "#DC2626" : "#94A3B8", fontSize: "0.72rem", mt: 0.5, display: "block" }}>
            {kpiStats.overdue > 0 ? "requires urgent action" : "all targets on schedule"}
          </Typography>
        </Card>

        {/* Card 4: Closed */}
        <Card
          elevation={0}
          onClick={() => setStatusFilter((prev) => (prev === "Closed" ? "ALL" : "Closed"))}
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: "1.5px solid",
            borderColor: statusFilter === "Closed" ? "#16A34A" : "#E2E8F0",
            bgcolor: statusFilter === "Closed" ? "#F0FDF4" : "#FFFFFF",
            boxShadow: statusFilter === "Closed" ? "0 0 0 2px rgba(22, 163, 74, 0.18)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "#86EFAC",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#16A34A", letterSpacing: "0.04em" }}>
              CLOSED
            </Typography>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: "#DCFCE7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16A34A",
              }}
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#16A34A", lineHeight: 1.1 }}>
            {kpiStats.closed}
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.72rem", mt: 0.5, display: "block" }}>
            {kpiStats.completionRate}% completion rate
          </Typography>
        </Card>

        {/* Card 5: Avg Progress */}
        <Card
          elevation={0}
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: "1.5px solid #E2E8F0",
            bgcolor: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#64748B", letterSpacing: "0.04em" }}>
              AVG PROGRESS
            </Typography>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colorTokens.primary.main,
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {kpiStats.avgProgress}%
          </Typography>
          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={kpiStats.avgProgress}
              sx={{
                height: 5,
                borderRadius: 2.5,
                bgcolor: "#F1F5F9",
                "& .MuiLinearProgress-bar": {
                  bgcolor: kpiStats.avgProgress >= 80 ? "#16A34A" : colorTokens.primary.main,
                },
              }}
            />
          </Box>
        </Card>
      </Box>

      {/* Main Table Container Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Search & Filter Toolbar */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            borderBottom: `1px solid ${colorTokens.workspace.border}`,
            bgcolor: "#F8FAFC",
          }}
        >
          {/* Search Field */}
          <TextField
            size="small"
            placeholder="Search by Action ID, Title, Deliverable, Circle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colorTokens.text.muted, fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm("")}>
                    <ClearIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              width: { xs: "100%", md: 360 },
              bgcolor: "#FFFFFF",
              "& .MuiOutlinedInput-root": {
                borderRadius: radiusTokens.sm,
                fontSize: "0.85rem",
              },
            }}
          />

          {/* Filter Pill Controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            {/* Status Pills */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700, fontSize: "0.74rem" }}>
                Status:
              </Typography>
              {[
                { label: "ALL", val: "ALL" },
                { label: "Open", val: "Open" },
                { label: "WIP", val: "WIP" },
                { label: "Closed", val: "Closed" },
              ].map((st) => {
                const isActive = statusFilter === st.val;
                return (
                  <Chip
                    key={st.val}
                    label={st.label}
                    size="small"
                    onClick={() => setStatusFilter(st.val)}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      height: 26,
                      px: 0.5,
                      bgcolor: isActive ? colorTokens.primary.main : "#FFFFFF",
                      color: isActive ? "#FFFFFF" : colorTokens.text.secondary,
                      border: `1px solid ${isActive ? colorTokens.primary.main : "#CBD5E1"}`,
                      boxShadow: isActive ? "0 1px 3px rgba(2, 132, 199, 0.25)" : "none",
                      "&:hover": {
                        bgcolor: isActive ? colorTokens.primary.dark : "#F1F5F9",
                      },
                    }}
                  />
                );
              })}
            </Box>

            {/* Priority Pills */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700, fontSize: "0.74rem" }}>
                Priority:
              </Typography>
              {[
                { label: "ALL", val: "ALL", activeBg: "#0F172A", activeColor: "#FFFFFF" },
                { label: "High", val: "High", activeBg: "#DC2626", activeColor: "#FFFFFF" },
                { label: "Medium", val: "Medium", activeBg: "#D97706", activeColor: "#FFFFFF" },
                { label: "Low", val: "Low", activeBg: "#64748B", activeColor: "#FFFFFF" },
              ].map((pr) => {
                const isActive = priorityFilter === pr.val;
                return (
                  <Chip
                    key={pr.val}
                    label={pr.label}
                    size="small"
                    onClick={() => setPriorityFilter(pr.val)}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      height: 26,
                      px: 0.5,
                      bgcolor: isActive ? pr.activeBg : "#FFFFFF",
                      color: isActive ? pr.activeColor : colorTokens.text.secondary,
                      border: `1px solid ${isActive ? pr.activeBg : "#CBD5E1"}`,
                      boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.2)" : "none",
                      "&:hover": {
                        bgcolor: isActive ? pr.activeBg : "#F1F5F9",
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Content Area: Loading, Error, Empty, or Table */}
        {loading ? (
          <Box sx={{ p: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress size={36} sx={{ color: colorTokens.primary.main }} />
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 500 }}>
              Loading tasks assigned to {ownerDisplayName}...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : filteredActions.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <AssignmentOutlinedIcon sx={{ fontSize: 44, color: "#94A3B8", mb: 1.5 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
              No assigned tasks found
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5, maxWidth: 440, mx: "auto" }}>
              {searchTerm || statusFilter !== "ALL" || priorityFilter !== "ALL"
                ? "No tasks match your filter criteria. Try clearing search or status filters."
                : `There are currently no tasks assigned to ${ownerDisplayName} in your authorized scope.`}
            </Typography>
            {(searchTerm || statusFilter !== "ALL" || priorityFilter !== "ALL") && (
              <Button
                size="small"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                }}
                sx={{ mt: 2, fontWeight: 700, textTransform: "none", color: colorTokens.primary.main }}
              >
                Reset Filters
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 120,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Action ID
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      minWidth: 260,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Task Title & Key Deliverables
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 140,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Circle
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 130,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Target Date
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 100,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Priority
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 100,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 130,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Progress
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 130,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Timeline
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: 800,
                      bgcolor: "#F8FAFC",
                      color: "#475569",
                      fontSize: "0.74rem",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      width: 90,
                      borderBottom: "1.5px solid #E2E8F0",
                    }}
                  >
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredActions.map((act) => {
                  const isClosed = act.status === "Closed";
                  const isOverdue = act.is_overdue && !isClosed;
                  const targetDate = act.current_target_date || act.target_closure_date;
                  const formattedDate = targetDate ? dayjs(targetDate).format("DD MMM YYYY") : "—";

                  return (
                    <TableRow
                      key={act.id}
                      hover
                      onClick={() => handleRowClick(act.id)}
                      sx={{
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                        "&:hover": { bgcolor: "#F8FAFC" },
                      }}
                    >
                      {/* Action ID */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 800,
                            color: colorTokens.primary.main,
                            fontSize: "0.85rem",
                            "&:hover": { textDecoration: "underline" },
                          }}
                        >
                          {act.action_id}
                        </Typography>
                      </TableCell>

                      {/* Task Title & Deliverables */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: "#0F172A",
                            fontSize: "0.86rem",
                            lineHeight: 1.3,
                            mb: 0.35,
                          }}
                        >
                          {act.action_point}
                        </Typography>
                        {act.key_deliverable && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#64748B",
                              fontSize: "0.76rem",
                              lineHeight: 1.25,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {act.key_deliverable}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Circle */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Chip
                          label={act.circle?.name || "Corporate"}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            height: 22,
                            bgcolor: "#F1F5F9",
                            color: "#334155",
                            border: "1px solid #E2E8F0",
                          }}
                        />
                      </TableCell>

                      {/* Target Date */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: isOverdue ? "#DC2626" : "#334155",
                          }}
                        >
                          {formattedDate}
                        </Typography>
                      </TableCell>

                      {/* Priority */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        {act.priority === "High" ? (
                          <Chip
                            icon={<PriorityHighIcon sx={{ fontSize: "13px !important", color: "#DC2626 !important" }} />}
                            label="High"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#FEE2E2",
                              color: "#B91C1C",
                              border: "1px solid #FCA5A5",
                            }}
                          />
                        ) : act.priority === "Medium" ? (
                          <Chip
                            label="Medium"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#FEF3C7",
                              color: "#B45309",
                              border: "1px solid #FDE68A",
                            }}
                          />
                        ) : (
                          <Chip
                            label="Low"
                            size="small"
                            sx={{
                              fontWeight: 600,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#F1F5F9",
                              color: "#475569",
                              border: "1px solid #E2E8F0",
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-start" }}>
                          {act.status === "Closed" ? (
                            <Chip
                              label="Closed"
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                height: 22,
                                bgcolor: "#ECFDF5",
                                color: "#047857",
                                border: "1px solid #A7F3D0",
                              }}
                            />
                          ) : act.status === "WIP" ? (
                            <Chip
                              label="WIP"
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                height: 22,
                                bgcolor: "#FEF3C7",
                                color: "#B45309",
                                border: "1px solid #FDE68A",
                              }}
                            />
                          ) : (
                            <Chip
                              label="Open"
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                height: 22,
                                bgcolor: "#EFF6FF",
                                color: "#1D4ED8",
                                border: "1px solid #BFDBFE",
                              }}
                            />
                          )}
                          {act.review_workflow_status && act.review_workflow_status !== "None" && (
                            <Chip
                              label={act.review_workflow_status}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.68rem",
                                height: 20,
                                bgcolor:
                                  act.review_workflow_status === "Approved"
                                    ? "#F0FDF4"
                                    : act.review_workflow_status === "Rework Required"
                                    ? "#FEF2F2"
                                    : act.review_workflow_status === "Awaiting Final Approval"
                                    ? "#F0F9FF"
                                    : "#EFF6FF",
                                color:
                                  act.review_workflow_status === "Approved"
                                    ? "#166534"
                                    : act.review_workflow_status === "Rework Required"
                                    ? "#991B1B"
                                    : act.review_workflow_status === "Awaiting Final Approval"
                                    ? "#0369A1"
                                    : "#1D4ED8",
                                border: `1px solid ${
                                  act.review_workflow_status === "Approved"
                                    ? "#BBF7D0"
                                    : act.review_workflow_status === "Rework Required"
                                    ? "#FECACA"
                                    : act.review_workflow_status === "Awaiting Final Approval"
                                    ? "#BAE6FD"
                                    : "#BFDBFE"
                                }`,
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      {/* Progress */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#0F172A", minWidth: 28, fontSize: "0.76rem" }}>
                            {act.current_progress_percent || 0}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={act.current_progress_percent || 0}
                            sx={{
                              flex: 1,
                              height: 5,
                              borderRadius: 2.5,
                              bgcolor: "#E2E8F0",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: isClosed ? "#16A34A" : colorTokens.primary.main,
                              },
                            }}
                          />
                        </Box>
                      </TableCell>

                      {/* Timeline */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        {isClosed ? (
                          <Chip
                            label="Completed"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#ECFDF5",
                              color: "#047857",
                              border: "1px solid #A7F3D0",
                            }}
                          />
                        ) : isOverdue ? (
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: "13px !important", color: "#DC2626 !important" }} />}
                            label={act.ageing_days ? `${act.ageing_days}d Overdue` : "Overdue"}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#FEF2F2",
                              color: "#DC2626",
                              border: "1px solid #FECACA",
                            }}
                          />
                        ) : (
                          <Chip
                            label="On Track"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              height: 22,
                              bgcolor: "#F0FDF4",
                              color: "#16A34A",
                              border: "1px solid #BBF7D0",
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Action */}
                      <TableCell align="center" sx={{ verticalAlign: "middle" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(act.id);
                          }}
                          sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            fontSize: "0.74rem",
                            py: 0.35,
                            px: 1.25,
                            minWidth: 70,
                            color: colorTokens.primary.main,
                            borderColor: "#CBD5E1",
                            borderRadius: radiusTokens.sm,
                            "&:hover": {
                              bgcolor: "#EFF6FF",
                              borderColor: colorTokens.primary.main,
                            },
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Consolidated Action Owner Email Dispatch Modal */}
      <SendOwnerEmailModal
        open={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        ownerId={parsedOwnerId}
        ownerName={ownerDisplayName}
        fallbackEmail={ownerEmail}
      />
    </Container>
  );
};
