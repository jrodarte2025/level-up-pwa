# Project Research Summary

**Project:** Level Up App — PWA Stabilization & Native App Transition
**Domain:** Firebase shared-project stabilization + PWA-to-native transition
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

This project has a well-understood root cause and a clear fix path. The Level Up App uses a single Firebase project (`level-up-app-c9f47`) shared between the React PWA, the new React Native/Expo app, and two external integrations (Squarespace, Salesforce). The native app's Firebase deployment — specifically its `firestore.rules` and `storage.rules` files — overwrote the live production rules without a merge review. The result: the PWA's event registration silently fails (blank screen, no user-visible error), external photo embeds return 403s, and admin users may have lost write access. Every reported symptom traces to this single root event.

The fix is surgical, not architectural. The PWA already has the right infrastructure: Admin SDK-powered Cloud Functions with CORS support, a well-structured Firestore rules file, and a component tree that has clear insertion points for a transition banner. The work breaks into two distinct workstreams — restoring stability (Firebase rules reconciliation + CORS audit) and enabling the transition (download banner, documentation). These must be sequenced correctly: rules must be live and verified before the banner is built, because the banner is meaningless if the underlying app is broken.

The main risk is deploying a fix that breaks the native app currently under App Store review. Research confirmed that the submitted native app binary uses 100% mock Firebase data — it does not connect to the live project. This means rules changes are safe to deploy immediately without risk of App Store rejection. The secondary risk is the post-launch period: once real users have both the PWA and the native app installed, FCM token collisions will cause duplicate notifications. This must be addressed before the native app goes live to real users.

---

## Key Findings

### Recommended Stack

No new dependencies are required for the stabilization work. The existing Firebase toolchain (Firebase CLI ~13.x, Admin SDK 13.4.0, `firebase-functions/v2`) covers all diagnostic and fix needs. The only potentially new addition is `@firebase/rules-unit-testing ^3.0.0` as a devDependency, which provides regression testing for rules changes going forward.

For the download banner, a custom React component (~20 lines of JSX + `localStorage`) is the right approach. All available banner libraries are either unmaintained or jQuery-era. The iOS Smart App Banner (`<meta name="apple-itunes-app">`) is a free supplement that renders at the OS level in Safari before React loads — add it once the App Store ID is confirmed.

**Core technologies:**
- **Firebase CLI `firebase-tools` (latest ~13.x)**: Rule deployment, diff, and log access — the only official channel for production rule management
- **Firebase Emulator Suite** (bundled): Local rule testing without touching production — required before any rule deployment
- **`@firebase/rules-unit-testing ^3.0.0`** (devDep): Automated rule regression tests — prevents the current breakage from recurring
- **Custom `AppDownloadBanner` React component**: Transition banner — no external library needed; uses existing Level Up brand tokens
- **iOS Smart App Banner meta tag**: Supplement for Safari users; renders before React; requires App Store ID (pending review)

**What NOT to add:** No Storage rules management library, no signed URLs for photo endpoints (existing `?alt=media` pattern is correct), no forced PWA-to-App Store redirect.

---

### Expected Features

The scope is tightly bounded. All table-stakes features are restorations, not new builds. The single new UI feature is the download banner.

**Must have (table stakes):**
- Firebase rule diff and audit — root cause is unknown until live rules are compared against both codebases
- Firestore rules fix — merge PWA and native app versions; preserve `registrationCodes` public read, dual `isAdmin()` check, no timestamp rate-limit on comments
- Storage rules creation — `storage.rules` file does not exist in PWA repo; must be created, version-controlled, and deployed
- CORS audit for external integrations — Squarespace and Salesforce are not in the explicit CORS allowlist for `coaches`/`students` endpoints; `getPhoto` already uses wildcard
- PWA event RSVP restoration — blank screen on registration is the primary user-facing breakage; 28 active users affected
- App download banner — dismissible, mobile-only, platform-aware (iOS vs Android), stored dismissal in `localStorage`

**Should have (differentiators):**
- Admin-controlled banner toggle via Firestore `config` document — lets Jim turn the banner on/off without a code deploy
- Deprecation notice schedule — escalating messaging as PWA sunset date approaches
- Rule deployment checklist as a documented protocol — prevents recurrence

