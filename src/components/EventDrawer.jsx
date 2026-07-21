// src/components/EventDrawer.jsx
// R2 — right-side event detail drawer (admin-app pattern, 580px).
// Pure presentation: RSVP/cancel/register flow through the onRSVP handler
// passed in from UserDashboard; no Firestore access here.
import React from "react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import {
  Drawer,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  IconButton,
  Avatar,
  AvatarGroup,
  Collapse,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EventIcon from "@mui/icons-material/Event";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PlaceIcon from "@mui/icons-material/Place";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { brandColors } from "../brandColors";

const generateCalendarLinks = (event) => {
  if (!event?.date?.seconds || !event?.timeRange) return {};

  const title = encodeURIComponent(event.name);
  const locationStr = encodeURIComponent(event.location || "");
  const descriptionStr = encodeURIComponent(event.description || "");
  const start = new Date(event.date.seconds * 1000);
  const normalized = event.timeRange.replace(/[-–—]/g, "|");
  const [startHour, endHour] = normalized.split("|").map((t) => t?.trim());

  if (!startHour || !endHour) return {};

  const startDateTime = new Date(`${start.toDateString()} ${startHour}`);
  const endDateTime = new Date(`${start.toDateString()} ${endHour}`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) return {};

  const format = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${format(startDateTime)}/${format(endDateTime)}`;

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${descriptionStr}&location=${locationStr}&sf=true&output=xml`;
  const ics = `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${title}%0ADESCRIPTION:${descriptionStr}%0ALOCATION:${locationStr}%0ADTSTART:${format(startDateTime)}%0ADTEND:${format(endDateTime)}%0AEND:VEVENT%0AEND:VCALENDAR`;

  return { google, ics, outlook: ics };
};

function EventDescription({ description }) {
  const theme = { link: brandColors.primary.coral };
  if (!description) return null;

  const isHTML =
    description.includes("<p>") || description.includes("<strong>") ||
    description.includes("<em>") || description.includes("<ul>") ||
    description.includes("<li>") || description.includes("<br");

  if (isHTML) {
    const sanitizedHTML = DOMPurify.sanitize(description, {
      ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "pre", "code", "h1", "h2", "h3"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });
    return (
      <Box
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
        sx={{
          "& p": { fontSize: "0.95rem", lineHeight: 1.65, m: 0, mb: "0.75em", color: "text.primary" },
          "& p:last-child": { mb: 0 },
          "& a": { color: theme.link, textDecoration: "underline" },
          "& ul, & ol": { pl: "1.5rem", my: "0.5em" },
          "& li": { mb: "0.25em", fontSize: "0.95rem", lineHeight: 1.6 },
          "& strong, & b": { fontWeight: 600 },
        }}
      />
    );
  }
  return (
    <ReactMarkdown
      components={{
        p: ({ node, ...props }) => (
          <p style={{ margin: "0 0 0.75em", fontSize: "0.95rem", lineHeight: 1.65 }} {...props} />
        ),
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: theme.link, textDecoration: "underline" }} />
        ),
      }}
    >
      {description}
    </ReactMarkdown>
  );
}

