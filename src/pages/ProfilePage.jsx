// src/pages/ProfilePage.jsx
// B.3 — dedicated /profile route (bookmarkable). Read-only display of the
// signed-in user's profile; all editing still flows through the existing
// ProfileModal (opened via onEdit), so profile writes stay centralized
// in App.jsx and no write shapes change.
import React from "react";
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import EmailIcon from "@mui/icons-material/Email";
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

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="overline" sx={{ color: "text.secondary", display: "block", lineHeight: 1.6 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

export default function ProfilePage({
  user,
  userRole,
  profileImage,
  firstName,
  lastName,
  company,
  jobTitle,
  major,
  graduationYear,
  linkedinUrl,
  phoneNumber,
  onEdit = () => {},
  onSignOut = () => {},
}) {
  const displayName = `${firstName || ""} ${lastName || ""}`.trim() || user?.email;
  const roleLabel =
    ROLE_LABELS[userRole] ||
    (userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "");
  const isStudent = userRole === "student";

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Card sx={{ overflow: "hidden" }}>
        {/* Navy banner */}
        <Box
          sx={{
            height: 96,
            background: `linear-gradient(135deg, ${brandColors.primary.blue} 0%, ${brandColors.primary.navyLight} 100%)`,
          }}
        />
        <Box sx={{ px: { xs: 2.5, md: 4 }, pb: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: 2,
              mt: "-48px",
              mb: 3,
            }}
          >
            <Avatar
              src={profileImage}
              alt={displayName}
              sx={{
                width: 112,
                height: 112,
                border: "4px solid #fff",
                boxShadow: "0 4px 12px rgba(24, 38, 78, 0.15)",
              }}
            />
            <Box sx={{ flex: 1, minWidth: 200, pb: 0.5 }}>
              <Typography variant="h2" component="h2">
                {displayName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
                {roleLabel && (
                  <Chip
                    label={roleLabel}
                    size="small"
                    sx={{
                      backgroundColor: ROLE_COLORS[userRole] || brandColors.neutral[500],
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ mb: 0.5 }}
            >
              Edit profile
            </Button>
          </Box>

          {/* Details grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2.5,
              mb: 3,
            }}
          >
            {isStudent ? (
              <>
                <Detail label="Major" value={major} />
                <Detail label="Graduation year" value={graduationYear} />
              </>
            ) : (
              <>
                <Detail label="Company" value={company} />
                <Detail label="Title" value={jobTitle} />
              </>
            )}
            <Detail
              label="Email"
              value={
                user?.email && (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <EmailIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                    {user.email}
                  </Box>
                )
              }
            />
            <Detail
              label="Phone"
              value={
                phoneNumber && (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <LocalPhoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                    {formatPhoneNumber(phoneNumber)}
                  </Box>
                )
              }
            />
          </Box>

          {linkedinUrl && (
            <Button
              component="a"
              href={linkedinUrl.startsWith("http") ? linkedinUrl : `https://${linkedinUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<LinkedInIcon />}
              sx={{ mb: 3 }}
            >
              LinkedIn profile
            </Button>
          )}

          <Divider sx={{ mb: 2.5 }} />
          <Button
            variant="text"
            color="secondary"
            startIcon={<LogoutIcon />}
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
