// src/components/SideNav.jsx
// Desktop-first persistent left sidebar. Mirrors the admin dashboard's
// navigation pattern (240px white rail, navy active state) using MUI.
import React from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import LogoutIcon from "@mui/icons-material/Logout";
import { brandColors } from "../brandColors";

const iconMap = {
  updates: ChatBubbleIcon,
  events: EventIcon,
  directory: PeopleIcon,
  resources: MenuBookIcon,
  adminMatches: HowToRegIcon,
};

const NAV_ORDER = ["updates", "events", "directory", "resources", "adminMatches"];

export const SIDENAV_WIDTH = 250;

export default function SideNav({
  tabs = [],
  selectedTab,
  onTabChange,
  profileImage,
  profileName = "",
  onProfileClick = () => {},
  onExitAdmin,
  isAdminView = false,
}) {
  const sortedTabs = [...tabs].sort(
    (a, b) => NAV_ORDER.indexOf(a.key) - NAV_ORDER.indexOf(b.key)
  );

  return (
    <Box
      component="aside"
      sx={{
        width: SIDENAV_WIDTH,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
        borderRight: `1px solid ${brandColors.neutral[200]}`,
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Level Up Cincinnati"
          onClick={() => onTabChange("updates")}
          sx={{ height: 40, objectFit: "contain", cursor: "pointer", display: "block" }}
        />
      </Box>

      {isAdminView && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <Box
            sx={{
              display: "inline-block",
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              background: `linear-gradient(135deg, ${brandColors.primary.blue}, ${brandColors.primary.navyLight})`,
              color: "#fff",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Admin view
          </Box>
        </Box>
      )}

      {/* Nav items */}
      <List sx={{ px: 1.5, py: 0.5, flex: 1 }}>
        {sortedTabs.map((tab) => {
          const Icon = iconMap[tab.key] || ChatBubbleIcon;
          const active = selectedTab === tab.key;
          return (
            <ListItemButton
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              sx={{
                borderRadius: "8px",
                mb: 0.5,
                py: 1,
                px: 1.5,
                color: active ? "#fff" : brandColors.neutral[600],
                backgroundColor: active ? brandColors.primary.blue : "transparent",
                "&:hover": {
                  backgroundColor: active
                    ? brandColors.primary.navyLight
                    : brandColors.neutral[150],
                },
                transition: "background-color 120ms ease",
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                <Icon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={tab.label}
                primaryTypographyProps={{
                  fontSize: "0.9rem",
                  fontWeight: active ? 600 : 500,
                }}
              />
            </ListItemButton>
          );
        })}

        {isAdminView && onExitAdmin && (
          <ListItemButton
            onClick={onExitAdmin}
            sx={{
              borderRadius: "8px",
              mt: 1,
              py: 1,
              px: 1.5,
              color: brandColors.primary.coral,
              "&:hover": { backgroundColor: brandColors.primary.coralPale },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
              <LogoutIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Exit admin view"
              primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 600 }}
            />
          </ListItemButton>
        )}
      </List>

      {/* Profile footer */}
      <Box sx={{ px: 1.5, pb: 2 }}>
        <Divider sx={{ mb: 1.5, borderColor: brandColors.neutral[150] }} />
        <ListItemButton
          onClick={onProfileClick}
          sx={{
            borderRadius: "8px",
            py: 1,
            px: 1.5,
            "&:hover": { backgroundColor: brandColors.neutral[150] },
          }}
        >
          <Avatar src={profileImage} sx={{ width: 36, height: 36, mr: 1.5 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "text.primary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {profileName || "Your profile"}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              View profile
            </Typography>
          </Box>
        </ListItemButton>
      </Box>
    </Box>
  );
}
