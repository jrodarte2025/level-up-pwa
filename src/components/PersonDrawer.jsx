// src/components/PersonDrawer.jsx
// R3 — read-only person detail drawer for the Directory. No Firestore
// access. Admin editing stays in Directory's legacy modal (untouched
// write paths) — the Edit button here just hands off via onEdit.
import React from "react";
import {
  Drawer,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  IconButton,
  Avatar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import EditIcon from "@mui/icons-material/Edit";
import { brandColors } from "../brandColors";
import { formatPhoneNumber } from "../utils/phoneValidation";

const ROLE_LABELS = {
  admin: "Level Up Team",
  "future-coach": "Future Coach",
  "coach-board": "Coach + Board",
};

const ROLE_COLORS = {
  coach: brandColors.primary.blue,
  student: brandColors.primary.coral,
  board: brandColors.accent.teal,
  "coach-board": brandColors.accent.teal,
  "future-coach": brandColors.secondary.softBlue,
  admin: brandColors.primary.blue,
};

// 16Personalities type names — mirrors the mobile app's
// src/data/pairingInsights.ts TYPE_NAMES (users.personalityCode is synced
// nightly from Salesforce by the pairing-insights feature)
const TYPE_NAMES = {
  INTJ: "Architect", INTP: "Logician", ENTJ: "Commander", ENTP: "Debater",
  INFJ: "Advocate", INFP: "Mediator", ENFJ: "Protagonist", ENFP: "Campaigner",
  ISTJ: "Logistician", ISFJ: "Defender", ESTJ: "Executive", ESFJ: "Consul",
  ISTP: "Virtuoso", ISFP: "Adventurer", ESTP: "Entrepreneur", ESFP: "Entertainer",
};

function FactRow({ icon, children, href }) {
  if (!children) return null;
  const content = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      {icon}
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  );
  if (href) {
    return (
      <Box
        component="a"
        href={href}
        sx={{
          textDecoration: "none",
          color: "text.primary",
          "&:hover": { color: "secondary.main" },
        }}
      >
        {content}
      </Box>
    );
  }
  return content;
}

export default function PersonDrawer({ open, user, isMyMatch = false, canEdit = false, onEdit, onClose }) {
  if (!user) return null;

  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
  const photo = user.headshotUrl || user.profileImage || "/default-avatar.png";
  const role = user.role || "";
  const roleLabel = ROLE_LABELS[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : "");
  const isStudent = role === "student";

  const subtitle = isStudent
    ? [user.major, user.graduationYear ? `Class of ${user.graduationYear}` : ""].filter(Boolean).join(", ")
    : [user.title, user.company].filter(Boolean).join(" at ");

  const linkedinHref = user.linkedinUrl
    ? user.linkedinUrl.startsWith("http")
      ? user.linkedinUrl
      : `https://${user.linkedinUrl}`
    : null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 440 },
          maxWidth: "100vw",
          boxShadow: "-20px 0 40px -12px rgba(15, 23, 42, 0.18)",
        },
      }}
    >
      {/* Single scroll container so the avatar can overlap the header band
          without being clipped at the scroll boundary */}
      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {/* Header band */}
        <Box
          sx={{
            position: "relative",
            height: 110,
            background: `linear-gradient(135deg, ${brandColors.primary.blue}, ${brandColors.primary.navyLight})`,
          }}
        >
          <IconButton
            onClick={onClose}
            aria-label="Close"
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: "rgba(255,255,255,0.9)",
              "&:hover": { backgroundColor: "#fff" },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          {isMyMatch && (
            <Chip
              label="Your Match"
              size="small"
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                backgroundColor: brandColors.primary.coral,
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            />
          )}
        </Box>

        <Box sx={{ px: 3, pb: 3 }}>
        <Avatar
          src={photo}
          alt={name}
          sx={{
            width: 96,
            height: 96,
            mt: "-48px",
            mb: 1.5,
            border: "4px solid #fff",
            boxShadow: "0 4px 12px rgba(24, 38, 78, 0.15)",
          }}
        />
        <Typography
          sx={{
            fontFamily: '"Poppins", "Roboto", sans-serif',
            fontWeight: 700,
            fontSize: "1.35rem",
            letterSpacing: "-0.5px",
            lineHeight: 1.25,
          }}
        >
          {name}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25, mb: 2.5 }}>
          {roleLabel && (
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                backgroundColor: ROLE_COLORS[role] || brandColors.neutral[500],
                color: "#fff",
                fontWeight: 600,
              }}
            />
          )}
          {user.alumni && (
            <Chip
              label="Alumni"
              size="small"
              sx={{ backgroundColor: brandColors.accent.tealPale, color: "#2F8990", fontWeight: 600 }}
            />
          )}
          {user.boardRole && (
            <Chip
              label={user.boardRole}
              size="small"
              sx={{ backgroundColor: brandColors.secondary.bluePale, color: brandColors.primary.blue, fontWeight: 600 }}
            />
          )}
          {user.personalityCode && (
            <Chip
              label={
                TYPE_NAMES[user.personalityCode]
                  ? `${user.personalityCode} · ${TYPE_NAMES[user.personalityCode]}`
                  : user.personalityCode
              }
              size="small"
              title="16Personalities type"
              sx={{
                backgroundColor: brandColors.primary.coralPale,
                color: brandColors.primary.coral,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            />
          )}
        </Box>

        <Divider sx={{ mb: 2, borderColor: brandColors.neutral[150] }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <FactRow
            icon={<EmailIcon sx={{ fontSize: 20, color: brandColors.secondary.softBlue }} />}
            href={user.email ? `mailto:${user.email}` : undefined}
          >
            {user.email}
          </FactRow>
          <FactRow
            icon={<LocalPhoneIcon sx={{ fontSize: 20, color: brandColors.secondary.softBlue }} />}
            href={user.phoneNumber ? `tel:${user.phoneNumber}` : undefined}
          >
            {user.phoneNumber ? formatPhoneNumber(user.phoneNumber) : null}
          </FactRow>
        </Box>

        {linkedinHref && (
          <Button
            component="a"
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<LinkedInIcon />}
            sx={{ mt: 2.5 }}
            fullWidth
          >
            LinkedIn profile
          </Button>
        )}

        {canEdit && (
          <>
            <Divider sx={{ my: 2.5, borderColor: brandColors.neutral[150] }} />
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => onEdit?.(user)}
              fullWidth
            >
              Edit user (admin)
            </Button>
          </>
        )}
        </Box>
      </Box>
    </Drawer>
  );
}