**Defer (v2+ / post-launch):**
- Automated CI/CD for rule testing — overkill for team size
- PWA offline mode — native app handles this use case
- FCM token collision handling — required before real dual-app users exist, but not before App Store launch (which uses mock data)

**Feature dependency critical path:**
```
Firebase rule audit
  → RSVP write fix
  → Storage access fix
    → External integration fix (CORS)

App Store review completion
  → Download banner (needs App Store link/App ID)
```

---

### Architecture Approach

The system's architecture is correct — the problem is a governance failure, not a design failure. Three consumers (PWA, native app, external integrations) share one Firebase project. Rules are a global contract: any deployment from either app's directory atomically replaces the live rules for all consumers. The current breakage is the predictable outcome of deploying without a merge step.

The fix establishes `Level-Up-App/` as the single canonical source for all Firebase deployments. The native app's rules files are demoted to reference copies. A new `storage.rules` file is added to the PWA repo and wired into `firebase.json`. The banner component slots into `App.jsx` above `AppShell` — following the existing pattern for `NotificationPrompt` and `ProfileModal`.

**Major components:**
1. **`firestore.rules` (canonical in `Level-Up-App/`)** — merged version preserving all PWA access patterns; `isAdmin()` checks both `isAdmin == true` and `role == "admin"`; `registrationCodes` stays public-read; comment timestamp equality check removed
2. **`storage.rules` (new, in `Level-Up-App/`)** — auth-required for direct reads; external access proxied through Cloud Functions only; `firebase.json` updated to include this file
3. **`functions/index.js`** — no code changes required for CORS; verify deployed origin is wildcard for `getPhoto`/`listUserPhotos`; add domain documentation comments
4. **`AppDownloadBanner` component** — new, renders in `App.jsx` above `AppShell`; `localStorage` dismissal; platform-aware store links

---

### Critical Pitfalls

1. **Blind deployment of native app's Firebase rules** — Never run `firebase deploy` from `LevelUp-Fresh/`. All rule deployments originate from `Level-Up-App/` only. Use `firebase deploy --only firestore:rules` (never bare `firebase deploy`) so you know exactly what you're changing.

2. **Fixing the PWA breaks the app in App Store review** — Confirmed safe: `LevelUp-Fresh-fixes/firebase.ts` is 100% mock data. The submitted binary does not connect to the live Firebase project. Rules changes will not affect the reviewer's session. Verify this before deployment regardless.

3. **Storage rules missing entirely** — There is no `storage.rules` in the PWA repo. The live Storage rules were set by the native app deployment and require authentication for all reads. Create `storage.rules`, version-control it, and deploy it from `Level-Up-App/` as part of Phase 1.

4. **No error visibility makes rule failures look like UI bugs** — The PWA has no error boundary (confirmed in CONCERNS.md). The blank screen on event registration is a silent `PERMISSION_DENIED` exception. Add a minimal error boundary and open DevTools → Console before debugging — look for `FirebaseError: Missing or insufficient permissions` before touching any code.

5. **FCM token collision after dual-app adoption** — When real users have both apps installed, the current single-token-per-user schema in `notification_tokens` will produce duplicate push notifications. Must be resolved before the native app is released to real users (not just under review).

---

## Implications for Roadmap

Based on research, a 3-phase structure is recommended.

### Phase 1: Diagnose and Stabilize

**Rationale:** Every other fix depends on knowing what rules are actually live in production. Diagnosis must precede any deployment. This phase has no Firebase deployments — it only reads.

**Delivers:** Confirmed root cause, side-by-side rule diff, error visibility in the app, confidence that App Store review is safe to proceed around

**Addresses:** Firebase rule audit, Storage rules audit, CORS audit, error boundary gap

**Avoids:**
- Pitfall 1 (blind deployment) — by reading live state before touching anything
- Pitfall 3 (breaking App Store review) — by confirming mock vs. real Firebase in submitted binary
- Pitfall 8 (silent permission errors) — by adding error boundary before any debugging

