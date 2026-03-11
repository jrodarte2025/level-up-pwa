---
phase: 02-stabilize
plan: 02
subsystem: infra
tags: [firebase, firestore, security-rules, storage-rules, deployment, production]

# Dependency graph
requires:
  - phase: 02-stabilize-01
    provides: "Merged firestore.rules, canonical storage.rules, and updated firebase.json"
provides:
  - "Production Firebase rules deployed and verified"
  - "Pre-deployment rule backups for rollback"
  - "PWA calendar link bug fix for native app event compatibility"
affects: [03-transition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalize dash characters (hyphen/en-dash/em-dash) when parsing timeRange fields"
    - "Pre-deployment backups stored in .planning/phases/XX-name/backups/"

key-files:
  created:
    - .planning/phases/02-stabilize/backups/pre-deploy-firestore.rules
    - .planning/phases/02-stabilize/backups/pre-deploy-storage.rules
  modified:
    - src/components/EventCard.jsx
    - src/pages/UserDashboard.jsx
    - src/pages/AdminPanel.jsx

key-decisions:
  - "PWA generateCalendarLinks() normalized to handle all dash variants from native app events"

patterns-established:
  - "Always normalize dash characters when parsing timeRange: replace(/[-\u2013\u2014]/g, '|')"

requirements-completed: [RULE-06, INTG-01, INTG-02, INTG-03]

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 02 Plan 02: Deploy and Verify Firebase Rules Summary

**Deployed merged Firestore and Storage rules to production, verified RSVP flow, photo integrations, and fixed PWA calendar link crash on native-app-created events**

## Performance

- **Duration:** ~15 min (includes human verification)
- **Started:** 2026-03-10T23:40:00Z
- **Completed:** 2026-03-10T23:57:58Z
- **Tasks:** 2
- **Files modified:** 5 (2 backup files created, 3 source files fixed)

## Accomplishments
- Deployed merged Firestore and Storage security rules to production, resolving all 3 reported symptoms (blank RSVP screen, 403 photo errors on Squarespace, Salesforce photo issues)
- Pre-deployment backups saved for rollback capability
- Cloud Function endpoints (getPhoto, coaches, students) confirmed still accessible post-deployment
- Fixed PWA crash in generateCalendarLinks() when events created by native app used hyphen-minus instead of en-dash in timeRange field

## Task Commits

Each task was committed atomically:

1. **Task 1: Back up live rules and deploy merged rules to production** - `81303b6` (feat)
2. **Task 2: Human verification (approved)** - `d09a0e3` (fix) - PWA calendar link dash normalization bug fix discovered and resolved during verification

## Files Created/Modified
- `.planning/phases/02-stabilize/backups/pre-deploy-firestore.rules` - Pre-deployment Firestore rules backup
- `.planning/phases/02-stabilize/backups/pre-deploy-storage.rules` - Pre-deployment Storage rules backup
- `src/components/EventCard.jsx` - Fixed generateCalendarLinks() dash parsing with null guards
- `src/pages/UserDashboard.jsx` - Fixed generateCalendarLinks() dash parsing with null guards
- `src/pages/AdminPanel.jsx` - Fixed timeRange split dash parsing

## Decisions Made
- Normalized all dash variants (hyphen `-`, en-dash, em-dash) to a pipe delimiter before splitting timeRange, ensuring PWA handles events from both native app and PWA

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed generateCalendarLinks() crash on native-app-created events**
- **Found during:** Task 2 (human verification)
- **Issue:** PWA's generateCalendarLinks() split timeRange on en-dash only, but native app creates events with hyphen-minus. This caused a crash (blank screen) when viewing native-app-created events in the PWA.
- **Fix:** Normalized all dash characters to a pipe delimiter before splitting. Added null guards for missing date/timeRange fields and invalid date validation.
- **Files modified:** src/components/EventCard.jsx, src/pages/UserDashboard.jsx, src/pages/AdminPanel.jsx
- **Verification:** Jim confirmed fix deployed and working -- all tests passing
- **Committed in:** d09a0e3

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for cross-app compatibility. No scope creep.

## Issues Encountered
None beyond the calendar link bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 2 objectives complete -- Firebase rules deployed and verified in production
- PWA is stable: RSVP works, photo integrations work, admin functionality restored
- Ready for Phase 3 (Transition) -- native app download banner and migration messaging
- Known Phase 3 blockers: App Store ID needed for Smart App Banner, FCM token collision deferred to v2

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-stabilize*
*Completed: 2026-03-10*
