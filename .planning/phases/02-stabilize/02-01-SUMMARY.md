---
phase: 02-stabilize
plan: 01
subsystem: database
tags: [firebase, firestore, security-rules, storage-rules]

# Dependency graph
requires:
  - phase: 01-diagnose
    provides: "11 divergence diagnosis between PWA and native app Firebase rules"
provides:
  - "Merged firestore.rules addressing all 11 divergences"
  - "Canonical storage.rules with public read on profile photo paths"
  - "firebase.json updated with storage rules registration"
affects: [02-stabilize]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual isAdmin() check for backward compatibility (isAdmin == true || role == admin)"
    - "All Firebase rule deployments from Level-Up-App/ only"

key-files:
  created:
    - storage.rules
  modified:
    - firestore.rules
    - firebase.json

key-decisions:
  - "Used native app comment rules with timestamp validation and 10s rate limiting over simpler PWA version"
  - "RSVP rate limiting codified from live-only orphaned rules with admin bypass added"
  - "registrationCodes locked to admin-only read/write per user decision"
  - "Profile photo Storage paths get public read; event images stay auth-required"

patterns-established:
  - "Merged rules superset pattern: native app baseline + PWA additions"
  - "Comment creation requires serverTimestamp() for timestamp validation"

requirements-completed: [RULE-01, RULE-02, RULE-03, RULE-04, RULE-05]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 02 Plan 01: Merged Firebase Rules Summary

**Merged Firestore rules (11 divergence fixes) and canonical Storage rules with public read for external photo embeds**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T23:34:40Z
- **Completed:** 2026-03-10T23:36:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Merged firestore.rules as superset of native app + PWA rules, addressing all 11 diagnosed divergences
- Created canonical storage.rules with public read on user profile photo paths for Squarespace/Salesforce external embeds
- Registered storage.rules in firebase.json for deployment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create merged firestore.rules** - `bd5dc26` (feat)
2. **Task 2: Create canonical storage.rules and update firebase.json** - `ac37bd0` (feat)

## Files Created/Modified
- `firestore.rules` - Merged Firestore Security Rules with dual isAdmin(), notification_tokens, RSVP rate limiting, admin overrides
- `storage.rules` - Canonical Storage Security Rules with public read on profile photos
- `firebase.json` - Added storage rules registration

## Decisions Made
- Used native app's granular create/update/delete on posts and events (more explicit than PWA's `allow write`)
- Kept native app's comment timestamp validation and 10-second rate limiting as security improvements
- Codified live-only RSVP rate limiting (5-second cooldown) with admin bypass for PWA admin panel
- Locked registrationCodes to admin-only (PWA signup disabled, native app only)
- Profile photos get public read for external embeds; event images stay auth-required

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three files (firestore.rules, storage.rules, firebase.json) are ready for deployment in Plan 02
- Deployment will require Firebase CLI authentication and `firebase deploy --only firestore:rules,storage`
- Verification with admin and coach accounts needed post-deployment

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-stabilize*
*Completed: 2026-03-10*
