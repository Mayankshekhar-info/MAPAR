import React, { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SearchIcon from "@mui/icons-material/Search";

import { SlideChildNode } from "../types/slide.types";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { EmptyState } from "../../../components/EmptyState";

interface SlideChildrenGridProps {
  childrenNodes: SlideChildNode[];
  childLevelName: string;
  onChildClick: (level: string, id: number) => void;
}

function getChildLevelIcon(level: string) {
  switch (level.toUpperCase()) {
    case "MAIN_COMPANY":
      return <BusinessOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "SUB_COMPANY":
      return <ApartmentOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "PROJECT":
      return <AccountTreeOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "CIRCLE":
      return <PublicOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "DOMAIN":
      return <LayersOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "DEPARTMENT":
    case "SUB_DEPARTMENT":
    case "TEAM":
      return <GroupsOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    case "USER":
      return <PersonOutlineIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
    default:
      return <AccountTreeOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />;
  }
}

function formatLevelLabel(level: string): string {
  switch (level.toUpperCase()) {
    case "MAIN_COMPANY":
      return "Main Company";
    case "SUB_COMPANY":
      return "Sub Company";
    case "PROJECT":
      return "Project";
    case "CIRCLE":
      return "Circle";
    case "DOMAIN":
      return "Domain";
    case "DEPARTMENT":
      return "Department";
    case "SUB_DEPARTMENT":
    case "TEAM":
      return "Team";
    case "USER":
      return "User";
    default:
      return level;
  }
}

function formatPluralLevelLabel(level: string, count: number): string {
  const singular = formatLevelLabel(level);
  if (count === 1) return `1 ${singular}`;
  if (singular.endsWith("y")) {
    return `${count} ${singular.slice(0, -1)}ies`;
  }
  return `${count} ${singular}s`;
}

export const SlideChildrenGrid: React.FC<SlideChildrenGridProps> = ({
  childrenNodes,
  childLevelName,
  onChildClick,
}) => {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return childrenNodes;
    const q = searchQuery.toLowerCase().trim();
    return childrenNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(q) ||
        (node.code && node.code.toLowerCase().includes(q)) ||
        (node.description && node.description.toLowerCase().includes(q))
    );
  }, [childrenNodes, searchQuery]);

  if (!childrenNodes || childrenNodes.length === 0) {
    return (
      <EmptyState
        title={`No ${childLevelName ? formatLevelLabel(childLevelName) + "s" : "Children"} Configured`}
        description={`There are currently no authorized ${childLevelName ? formatLevelLabel(childLevelName) + "s" : "child units"} configured under this organization node.`}
      />
    );
  }

  return (
    <Box>
      {/* Controls Bar: Search & View Mode Switcher */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          placeholder={`Search ${childLevelName ? formatLevelLabel(childLevelName) + "s" : "units"} by name or code...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: colorTokens.text.muted }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: 260,
            maxWidth: 380,
            bgcolor: "#FFFFFF",
            "& .MuiOutlinedInput-root": {
              borderRadius: radiusTokens.md,
              fontSize: "0.82rem",
            },
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
            Showing {filteredNodes.length} of {childrenNodes.length}
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            sx={{
              bgcolor: "#FFFFFF",
              borderRadius: radiusTokens.md,
              "& .MuiToggleButton-root": {
                px: 1.25,
                py: 0.5,
                border: `1px solid ${colorTokens.workspace.border}`,
                color: colorTokens.text.secondary,
                "&.Mui-selected": {
                  bgcolor: colorTokens.primary.lighter,
                  color: colorTokens.primary.main,
                  fontWeight: 700,
                },
              },
            }}
          >
            <ToggleButton value="table" title="Table View">
              <ViewListIcon sx={{ fontSize: 18, mr: 0.5 }} />
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "none" }}>Table</Typography>
            </ToggleButton>
            <ToggleButton value="cards" title="Cards View">
              <ViewModuleIcon sx={{ fontSize: 18, mr: 0.5 }} />
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "none" }}>Cards</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Render Table View (Default) */}
      {viewMode === "table" ? (
        <Card
          sx={{
            bgcolor: "#FFFFFF",
            borderRadius: radiusTokens.lg,
            border: `1px solid ${colorTokens.workspace.border}`,
            boxShadow: shadowTokens.subtle,
            overflow: "hidden",
          }}
        >
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    ORGANIZATION UNIT / NAME
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    CODE
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    LEVEL
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    DIRECT SUB-UNITS
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    STATUS
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    RAG HEALTH
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary, py: 1.5 }}>
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredNodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: colorTokens.text.muted }}>
                        No organization units match your search "{searchQuery}".
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNodes.map((child) => {
                    const kpi = child.kpi_summary || { total: 0, green: 0, amber: 0, red: 0 };
                    const label = formatLevelLabel(child.level || childLevelName);
                    const subUnitText =
                      child.child_count > 0
                        ? formatPluralLevelLabel(child.child_level || "sub_unit", child.child_count)
                        : "Terminal Node";

                    return (
                      <TableRow
                        key={`${child.level}_${child.id}`}
                        hover
                        onClick={() => onChildClick(child.level || childLevelName, child.id)}
                        sx={{
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          "&:last-child td": { borderBottom: "none" },
                          "&:hover": { bgcolor: colorTokens.workspace.borderSubtle },
                        }}
                      >
                        {/* Name + Icon + Description */}
                        <TableCell sx={{ py: 1.75 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: radiusTokens.md,
                                bgcolor: colorTokens.primary.lighter,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {getChildLevelIcon(child.level || childLevelName)}
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: colorTokens.text.primary, lineHeight: 1.25 }}>
                                {child.name}
                              </Typography>
                              {child.description && (
                                <Typography sx={{ fontSize: "0.74rem", color: colorTokens.text.secondary, mt: 0.25 }}>
                                  {child.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Code */}
                        <TableCell sx={{ py: 1.75 }}>
                          <Chip
                            label={child.code || "—"}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              bgcolor: colorTokens.workspace.borderSubtle,
                              color: colorTokens.text.primary,
                              border: `1px solid ${colorTokens.workspace.border}`,
                              borderRadius: radiusTokens.xs,
                            }}
                          />
                        </TableCell>

                        {/* Level */}
                        <TableCell sx={{ py: 1.75 }}>
                          <Chip
                            label={label}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: "0.72rem",
                              bgcolor: colorTokens.primary.lighter,
                              color: colorTokens.primary.darker,
                              borderRadius: radiusTokens.xs,
                            }}
                          />
                        </TableCell>

                        {/* Direct Sub-Units */}
                        <TableCell sx={{ py: 1.75 }}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.primary }}>
                            {subUnitText}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell align="center" sx={{ py: 1.75 }}>
                          <StatusChip
                            status={child.status === "ACTIVE" ? "success" : "neutral"}
                            label={child.status || "ACTIVE"}
                          />
                        </TableCell>

                        {/* RAG Health */}
                        <TableCell align="center" sx={{ py: 1.75 }}>
                          {kpi.total > 0 ? (
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                              {kpi.green > 0 && (
                                <Chip
                                  label={`${kpi.green} Opt`}
                                  size="small"
                                  sx={{
                                    bgcolor: colorTokens.status.success.light,
                                    color: colorTokens.status.success.text,
                                    fontWeight: 800,
                                    fontSize: "0.68rem",
                                    height: 20,
                                  }}
                                />
                              )}
                              {kpi.amber > 0 && (
                                <Chip
                                  label={`${kpi.amber} Warn`}
                                  size="small"
                                  sx={{
                                    bgcolor: colorTokens.status.warning.light,
                                    color: colorTokens.status.warning.text,
                                    fontWeight: 800,
                                    fontSize: "0.68rem",
                                    height: 20,
                                  }}
                                />
                              )}
                              {kpi.red > 0 && (
                                <Chip
                                  label={`${kpi.red} Crit`}
                                  size="small"
                                  sx={{
                                    bgcolor: colorTokens.status.error.light,
                                    color: colorTokens.status.error.text,
                                    fontWeight: 800,
                                    fontSize: "0.68rem",
                                    height: 20,
                                  }}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                              —
                            </Typography>
                          )}
                        </TableCell>

                        {/* Action: Explore */}
                        <TableCell align="right" sx={{ py: 1.75 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              onChildClick(child.level || childLevelName, child.id);
                            }}
                            sx={{
                              borderRadius: radiusTokens.md,
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              textTransform: "none",
                              py: 0.4,
                              px: 1.5,
                              borderColor: colorTokens.workspace.border,
                              color: colorTokens.primary.main,
                              bgcolor: "#FFFFFF",
                              "&:hover": {
                                bgcolor: colorTokens.primary.lighter,
                                borderColor: colorTokens.primary.main,
                              },
                            }}
                          >
                            Explore
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        /* Render Cards View */
        <Grid container spacing={2.5}>
          {filteredNodes.map((child) => {
            const kpi = child.kpi_summary || { total: 0, green: 0, amber: 0, red: 0 };
            const label = formatLevelLabel(child.level || childLevelName);
            const subUnitText =
              child.child_count > 0
                ? formatPluralLevelLabel(child.child_level || "sub_unit", child.child_count)
                : "Terminal Node";

            return (
              <Grid key={`${child.level}_${child.id}`} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  onClick={() => onChildClick(child.level || childLevelName, child.id)}
                  sx={{
                    p: 2.5,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    bgcolor: "#FFFFFF",
                    borderRadius: radiusTokens.lg,
                    border: `1px solid ${colorTokens.workspace.border}`,
                    boxShadow: shadowTokens.subtle,
                    transition: "all 0.2s ease-in-out",
                    cursor: "pointer",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: shadowTokens.cardHover,
                      borderColor: colorTokens.primary.main,
                    },
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: radiusTokens.md,
                            bgcolor: colorTokens.primary.lighter,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {getChildLevelIcon(child.level || childLevelName)}
                        </Box>
                        <Chip
                          label={label}
                          size="small"
                          sx={{
                            bgcolor: colorTokens.workspace.borderSubtle,
                            color: colorTokens.text.secondary,
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            borderRadius: radiusTokens.xs,
                          }}
                        />
                      </Box>

                      <Chip
                        label={child.code || "—"}
                        size="small"
                        sx={{
                          bgcolor: colorTokens.workspace.background,
                          border: `1px solid ${colorTokens.workspace.border}`,
                          color: colorTokens.text.primary,
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          borderRadius: radiusTokens.xs,
                        }}
                      />
                    </Box>

                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: colorTokens.text.primary,
                        fontSize: "1.05rem",
                        mb: 0.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {child.name}
                    </Typography>

                    {child.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: colorTokens.text.secondary,
                          fontSize: "0.8rem",
                          mb: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {child.description}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ pt: 2, borderTop: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                        {subUnitText}
                      </Typography>

                      {kpi.total > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {kpi.green > 0 && (
                            <Chip
                              label={kpi.green}
                              size="small"
                              sx={{
                                bgcolor: colorTokens.status.success.light,
                                color: colorTokens.status.success.text,
                                fontWeight: 800,
                                fontSize: "0.68rem",
                                height: 20,
                              }}
                            />
                          )}
                          {kpi.amber > 0 && (
                            <Chip
                              label={kpi.amber}
                              size="small"
                              sx={{
                                bgcolor: colorTokens.status.warning.light,
                                color: colorTokens.status.warning.text,
                                fontWeight: 800,
                                fontSize: "0.68rem",
                                height: 20,
                              }}
                            />
                          )}
                          {kpi.red > 0 && (
                            <Chip
                              label={kpi.red}
                              size="small"
                              sx={{
                                bgcolor: colorTokens.status.error.light,
                                color: colorTokens.status.error.text,
                                fontWeight: 800,
                                fontSize: "0.68rem",
                                height: 20,
                              }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        borderRadius: radiusTokens.md,
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        textTransform: "none",
                        borderColor: colorTokens.workspace.border,
                        color: colorTokens.primary.main,
                        "&:hover": {
                          bgcolor: colorTokens.primary.lighter,
                          borderColor: colorTokens.primary.main,
                        },
                      }}
                    >
                      Explore {child.name}
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

