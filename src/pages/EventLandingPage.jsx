import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import AvatarList from "../components/AvatarList";
import GuestCountModal from "../components/GuestCountModal";

export default function EventLandingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRSVPed, setIsRSVPed] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [attendingUsers, setAttendingUsers] = useState([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [currentGuestCount, setCurrentGuestCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

  // Ref for timeout cleanup
  const successTimeoutRef = useRef(null);

  // Helper function for login redirect
  const redirectToLogin = () => {
    sessionStorage.setItem("redirectAfterLogin", location.pathname);
    navigate("/login");
  };

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          setUser({ uid: u.uid, email: u.email, ...userDoc.data() });
        } else {
          setUser({ uid: u.uid, email: u.email });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        // First try to find by slug
        const eventsRef = collection(db, "events");
        const slugQuery = query(eventsRef, where("slug", "==", eventId));
        const slugSnapshot = await getDocs(slugQuery);

        let eventData = null;
        let eventDocId = null;

        if (!slugSnapshot.empty) {
          // Found by slug
          const eventSnap = slugSnapshot.docs[0];
          eventData = eventSnap.data();
          eventDocId = eventSnap.id;
        } else {
          // Try by document ID
          const eventDoc = await getDoc(doc(db, "events", eventId));
          if (eventDoc.exists()) {
            eventData = eventDoc.data();
            eventDocId = eventDoc.id;
          }
        }

        if (eventData) {
          setEvent({ id: eventDocId, ...eventData });
        } else {
          setError("Event not found");
        }
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Check RSVP status and fetch attendees
  useEffect(() => {
    if (!event?.id || !user?.uid) return;

    const checkRSVP = async () => {
      try {
        const rsvpDoc = await getDoc(doc(db, "rsvps", `${user.uid}_${event.id}`));
        if (rsvpDoc.exists() && rsvpDoc.data().attending) {
          setIsRSVPed(true);
          setCurrentGuestCount(rsvpDoc.data().guestCount || 0);
        }
      } catch (err) {
        console.error("Error checking RSVP:", err);
      }
    };

    const fetchAttendees = async () => {
      try {
        const rsvpQuery = query(
          collection(db, "rsvps"),
          where("eventId", "==", event.id),
          where("attending", "==", true)
        );
        const rsvpSnapshot = await getDocs(rsvpQuery);

        const attendees = await Promise.all(
          rsvpSnapshot.docs.map(async (rsvpDoc) => {
            const rsvpData = rsvpDoc.data();

            // Use denormalized data if available (new RSVPs)
            if (rsvpData.userName) {
              return {
                id: rsvpData.userId,
                fullName: rsvpData.userName,
                profileImage: rsvpData.userAvatar,
                guestCount: rsvpData.guestCount || 0
              };
            }

            // Fall back to fetching user doc for older RSVPs without denormalized data
            const userDoc = await getDoc(doc(db, "users", rsvpData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: userDoc.id,
                ...userData,
                profileImage: userData.profileImage || userData.headshotUrl,
                guestCount: rsvpData.guestCount || 0
              };
            }
            return null;
          })
        );

        setAttendingUsers(attendees.filter(Boolean));
      } catch (err) {
        console.error("Error fetching attendees:", err);
      }
    };

    checkRSVP();
    fetchAttendees();
  }, [event?.id, user?.uid]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Handle RSVP
  const handleRSVP = async (guestCount = 0) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    setRsvpLoading(true);
    setErrorMessage("");
    try {
      const rsvpRef = doc(db, "rsvps", `${user.uid}_${event.id}`);

      // Denormalize user data in RSVP for efficient attendee list fetching
      await setDoc(rsvpRef, {
        userId: user.uid,
        eventId: event.id,
        attending: true,
        guestCount: guestCount,
        rsvpTimestamp: Timestamp.now(),
        // Denormalized user data
        userName: user.fullName || user.email,
        userAvatar: user.profileImage || user.headshotUrl || null
      });

      setIsRSVPed(true);
      setCurrentGuestCount(guestCount);
      setSuccessMessage("You're in! See you there.");

      // Clear any existing timeout and set new one
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 5000);

      // Add to attendees list with race condition protection
      setAttendingUsers(prev => {
        // Check if user already exists to prevent duplicates
        if (prev.some(u => u.id === user.uid)) {
          return prev.map(u =>
            u.id === user.uid ? { ...u, guestCount } : u
          );
        }
        return [...prev, {
          id: user.uid,
          fullName: user.fullName,
          profileImage: user.profileImage || user.headshotUrl,
          guestCount
        }];
      });
    } catch (err) {
      console.error("Error RSVPing:", err);
      setErrorMessage("Failed to RSVP. Please try again.");
    } finally {
      setRsvpLoading(false);
      setShowGuestModal(false);
    }
  };

  // Handle Cancel RSVP
  const handleCancelRSVP = async () => {
    if (!user || !event) return;

    setRsvpLoading(true);
    setErrorMessage("");
    try {
      const rsvpRef = doc(db, "rsvps", `${user.uid}_${event.id}`);
      await setDoc(rsvpRef, {
        userId: user.uid,
        eventId: event.id,
        attending: false,
        guestCount: 0,
        rsvpTimestamp: Timestamp.now()
      });

      setIsRSVPed(false);
      setCurrentGuestCount(0);
      setAttendingUsers(prev => prev.filter(u => u.id !== user.uid));
    } catch (err) {
      console.error("Error canceling RSVP:", err);
      setErrorMessage("Failed to cancel RSVP. Please try again.");
    } finally {
      setRsvpLoading(false);
    }
  };

  // Generate calendar links
  const generateCalendarLinks = () => {
    if (!event?.date?.seconds || !event?.timeRange) return {};

    const title = encodeURIComponent(event.name || "Event");
    const locationStr = encodeURIComponent(event.location || "");
    const descriptionStr = encodeURIComponent(event.description?.replace(/<[^>]*>/g, '') || "");

    // Handle multiple dash types (hyphen, en-dash, em-dash)
    const normalizedTimeRange = event.timeRange.replace(/[-–—]/g, "|");
    const [startHour, endHour] = normalizedTimeRange.split("|").map(t => t?.trim());

    if (!startHour || !endHour) return {};

    const start = new Date(event.date.seconds * 1000);
    const startDateTime = new Date(`${start.toDateString()} ${startHour}`);
    const endDateTime = new Date(`${start.toDateString()} ${endHour}`);

    // Validate dates are valid
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) return {};

    const format = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${format(startDateTime)}/${format(endDateTime)}`;

    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${descriptionStr}&location=${locationStr}&sf=true&output=xml`;
    const ics = `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${title}%0ADESCRIPTION:${descriptionStr}%0ALOCATION:${locationStr}%0ADTSTART:${format(startDateTime)}%0ADTEND:${format(endDateTime)}%0AEND:VEVENT%0AEND:VCALENDAR`;

    return { google, ics, outlook: ics };
  };

  // Handle sharing event link
  const handleShareEvent = async () => {
    const eventUrl = `https://app.levelupcincinnati.org/event/${event.slug || event.id}`;

    // Use Web Share API on mobile, clipboard on desktop
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: `Check out this event: ${event.name}`,
          url: eventUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Desktop fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(eventUrl);
        setSuccessMessage("Event link copied to clipboard!");
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 3000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = eventUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setSuccessMessage("Event link copied to clipboard!");
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 3000);
      }
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "Date TBD";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  if (loading || authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.palette.background.default
      }}>
        <img src="/logo.png" alt="Level Up Cincinnati" style={{ height: "64px", marginBottom: "1rem" }} />
        <div style={{ fontSize: "0.9rem", color: theme.palette.text.secondary }}>
          Loading event...
        </div>
      </div>
    );
  }

  if (error) {
    // If user is not logged in, show "Members Only" message instead of "Not Found"
    // This handles the case where Firestore rules require authentication
    if (!user) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.palette.background.default,
          padding: "2rem",
          textAlign: "center"
        }}>
          <img src="/logo.png" alt="Level Up Cincinnati" style={{ height: "64px", marginBottom: "1.5rem" }} />
          <div style={{
            fontSize: "3rem",
            marginBottom: "1rem"
          }}>
            🔒
          </div>
          <h2 style={{ color: theme.palette.text.primary, marginBottom: "0.5rem" }}>
            Members Only
          </h2>
          <p style={{
            color: theme.palette.text.secondary,
            marginBottom: "1.5rem",
            maxWidth: "300px",
            lineHeight: 1.5
          }}>
            This event is for Level Up members. Please log in to view the event details.
          </p>
          <button
            className="button-primary"
            onClick={redirectToLogin}
            style={{ marginBottom: "1rem" }}
          >
            Log In to View Event
          </button>
          <p style={{
            color: theme.palette.text.secondary,
            fontSize: "0.85rem"
          }}>
            Not a member?{" "}
            <button
              onClick={() => {
                sessionStorage.setItem("redirectAfterLogin", location.pathname);
                navigate("/signup");
              }}
              style={{
                background: "none",
                border: "none",
                color: theme.palette.primary.main,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                fontSize: "0.85rem"
              }}
            >
              Sign up here
            </button>
          </p>
        </div>
      );
    }

    // User is logged in but event not found - show actual error
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.palette.background.default,
        padding: "2rem"
      }}>
        <img src="/logo.png" alt="Level Up Cincinnati" style={{ height: "64px", marginBottom: "1rem" }} />
        <h2 style={{ color: theme.palette.text.primary, marginBottom: "0.5rem" }}>Event Not Found</h2>
        <p style={{ color: theme.palette.text.secondary, marginBottom: "1.5rem" }}>
          This event may have been removed or the link is incorrect.
        </p>
        <button
          className="button-primary"
          onClick={() => navigate("/")}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const imageUrl = event.headerImage || "https://via.placeholder.com/1200x675?text=Level+Up+Event";
  const calendarLinks = generateCalendarLinks();

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: theme.palette.background.default
    }}>
      {/* Success Message Toast */}
      {successMessage && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: theme.palette.success?.main || "#10b981",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontWeight: 500
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: theme.palette.error?.main || "#dc2626",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontWeight: 500
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Hero Section */}
      <div style={{
        width: "100%",
        padding: "0 1rem",
        paddingTop: "1rem",
        boxSizing: "border-box"
      }}>
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(24, 38, 78, 0.15)"
        }}>
          {/* Aspect ratio container - 16:9 */}
          <div style={{
            position: "relative",
            width: "100%",
            paddingTop: "56.25%", /* 16:9 aspect ratio */
          }}>
            <img
              src={imageUrl}
              alt={event.name}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)"
            }} />

            {/* Logo */}
            <div style={{
              position: "absolute",
              top: "1rem",
              left: "1rem"
            }}>
              <img
                src="/logo.png"
                alt="Level Up"
                style={{
                  height: "36px",
                  filter: "brightness(0) invert(1)",
                  opacity: 0.9
                }}
              />
            </div>

            {/* Event Title */}
            <div style={{
              position: "absolute",
              bottom: "1.25rem",
              left: "1.25rem",
              right: "1.25rem",
              color: "#fff"
            }}>
              {event.required && (
                <span style={{
                  backgroundColor: "var(--brand-primary-coral)",
                  color: "#fff",
                  padding: "0.3rem 0.7rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.6rem",
                  display: "inline-block"
                }}>
                  Required
                </span>
              )}
              <h1 style={{
                fontSize: "clamp(1.35rem, 4vw, 2.25rem)",
                fontWeight: 700,
                fontFamily: '"Poppins", "Roboto", sans-serif',
                letterSpacing: "-0.5px",
                margin: 0,
                textShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}>
                {event.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "1.5rem"
      }}>
        {/* Date, Time, Location */}
        <div style={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: `1px solid ${theme.palette.divider}`
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.25rem" }}>📅</span>
            <div>
              <div style={{ fontWeight: 600, color: theme.palette.text.primary }}>
                {formatDate(event.date)}
              </div>
              <div style={{ color: theme.palette.text.secondary, fontSize: "0.95rem" }}>
                {event.timeRange}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.25rem" }}>📍</span>
            <div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: theme.palette.primary.main,
                  textDecoration: "underline",
                  fontWeight: 500
                }}
              >
                {event.location}
              </a>
            </div>
          </div>
        </div>

        {/* RSVP Button */}
        {!isRSVPed ? (
          <button
            onClick={() => {
              if (!user) {
                redirectToLogin();
              } else if (event.allowGuests) {
                setShowGuestModal(true);
              } else {
                handleRSVP(0);
              }
            }}
            disabled={rsvpLoading}
            className="button-primary"
            aria-label={user ? "RSVP to this event" : "Log in to RSVP"}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              backgroundColor: "var(--brand-primary-coral)",
              borderRadius: "10px",
              opacity: rsvpLoading ? 0.7 : 1
            }}
          >
            {rsvpLoading ? "Saving..." : user ? "RSVP Now" : "Log In to RSVP"}
          </button>
        ) : (
          <div style={{
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 45, 95, 0.3)' : '#f8f8f8',
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(107, 123, 168, 0.3)' : '#e5e7eb'}`,
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            textAlign: "center"
          }}>
            {/* Success Icon - Navy circle with checkmark */}
            <div style={{
              width: "56px",
              height: "56px",
              background: "linear-gradient(135deg, #1e2d5f 0%, #18264e 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "1.5rem",
              color: "#fff"
            }}>
              ✓
            </div>
            <div style={{
              fontWeight: 600,
              color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#18264e',
              fontSize: "1.1rem",
              marginBottom: "0.25rem"
            }}>
              You're Registered!
            </div>
            {currentGuestCount > 0 && (
              <div style={{
                fontSize: "0.875rem",
                color: theme.palette.mode === 'dark' ? '#9ca3af' : '#666',
                marginBottom: "0.5rem"
              }}>
                + {currentGuestCount} guest{currentGuestCount !== 1 ? "s" : ""}
              </div>
            )}

            {/* Calendar Links */}
            <div style={{
              marginTop: "1.25rem",
              paddingTop: "1.25rem",
              borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(107, 123, 168, 0.2)' : '#e5e7eb'}`,
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap"
            }}>
              <a
                href={calendarLinks.google}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: `2px solid ${theme.palette.mode === 'dark' ? '#6B7BA8' : '#18264e'}`,
                  color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#18264e',
                  backgroundColor: "transparent",
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: "all 0.2s"
                }}
              >
                Add to Google
              </a>
              <a
                href={calendarLinks.ics}
                download={`${event.name}.ics`}
                style={{
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: `2px solid ${theme.palette.mode === 'dark' ? '#6B7BA8' : '#18264e'}`,
                  color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#18264e',
                  backgroundColor: "transparent",
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: "all 0.2s"
                }}
              >
                Add to Calendar
              </a>
              <button
                onClick={handleShareEvent}
                style={{
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: `2px solid ${theme.palette.mode === 'dark' ? '#6B7BA8' : '#18264e'}`,
                  color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#18264e',
                  backgroundColor: "transparent",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.2s"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share Event
              </button>
            </div>

            {/* Cancel RSVP - Muted, not alarming */}
            <button
              onClick={handleCancelRSVP}
              disabled={rsvpLoading}
              aria-label="Cancel your RSVP"
              style={{
                marginTop: "1rem",
                background: "none",
                border: "none",
                color: theme.palette.mode === 'dark' ? '#9ca3af' : '#888',
                fontSize: "0.8rem",
                cursor: "pointer",
                padding: "0.5rem",
                opacity: rsvpLoading ? 0.5 : 1
              }}
            >
              Cancel RSVP
            </button>
          </div>
        )}

        {/* Additional Registration Link */}
        {event.additionalRegistrationUrl && isRSVPed && (
          <div style={{
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(241, 95, 94, 0.1)' : 'rgba(241, 95, 94, 0.06)',
            borderLeft: "4px solid #F15F5E",
            borderRadius: "0 8px 8px 0",
            padding: "1.25rem",
            marginBottom: "1.5rem"
          }}>
            <div style={{
              fontWeight: 600,
              color: "#F15F5E",
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <span style={{ fontSize: "1rem" }}>⚡</span>
              {event.additionalRegistrationText || "One More Step"}
            </div>
            <p style={{
              fontSize: "0.875rem",
              color: theme.palette.mode === 'dark' ? '#d1d5db' : '#555',
              margin: "0 0 1rem 0",
              lineHeight: 1.5
            }}>
              Complete your registration to secure your spot.
            </p>
            <a
              href={event.additionalRegistrationUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "0.75rem 1.25rem",
                backgroundColor: "#F15F5E",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background-color 0.2s"
              }}
            >
              Complete Registration
            </a>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            border: `1px solid ${theme.palette.divider}`
          }}>
            <h3 style={{
              margin: "0 0 0.75rem 0",
              fontSize: "1rem",
              fontWeight: 600,
              color: theme.palette.text.primary
            }}>
              About This Event
            </h3>
            {(() => {
              const isHTML = event.description.includes('<p>') ||
                             event.description.includes('<strong>') ||
                             event.description.includes('<ul>');

              if (isHTML) {
                const sanitizedHTML = DOMPurify.sanitize(event.description, {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li'],
                  ALLOWED_ATTR: ['href', 'target', 'rel']
                });
                return (
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      color: theme.palette.text.primary
                    }}
                  />
                );
              } else {
                return (
                  <ReactMarkdown
                    components={{
                      // eslint-disable-next-line no-unused-vars
                      p: ({ node, ...props }) => (
                        <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", lineHeight: 1.6 }} {...props} />
                      ),
                      // eslint-disable-next-line no-unused-vars
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main }} />
                      )
                    }}
                  >
                    {event.description}
                  </ReactMarkdown>
                );
              }
            })()}
          </div>
        )}

        {/* Who's Attending */}
        {attendingUsers.length > 0 && (
          <div
            onClick={() => setShowAttendeesModal(true)}
            style={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: "12px",
              padding: "1.25rem",
              marginBottom: "1.5rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              border: `1px solid ${theme.palette.divider}`,
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.01)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }}
          >
            <h3 style={{
              margin: "0 0 0.75rem 0",
              fontSize: "1rem",
              fontWeight: 600,
              color: theme.palette.text.primary,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>Who's Attending ({attendingUsers.length})</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.palette.text.secondary }}>
                Tap to view all →
              </span>
            </h3>
            <AvatarList users={attendingUsers} size={40} />
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: "center",
          padding: "1rem 0 2rem",
          color: theme.palette.text.secondary,
          fontSize: "0.85rem"
        }}>
          <img src="/logo.png" alt="Level Up Cincinnati" style={{ height: "32px", marginBottom: "0.5rem", opacity: 0.6 }} />
          <div>Level Up Cincinnati</div>
          {user && (
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: "0.75rem",
                background: "none",
                border: "none",
                color: theme.palette.primary.main,
                fontSize: "0.85rem",
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Go to App
            </button>
          )}
        </div>
      </div>

      {/* Guest Count Modal */}
      {showGuestModal && (
        <GuestCountModal
          onClose={() => setShowGuestModal(false)}
          onConfirm={(count) => handleRSVP(count)}
          initialCount={currentGuestCount}
        />
      )}

      {/* Attendees Modal */}
      {showAttendeesModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000
          }}
          onClick={() => setShowAttendeesModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.palette.background.paper,
              padding: "1.5rem",
              borderRadius: "12px",
              maxWidth: "400px",
              width: "90%",
              maxHeight: "70vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem"
            }}>
              <h3 style={{ margin: 0, color: theme.palette.text.primary, fontSize: "1.1rem", fontWeight: 600 }}>
                Who's Attending ({attendingUsers.length})
              </h3>
              <button
                onClick={() => setShowAttendeesModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  color: theme.palette.text.secondary,
                  cursor: "pointer",
                  padding: "0.25rem"
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {attendingUsers.map((attendee, i) => (
                <li key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                  color: theme.palette.text.primary
                }}>
                  <img
                    src={attendee.profileImage || attendee.headshotUrl || "https://via.placeholder.com/32"}
                    alt={attendee.fullName || attendee.email}
                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 500, color: theme.palette.text.primary }}>
                      {attendee.fullName || attendee.displayName || attendee.email}
                    </div>
                    {attendee.guestCount > 0 && (
                      <div style={{ fontSize: "0.8rem", color: theme.palette.text.secondary }}>
                        +{attendee.guestCount} guest{attendee.guestCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