export default function EventDrawer({
  open,
  event,
  isRSVPed = false,
  isMatchGoing = false,
  attendingUsers = [],
  onRSVP,
  onClose,
}) {
  const [showAttendeeList, setShowAttendeeList] = React.useState(false);

  // Collapse the roster again whenever a different event opens
  React.useEffect(() => {
    setShowAttendeeList(false);
  }, [event?.id]);

  if (!event) return null;

  const {
    id,
    name,
    description,
    location,
    timeRange,
    date,
    headerImage,
    required,
    isExternal,
    registrationUrl,
  } = event;

  const formattedDate = date?.seconds
    ? new Date(date.seconds * 1000).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const groups = event.groups;
  const isForCoaches = Array.isArray(groups)
    ? groups.includes("coaches")
    : groups === "both" || groups === "coaches";
  const isForStudents = Array.isArray(groups)
    ? groups.includes("students")
    : groups === "both" || groups === "students";
  const isForBoard = Array.isArray(groups)
    ? groups.includes("board")
    : groups === "board";
  const isForBoth = isForCoaches && isForStudents;

  const audienceColor = isForBoth
    ? brandColors.accent.teal
    : isForCoaches
    ? brandColors.primary.blue
    : isForBoard
    ? brandColors.primary.navyDark
    : brandColors.secondary.softBlue;

  const hasRegisterLink =
    typeof registrationUrl === "string" &&
    (registrationUrl.startsWith("http://") || registrationUrl.startsWith("https://"));

  const cal = generateCalendarLinks(event);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 580 },
          maxWidth: "100vw",
          boxShadow: "-20px 0 40px -12px rgba(15, 23, 42, 0.18)",
        },
      }}
    >
      {/* Hero */}
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        {headerImage ? (
          <Box
            component="img"
            src={headerImage}
            alt={name}
            sx={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: 120,
              background: `linear-gradient(135deg, ${brandColors.primary.blue}, ${brandColors.primary.navyLight})`,
            }}
          />
        )}
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            backgroundColor: "rgba(255,255,255,0.9)",
            "&:hover": { backgroundColor: "#fff" },
          }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Box sx={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 0.75 }}>
          <Chip
            label={isForBoth ? "All Attendees" : isForCoaches ? "For Coaches" : isForBoard ? "For Board" : "For Students"}
            size="small"
            sx={{ backgroundColor: audienceColor, color: "#fff", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}
          />
          {isExternal === true && (
            <Chip
              label="External"
              size="small"
              sx={{ backgroundColor: brandColors.accent.tealPale, color: "#2F8990", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}
            />
          )}
          {required && (
            <Chip
              label="Required"
              size="small"
              sx={{ backgroundColor: brandColors.primary.coral, color: "#fff", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}
            />
          )}
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3, overflowY: "auto", flex: 1 }}>
        <Typography
          sx={{
            fontFamily: '"Poppins", "Roboto", sans-serif',
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "-0.5px",
            lineHeight: 1.25,
            mb: 2,
          }}
        >
          {name}
        </Typography>

        {/* Facts */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2.5 }}>
          {formattedDate && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "text.primary" }}>
              <EventIcon sx={{ fontSize: 20, color: brandColors.secondary.softBlue }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{formattedDate}</Typography>
            </Box>
          )}
          {timeRange && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <ScheduleIcon sx={{ fontSize: 20, color: brandColors.secondary.softBlue }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{timeRange}</Typography>
            </Box>
          )}
          {location && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <PlaceIcon sx={{ fontSize: 20, color: brandColors.secondary.softBlue }} />
              <Typography
                component="a"
                variant="body2"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                target="_blank"
                rel="noreferrer"
                sx={{ fontWeight: 500, color: "text.primary", textDecorationColor: brandColors.neutral[300], "&:hover": { color: "secondary.main" } }}
              >
                {location}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Primary action */}
        <Box sx={{ mb: 3 }}>
          {isExternal === true ? (
            hasRegisterLink && (
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                size="large"
                endIcon={<OpenInNewIcon />}
                onClick={() => window.open(registrationUrl, "_blank", "noopener,noreferrer")}
              >
                Register
              </Button>
            )
          ) : !isRSVPed ? (
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              size="large"
              onClick={() => onRSVP?.(id)}
            >
              RSVP
            </Button>
          ) : (
            <Box sx={{ textAlign: "center" }}>
              <Chip
                label="✓ You're in!"
                sx={{
                  backgroundColor: brandColors.functional.successPale,
                  color: "#047857",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  px: 1,
                  py: 2.25,
                }}
              />
              <Typography
                onClick={() => onRSVP?.(id, true)}
                variant="body2"
                sx={{
                  mt: 1,
                  color: "secondary.main",
                  fontWeight: 600,
                  cursor: "pointer",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Can't make it anymore? Cancel RSVP
              </Typography>
            </Box>
          )}
        </Box>

        {isMatchGoing && !isExternal && (
          <Chip
            label="Your match is going 🎉"
            size="small"
            sx={{
              mb: 2.5,
              backgroundColor: brandColors.secondary.bluePale,
              color: brandColors.primary.blue,
              fontWeight: 600,
            }}
          />
        )}

        {description && (
          <>
            <Divider sx={{ mb: 2, borderColor: brandColors.neutral[150] }} />
            <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
              About this event
            </Typography>
            <EventDescription description={description} />
          </>
        )}

        {!isExternal && attendingUsers.length > 0 && (
          <>
            <Divider sx={{ my: 2.5, borderColor: brandColors.neutral[150] }} />
            <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
              Who's attending ({attendingUsers.length})
            </Typography>
            {/* Compact avatar strip — click to expand the named list */}
            <Box
              onClick={() => setShowAttendeeList((v) => !v)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                borderRadius: 2,
                p: 0.75,
                mx: -0.75,
                "&:hover": { backgroundColor: brandColors.neutral[100] },
              }}
            >
              <AvatarGroup
                max={6}
                sx={{
                  "& .MuiAvatar-root": { width: 36, height: 36, fontSize: "0.85rem" },
                }}
              >
                {attendingUsers.map((u, i) => (
                  <Avatar key={i} src={u.profileImage} alt={u.displayName || u.email}>
                    {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                  </Avatar>
                ))}
              </AvatarGroup>
              <Typography variant="body2" sx={{ color: "secondary.main", fontWeight: 600, ml: 0.5 }}>
                {showAttendeeList ? "Hide list" : "See who's going"}
              </Typography>
              {showAttendeeList ? (
                <ExpandLessIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              )}
            </Box>
            <Collapse in={showAttendeeList}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1.5 }}>
                {attendingUsers.map((u, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Avatar src={u.profileImage} alt={u.displayName || u.email} sx={{ width: 28, height: 28 }}>
                      {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {u.displayName || u.email}
                      {u.guestCount > 0 && (
                        <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.75 }}>
                          +{u.guestCount} guest{u.guestCount > 1 ? "s" : ""}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </>
        )}

        {!isExternal && isRSVPed && cal.google && (
          <>
            <Divider sx={{ my: 2.5, borderColor: brandColors.neutral[150] }} />
            <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
              Add to calendar
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} component="a" href={cal.google} target="_blank" rel="noreferrer">
                Google
              </Button>
              <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} component="a" href={cal.ics} download={`${name}.ics`}>
                iCal
              </Button>
              <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} component="a" href={cal.outlook} download={`${name}.ics`}>
                Outlook
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
