// src/components/EventCard.jsx
// R2 — summary card only; clicking opens EventDrawer (details live there).
// Pure presentation: RSVP/Register flow up through onRSVP; no Firestore here.
import React from "react";
import { useTheme } from "@mui/material/styles";
import { brandColors } from "../brandColors";

export default function EventCard({
  event,
  isRSVPed = false,
  isMatchGoing = false,
  onRSVP,
  onClick,
}) {
  const theme = useTheme();

  const {
    id,
    name,
    timeRange,
    date,
    headerImage,
    required,
    isExternal,
    registrationUrl
  } = event;

  const formattedDate = date?.seconds
    ? new Date(date.seconds * 1000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    : "";

  const imageUrl = headerImage || "https://via.placeholder.com/400x225?text=Event";

  // Handle both array format ["students", "coaches"] and legacy string format "both"
  const groups = event.groups;
  const isForCoaches = Array.isArray(groups)
    ? groups.includes("coaches")
    : groups === "both" || groups === "coaches";
  const isForStudents = Array.isArray(groups)
    ? groups.includes("students")
    : groups === "both" || groups === "students";
  const isForBoth = isForCoaches && isForStudents;

  const audienceColor = isForBoth
    ? brandColors.accent.teal
    : isForCoaches
    ? brandColors.primary.blue
    : brandColors.secondary.softBlue;

  const badgeBase = {
    padding: "0.35rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    zIndex: 1,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    lineHeight: 1.2
  };

  const hasRegisterLink =
    typeof registrationUrl === "string" &&
    (registrationUrl.startsWith("http://") || registrationUrl.startsWith("https://"));

  return (
    <div
      key={id}
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        border: required
          ? `1px solid ${brandColors.primary.coralLight}`
          : `1px solid ${brandColors.neutral[200]}`,
        boxShadow: required
          ? "0 2px 12px rgba(241, 95, 94, 0.15)"
          : "0 1px 3px rgba(24, 38, 78, 0.06)",
        backgroundColor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        position: "relative",
        transition: "box-shadow 0.2s ease, transform 0.2s ease"
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(24, 38, 78, 0.12)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = required
          ? "0 2px 12px rgba(241, 95, 94, 0.15)"
          : "0 1px 3px rgba(24, 38, 78, 0.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header image */}
      <div style={{ position: "relative", width: "100%", height: "200px" }}>
        {/* Badge row: audience + external */}
        <div style={{
          position: "absolute",
          top: "0.75rem",
          left: "0.75rem",
          display: "flex",
          gap: "0.4rem",
          zIndex: 1
        }}>
          <span style={{ ...badgeBase, backgroundColor: audienceColor, color: "#fff" }}>
            {isForBoth ? "All Attendees" : isForCoaches ? "For Coaches" : "For Students"}
          </span>
          {isExternal === true && (
            <span style={{
              ...badgeBase,
              backgroundColor: brandColors.accent.tealPale,
              color: brandColors.accent.teal
            }}>
              External
            </span>
          )}
        </div>

        {/* Match Going Badge - stacked below badge row */}
        {isMatchGoing && !isExternal && (
          <span style={{
            position: "absolute",
            top: "2.9rem",
            left: "0.75rem",
            backgroundColor: brandColors.primary.blue,
            color: "#fff",
            padding: "0.25rem 0.6rem",
            borderRadius: "999px",
            fontSize: "0.7rem",
            fontWeight: 600,
            zIndex: 1
          }}>
            Your Match is Going
          </span>
        )}
        <img
          src={imageUrl}
          alt={name}
          style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(15, 26, 54, 0.75) 25%, transparent 65%)",
          pointerEvents: "none"
        }} />
        {/* Required badge - stays top-right */}
        {required && (
          <span style={{
            ...badgeBase,
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            backgroundColor: "var(--brand-primary-coral)",
            color: "#fff"
          }}>
            Required
          </span>
        )}
        <div style={{
          position: "absolute",
          bottom: "0.85rem",
          left: "1rem",
          right: "1rem",
          color: "#fff"
        }}>
          <h4 style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 700,
            fontFamily: '"Poppins", "Roboto", sans-serif',
            letterSpacing: "-0.25px",
            textShadow: "0 1px 4px rgba(0,0,0,0.4)"
          }}>{name}</h4>
          <p style={{ margin: "0.15rem 0 0", fontSize: "0.875rem", opacity: 0.95 }}>
            {formattedDate}{timeRange ? ` · ${timeRange}` : ""}
          </p>
        </div>
      </div>

      {/* Action row: Register (external) or RSVP / status */}
      {isExternal === true ? (
        hasRegisterLink ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(registrationUrl, "_blank", "noopener,noreferrer");
            }}
            style={{
              backgroundColor: "var(--brand-primary-coral)",
              color: "#fff",
              padding: "0.6rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.2s",
              margin: "0.85rem"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#DE4948"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--brand-primary-coral)"}
          >
            Register ↗
          </button>
        ) : (
          <div style={{ padding: "0.75rem 1.2rem", textAlign: "center" }}>
            <span style={{ color: theme.palette.text.secondary, fontWeight: 600, fontSize: "0.9rem" }}>
              Details →
            </span>
          </div>
        )
      ) : !isRSVPed ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRSVP?.(id);
          }}
          style={{
            backgroundColor: "var(--brand-primary-coral)",
            color: "#fff",
            padding: "0.6rem 1rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            transition: "background-color 0.2s",
            margin: "0.85rem"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#DE4948"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--brand-primary-coral)"}
        >
          RSVP
        </button>
      ) : (
        <div style={{ padding: "0.75rem 1.2rem", textAlign: "center" }}>
          <span style={{
            color: brandColors.functional.success,
            fontWeight: 700,
            fontSize: "0.95rem"
          }}>
            ✓ You're In!
          </span>
        </div>
      )}
    </div>
  );
}
