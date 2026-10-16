import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useAuth } from "../../features/auth";
import { Breadcrumbs } from "./Breadcrumbs";
import { colorTokens, radiusTokens, shadowTokens } from "../theme/tokens";

interface TopBarProps {
  onMobileMenuToggle: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const initials = (user?.name || user?.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${colorTokens.workspace.border}`,
        color: colorTokens.text.primary,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: { xs: 2, sm: 3 }, gap: 2 }}>
        {/* Mobile menu trigger */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="open navigation menu"
          onClick={onMobileMenuToggle}
          sx={{ display: { md: "none" }, mr: 1, color: colorTokens.text.secondary }}
        >
          <MenuIcon />
        </IconButton>

        {/* Dynamic Context Breadcrumbs */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Breadcrumbs />
        </Box>

        {/* Right Action Elements */}
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.5 } }}>
          {/* Active Operational Cycle Badge */}
          <Chip
            icon={<FiberManualRecordIcon sx={{ fontSize: "10px !important", color: "#10B981" }} />}
            label="CYCLE 2026-09 ACTIVE"
            size="small"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              bgcolor: colorTokens.status.success.light,
              color: colorTokens.status.success.text,
              border: `1px solid ${colorTokens.status.success.border}`,
              fontWeight: 700,
              fontSize: "0.68rem",
              letterSpacing: "0.04em",
              height: 26,
            }}
          />

          {/* Notifications button */}
          <IconButton
            size="small"
            aria-label="notifications"
            sx={{
              color: colorTokens.text.secondary,
              p: 1,
              borderRadius: radiusTokens.md,
              "&:hover": { bgcolor: colorTokens.workspace.borderSubtle },
            }}
          >
            <Badge badgeContent={2} color="primary" variant="dot">
              <NotificationsNoneIcon fontSize="small" />
            </Badge>
          </IconButton>

          {/* Help button */}
          <IconButton
            size="small"
            aria-label="help"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              color: colorTokens.text.secondary,
              p: 1,
              borderRadius: radiusTokens.md,
              "&:hover": { bgcolor: colorTokens.workspace.borderSubtle },
            }}
          >
            <HelpOutlineIcon fontSize="small" />
          </IconButton>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, my: "auto" }} />

          {/* User Profile Menu Button */}
          <Box
            onClick={handleMenuOpen}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              cursor: "pointer",
              p: 0.5,
              pr: 1.5,
              borderRadius: radiusTokens.full,
              border: `1px solid ${colorTokens.workspace.border}`,
              bgcolor: "#FFFFFF",
              transition: "all 0.15s ease",
              "&:hover": {
                borderColor: colorTokens.primary.main,
                boxShadow: shadowTokens.subtle,
              },
            }}
          >
            <Avatar
              sx={{
                width: 30,
                height: 30,
                bgcolor: colorTokens.primary.main,
                color: "#FFFFFF",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "left", minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  lineHeight: 1.2,
                  color: colorTokens.text.primary,
                }}
              >
                {user?.name || user?.username}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.68rem",
                  color: colorTokens.text.secondary,
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {user?.role_name || user?.role}
              </Typography>
            </Box>
          </Box>

          {/* Dropdown Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            slotProps={{
              paper: {
                sx: {
                  width: 230,
                  mt: 1.5,
                  borderRadius: radiusTokens.lg,
                  boxShadow: shadowTokens.dropdown,
                  border: `1px solid ${colorTokens.workspace.border}`,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                {user?.name || user?.username}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                {user?.email || "internal@mapar.corporate"}
              </Typography>
              <Chip
                label={user?.role_name || user?.role}
                size="small"
                sx={{
                  mt: 1,
                  height: 22,
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  bgcolor: colorTokens.primary.lighter,
                  color: colorTokens.primary.darker,
                }}
              />
            </Box>
            <Divider />
            <MenuItem onClick={handleMenuClose} sx={{ py: 1.2, fontSize: "0.84rem" }}>
              <ListItemIcon>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              My Profile
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                handleMenuClose();
                logout();
              }}
              sx={{
                py: 1.2,
                fontSize: "0.84rem",
                color: colorTokens.status.error.main,
                "&:hover": { bgcolor: colorTokens.status.error.light },
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign Out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
