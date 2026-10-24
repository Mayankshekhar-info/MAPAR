import React, { useState } from "react";
import Box from "@mui/material/Box";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { colorTokens } from "../theme/tokens";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleMobileMenuToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: colorTokens.workspace.background }}>
      {/* Primary Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />

      {/* Main Execution Workspace */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* Top Application Bar */}
        <TopBar onMobileMenuToggle={handleMobileMenuToggle} />

        {/* Content Viewport */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3, md: 4 },
            maxWidth: 1600,
            width: "100%",
            mx: "auto",
            boxSizing: "border-box",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
