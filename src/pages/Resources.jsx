// src/pages/Resources.jsx
// Read-only resource library (no Firestore writes). Desktop-first
// redesign: toolbar with search + filters, section groups, card grid.
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";
import {
  Box,
  Typography,
  useTheme,
  Card,
  TextField,
  MenuItem,
  Button,
  Chip,
  InputAdornment,
  Collapse,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SchoolIcon from "@mui/icons-material/School";
import DescriptionIcon from "@mui/icons-material/Description";
import PeopleIcon from "@mui/icons-material/People";
import FeedbackIcon from "@mui/icons-material/Feedback";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { brandColors } from "../brandColors";

const TYPE_STYLES = {
  Form: { bg: brandColors.primary.coralPale, fg: "#B91C1C" },
  Document: { bg: brandColors.secondary.bluePale, fg: brandColors.primary.blue },
  "Resource Link": { bg: brandColors.accent.tealPale, fg: "#2F8990" },
  Curriculum: { bg: brandColors.functional.successPale, fg: "#047857" },
};

export default function Resources() {
  const theme = useTheme();

  const [resources, setResources] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
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
    };

    fetchUserRoleAndResources();
  }, []);

  const grouped = resources
    .filter(r => {
      const matchRole =
        ["admin", "board", "employee"].includes(userRole) ||
        (Array.isArray(r.role) ? r.role.includes(userRole) : r.role === userRole);
      const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !typeFilter || r.type === typeFilter;
      const matchSection = !sectionFilter || r.section === sectionFilter;
      return matchRole && matchSearch && matchType && matchSection;
    })
    .reduce((acc, item) => {
      acc[item.section] = acc[item.section] || [];
      acc[item.section].push(item);
      return acc;
    }, {});

  const sectionIcon = (section) => {
    const sx = { fontSize: 20, color: brandColors.secondary.softBlue };
    if (section.includes("Professional")) return <SchoolIcon sx={sx} />;
    if (section.includes("Forms")) return <DescriptionIcon sx={sx} />;
    if (section.includes("Networking")) return <PeopleIcon sx={sx} />;
    if (section.includes("Support & Feedback")) return <FeedbackIcon sx={sx} />;
    return <DescriptionIcon sx={sx} />;
  };

  if (!userRole || resources.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="text.secondary">Loading resources...</Typography>
      </Box>
    );
  }

  const hasActiveFilters = searchTerm || typeFilter || sectionFilter;

  return (
    <Box>
      {/* Toolbar: search + filters */}
      <Card sx={{ p: 2, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            alignItems: { sm: "center" },
          }}
        >
          <TextField
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            sx={{ minWidth: 160 }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="Form">Form</MenuItem>
            <MenuItem value="Document">Document</MenuItem>
            <MenuItem value="Resource Link">Resource Link</MenuItem>
            <MenuItem value="Curriculum">Curriculum</MenuItem>
          </TextField>
          <TextField
            select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            sx={{ minWidth: 180 }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">All Sections</MenuItem>
            {Array.from(new Set(resources.map(r => r.section))).map(section => (
              <MenuItem key={section} value={section}>{section}</MenuItem>
            ))}
          </TextField>
          {hasActiveFilters && (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("");
                setSectionFilter("");
              }}
            >
              Clear
            </Button>
          )}
        </Box>
      </Card>

      {Object.keys(grouped).length === 0 && (
        <Typography color="text.secondary">
          {hasActiveFilters
            ? "No resources match your search."
            : "No resources available for your role yet."}
        </Typography>
      )}

      {Object.keys(grouped).map(section => (
        <Box key={section} sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            {sectionIcon(section)}
            <Typography
              variant="h4"
              component="h2"
              sx={{ color: "text.primary" }}
            >
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

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
              gap: 2,
              alignItems: "start",
            }}
          >
            {grouped[section].map((r) => {
              const isOpen = expandedId === r.id;
              const typeStyle = TYPE_STYLES[r.type] || TYPE_STYLES.Document;
              return (
                <Card
                  key={r.id}
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                  sx={{
                    p: 2.5,
                    cursor: "pointer",
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(24, 38, 78, 0.12)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontWeight: 600, minWidth: 0 }}>
                      {r.title}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
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
                      {isOpen ? (
                        <ExpandLessIcon sx={{ fontSize: "1.4rem", color: "text.secondary" }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: "1.4rem", color: "text.secondary" }} />
                      )}
                    </Box>
                  </Box>

                  <Collapse in={isOpen}>
                    <Box sx={{ mt: 1.5 }}>
                      <Typography sx={{ fontSize: "0.875rem", mb: 1.5, color: "text.primary" }}>
                        {r.description}
                      </Typography>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        {r.timestamp?.seconds ? (
                          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                            Last updated: {new Date(r.timestamp.seconds * 1000).toLocaleDateString()}
                          </Typography>
                        ) : <span />}
                        <Button
                          component="a"
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          variant="contained"
                          color="secondary"
                          endIcon={<OpenInNewIcon sx={{ fontSize: "0.9rem" }} />}
                        >
                          Open {r.type}
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </Card>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
