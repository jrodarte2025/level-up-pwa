// src/components/UpdatesRail.jsx
// Right rail for the Updates home (R1): Next Event, Your Match, GroupMe.
// READ-ONLY — fetches events / rsvps / matches / users once; never writes.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Avatar,
  Skeleton,
} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import PlaceIcon from "@mui/icons-material/Place";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ChatBubbleOutline as ChatIcon, ArrowForward as ArrowIcon } from "@mui/icons-material";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { processUpcomingEvents } from "../utils/eventUtils";
import { brandColors } from "../brandColors";

function railEventMatchesRole(event, userRole) {
  if (!userRole || ["admin", "board", "employee"].includes(userRole)) return true;
  const groups = event.groups;
  const isCoach = Array.isArray(groups)
    ? groups.includes("coaches")
    : groups === "both" || groups === "coaches";
  const isStudent = Array.isArray(groups)
    ? groups.includes("students")
    : groups === "both" || groups === "students";
  if (userRole === "coach" || userRole === "coach-board" || userRole === "future-coach") return isCoach;
  if (userRole === "student") return isStudent;
  return true;
}

export default function UpdatesRail({ userRole }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextEvent, setNextEvent] = useState(null);
  const [isRsvped, setIsRsvped] = useState(false);
  const [match, setMatch] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !userRole) return;

    const load = async () => {
      try {
        // Next upcoming event for this user's role
        const eventsSnap = await getDocs(collection(db, "events"));
        const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const upcoming = processUpcomingEvents(events).filter(
          (e) => e.status !== "draft" && railEventMatchesRole(e, userRole)
        );
        const next = upcoming[0] || null;
        setNextEvent(next);

        if (next) {
          const rsvpSnap = await getDoc(doc(db, "rsvps", `${user.uid}_${next.id}`));
          setIsRsvped(rsvpSnap.exists() && rsvpSnap.data().attending === true);
        }

        // Match (coach or student side)
        let matchDoc = null;
        const asCoach = await getDocs(
          query(collection(db, "matches"), where("coachId", "==", user.uid))
        );
        if (asCoach.docs.length) {
          matchDoc = asCoach.docs[0].data();
        } else {
          const asStudent = await getDocs(
            query(collection(db, "matches"), where("studentId", "==", user.uid))
          );
          if (asStudent.docs.length) matchDoc = asStudent.docs[0].data();
        }
        if (matchDoc) {
          const otherId = matchDoc.coachId === user.uid ? matchDoc.studentId : matchDoc.coachId;
          const otherSnap = await getDoc(doc(db, "users", otherId));
          if (otherSnap.exists()) {
            const u = otherSnap.data();
            setMatch({
              id: otherId,
              name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
              photo: u.headshotUrl || u.profileImage || "",
              subtitle:
                u.role === "student"
                  ? [u.major, u.graduationYear ? `Class of ${u.graduationYear}` : ""].filter(Boolean).join(", ")
                  : [u.title, u.company].filter(Boolean).join(" at "),
              isCoach: matchDoc.coachId === otherId,
            });
          }
        }
      } catch (err) {
        console.error("UpdatesRail load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userRole]);

  const goToEvents = () => navigate("/", { state: { selectedTab: "events" } });
  const goToDirectory = () => navigate("/", { state: { selectedTab: "directory" } });

  const eventDate = nextEvent?.date?.seconds
    ? new Date(nextEvent.date.seconds * 1000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Next Event */}
      {loading ? (
        <Card sx={{ p: 2.5 }}>
          <Skeleton width={90} height={18} />
          <Skeleton width="80%" height={28} sx={{ mt: 1 }} />
          <Skeleton width="60%" height={20} />
        </Card>
      ) : nextEvent ? (
        <Card
          onClick={goToEvents}
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
            "&:hover": { boxShadow: "0 8px 24px rgba(24, 38, 78, 0.12)", transform: "translateY(-2px)" },
          }}
        >
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="overline" sx={{ color: brandColors.primary.coral, lineHeight: 1.4 }}>
                Next event
              </Typography>
              {isRsvped ? (
                <Chip
                  label="You're in"
                  size="small"
                  sx={{ height: 20, fontSize: "0.68rem", backgroundColor: brandColors.functional.successPale, color: "#047857", fontWeight: 700 }}
                />
              ) : (
                nextEvent.required && (
                  <Chip
                    label="Required"
                    size="small"
                    sx={{ height: 20, fontSize: "0.68rem", backgroundColor: brandColors.primary.coral, color: "#fff", fontWeight: 700 }}
                  />
                )
              )}
            </Box>
            <Typography
              sx={{
                fontFamily: '"Poppins", "Roboto", sans-serif',
                fontWeight: 700,
                fontSize: "1.05rem",
                letterSpacing: "-0.25px",
                lineHeight: 1.3,
                mb: 1,
              }}
            >
              {nextEvent.name}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", mb: 0.5 }}>
              <EventIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">
                {eventDate}
                {nextEvent.timeRange ? ` · ${nextEvent.timeRange}` : ""}
              </Typography>
            </Box>
            {nextEvent.location && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
                <PlaceIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" noWrap>
                  {nextEvent.location}
                </Typography>
              </Box>
            )}
            {!isRsvped && (
              <Button
                size="small"
                variant="contained"
                color="secondary"
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                sx={{ mt: 1.5 }}
                onClick={goToEvents}
              >
                See events
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Your Match */}
      {!loading && match && (
        <Card
          onClick={goToDirectory}
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
            "&:hover": { boxShadow: "0 8px 24px rgba(24, 38, 78, 0.12)", transform: "translateY(-2px)" },
          }}
        >
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="overline" sx={{ color: brandColors.secondary.softBlue, lineHeight: 1.4, display: "block", mb: 1 }}>
              Your {match.isCoach ? "coach" : "scholar"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar src={match.photo} alt={match.name} sx={{ width: 48, height: 48 }}>
                {match.name?.charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{match.name}</Typography>
                {match.subtitle && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                    {match.subtitle}
                  </Typography>
                )}
              </Box>
              <ArrowForwardIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* GroupMe community card */}
      <Card
        sx={{
          background: `linear-gradient(135deg, ${brandColors.accent.teal} 0%, ${brandColors.primary.blue} 100%)`,
          border: "none",
          cursor: "pointer",
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 6px 16px rgba(76, 175, 182, 0.4)",
          },
        }}
        onClick={() => window.open("https://groupme.com/join_group/111057832/9TtW2MIp", "_blank")}
      >
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "50%",
                p: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChatIcon sx={{ fontSize: 24, color: "#fff" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "1rem", mb: 0.25 }}>
                Join Our Community Chat
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.9)", lineHeight: 1.4 }}>
                Connect with scholars and coaches in our GroupMe!
              </Typography>
            </Box>
            <ArrowIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
