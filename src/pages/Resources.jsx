// src/pages/Resources.jsx
// Read-only resource library (no Firestore writes). Desktop library layout:
// left section rail + always-open resource cards (no accordion), search +
// type chips. Data fetching and role filtering unchanged.
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  Chip,
  InputAdornment,
  Skeleton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SchoolIcon from "@mui/icons-material/School";
import DescriptionIcon from "@mui/icons-material/Description";
import PeopleIcon from "@mui/icons-material/People";
import FeedbackIcon from "@mui/icons-material/Feedback";
import FolderIcon from "@mui/icons-material/Folder";
import AppsIcon from "@mui/icons-material/Apps";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { brandColors } from "../brandColors";

const TYPE_STYLES = {
  Form: { bg: brandColors.primary.coralPale, fg: "#B91C1C" },
  Document: { bg: brandColors.secondary.bluePale, fg: brandColors.primary.blue },
  "Resource Link": { bg: brandColors.accent.tealPale, fg: "#2F8990" },
  Curriculum: { bg: brandColors.functional.successPale, fg: "#047857" },
};

const TYPES = ["Form", "Document", "Resource Link", "Curriculum"];

function sectionIcon(section, active) {
  const sx = { fontSize: 18, color: active ? "#fff" : brandColors.secondary.softBlue };
  if (!section) return <AppsIcon sx={sx} />;
  if (section.includes("Professional")) return <SchoolIcon sx={sx} />;
  if (section.includes("Forms")) return <DescriptionIcon sx={sx} />;
  if (section.includes("Networking")) return <PeopleIcon sx={sx} />;
  if (section.includes("Support & Feedback")) return <FeedbackIcon sx={sx} />;
  return <FolderIcon sx={sx} />;
}

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  useEffect(() => {
    const fetchUserRoleAndResources = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const role = userSnap.data().role;
        setUserRole(role);
      }

      const resSnap = await getDocs(collection(db, "resources"));
      const allResources = resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResources(allResources);
      setLoaded(true);
    };

    fetchUserRoleAndResources();
  }, []);

  // Role-visible resources (unchanged logic)
  const visible = resources.filter(r =>
    ["admin", "board", "employee"].includes(userRole) ||
    (Array.isArray(r.role) ? r.role.includes(userRole) : r.role === userRole)
  );

  const sections = Array.from(new Set(visible.map(r => r.section))).filter(Boolean);

  const matches = visible.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !typeFilter || r.type === typeFilter;
    const matchSection = !sectionFilter || r.section === sectionFilter;
    return matchSearch && matchType && matchSection;
  });

  const grouped = matches.reduce((acc, item) => {
    acc[item.section] = acc[item.section] || [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const hasActiveFilters = searchTerm || typeFilter || sectionFilter;

  if (!loaded || !userRole) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px 1fr" }, gap: 3 }}>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={40} sx={{ mb: 1, borderRadius: 2 }} />)}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 2 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Card key={i} sx={{ p: 2.5 }}>
              <Skeleton width="30%" height={22} sx={{ mb: 1 }} />
              <Skeleton width="80%" height={24} />
              <Skeleton width="100%" height={16} />
              <Skeleton width="60%" height={16} />
            </Card>
          ))}
        </Box>
      </Box>
    );
  }

  const railItem = (label, value, count) => {
    const active = sectionFilter === value;
    return (
      <Box
        key={value || "all"}
        onClick={() => setSectionFilter(value)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.5,
          py: 1,
          borderRadius: "8px",
          cursor: "pointer",
          mb: 0.5,
          backgroundColor: active ? brandColors.primary.blue : "transparent",
          color: active ? "#fff" : brandColors.neutral[600],
          transition: "background-color 120ms ease",
          "&:hover": {
            backgroundColor: active ? brandColors.primary.navyLight : brandColors.neutral[150],
          },
        }}
      >
        {sectionIcon(value, active)}
        <Typography sx={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500, flex: 1, minWidth: 0 }} noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, opacity: active ? 0.85 : 0.6 }}>
          {count}
        </Typography>
      </Box>
    );
  };

  const resourceCard = (r) => {
    const typeStyle = TYPE_STYLES[r.type] || TYPE_STYLES.Document;
    return (
      <Card
        key={r.id}
        sx={{
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": {
            boxShadow: "0 8px 24px rgba(24, 38, 78, 0.12)",
            transform: "translateY(-2px)",
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Chip
            label={r.type}
            size="small"
            sx={{
              backgroundColor: typeStyle.bg,
              color: typeStyle.fg,
              fontWeight: 600,
              fontSize: "0.72rem",
              height: 22,
            }}
          />
          {r.timestamp?.seconds && (
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              Updated {new Date(r.timestamp.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.35 }}>
          {r.title}
        </Typography>
        {r.description && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {r.description}
          </Typography>
        )}
        <Box sx={{ mt: "auto", pt: 1 }}>
          <Button
            component="a"
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            variant="contained"
            color="secondary"
            endIcon={<OpenInNewIcon sx={{ fontSize: "0.9rem" }} />}
          >
            Open {r.type}
          </Button>
        </Box>
      </Card>
    );
  };

  const cardsGrid = (items) => (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
        gap: 2,
        alignItems: "stretch",
      }}
    >
      {items.map(resourceCard)}
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)" }, gap: 3, alignItems: "start" }}>
      {/* Section rail (desktop) */}
      <Box
        sx={{
          position: { md: "sticky" },
          top: { md: 32 },
          display: { xs: "none", md: "block" },
        }}
      >
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block", px: 1.5, mb: 0.75 }}>
          Sections
        </Typography>
        {railItem("All Resources", "", visible.length)}
        {sections.map((s) =>
          railItem(s, s, visible.filter((r) => r.section === s).length)
        )}
      </Box>
      {/* Section chips (small screens) */}
      <Box sx={{ display: { xs: "flex", md: "none" }, gap: 1, flexWrap: "wrap" }}>
        <Chip
          label={`All (${visible.length})`}
          clickable
          onClick={() => setSectionFilter("")}
          variant={!sectionFilter ? "filled" : "outlined"}
          sx={!sectionFilter ? { backgroundColor: brandColors.primary.blue, color: "#fff", fontWeight: 600 } : {}}
        />
        {sections.map((s) => (
          <Chip
            key={s}
            label={s}
            clickable
            onClick={() => setSectionFilter(s)}
            variant={sectionFilter === s ? "filled" : "outlined"}
            sx={sectionFilter === s ? { backgroundColor: brandColors.primary.blue, color: "#fff", fontWeight: 600 } : {}}
          />
        ))}
      </Box>

      {/* Main column */}
      <Box sx={{ minWidth: 0 }}>
        {/* Search + type chips */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 3 }}>
          <TextField
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1, minWidth: 220, "& .MuiOutlinedInput-root": { backgroundColor: "background.paper" } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {TYPES.map((t) => {
              const active = typeFilter === t;
              const style = TYPE_STYLES[t];
              return (
                <Chip
                  key={t}
                  label={t}
                  clickable
                  onClick={() => setTypeFilter(active ? "" : t)}
                  variant={active ? "filled" : "outlined"}
                  sx={active
                    ? { backgroundColor: style.fg, color: "#fff", fontWeight: 600 }
                    : { borderColor: brandColors.neutral[300], backgroundColor: "background.paper" }}
                />
              );
            })}
          </Box>
        </Box>

        {matches.length === 0 && (
          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              {hasActiveFilters
                ? "No resources match your search."
                : "No resources available for your role yet."}
            </Typography>
            {hasActiveFilters && (
              <Button
                size="small"
                sx={{ mt: 1.5 }}
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("");
                  setSectionFilter("");
                }}
              >
                Clear filters
              </Button>
            )}
          </Card>
        )}

        {/* One section selected → flat grid; All → grouped with headers */}
        {matches.length > 0 && (sectionFilter ? (
          cardsGrid(matches)
        ) : (
          Object.keys(grouped).map((section) => (
            <Box key={section} sx={{ mb: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                {sectionIcon(section, false)}
                <Typography variant="h4" component="h2">
                  {section}
                </Typography>
                <Chip
                  label={grouped[section].length}
                  size="small"
                  sx={{
                    backgroundColor: brandColors.neutral[150],
                    color: brandColors.neutral[600],
                    fontWeight: 700,
                    height: 22,
                  }}
                />
              </Box>
              {cardsGrid(grouped[section])}
            </Box>
          ))
        ))}
      </Box>
    </Box>
  );
}
