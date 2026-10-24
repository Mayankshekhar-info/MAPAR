import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { ModuleCatalogItem, ModuleAccessLevel, UserModulePermissionItem } from "../types/users.types";
import { NavigationIcon } from "../../../app/navigation/navigationIcon";

interface ModulePermissionsCardProps {
  catalog: ModuleCatalogItem[];
  isLoading?: boolean;
  value: UserModulePermissionItem[];
  onChange: (updated: UserModulePermissionItem[]) => void;
}

export const ModulePermissionsCard: React.FC<ModulePermissionsCardProps> = ({
  catalog,
  isLoading = false,
  value,
  onChange,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Map module_code or module_id to access_level
  const permsMap = new Map<string, ModuleAccessLevel>();
  value.forEach((v) => {
    permsMap.set(v.module_code, v.access_level);
  });

  const getModuleAccess = (code: string): ModuleAccessLevel => {
    return permsMap.get(code) || "READ";
  };

  const handleLevelChange = (module: ModuleCatalogItem, newLevel: ModuleAccessLevel | null) => {
    if (!newLevel) return;
    const existingIndex = value.findIndex((v) => v.module_code === module.code);
    let updated: UserModulePermissionItem[];
    if (existingIndex >= 0) {
      updated = [...value];
      updated[existingIndex] = {
        ...updated[existingIndex],
        access_level: newLevel,
      };
    } else {
      updated = [
        ...value,
        {
          module_id: module.id,
          module_code: module.code,
          module_name: module.name,
          access_level: newLevel,
        },
      ];
    }
    onChange(updated);
  };

  // Batch Handlers
  const handleSetAll = (level: ModuleAccessLevel) => {
    const updated = catalog.map((mod) => ({
      module_id: mod.id,
      module_code: mod.code,
      module_name: mod.name,
      access_level: level,
    }));
    onChange(updated);
  };

  // Filter modules by search
  const filteredModules = catalog.filter((mod) => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      mod.name.toLowerCase().includes(query) ||
      mod.code.toLowerCase().includes(query) ||
      mod.description.toLowerCase().includes(query) ||
      mod.route_name.toLowerCase().includes(query)
    );
  });

  // Calculate summaries
  const writeCount = catalog.filter((m) => getModuleAccess(m.code) === "WRITE").length;
  const readCount = catalog.filter((m) => getModuleAccess(m.code) === "READ").length;
  const noAccessCount = catalog.filter((m) => getModuleAccess(m.code) === "NO_ACCESS").length;

  return (
    <Card
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: radiusTokens.lg,
        boxShadow: shadowTokens.card,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#FFFFFF",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                bgcolor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SecurityOutlinedIcon fontSize="small" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "1.05rem" }}>
              Dimension 1: Module Access Permissions
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 650 }}>
            Configure individual module access independently. A user can only see and access granted modules. Users with Read permission cannot perform write operations.
          </Typography>
        </Box>

        {/* Quick Batch Controls */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon fontSize="small" />}
            onClick={() => handleSetAll("READ")}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              borderColor: "#CBD5E1",
              color: "#0369A1",
              "&:hover": { borderColor: "#0284C7", bgcolor: "#F0F9FF" },
            }}
          >
            All Read
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DoneAllIcon fontSize="small" />}
            onClick={() => handleSetAll("WRITE")}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              borderColor: "#CBD5E1",
              color: "#059669",
              "&:hover": { borderColor: "#10B981", bgcolor: "#ECFDF5" },
            }}
          >
            All Write
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearAllIcon fontSize="small" />}
            onClick={() => handleSetAll("NO_ACCESS")}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              borderColor: "#CBD5E1",
              color: "#DC2626",
              "&:hover": { borderColor: "#EF4444", bgcolor: "#FEF2F2" },
            }}
          >
            Revoke All
          </Button>
        </Stack>
      </Box>

      {/* Filter and Summary Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          p: 1.5,
          bgcolor: "#F8FAFC",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
          mb: 2,
        }}
      >
        <TextField
          size="small"
          placeholder="Filter modules by name or route..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            minWidth: 260,
            bgcolor: "#FFFFFF",
            "& .MuiOutlinedInput-root": { fontSize: "0.85rem", height: 36 },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Live Summary Badges */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={`${writeCount} Read & Write`}
            sx={{
              bgcolor: "#D1FAE5",
              color: "#065F46",
              fontWeight: 600,
              fontSize: "0.75rem",
              border: "1px solid #A7F3D0",
            }}
          />
          <Chip
            size="small"
            label={`${readCount} Read Only`}
            sx={{
              bgcolor: "#E0F2FE",
              color: "#0369A1",
              fontWeight: 600,
              fontSize: "0.75rem",
              border: "1px solid #BAE6FD",
            }}
          />
          <Chip
            size="small"
            label={`${noAccessCount} No Access`}
            sx={{
              bgcolor: "#F1F5F9",
              color: "#64748B",
              fontWeight: 600,
              fontSize: "0.75rem",
              border: "1px solid #E2E8F0",
            }}
          />
        </Stack>
      </Box>

      {/* Loading state */}
      {isLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 4, gap: 1.5 }}>
          <CircularProgress size={24} sx={{ color: "#4F46E5" }} />
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Loading application modules...
          </Typography>
        </Box>
      ) : filteredModules.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center", color: "#64748B" }}>
          <Typography variant="body2">No modules match your filter query.</Typography>
        </Box>
      ) : (
        /* Modules Table */
        <TableContainer sx={{ border: "1px solid #E2E8F0", borderRadius: "8px" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1.2, width: "40%" }}>Module Name & Details</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1.2, width: "25%" }}>Route Path</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: "#475569", py: 1.2, width: "35%" }}>
                  Configured Permission Level
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModules.map((mod) => {
                const currentLevel = getModuleAccess(mod.code);

                return (
                  <TableRow
                    key={mod.code}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                      bgcolor: currentLevel === "NO_ACCESS" ? "#FAFAFA" : "#FFFFFF",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <TableCell sx={{ py: 1.2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "6px",
                            bgcolor:
                              currentLevel === "WRITE"
                                ? "#ECFDF5"
                                : currentLevel === "READ"
                                ? "#F0F9FF"
                                : "#F1F5F9",
                            color:
                              currentLevel === "WRITE"
                                ? "#059669"
                                : currentLevel === "READ"
                                ? "#0284C7"
                                : "#94A3B8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <NavigationIcon name={mod.icon} fontSize="small" />
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 600,
                              color: currentLevel === "NO_ACCESS" ? "#94A3B8" : colorTokens.text.primary,
                              fontSize: "0.875rem",
                            }}
                          >
                            {mod.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: colorTokens.text.muted,
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {mod.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ py: 1.2 }}>
                      <Chip
                        size="small"
                        label={mod.route_name || `/${mod.code}`}
                        sx={{
                          height: 22,
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          bgcolor: "#F1F5F9",
                          color: "#475569",
                        }}
                      />
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1.2 }}>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={currentLevel}
                        onChange={(_, val) => handleLevelChange(mod, val)}
                        sx={{
                          height: 30,
                          "& .MuiToggleButton-root": {
                            px: 1.5,
                            py: 0.2,
                            textTransform: "none",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            borderColor: "#CBD5E1",
                          },
                        }}
                      >
                        <Tooltip title="Module and its pages will not be visible or accessible">
                          <ToggleButton
                            value="NO_ACCESS"
                            sx={{
                              "&.Mui-selected": {
                                bgcolor: "#FEF2F2 !important",
                                color: "#DC2626 !important",
                                borderColor: "#FCA5A5 !important",
                              },
                            }}
                          >
                            <BlockIcon sx={{ fontSize: 14, mr: 0.5 }} />
                            No Access
                          </ToggleButton>
                        </Tooltip>

                        <Tooltip title="User can view records, charts, and details but cannot create/edit/upload">
                          <ToggleButton
                            value="READ"
                            sx={{
                              "&.Mui-selected": {
                                bgcolor: "#E0F2FE !important",
                                color: "#0369A1 !important",
                                borderColor: "#7DD3FC !important",
                              },
                            }}
                          >
                            <VisibilityIcon sx={{ fontSize: 14, mr: 0.5 }} />
                            Read
                          </ToggleButton>
                        </Tooltip>

                        <Tooltip title="User can view and perform permitted create/update operations within organization scope">
                          <ToggleButton
                            value="WRITE"
                            sx={{
                              "&.Mui-selected": {
                                bgcolor: "#D1FAE5 !important",
                                color: "#065F46 !important",
                                borderColor: "#6EE7B7 !important",
                              },
                            }}
                          >
                            <EditNoteIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            Write
                          </ToggleButton>
                        </Tooltip>
                      </ToggleButtonGroup>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Footer Info */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
          * Permissions are enforced on both frontend routes and backend APIs. Granting Write does not bypass organization scope.
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#475569" }}>
          Total Modules: {catalog.length} (Active: {writeCount + readCount}, Denied: {noAccessCount})
        </Typography>
      </Box>
    </Card>
  );
};