**Key actions:**
- Run `firebase firestore:rules:get` to capture live rules
- Diff live rules vs. `Level-Up-App/firestore.rules` vs. `LevelUp-Fresh/firestore.rules`
- Run `firebase storage:rules:get` to capture live Storage rules
- Open browser DevTools and reproduce the blank RSVP screen — look for `FirebaseError`
- Add minimal React error boundary before any rules changes

**Research flag:** Skip — diagnosis steps are straightforward CLI commands. Well-documented Firebase toolchain.

---

### Phase 2: Fix Firebase Rules and External Integrations

**Rationale:** With diagnosis complete and root cause confirmed, apply the minimum surgical changes needed to restore PWA function. Deploy incrementally with emulator validation between each change.

**Delivers:** Working event registration for 28 PWA users, restored Squarespace photo embeds, restored Salesforce photo access, version-controlled `storage.rules` file

**Addresses:** Firestore rules fix, Storage rules creation and deployment, CORS verification, RSVP write restoration

**Avoids:**
- Pitfall 2 (CORS allowlist gaps) — by auditing which endpoints each external integration calls before adding origins
- Pitfall 4 (Storage rules missing) — by creating and committing `storage.rules` as part of this phase
- Pitfall 7 (`isAdmin()` extra read) — by preserving dual `isAdmin()` check in merged rules
- Pitfall 10 (emulator detection bug) — by switching emulator detection to `VITE_ENVIRONMENT` before local testing

**Key actions:**
- Create merged `firestore.rules` from both versions; preserve all PWA access patterns
- Create `storage.rules` with auth-required direct reads; add to `firebase.json`
- Deploy rules from `Level-Up-App/` only using `--only` flags
- Verify each fix against emulator before production deployment
- Test Squarespace embed and RSVP flow after each deployment

**Research flag:** Skip — merge strategy is fully documented in ARCHITECTURE.md with exact rule syntax.

---

### Phase 3: Transition Banner and Post-Launch Architecture

**Rationale:** Banner is cosmetic and has zero Firebase dependency. Build it after core functionality is confirmed working. Post-launch architecture (FCM token schema) must be addressed before real users have both apps simultaneously.

**Delivers:** PWA download banner directing users to native app, iOS Smart App Banner meta tag, FCM token collision prevention, documented deploy protocol for both codebases

**Addresses:** App download banner, platform detection, FCM token schema update, service worker deactivation path, rule deployment documentation

**Avoids:**
- Pitfall 5 (FCM token collision) — update `notification_tokens` to support per-platform token keys
- Pitfall 6 (stale service worker) — build explicit deactivation into the banner ("I've downloaded the app" button)
- Pitfall 9 (banner vs. PWA install prompt conflict) — check `window.navigator.standalone` before showing banner on iOS

**Key actions:**
- Build `AppDownloadBanner` component in `App.jsx` above `AppShell`
- Add iOS Smart App Banner meta tag to `index.html` once App Store ID is confirmed
- Update `notification_tokens` schema to `{ web: token, ios: token, android: token }`
- Add `nativeAppActive` flag write to native app login flow
- Document canonical deploy protocol (which repo to deploy from, which `--only` flags)

**Research flag:** FCM token collision handling may need a Phase 3 research pass. The token schema update affects Cloud Functions and both app clients simultaneously. Standard pattern but coordination is non-trivial.

---

### Phase Ordering Rationale

- Phase 1 (diagnosis) must precede Phase 2 (fix) because deploying without knowing the current live state risks making things worse. The entire breakage history is one deployment made without reading the live state first.
- Phase 2 must precede Phase 3 because the banner is worthless if event registration still fails. Users directed to the native app should at minimum have a functional PWA as the fallback.
- The App Store review constraint is actually permissive, not restrictive: since the submitted binary is mock-only, rules changes can proceed immediately without coordinating around the review timeline.
- FCM token collision is grouped into Phase 3 because it only becomes a problem when real users have both apps installed — which cannot happen until the native app passes review and is released.

---

### Research Flags

