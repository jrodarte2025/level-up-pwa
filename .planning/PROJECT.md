# Level Up App — PWA Stabilization & Transition

## What This Is

The Level Up Cincinnati PWA is a React/Firebase web app used by scholars, coaches, and admins for events, posts, profiles, and notifications. A new native iOS/Android app has been built against the same Firebase backend and is currently in App Store review. Firebase rule and configuration changes made during the native app build have broken parts of the PWA, and two external integrations that pull photos from Firebase Storage. This project fixes the breakage and builds the architecture for transitioning users from the PWA to the native app.

## Core Value

The PWA must continue working reliably — especially event registration — until users have migrated to the native app. No fix to the PWA can break the new native app.

## Requirements

### Validated

<!-- Existing capabilities confirmed from codebase map -->

- ✓ User authentication via Firebase Auth (email/password + Google) — existing
- ✓ Role-based access control (student, coach, board, admin) — existing
- ✓ Event creation, listing, and RSVP flow — existing
- ✓ Post/update feed with rich text, comments, and typing indicators — existing
- ✓ User profile management with headshot upload — existing
- ✓ Push notifications via Firebase Cloud Messaging — existing
- ✓ Admin panel for events, posts, users, and matches — existing
- ✓ Public event landing page (no auth required) — existing
- ✓ Cloud Functions for notifications, photo access, email, admin operations — existing
- ✓ PWA with service worker and manifest — existing

### Active

- [ ] Fix PWA event registration (blank screen / broken fields)
- [ ] Fix Firebase Storage photo access for website embed
- [ ] Fix Firebase Storage photo access for Salesforce integration
- [ ] Diagnose Firebase rule/config changes that caused breakage
- [ ] Ensure all fixes are compatible with the new native app
- [ ] Add download banner in PWA directing users to App Store / Play Store
- [ ] Document transition roadmap from PWA to native app

### Out of Scope

- Native app development — already built and in review
- New feature development for the PWA — focus is stabilization and transition
- Sunsetting the PWA — not yet; just planning the path
- Firebase backend restructuring — changes must be surgical, not architectural

## Context

- **Shared Firebase project:** Both the PWA and the new native app use the same Firebase project (`level-up-app-c9f47`). Any Firestore rules, Storage rules, or API key changes affect both apps.
- **New app codebase:** Located at `/Users/jimrodarte/Level Up App/LevelUp-Fresh`. Has its own `firestore.rules` file that may have been deployed, overwriting the PWA's rules.
- **External integrations broken:** An HTML embed on the Squarespace website and a Salesforce integration both pull user photos (JPGs) from Firebase Storage. Both stopped working after the native app build changes.
- **Cloud Functions:** The PWA has HTTP endpoints (`getPhoto`, `listUserPhotos`, `coaches`, `students`) that serve photo data. These may be affected by rule or CORS changes.
- **CORS configuration:** Known recurring issue. Allowed origins are explicitly listed in Cloud Functions — the new app may need additions or may have changed these.
- **PWA hosted at:** `https://app.levelupcincinnati.org` (Firebase Hosting)

## Constraints

- **Shared backend**: Firebase rules must work for both PWA and native app simultaneously
- **App in review**: Cannot make changes that would invalidate the native app's current App Store submission
- **Lean team**: Jim + JeRod — solutions must be straightforward, not require ongoing maintenance
- **Production users**: 28+ scholars and coaches actively use the PWA — fixes must not introduce new breakage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix PWA before building transition | Broken app undermines trust; users need working events now | — Pending |
| Banner approach for transition (not redirect) | PWA should still work; gently encourage native app download | — Pending |
| Compare both apps' Firebase rules to diagnose | Same Firebase project means rule deployment is likely root cause | — Pending |

---
*Last updated: 2026-03-10 after initialization*
