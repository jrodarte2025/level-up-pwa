import React, { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import EventCard from "../components/EventCard";
import GuestCountModal from "../components/GuestCountModal";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { processUpcomingEvents } from "../utils/eventUtils";

export default function UserDashboard({ setShowAdminPanel }) {
  const theme = useTheme();
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(auth.currentUser);
  const [userRole, setUserRole] = useState(null);
  const [rsvps, setRsvps] = useState({});

  // Match tracking
  const [matchUserId, setMatchUserId] = useState(null);
  const [matchRsvps, setMatchRsvps] = useState({});
  // Load matchUserId
  useEffect(() => {
    if (!user) return;
    const fetchMatch = async () => {
      // Find match document
      const snap = await getDocs(query(
        collection(db, "matches"),
        where("coachId", "==", user.uid)
      ));
      let m = snap.docs.length ? snap.docs[0].data() : null;
      if (!m) {
        const snap2 = await getDocs(query(
          collection(db, "matches"),
          where("studentId", "==", user.uid)
        ));
        m = snap2.docs.length ? snap2.docs[0].data() : null;
      }
      if (m) {
        // Determine the other user
        const other = m.coachId === user.uid ? m.studentId : m.coachId;
        setMatchUserId(other);
      }
    };
    fetchMatch();
  }, [user]);

  // Subscribe to match's RSVPs
  useEffect(() => {
    if (!matchUserId) return;
    const unsub = onSnapshot(
      query(collection(db, "rsvps"), where("userId", "==", matchUserId)),
      (snapshot) => {
        const data = {};
        snapshot.docs.forEach((d) => {
          const r = d.data();
          if (r.attending) data[r.eventId] = true;
        });
        setMatchRsvps(data);
      }
    );
    return () => unsub();
  }, [matchUserId]);
  const [filters, setFilters] = useState({
    coach: false,
    student: false,
    required: false,
    notRsvpd: false,
  });
  // Modal state for profile
  const [showProfile, setShowProfile] = useState(false);

  const [profileImage, setProfileImage] = useState("https://via.placeholder.com/64");
  const [profileFile, setProfileFile] = useState(null);
  // Inline edit profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [major, setMajor] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpUsers, setRsvpUsers] = useState([]);
  const [showRsvpList, setShowRsvpList] = useState(false);
  
  // Guest modal state
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [pendingRsvpEvent, setPendingRsvpEvent] = useState(null);
  useEffect(() => {
    if (!user) return;
    const loadRole = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserRole(data.role || null);
        // fallback for basic info
        if (!data.firstName && data.displayName) {
          setFirstName(data.displayName.split(" ")[0] || "");
          setLastName(data.displayName.split(" ")[1] || "");
        }
      }
    };
    loadRole();
  }, [user]);


  useEffect(() => {
    if (!selectedEvent) return;

    const loadRsvpUsers = async () => {
      // 1) fetch RSVPs for this event
      const rsvpSnap = await getDocs(
        query(collection(db, "rsvps"), where("eventId", "==", selectedEvent.id))
      );
      const rsvpData = rsvpSnap.docs.map(d => ({
        userId: d.data().userId,
        guestCount: d.data().guestCount || 0
      }));
      if (rsvpData.length === 0) {
        setRsvpUsers([]);
        return;
      }
      
      const userIds = rsvpData.map(r => r.userId);

      // 2) fetch all users and filter to those IDs
      const usersSnap = await getDocs(collection(db, "users"));
      let matched = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => userIds.includes(u.id));

      // 3) for each user, prefer headshotUrl, then profileImage, then fallback to Storage
      const storage = getStorage();
      matched = await Promise.all(matched.map(async u => {
        // Find guest count for this user
        const userRsvpData = rsvpData.find(r => r.userId === u.id);
        const guestCount = userRsvpData?.guestCount || 0;
        
        // 1) Firestore headshotUrl
        if (u.headshotUrl) {
          return { ...u, profileImage: u.headshotUrl, guestCount };
        }
        // 2) Existing stored profileImage field
        if (u.profileImage) {
          return { ...u, guestCount };
        }
        // 3) Fallback to Storage lookup
        try {
          const url = await getDownloadURL(ref(storage, `users/${u.id}/profile.jpg`));
          return { ...u, profileImage: url, guestCount };
        } catch {
          return { ...u, guestCount };
        }
      }));

      setRsvpUsers(matched);
    };

    loadRsvpUsers();
  }, [selectedEvent]);

  useEffect(() => {
    if (!user) return;
    const loadProfileImage = async () => {
      // 1) Try Firestore fields
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.headshotUrl) {
          setProfileImage(data.headshotUrl);
          return;
        }
        if (data.profileImage) {
          const storage = getStorage();
          try {
            const url = await getDownloadURL(ref(storage, `users/${user.uid}/profile.jpg`));
            setProfileImage(url);
            return;
          } catch {
            setProfileImage(data.profileImage);
            return;
          }
        }
      }
      // 2) Fallback to Storage
      try {
        const storage = getStorage();
        const imageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        const url = await getDownloadURL(imageRef);
        setProfileImage(url);
      } catch {
        setProfileImage("https://via.placeholder.com/64");
      }
    };
    loadProfileImage();
  }, [user]);

  // Load profile data for editing in modal
  useEffect(() => {
    if (!user) return;
    // Load Firestore profile
    getDoc(doc(db, "users", user.uid)).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        // fallback just in case displayName isn't already set
        if (data.displayName) {
          setFirstName(data.displayName.split(" ")[0] || "");
          setLastName(data.displayName.split(" ")[1] || "");
        }
        setCompany(data.company || "");
        setJobTitle(data.title || "");
        setMajor(data.major || "");
        setGraduationYear(data.graduationYear || "");
      }
    });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEvents(all);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rsvps"), (snapshot) => {
      const data = {};
      snapshot.docs.forEach((doc) => {
        const rsvp = doc.data();
        if (rsvp.userId === user?.uid) {
          data[rsvp.eventId] = {
            attending: true,
            guestCount: rsvp.guestCount || 0
          };
        }
      });
      setRsvps(data);
    });

    return () => unsub();
  }, [user]);

  const handleRSVP = async (eventId, forceCancel = false) => {
    const key = `${user.uid}_${eventId}`;
    const rsvpDocRef = doc(db, "rsvps", key);
    
    // Find the event to check if guests are allowed
    const event = events.find(e => e.id === eventId);

    if (rsvps[eventId] || forceCancel) {
      // Cancel existing RSVP
      await deleteDoc(rsvpDocRef);
    } else {
      // Check if event allows guests
      if (event?.allowGuests) {
        // Show guest modal
        setPendingRsvpEvent(event);
        setGuestModalOpen(true);
      } else {
        // Direct RSVP without guests
        await setDoc(rsvpDocRef, {
          userId: user.uid,
          eventId,
          attending: true,
          guestCount: 0,
          rsvpTimestamp: serverTimestamp(),
        });
      }
    }
  };

  const handleGuestRSVP = async (guestCount) => {
    if (!pendingRsvpEvent) return;
    
    const key = `${user.uid}_${pendingRsvpEvent.id}`;
    const rsvpDocRef = doc(db, "rsvps", key);
    
    await setDoc(rsvpDocRef, {
      userId: user.uid,
      eventId: pendingRsvpEvent.id,
      attending: true,
      guestCount: guestCount,
      rsvpTimestamp: serverTimestamp(),
    });
    
    setPendingRsvpEvent(null);
  };

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sortedEvents = processUpcomingEvents([...events]);

  // Filter out draft events - only show published events (or events without status for backwards compatibility)
  const publishedEvents = sortedEvents.filter((event) => event.status !== "draft");

  const filteredEvents = publishedEvents.filter((event) => {
    // Handle both array format ["students", "coaches"] and legacy string format "both"
    const groups = event.groups;
    const isCoach = Array.isArray(groups)
      ? groups.includes("coaches")
      : groups === "both" || groups === "coaches";
    const isStudent = Array.isArray(groups)
      ? groups.includes("students")
      : groups === "both" || groups === "students";
    const isRequired = event.required;
    const isRSVPed = rsvps[event.id];

    // AUTOMATIC ROLE-BASED FILTERING
    // If no manual filters are active, auto-filter by user role
    const hasActiveFilters = filters.coach || filters.student || filters.required || filters.notRsvpd;

    if (!hasActiveFilters && userRole) {
      // Default: Only show events relevant to user's role
      if (userRole === "coach" && !isCoach) return false;
      if (userRole === "student" && !isStudent) return false;
    }

    // Manual filter overrides
    if (filters.coach && !isCoach) return false;
    if (filters.student && !isStudent) return false;
    if (filters.required && !isRequired) return false;
    if (filters.notRsvpd && isRSVPed) return false;

    return true;
  });

  const generateCalendarLinks = (event) => {
    if (!event?.date?.seconds || !event?.timeRange) return {};

    const title = encodeURIComponent(event.name);
    const location = encodeURIComponent(event.location || "");
    const description = encodeURIComponent(event.description || "");
    const start = new Date(event.date.seconds * 1000);
    const normalized = event.timeRange.replace(/[-–—]/g, "|");
    const [startHour, endHour] = normalized.split("|").map(t => t?.trim());

    if (!startHour || !endHour) return {};

    const startDateTime = new Date(`${start.toDateString()} ${startHour}`);
    const endDateTime = new Date(`${start.toDateString()} ${endHour}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) return {};

    const format = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${format(startDateTime)}/${format(endDateTime)}`;

    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${description}&location=${location}&sf=true&output=xml`;
    const ics = `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${title}%0ADESCRIPTION:${description}%0ALOCATION:${location}%0ADTSTART:${format(startDateTime)}%0ADTEND:${format(endDateTime)}%0AEND:VEVENT%0AEND:VCALENDAR`;

    return { google, ics, outlook: ics };
  };


  return (
    <div style={{ padding: "1rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Event Filters Subtitle and Controls */}
      <div style={{ maxWidth: "600px", margin: "0 auto 1.5rem", padding: "0 1rem" }}>
        {/* Smart filter header with user context */}
        <div style={{
          marginBottom: "1rem",
          textAlign: "center",
          fontSize: "0.9rem",
          color: "var(--brand-medium-gray)"
        }}>
          {!filters.coach && !filters.student && !filters.required && !filters.notRsvpd ? (
            <p style={{ margin: 0 }}>
              Showing <strong>{userRole === "coach" ? "Coach" : userRole === "student" ? "Student" : "All"} Events</strong>
              {userRole && (
                <>
                  {" · "}
                  <button
                    onClick={() => toggleFilter(userRole === "coach" ? "student" : userRole === "student" ? "coach" : null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4A90E2",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 500
                    }}
                  >
                    Show all events
                  </button>
                </>
              )}
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Filtered view ·
              <button
                onClick={() => setFilters({ coach: false, student: false, required: false, notRsvpd: false })}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4A90E2",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  marginLeft: "0.25rem"
                }}
              >
                Clear filters
              </button>
            </p>
          )}
        </div>

        {/* Filter buttons */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.5rem"
        }}>
          {[
            { label: "Coach Events", key: "coach", color: "#18264E" },
            { label: "Student Events", key: "student", color: "#6B7BA8" },
            { label: "Required Only", key: "required", color: "#F15F5E" },
            { label: "Not Yet RSVP'd", key: "notRsvpd", color: "#d8d9df" }
          ].map(({ label, key, color }) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`button-toggle ${filters[key] ? "active" : ""}`}
              style={filters[key] ? {
                backgroundColor: color,
                color: key === "notRsvpd" ? "#18264E" : "#fff",
                borderColor: color,
                fontWeight: 600
              } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filteredEvents.length > 0 ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "600px",
          margin: "0 auto"
        }}>
          {(() => {
            // Group events by required status
            const requiredEvents = filteredEvents.filter(e => e.required);
            const optionalEvents = filteredEvents.filter(e => !e.required);

            return (
              <>
                {/* Required Events Section */}
                {requiredEvents.length > 0 && (
                  <>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                      padding: "0 0.5rem"
                    }}>
                      <span style={{
                        backgroundColor: "#F15F5E",
                        color: "#fff",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        Required
                      </span>
                      <h3 style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        color: theme.palette.text.secondary
                      }}>
                        Don't Miss These
                      </h3>
                    </div>
                    {requiredEvents.map((event) => {
                      const isExpanded = selectedEvent && selectedEvent.id === event.id;
                      const attendingUsers = isExpanded ? rsvpUsers : [];

                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          isRSVPed={!!rsvps[event.id]?.attending}
                          isMatchGoing={!!matchRsvps[event.id]}
                          onRSVP={handleRSVP}
                          onClick={() => {
                            setSelectedEvent(isExpanded ? null : event);
                            setShowRsvpList(false);
                          }}
                          expanded={isExpanded}
                          showDetails={isExpanded}
                          attendingUsers={attendingUsers}
                          toggleDetails={() => setShowRsvpList(!showRsvpList)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Optional Events Section */}
                {optionalEvents.length > 0 && (
                  <>
                    {requiredEvents.length > 0 && (
                      <div style={{
                        borderTop: `1px solid ${theme.palette.divider}`,
                        margin: "2rem 0 1.5rem",
                        paddingTop: "1.5rem"
                      }}>
                        <h3 style={{
                          textAlign: "center",
                          fontSize: "0.9rem",
                          color: theme.palette.text.secondary,
                          marginBottom: "1rem"
                        }}>
                          Optional Events
                        </h3>
                      </div>
                    )}
                    {optionalEvents.map((event) => {
                      const isExpanded = selectedEvent && selectedEvent.id === event.id;
                      const attendingUsers = isExpanded ? rsvpUsers : [];

                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          isRSVPed={!!rsvps[event.id]?.attending}
                          isMatchGoing={!!matchRsvps[event.id]}
                          onRSVP={handleRSVP}
                          onClick={() => {
                            setSelectedEvent(isExpanded ? null : event);
                            setShowRsvpList(false);
                          }}
                          expanded={isExpanded}
                          showDetails={isExpanded}
                          attendingUsers={attendingUsers}
                          toggleDetails={() => setShowRsvpList(!showRsvpList)}
                        />
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div style={{
          textAlign: "center",
          padding: "2rem",
          color: "var(--brand-medium-gray)"
        }}>
          <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem", margin: 0 }}>
            {filters.coach || filters.student || filters.required || filters.notRsvpd
              ? "No events match your filters"
              : `No ${userRole === "coach" ? "coach" : userRole === "student" ? "student" : ""} events found`}
          </p>
          <p style={{ fontSize: "0.9rem", margin: "0.5rem 0 0 0" }}>
            {filters.required || filters.notRsvpd || filters.coach || filters.student
              ? "Try adjusting your filters to see more events."
              : "Check back later for upcoming events!"}
          </p>
          {(filters.required || filters.notRsvpd || filters.coach || filters.student) && (
            <button
              className="button-primary"
              onClick={() => setFilters({ coach: false, student: false, required: false, notRsvpd: false })}
              style={{ marginTop: "1rem" }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
      {/* Slide-up Profile Modal */}
      {showProfile && (
        // Backdrop: clicking outside closes modal
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            zIndex: 1000
          }}
          onClick={() => setShowProfile(false)}
        >
          {/* Modal container */}
          <div
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: "12px",
              borderTopRightRadius: "12px",
              boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
              padding: "1.5rem 1rem",
              width: "100%",
              maxWidth: "400px",
              position: "relative",
              boxSizing: "border-box",
              maxHeight: "95vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button (×) */}
            <button
              onClick={() => setShowProfile(false)}
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                background: "transparent",
                border: "none",
                fontSize: "1.25rem",
                color: "var(--brand-medium-gray)",
                cursor: "pointer"
              }}
              aria-label="Close"
            >
              ×
            </button>

            {/* ==== Existing modal content goes here ==== */}
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              {/* Hidden file input for profile image upload */}
              <input
                id="profileUpload"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const storage = getStorage();
                  const refPath = ref(storage, `users/${user.uid}/profile.jpg`);
                  await uploadBytes(refPath, file);
                  const url = await getDownloadURL(refPath);
                  setProfileImage(url);
                }}
                style={{ display: "none" }}
              />
              <label htmlFor="profileUpload" style={{ cursor: "pointer", display: "inline-block", position: "relative" }}>
                <img
                  src={profileImage}
                  alt="Profile"
                  style={{ borderRadius: "50%", width: "96px", height: "96px", marginBottom: "1rem", objectFit: "cover" }}
                />
                <span style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  fontSize: "0.7rem",
                  textAlign: "center",
                  color: "#fff",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  padding: "2px",
                  borderBottomLeftRadius: "50%",
                  borderBottomRightRadius: "50%"
                }}>
                  Upload Photo
                </span>
              </label>
              <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{user?.email}</p>
            </div>
            {/* Inline edit profile fields */}
            <div style={{ margin: "1rem auto", width: "80%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
              {userRole?.includes("student") ? (
                <>
                  <input
                    type="text"
                    placeholder="Major"
                    value={major}
                    onChange={e => setMajor(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                  <input
                    type="text"
                    placeholder="Graduation Year"
                    value={graduationYear}
                    onChange={e => setGraduationYear(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Company"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                  <input
                    type="text"
                    placeholder="Job Title"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </>
              )}
            </div>
            <button
              className="button-primary"
              onClick={async () => {
                const userRef = doc(db, "users", user.uid);
                await setDoc(
                  userRef,
                  {
                    firstName,
                    lastName,
                    displayName: `${firstName} ${lastName}`,
                    ...(userRole === "student"
                      ? { major, graduationYear }
                      : { company, title: jobTitle })
                  },
                  { merge: true }
                );
                setShowProfile(false);
              }}
            >
              Save Profile
            </button>
            {/* Only show if userRole is admin */}
            {userRole === "admin" && (
              <button
                className="button-primary"
                onClick={() => {
                  setShowAdminPanel(true);
                  setShowProfile(false);
                }}
              >
                Switch to Admin Panel
              </button>
            )}
            <button
              className="button-danger"
              onClick={() => {
                signOut(auth).then(() => window.location.reload());
              }}
            >
              Sign Out
            </button>
            <button
              className="button-link"
              onClick={() => setShowProfile(false)}
              style={{ marginTop: "1rem", width: "100%" }}
            >
              Close
            </button>
            {/* ============================================ */}
          </div>
        </div>
      )}
      {/* Remove old selectedEvent modal, now replaced by accordion style */}
      {showRsvpList && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.palette.background.paper,
            padding: "1.5rem",
            borderRadius: "12px",
            maxWidth: "400px",
            width: "90%",
            maxHeight: "70vh",
            overflowY: "auto"
          }}>
            <h3 style={{ marginTop: 0, color: theme.palette.text.primary }}>RSVP'd Attendees</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {rsvpUsers.map((user, i) => (
                <li key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                  color: theme.palette.text.primary
                }}>
                  <img
                    src={user.profileImage || "https://via.placeholder.com/32"}
                    alt={user.email}
                    style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <span style={{ fontSize: "0.95rem", fontWeight: 500, color: theme.palette.text.primary }}>
                    {user.displayName || user.email}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="button-primary"
              onClick={() => setShowRsvpList(false)}
              style={{ marginTop: "1rem", width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Guest Count Modal */}
      <GuestCountModal
        isOpen={guestModalOpen}
        onClose={() => {
          setGuestModalOpen(false);
          setPendingRsvpEvent(null);
        }}
        onConfirm={handleGuestRSVP}
        eventName={pendingRsvpEvent?.name || ""}
        isRSVPing={true}
      />
    </div>
  );
}