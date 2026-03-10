# Feature Landscape

**Domain:** Firebase PWA stabilization and PWA-to-native app transition
**Project:** Level Up App — PWA Stabilization & Native App Transition
**Researched:** 2026-03-10
**Confidence:** MEDIUM — based on codebase analysis (HIGH confidence) and training knowledge of Firebase debugging/PWA patterns (MEDIUM confidence; no live web search available this session)

---

## Table Stakes

Features the fix/transition cannot succeed without. Missing any of these means the project fails its core goal.

### Firebase Rule Audit & Fix

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Side-by-side rule diff (PWA vs native app) | Root cause diagnosis — deployed native app rules likely overwrote PWA rules | Low | Compare `firestore.rules` in this repo vs `LevelUp-Fresh` repo; current PWA rules file is at `/firestore.rules` |
| Identify which rules file was last deployed | Without this you're guessing at the breakage cause | Low | Firebase Console > Firestore > Rules tab shows deploy history with timestamps |
| Storage rules audit | External integrations (Squarespace embed, Salesforce) stopped working after native app build — Storage rules are almost certainly the cause | Low | `firebase.json` has no `storage` entry, meaning Storage rules are managed separately; must be checked in Firebase Console |
| CORS origin audit for Cloud Functions | `getPhoto` and `listUserPhotos` endpoints are called by external origins (Squarespace, Salesforce); if CORS allowed-origins list changed, these break silently | Low | Current allowed origins in `functions/index.js` don't include Squarespace or Salesforce domains — this is likely a root cause |
| Verify both apps' Firebase SDK versions match expectations | Native app (React Native/Expo) uses Firebase JS SDK v10; PWA uses v11.7.3 — rule syntax must be compatible with both | Medium | Firestore rules language is version-independent; the risk is behavioral differences in how each SDK encodes auth tokens |
| Test rule changes against both apps before deploying | Shared Firebase project means any rule deployment affects both apps simultaneously | Medium | Use Firebase Emulator Suite (`firebase emulators:start`) to validate rule changes locally before deploying to production |

### PWA Event Registration Fix

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Diagnose blank screen / broken fields on event RSVP | Core reported breakage; 28+ active users cannot register for events | Medium | Likely a Firestore rule permission error on `rsvps` collection write; check browser console for `PERMISSION_DENIED` errors |
| Verify RSVP write rule covers current auth state | RSVPs rule requires `request.resource.data.userId == request.auth.uid`; if auth token is stale or user doc structure changed, this fails silently | Medium | Auth token expiry or changed user document schema are common causes of this exact symptom |
| Confirm `events` collection read rule works for authenticated users | Event form can't populate if event document is unreadable | Low | Current rule `allow read: if request.auth != null` should work; verify it hasn't been overwritten |

### External Integration Fix (Squarespace + Salesforce)

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Add external domains to CORS allowed origins | Squarespace website and Salesforce both call `getPhoto`/`listUserPhotos` Cloud Functions; neither `squarespace.com` nor Salesforce domains are in current CORS config | Low | This is almost certainly the root cause for external integrations; add the specific domains calling these functions |
| Verify Firebase Storage rules allow public or service-account reads | If Storage rules require Firebase Auth but Salesforce/Squarespace calls don't carry Firebase tokens, all photo reads will fail with 403 | Medium | Cloud Functions using Admin SDK bypass Storage rules; if the functions themselves haven't changed but external calls broke, CORS is more likely than rules |
| Test photo endpoint responses from external callers | Confirm fix works from both external contexts, not just from the PWA | Low | Use `curl` or Postman with `Origin` header set to the external domain to simulate cross-origin requests |

### Download Banner for App Store Transition

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent but dismissible banner in PWA header | Users need to know the native app exists; without a banner, nobody discovers it organically | Low | Banner must not break existing PWA navigation; place below `HeaderBar` in `AppShell.jsx` |
| Platform detection (iOS vs Android) | App Store links are different for each platform; wrong link = user confusion and failed download | Low | `navigator.userAgent` check for `iPhone|iPad|iPod` vs Android is reliable for banner link targeting; HIGH confidence this is the standard approach |
| Link to App Store (iOS) and Play Store (Android) | Users need the correct deep link to download | Low | App Store link requires the app's Apple ID (available after App Store review completes); Play Store link requires the package name |
| "Don't show again" dismissal stored in localStorage | Respect user intent; don't re-surface banner to users who dismissed it | Low | Pattern: `localStorage.setItem('appBannerDismissed', '1')` checked on mount |
| Desktop suppression | Banner only makes sense on mobile; showing it on desktop is confusing | Low | Check `window.innerWidth < 768` or user agent for mobile detection |

### Transition Documentation

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Document which Firebase rules work for both apps | Required before any future deployment; prevents re-breaking the PWA when making native app changes | Low | Single markdown file in `.planning/` noting which rules have been verified cross-compatible |
| Document CORS allowed-origins list with reasoning | Prevents CORS from being inadvertently broken again during future functions deployments | Low | Add comment block in `functions/index.js` explaining each allowed origin and why |

---

## Differentiators

