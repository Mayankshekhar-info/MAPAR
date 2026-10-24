import React, { useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useAuth } from "../../features/auth";
import { NavigationItem } from "../navigation/navigation.types";
import { resolveNavigation } from "../navigation/navigation.resolver";
import { NavigationIcon } from "../navigation/navigationIcon";
import { UserProfileWidget } from "./UserProfileWidget";
import { colorTokens, radiusTokens } from "../theme/tokens";

export const SIDEBAR_EXPANDED_WIDTH = 270;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const navigationGroups = resolveNavigation(user);

  // Track expanded parent items
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const handleToggleParent = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  const renderNavContent = () => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: colorTokens.nav.background,
        color: colorTokens.nav.textPrimary,
        userSelect: "none",
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          px: collapsed ? 1 : 2.5,
          borderBottom: `1px solid ${colorTokens.nav.border}`,
          flexShrink: 0,
        }}
      >
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: radiusTokens.md,
              background: `linear-gradient(135deg, ${colorTokens.primary.main} 0%, #0369A1 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: `0 2px 8px ${colorTokens.nav.accentGlow}`,
              flexShrink: 0,
            }}
          >
            <AssessmentIcon sx={{ fontSize: 20 }} />
          </Box>
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  fontSize: "1rem",
                  lineHeight: 1.15,
                  background: "linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                PAGMS
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: colorTokens.nav.textMuted,
                  fontSize: "0.68rem",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                  display: "block",
                }}
              >
                ENTERPRISE COCKPIT
              </Typography>
            </Box>
          )}
        </Box>

        {!collapsed && (
          <IconButton
            onClick={onToggleCollapse}
            size="small"
            aria-label="Collapse sidebar"
            sx={{
              color: colorTokens.nav.textSecondary,
              borderRadius: radiusTokens.sm,
              "&:hover": {
                color: "#FFFFFF",
                bgcolor: colorTokens.nav.surfaceHover,
              },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Navigation Groups List */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          py: 1.5,
          px: collapsed ? 1 : 1.5,
          "&::-webkit-scrollbar": {
            width: 4,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 4,
          },
        }}
      >
        {collapsed && (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              aria-label="Expand sidebar"
              sx={{
                color: colorTokens.nav.textSecondary,
                "&:hover": { color: "#FFFFFF", bgcolor: colorTokens.nav.surfaceHover },
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {navigationGroups.map((group) => (
          <Box key={group.id} sx={{ mb: 2 }}>
            {!collapsed && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  py: 0.75,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#38BDF8",
                  textTransform: "uppercase",
                }}
              >
                {group.title}
              </Typography>
            )}

            <List disablePadding>
              {group.items.map((item) => {
                const active = isItemActive(item);
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isOpen = openItems[item.id] ?? false;

                const buttonContent = (
                  <ListItemButton
                    component={hasChildren ? "div" : RouterLink}
                    to={hasChildren ? undefined : item.path}
                    onClick={hasChildren ? () => handleToggleParent(item.id) : onMobileClose}
                    sx={{
                      minHeight: 40,
                      px: collapsed ? 1.5 : 1.5,
                      py: 0.8,
                      mb: 0.4,
                      borderRadius: radiusTokens.md,
                      position: "relative",
                      bgcolor: active ? "rgba(2, 132, 199, 0.18)" : "transparent",
                      color: active ? "#38BDF8" : "#E2E8F0",
                      transition: "all 0.15s ease",
                      "&::before": active
                        ? {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: "15%",
                            height: "70%",
                            width: 3,
                            bgcolor: "#38BDF8",
                            borderRadius: "0 3px 3px 0",
                          }
                        : undefined,
                      "&:hover": {
                        bgcolor: active ? "rgba(2, 132, 199, 0.22)" : "rgba(255, 255, 255, 0.08)",
                        "& .MuiListItemText-primary": {
                          color: active ? "#38BDF8" : "#FFFFFF",
                        },
                        "& .nav-icon": {
                          color: active ? "#38BDF8" : "#FFFFFF",
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? "auto" : 32,
                        mr: collapsed ? "auto" : 1,
                        ml: collapsed ? "auto" : 0,
                        justifyContent: "center",
                        color: active ? "#38BDF8" : "#CBD5E1",
                        transition: "color 0.15s ease",
                      }}
                      className="nav-icon"
                    >
                      <NavigationIcon name={item.iconName} fontSize="small" />
                    </ListItemIcon>

                    {!collapsed && (
                      <>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: "0.84rem",
                            fontWeight: active ? 600 : 500,
                            color: active ? "#38BDF8" : "#E2E8F0",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        />
                        {item.badge && (
                          <Chip
                            label={item.badge}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              bgcolor: colorTokens.status.info.main,
                              color: "#FFFFFF",
                              mr: hasChildren ? 0.5 : 0,
                            }}
                          />
                        )}
                        {hasChildren && (
                          isOpen ? (
                            <ExpandLess sx={{ fontSize: 18, color: active ? "#38BDF8" : "#94A3B8" }} />
                          ) : (
                            <ExpandMore sx={{ fontSize: 18, color: active ? "#38BDF8" : "#94A3B8" }} />
                          )
                        )}
                      </>
                    )}
                  </ListItemButton>
                );

                return (
                  <React.Fragment key={item.id}>
                    {collapsed ? (
                      <Tooltip title={item.label} placement="right" arrow>
                        {buttonContent}
                      </Tooltip>
                    ) : (
                      buttonContent
                    )}

                    {/* Children sub-navigation */}
                    {!collapsed && hasChildren && (
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding sx={{ pl: 4 }}>
                          {item.children?.map((child) => {
                            const childActive = location.pathname === child.path;
                            return (
                              <ListItemButton
                                key={child.id}
                                component={RouterLink}
                                to={child.path}
                                onClick={onMobileClose}
                                sx={{
                                  py: 0.6,
                                  px: 1.5,
                                  mb: 0.25,
                                  borderRadius: radiusTokens.md,
                                  bgcolor: childActive ? "rgba(2, 132, 199, 0.15)" : "transparent",
                                  color: childActive ? "#38BDF8" : "#CBD5E1",
                                  "&:hover": {
                                    bgcolor: "rgba(255, 255, 255, 0.08)",
                                    "& .MuiListItemText-primary": {
                                      color: "#FFFFFF",
                                    },
                                  },
                                }}
                              >
                                <ListItemText
                                  primary={child.label}
                                  primaryTypographyProps={{
                                    fontSize: "0.8rem",
                                    fontWeight: childActive ? 600 : 400,
                                    color: childActive ? "#38BDF8" : "#CBD5E1",
                                  }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      </Collapse>
                    )}
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Dynamic User Profile Area */}
      <UserProfileWidget collapsed={collapsed} />
    </Box>
  );

  return (
    <>
      {/* Desktop Persistent Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
            boxSizing: "border-box",
            borderRight: `1px solid ${colorTokens.nav.border}`,
            bgcolor: colorTokens.nav.background,
            transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowX: "hidden",
          },
        }}
      >
        {renderNavContent()}
      </Drawer>

      {/* Mobile Temporary Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_EXPANDED_WIDTH,
            boxSizing: "border-box",
            bgcolor: colorTokens.nav.background,
            borderRight: `1px solid ${colorTokens.nav.border}`,
          },
        }}
      >
        {renderNavContent()}
      </Drawer>
    </>
  );
};
