---
phase: 01-diagnose
plan: 01
subsystem: infra
tags: [firebase, security-rules, firestore, storage, diagnostics]

# Dependency graph
requires: []
provides:
  - "Complete diagnosis of all Firebase Security Rules divergences between live, PWA, and native app"
  - "Symptom-to-root-cause mapping for all 3 reported issues"
  - "Fix recommendations with native app safety guarantees for Phase 2"
affects: [02-fix-and-harden]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Firebase Rules REST API for fetching live-deployed rules"
    - "Three-way diff pattern (live vs PWA vs native app)"

key-files:
  created:
    - ".planning/phases/01-diagnose/01-DIAGNOSIS.md"
  modified: []

key-decisions:
  - "All 3 reported symptoms fully explained by rule divergences -- API key restrictions unlikely contributing factor"
  - "Live Firestore rules contain RSVP rate limiting (lastRsvpAt 5s) found in neither codebase -- live-only modification"
  - "registrationCodes needs public read (allow read: if true) because PWA validates codes before user authentication"
  - "Merged rules will be a superset of native app rules -- no native app breakage possible"
  - "All future rule deployments must originate from Level-Up-App/ only"

patterns-established:
  - "Rule deployment governance: single-source deployment from PWA repo"
  - "Three-way comparison for multi-codebase Firebase projects"

requirements-completed: [DIAG-01, DIAG-02, DIAG-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 1 Plan 1: Firebase Security Rules Diagnosis Summary

**11 Firestore divergences and 1 Storage rules issue identified via three-way diff; all 3 reported symptoms mapped to specific rule changes with fix recommendations safe for native app**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T20:59:46Z
- **Completed:** 2026-03-10T21:04:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Fetched live Firestore and Storage rules from production via Firebase Rules REST API and diffed against both codebases
- Identified 11 Firestore rule divergences and confirmed Storage rules are byte-for-byte identical to native app (auth-required reads blocking external embeds)
- Mapped all 3 reported symptoms (blank RSVP screen, 403 photo errors, registration code failure) to specific rule changes with root causes
- Produced prioritized fix recommendations for Phase 2 with native app safety guarantees for every proposed change
- Confirmed all 17 Cloud Functions deployed and operational; CORS configuration not a blocker

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch live rules and produce all diffs** + **Task 2: Write DIAGNOSIS.md** - `a6207ce` (feat)

## Files Created/Modified

- `.planning/phases/01-diagnose/01-DIAGNOSIS.md` - Complete diagnosis report with three-way Firestore diffs, Storage analysis, Cloud Functions status, CORS review, symptom-to-root-cause mapping, and prioritized fix recommendations

## Decisions Made

- All 3 reported symptoms are fully explained by Firestore and Storage rule divergences; API key restrictions flagged for manual verification only if symptoms persist after Phase 2 fixes
- Live RSVP rate limiting (`lastRsvpAt` 5-second check) exists in neither codebase -- documented as live-only modification requiring investigation
- `registrationCodes` must use public read (`if true`) because PWA validates codes during signup before authentication
- Merged rules strategy: PWA version as base with native app security improvements (rate limiting, timestamp validation) preserved where compatible
- Single-source deployment governance: all future rule deploys from `Level-Up-App/` repo only

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- DIAGNOSIS.md provides complete, actionable specifications for Phase 2 merged rules
- 11 Firestore divergences documented with specific "use PWA version" vs "use native version" vs "merge" recommendations
- Storage rules fix documented with recommended public-read approach
- PWA code checks needed in Phase 2: comment `timestamp` field, reaction authorization model, wildcard catch-all necessity
- Open question: who deployed RSVP rate limiting (ask Jim)

---
*Phase: 01-diagnose*
*Completed: 2026-03-10*