Features that would improve the transition experience but aren't required for the fix to succeed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smart banner: suppress if already on native app | If a user visits the PWA URL from the native app's webview, don't show the download banner | Low | Check for a custom user-agent or URL parameter set by the native app; useful but not critical |
| Banner with app store rating display | "4.8 stars — Download free" increases click-through on the banner | Low | Requires App Store Connect API or hardcoding the rating after accumulating reviews |
| Admin-controlled banner toggle in Firestore | Let Jim turn the banner on/off without a code deployment | Medium | Store `appBannerEnabled: boolean` in a Firestore `config` document; read on PWA load |
| Deprecation notice schedule | Display increasingly urgent messaging as the PWA sunset date approaches | Medium | "Native app now available" → "PWA retiring in 30 days" → "Please switch to the native app" |
| Rule deployment checklist as a shared doc | Prevent accidental breakage during future Firebase deployments | Low | Simple checklist: test in emulator, diff against known-good rules, verify both apps before deploying |
| Firebase Rules Playground use for ongoing validation | Firebase Console has a built-in Rules Playground simulator | Low | Document how to use it; no code required; useful for Jim and JeRod to self-diagnose future rule issues |

---

## Anti-Features

Features to deliberately NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated rule testing suite (CI/CD) | Adds infrastructure overhead for a lean 1.5-person team; overkill for this scope | Manual emulator testing + documented checklist is sufficient |
| PWA offline mode | Out of scope per PROJECT.md; adds complexity with service worker caching strategies; native app covers this use case | Leave offline mode as a future native app feature |
| Forced redirect from PWA to App Store | Users on the PWA during the transition period may have legitimate reasons to stay; forced redirect is hostile UX | Use a banner that encourages but doesn't force migration |
| Custom "install PWA" prompt | The PWA is being deprecated; encouraging users to install it as a PWA works against the transition goal | Show the native app download banner instead |
| New PWA features during this milestone | PROJECT.md explicitly states "new feature development for the PWA" is out of scope | Focus 100% on stabilization and transition |
| Firebase project split (separate project for native app) | Would require migrating all user data and Auth records; dangerous with 28+ active users and app in review | Keep shared Firebase project; use rules that work for both apps |
| Full Storage rules rewrite | Architectural change to rules is out of scope; native app is already in review and depends on current Storage behavior | Make surgical changes only; document what changed and why |

---

## Feature Dependencies

```
Firebase rule audit
  → identifies root cause
    → RSVP write fix (Firestore rules)
    → Storage access fix (Storage rules or CORS)
      → External integration fix (CORS allowed origins)

CORS audit
  → External integration fix (add Squarespace/Salesforce origins)

App Store review completion
  → Download banner (need App Store link/App ID before banner can link correctly)

Download banner
  → Platform detection (must know iOS vs Android before rendering link)
  → Dismissal logic (localStorage must be checked before rendering)
```

**Critical path:** Firebase rule audit must happen first. Every other fix depends on understanding what changed.

---

## MVP Recommendation

Prioritize in this order:

1. **Firebase rule diff and audit** — Diagnose before fixing; run side-by-side comparison of this repo's `firestore.rules` vs what's currently deployed and what the native app repo uses
2. **CORS allowed-origins fix** — High-probability root cause for both the external integrations breakage; low effort, high impact
3. **Storage rules audit** — Verify `getPhoto` and `listUserPhotos` Cloud Functions still have appropriate Storage access; check if Storage rules were separately deployed
4. **RSVP write fix** — Restore event registration for the 28 active PWA users; validate against emulator before deploying
5. **Download banner** — Build after rules are stable; requires App Store link which may not be available until review completes

**Defer:**
- Admin-controlled banner toggle: adds Firestore dependency for a simple UI element; use a code flag instead
- Deprecation schedule messaging: design this after the native app has launched and adoption is measurable
- Rule testing automation: not justified for team size and project scope

---

## Confidence Notes

| Claim | Confidence | Basis |
|-------|------------|-------|
| CORS is root cause for external integrations | HIGH | Squarespace/Salesforce not in current allowed-origins list (verified in `functions/index.js`); Admin SDK bypasses Storage rules so functions themselves should still have storage access |
| Storage rules changed during native app build | MEDIUM | No `storage.rules` file found in this repo and no `storage` key in `firebase.json`; Storage rules likely deployed separately via Firebase Console during native app development |
| PWA RSVP breakage is Firestore rules-related | MEDIUM | Symptom (blank screen, broken fields) is consistent with `PERMISSION_DENIED` on writes; the RSVP rule uses `request.resource.data.userId` which fails if the native app changed how userId is stored |
| Platform detection via user-agent is reliable for banner | HIGH | Standard browser API; well-established pattern; iOS/Android detection from user-agent is stable |
| Banner + localStorage dismissal is sufficient for transition | HIGH | This is the industry-standard approach for PWA-to-native transitions; no complex infrastructure required |

---

## Sources

- Codebase analysis: `/Users/jimrodarte/Documents/GitHub/Level-Up-App/functions/index.js` (CORS config — verified)
- Codebase analysis: `/Users/jimrodarte/Documents/GitHub/Level-Up-App/firestore.rules` (rule structure — verified)
- Codebase analysis: `/Users/jimrodarte/Documents/GitHub/Level-Up-App/firebase.json` (no storage config — verified)
- Codebase analysis: `.planning/codebase/CONCERNS.md` (known bugs, fragile areas — verified)
- Codebase analysis: `.planning/codebase/INTEGRATIONS.md` (CORS allowed origins, Cloud Function endpoints — verified)
- Project scope: `.planning/PROJECT.md` (requirements, constraints, out-of-scope items — verified)
- Training knowledge (August 2025): Firebase Emulator Suite capabilities, PWA banner patterns, localStorage dismissal patterns, platform detection via user-agent — MEDIUM confidence, not web-verified this session
