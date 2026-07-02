// src/components/EventCard.jsx
// Presentational event card (no Firestore writes — all mutations flow up
// through onRSVP). Desktop-first redesign: bordered card, hover lift,
// external-event support (B.2) mirroring the mobile app's phase-13 UI:
// teal "External" pill, RSVP suppressed, Register button → registrationUrl.
import React from "react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import AvatarList from "./AvatarList";
import { useTheme } from "@mui/material/styles";
import { brandColors } from "../brandColors";

export default function EventCard({
  event,
  isRSVPed = false,
  isMatchGoing = false,
  onRSVP,
  onClick,
  expanded = false,
  showDetails = false,
  attendingUsers = [],
  toggleDetails
}) {
  const theme = useTheme();

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

  const generateCalendarLinks = () => {
    if (!date?.seconds || !timeRange) return {};

    const title = encodeURIComponent(name);
    const locationStr = encodeURIComponent(location || "");
    const descriptionStr = encodeURIComponent(description || "");
    const start = new Date(date.seconds * 1000);
    const normalized = timeRange.replace(/[-–—]/g, "|");
    const [startHour, endHour] = normalized.split("|").map(t => t?.trim());

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

  // Handle both array format ["students", "coaches"] and legacy string format "both"
  const groups = event.groups;
  const isForCoaches = Array.isArray(groups)
    ? groups.includes("coaches")
    : groups === "both" || groups === "coaches";
  const isForStudents = Array.isArray(groups)
    ? groups.includes("students")
    : groups === "both" || groups === "students";
  const isForBoth = isForCoaches && isForStudents;

  // Audience color for badges + left accent
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
        hasRegisterLink && (
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

      {/* Expanded details */}
      {expanded && showDetails && (
        <div style={{ padding: "1.5rem 1.25rem", borderTop: `1px solid ${brandColors.neutral[150]}`, background: theme.palette.background.default }}>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500 }}>
            <strong>Date:</strong> {formattedDate}
          </p>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500 }}>
            <strong>Time:</strong> {timeRange}
          </p>
          <p style={{ margin: "0 0 1rem", fontWeight: 500 }}>
            <strong>Location:</strong>{" "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: theme.palette.primary.main, textDecoration: "underline" }}
            >
              {location}
            </a>
          </p>
          <p style={{ marginBottom: "0.5rem", fontWeight: 500 }}>
            <strong>Details:</strong>
          </p>
          {/* Check if content is HTML (new events) or Markdown (legacy events) */}
          {(() => {
            // More robust HTML detection
            const isHTML = description &&
              (description.includes('<p>') || description.includes('<strong>') ||
               description.includes('<em>') || description.includes('<ul>') ||
               description.includes('<li>') || description.includes('<br'));

            if (isHTML) {
              try {
                const sanitizedHTML = DOMPurify.sanitize(description, {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3'],
                  ALLOWED_ATTR: ['href', 'target', 'rel']
                });
                return (
                  <>
                    <style>
                      {`
                        .event-description-content a {
                          color: ${theme.palette.primary.main};
                          text-decoration: underline;
                        }
                        .event-description-content p {
                          margin: 0 0 0.5rem 0;
                        }
                        .event-description-content p:last-child {
                          margin: 0;
                        }
                        .event-description-content ul,
                        .event-description-content ol {
                          margin: 0.5rem 0;
                          padding-left: 1.5rem;
                        }
                        .event-description-content li {
                          margin: 0.25rem 0;
                        }
                      `}
                    </style>
                    <div
                      className="event-description-content"
                      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                      style={{
                        fontSize: "0.95rem",
                        lineHeight: 1.6
                      }}
                    />
                  </>
                );
              } catch (error) {
                console.warn('DOMPurify failed, falling back to text:', error);
                // Fallback: strip HTML tags and show as plain text
                const plainText = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                return (
                  <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6 }}>
                    {plainText}
                  </p>
                );
              }
            } else {
              // Legacy Markdown content
              return (
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => (
                      <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6 }} {...props} />
                    ),
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: theme.palette.primary.main,
                          textDecoration: "underline"
                        }}
                      />
                    )
                  }}
                >
                  {description}
                </ReactMarkdown>
              );
            }
          })()}
          {!isExternal && attendingUsers.length > 0 && (
            <>
              <p style={{ marginTop: "1.5rem", marginBottom: "0.5rem", fontWeight: 500 }}>
                Who's Attending:
              </p>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDetails?.();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1.25rem",
                  cursor: "pointer",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <AvatarList size={40} users={attendingUsers} />
              </div>
            </>
          )}
          {!isExternal && isRSVPed && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "1rem", flexWrap: "wrap" }}>
              <p style={{ fontSize: "0.85rem", margin: 0, color: theme.palette.text.secondary }}>
                Add to calendar:{" "}
                <a href={generateCalendarLinks().google} target="_blank" rel="noreferrer" style={{ color: theme.palette.primary.main, textDecoration: "underline" }}>Google</a>,{" "}
                <a href={generateCalendarLinks().ics} download={`${name}.ics`} style={{ color: theme.palette.primary.main, textDecoration: "underline" }}>iCal</a>,{" "}
                <a href={generateCalendarLinks().outlook} download={`${name}.ics`} style={{ color: theme.palette.primary.main, textDecoration: "underline" }}>Outlook</a>
              </p>
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  onRSVP?.(id, true); // force cancel
                }}
                style={{
                  margin: 0,
                  color: "var(--brand-primary-coral)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textDecorationColor: "transparent",
                  transition: "text-decoration-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = "#F15F5E"}
                onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = "transparent"}
              >
                Can't make it anymore? Cancel RSVP
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