**Needs research before Phase 3 implementation:**
- **FCM token schema update:** Changing the token storage structure requires coordinated changes to Cloud Functions (`sendUpdateNotification`, `sendEventNotification`) and the native app client. The interaction surface is larger than it appears. A targeted research pass on multi-platform FCM token management would reduce risk.

**Standard patterns (skip research):**
- **Phase 1 (diagnosis):** All steps are Firebase CLI commands and console reads. No ambiguity.
- **Phase 2 (rules fix):** The exact merged rule syntax is documented in ARCHITECTURE.md with line-level specificity. The `storage.rules` pattern is provided in STACK.md. Emulator testing procedure is well-documented.
- **Phase 3 banner:** Custom React component is 20 lines. The `localStorage` dismissal and platform detection patterns are industry standard with HIGH confidence.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct codebase inspection of `functions/index.js`, `firebase.json`, `package.json`. Firebase CLI toolchain is stable. Only version numbers (CLI ~13.x, `@firebase/rules-unit-testing ^3.0.0`) need live verification before pinning. |
| Features | HIGH | Scope is tightly bounded by PROJECT.md. Table-stakes features are restorations of documented functionality, not greenfield builds. Anti-features are clearly established. |
| Architecture | HIGH | Both `firestore.rules` files were read directly. The divergences are documented at the line level (5 specific rule differences identified). `AppShell.jsx` and `App.jsx` component structure confirmed. Storage rules absence confirmed via Glob search. |
| Pitfalls | HIGH | All 10 pitfalls are grounded in actual code (CONCERNS.md, `functions/index.js`, `LevelUp-Fresh-fixes/firebase.ts`). The mock-only status of the submitted native app binary is a critical confirmed finding. |

**Overall confidence:** HIGH

### Gaps to Address

- **Live Storage rules content:** `firebase storage:rules:get` has not been run yet. The research confirmed the rules were likely deployed from the native app and require authentication, but the exact live content is unknown. Read this in Phase 1 before writing any fix.
- **App Store ID:** Not yet confirmed. Required for the `<meta name="apple-itunes-app">` tag and the iOS App Store link in the download banner. Available once the app passes review.
- **Firebase CLI subcommand syntax:** `firebase firestore:rules:list` vs. `firebase firestore:rules:get` — exact subcommand should be verified with `firebase help firestore:rules` before scripting. MEDIUM confidence on exact syntax.
- **Which specific domains call `coaches`/`students` endpoints:** CORS audit needs to confirm whether Squarespace or Salesforce ever calls these endpoints (which use the explicit allowlist, not wildcard). If they do, those domains need to be added. If they only call `getPhoto`/`listUserPhotos` (wildcard), the external integration issue may be Storage rules, not CORS.

---

## Sources

### Primary (HIGH confidence)

- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/firestore.rules` — PWA Firestore rules (current version in repo)
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/LevelUp-Fresh-fixes/firestore.rules` — native app Firestore rules (divergent version)
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/LevelUp-Fresh-fixes/firebase.ts` — confirmed 100% mock Firebase implementation
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/functions/index.js` — CORS config, Cloud Function endpoints, Admin SDK usage
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/firebase.json` — confirmed no `storage` section
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/PROJECT.md` — project constraints, scope boundaries, shared Firebase project context
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/codebase/CONCERNS.md` — no error boundary, no error logging, fragile auth state
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/codebase/INTEGRATIONS.md` — CORS allowed origins list, Cloud Function endpoints, external integration patterns

### Secondary (MEDIUM confidence)

- Firebase ecosystem training knowledge (through August 2025): Admin SDK bypasses Storage rules; `firebase deploy` is a full atomic overwrite; FCM token management patterns; PWA banner/localStorage dismissal pattern
- CLI subcommand syntax: `firebase firestore:rules:get` — pattern is correct, exact subcommand should be verified with `firebase help`

### Tertiary (LOW confidence)

- `@firebase/rules-unit-testing ^3.0.0` version number — correct package, version should be verified with `npm show @firebase/rules-unit-testing version` before installing
- Smart App Banner App Store ID — unavailable until App Store review completes

---

*Research completed: 2026-03-10*
*Ready for roadmap: yes*
