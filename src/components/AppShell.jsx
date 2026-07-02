// src/components/AppShell.jsx
// Responsive shell: desktop gets a persistent sidebar layout (the PWA's
// primary experience); small screens keep the legacy header + bottom-nav
// (mobile users are steered to the native app via AppStoreBanner).
import React from "react";
import { Box, Typography, IconButton, useMediaQuery } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTheme } from "@mui/material/styles";
import HeaderBar from "./HeaderBar";
import BottomNavBar from "./BottomNavBar";
import SideNav from "./SideNav";

export default function AppShell({
  title = "",
  profileImage = "https://via.placeholder.com/32",
  profileName = "",
  onProfileClick = () => {},
  onProfileNavigate,
  selectedTab = "",
  onTabChange = () => {},
  tabs = [],
  isAdminView = false,
  onExitAdmin,
  showBack = false,
  onBack = () => {},
  children,
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedTab]);

  if (isDesktop) {
    return (
      // NOTE: no className here — the legacy .app-container rule in App.css
      // (flex-direction: column, max-width: 800px) belongs to the mobile
      // layout only and must not leak into the desktop shell.
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          minHeight: "100vh",
          backgroundColor: "background.default",
          color: "text.primary",
        }}
      >
        <SideNav
          tabs={tabs}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          profileImage={profileImage}
          profileName={profileName}
          onProfileClick={onProfileNavigate || onProfileClick}
          isAdminView={isAdminView}
          onExitAdmin={onExitAdmin}
        />

        <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ maxWidth: 1140, mx: "auto", px: { md: 4, lg: 6 }, py: 4 }}>
            {/* Page header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
              {showBack && (
                <IconButton onClick={onBack} aria-label="Back" size="small">
                  <ArrowBackIcon />
                </IconButton>
              )}
              {title && (
                <Typography variant="h1" component="h1">
                  {title}
                </Typography>
              )}
            </Box>

            <Box sx={{ animation: "fadeIn 0.3s ease-in-out" }}>{children}</Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // Legacy mobile layout (native app is the primary phone experience)
  return (
    <div
      className="app-container"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
      }}
    >
      <HeaderBar
        title={title}
        profileImage={profileImage}
        onProfileClick={onProfileClick}
        onLogoClick={() => selectedTab && onTabChange("updates")}
      />

      {/* Main content */}
      <div
        className="page-content"
        style={{
          flex: 1,
          backgroundColor: theme.palette.background.default,
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
          padding: "1rem",
          boxSizing: "border-box",
          overflowY: "auto",
          maxWidth: "100vw",
        }}
      >
        <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>{children}</div>
      </div>

      <BottomNavBar tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
    </div>
  );
}
