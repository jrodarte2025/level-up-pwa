# Architecture Patterns

**Domain:** Firebase PWA stabilization and PWA-to-native transition
**Researched:** 2026-03-10

---

## Recommended Architecture

The system is a single Firebase project (`level-up-app-c9f47`) shared by three consumers:

1. **React PWA** — `app.levelupcincinnati.org` (Firebase Hosting, Vite/React 19)
2. **React Native / Expo app** — iOS/Android native, Firebase JS SDK v10
3. **External integrations** — Squarespace embed + Salesforce, both unauthenticated HTTP

Firebase rules are the shared contract between all three. Rule changes are global — deploying from either app's directory overwrites the live rules for all consumers simultaneously. This is the root cause of the current breakage.

```
┌─────────────────────────────────────────────────────────┐
│              Firebase Project: level-up-app-c9f47        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Firestore   │  │   Storage    │  │Cloud Functions│  │
│  │  firestore   │  │  storage     │  │  index.js     │  │
│  │  .rules      │  │  .rules      │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
└─────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                   │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ React PWA │    │ Native App  │    │  External   │
    │(web/auth) │    │(iOS/Android)│    │  (no auth)  │
    └───────────┘    └─────────────┘    └─────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Auth Requirement |
|-----------|---------------|-------------------|-----------------|
| `firestore.rules` | Document-level read/write permissions | All three consumers | Firebase Auth token |
| `storage.rules` | Storage bucket read/write permissions | PWA, native app, external integrations | Firebase Auth token (or none for public paths) |
| `functions/index.js` | Server-side photo access, notifications, admin ops | External callers via HTTP; Firestore triggers | None for `getPhoto`/`coaches`/`students`; Admin SDK bypasses rules |
| `AppShell.jsx` | Authenticated app layout (header + content + bottom nav) | All authenticated pages | Must be authenticated to render |
| `App.jsx` | Auth state, routing, top-level modals | All pages, Firebase Auth | Entry point |
| Banner component (new) | Transition messaging to native app | `AppShell.jsx` or `App.jsx` | Only shown to authenticated users |

---

## Data Flow

### Firebase Rules — Shared Contract

Both app codebases contain their own `firestore.rules` and `storage.rules` files. Whichever was most recently deployed (`firebase deploy --only firestore:rules` or `firebase deploy --only storage`) is what's live in production. The files in each codebase are the **source** — the deployed rules are the **truth**.

Current diagnosed divergence:

**Firestore rules — three breaking changes in native app's version:**

| Rule | PWA version (`Level-Up-App/firestore.rules`) | Native app version (`LevelUp-Fresh/firestore.rules`) | Impact |
|------|----------------------------------------------|------------------------------------------------------|--------|
| `users` write | `uid == userId OR isAdmin()` | `uid == userId` only | Admins cannot write other users' profiles via PWA |
| `registrationCodes` | `allow read: if true` (public) | `allow read: if isAdmin()` | Signup flow broken — code validation requires unauthenticated read |
| `rsvps` write | userId check OR isAdmin() | userId check only (no isAdmin fallback) | Admin cannot manage RSVPs |
| `isAdmin()` function | Checks `isAdmin == true OR role == "admin"` | Checks `isAdmin == true` only | Users with `role == "admin"` (no `isAdmin` flag) lose admin access |
| Comments create | No rate-limit check | Rate-limit: 10s between comments, `timestamp == request.time` | PWA `timestamp` field may not match `request.time` exactly, blocking comment submission |

**Storage rules — the external integration breakage cause:**

| Rule | PWA (no `storage.rules` in PWA repo) | Native app version | Impact |
|------|--------------------------------------|--------------------|--------|
| `users/{userId}/**` read | Was either public or non-existent | `request.auth != null` required | Squarespace embed and Salesforce can no longer read photos directly from Storage |
| `events/{eventId}/**` read | Same | `request.auth != null` required | Event images may fail for unauthenticated callers |

The `getPhoto` Cloud Function (in `functions/index.js`) uses the Firebase Admin SDK, which bypasses Storage rules entirely. The function already returns a public download URL (`?alt=media`). The external integration breakage is therefore one of:
1. Storage rules were deployed locking down read access, causing direct Storage URL requests to fail with 403
2. CORS changes to Cloud Functions blocked the Squarespace or Salesforce callers
3. The `getPhoto` function itself wasn't deployed or has a runtime error

---

## Patterns to Follow

### Pattern 1: Canonical Rules File in PWA Repo

**What:** Treat `Level-Up-App/firestore.rules` and a new `Level-Up-App/storage.rules` as the single source of truth. Both apps read from the same Firebase project, so there is only one live set of rules. The native app's rules file should be deleted or explicitly marked as not-for-deployment.

**Why:** The native app's directory (`LevelUp-Fresh`) is a React Native project. Firebase Hosting/Functions deploys originate from the PWA repo. Keeping two active `firestore.rules` files is the direct cause of accidental overwrites.

**Implementation:**
```
Level-Up-App/
  firestore.rules     ← CANONICAL — deploy from here
  storage.rules       ← CREATE THIS — deploy from here
  firebase.json       ← Points to both rule files above

LevelUp-Fresh/
  firestore.rules     ← Mark as reference-only, do not deploy
  storage.rules       ← Mark as reference-only, do not deploy
```

### Pattern 2: Layered Storage Rules — Auth-Required with Public Function Proxy

**What:** Storage rules require auth for all direct reads. External/unauthenticated access goes through Cloud Functions only (`getPhoto`, `coaches`, `students`). The functions use Admin SDK (bypasses rules) and return signed URLs or data.

**Why:** This is the correct architecture for this project. It preserves security for user data while enabling the Squarespace and Salesforce integrations without making Storage buckets world-readable. The pattern already exists — it just needs to be working.

**Storage rules structure to deploy:**
```
/users/{userId}/**   → read: auth required (direct); public via getPhoto function
/events/{eventId}/** → read: auth required (direct); public via coaches/students functions
/b/{bucket}/o        → default deny
```

**For external embed/Salesforce:** Continue using `getPhoto` and `coaches`/`students` Cloud Function endpoints. Verify CORS config includes Squarespace domain and Salesforce domain. The function already sets `Access-Control-Allow-Origin: *` for `getPhoto` — confirm this is deployed.

### Pattern 3: Merge Rules, Not Replace

**What:** When reconciling the two rule versions, do not choose one wholesale. Merge the stricter and more complete version. The PWA rules are more complete (registrationCodes, phone validation, composite isAdmin check). The native app rules are better structured (explicit create/update/delete vs. combined write). Take the best of both.

**Merged isAdmin() function:**
```javascript
function isAdmin() {
  let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
  return userData.isAdmin == true || userData.role == "admin";
}
```

**registrationCodes must stay public-read:**
```javascript
match /registrationCodes/{codeId} {
  allow read: if true;  // Required for signup flow — code validation before auth
  allow write: if isAdmin();
}
```

**Comment timestamps:** The native app's `request.resource.data.timestamp == request.time` check is likely to fail in the PWA because the PWA uses `serverTimestamp()` which resolves server-side after the rule check. Remove this constraint from the merged rules or change the PWA's comment creation to pass a client timestamp.

### Pattern 4: Transition Banner as App.jsx Modal — Not AppShell

**What:** Place the transition banner as a dismissible state managed in `App.jsx`, rendered above `AppShell` in the component tree, not inside `AppShell` itself.

**Why:** `AppShell` is a layout wrapper with no state. Injecting banner logic there adds state management to a stateless component. `App.jsx` already manages other dismissible UI (notification prompt, profile reminder) using the same `useState` + `localStorage` pattern. The banner follows the same pattern.

**Component hierarchy:**
```
App.jsx
  ├── ProfileModal (modal overlay)
  ├── NotificationPrompt (modal overlay)
  ├── AppDownloadBanner (NEW — persistent top bar, dismissible)
  └── AppShell
        ├── HeaderBar
        ├── {page content / children}
        └── BottomNavBar
```

**Banner placement options within App.jsx render:**
```jsx
// Inside App.jsx, within the authenticated render path:
return (
  <>
    {showAppBanner && <AppDownloadBanner onDismiss={handleDismissBanner} />}
    <AppShell ...>
      {/* existing content */}
    </AppShell>
    {showProfile && <ProfileModal ... />}
    {showNotificationPrompt && <NotificationPrompt ... />}
  </>
);
```

The banner renders above AppShell and doesn't affect AppShell's internal layout, padding, or safe area insets.

**Persistence logic (follows existing pattern):**
- `localStorage.getItem('appBannerDismissed')` — if set, don't show
- Or: `localStorage.getItem('appBannerDismissedAt')` — dismiss for 30 days, then re-show once

### Pattern 5: CORS Scope for External Origins

**What:** For Cloud Functions accessed by external callers (Squarespace embed, Salesforce), the current `Access-Control-Allow-Origin: *` is acceptable given these are public read endpoints returning non-sensitive data. For admin/user-specific endpoints, maintain explicit origin allowlisting.

**Current CORS allowlist in functions (for `onRequest` with `cors: true`):**
- Defaults to the project's hosting domains
- `getPhoto` manually sets `*` — this is correct for external embed use

**What to verify:** Confirm Squarespace and Salesforce are not blocked by anything at the network/CDN level. The `getPhoto` function uses `functions.https.onRequest` (v1 style) while `coaches`/`students` use `onRequest` from `firebase-functions/v2/https` with `cors: true`. Ensure both are deployed and the v1/v2 mix doesn't cause issues.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Deploying Firebase Rules from the Native App Directory

**What:** Running `firebase deploy` from `/LevelUp-Fresh/` or deploying only the rules from that project.
**Why bad:** Overwrites live Firestore and Storage rules for all consumers simultaneously, with no warning. This is how the current breakage occurred.
**Instead:** All Firebase deployments that touch shared resources (rules, functions, hosting) originate from `Level-Up-App/`. The native app's Firebase files are reference copies only.

### Anti-Pattern 2: Direct Firebase Storage URLs for External Integrations

**What:** Constructing `firebasestorage.googleapis.com/...` URLs in Squarespace embed HTML or Salesforce and relying on Storage rules allowing public read.
**Why bad:** Storage rules change breaks all embeds instantly. No CORS control. No fallback path logic.
**Instead:** All external photo access goes through `getPhoto` Cloud Function. The function uses Admin SDK (rule-immune) and returns a download URL. The external integration only depends on the function URL, which is stable.

### Anti-Pattern 3: Embedding Banner in AppShell

**What:** Adding `showBanner` prop to `AppShell` and rendering the banner inside it.
**Why bad:** AppShell is a stateless layout component. Adding state and props for banner logic violates its single responsibility. It's also used everywhere — changes to AppShell are high-risk.
**Instead:** Manage banner state in `App.jsx` alongside the existing notification prompt and profile reminder patterns. Render as a sibling above AppShell.

### Anti-Pattern 4: rate-limit Timestamp Check in Firestore Rules (for PWA)

**What:** The native app's comment rules enforce `request.resource.data.timestamp == request.time`. The PWA uses `serverTimestamp()` which does not produce a client-side value matching `request.time` at rule evaluation time.
**Why bad:** This silently blocks all comment creation from the PWA. Users see a permission denied error with no explanation.
**Instead:** Remove the timestamp equality check from the merged rules. Rate limiting via rules is brittle; if rate limiting is needed, implement it in a Cloud Function callable instead.

---

## Scalability Considerations

This is a small-scale app (28 scholars + coaches + admins, total ~60–80 users). Scalability is not a concern for the current milestone. The relevant concerns are:

| Concern | Current Scale | Mitigation |
|---------|---------------|------------|
| Rules read costs (`get()` in isAdmin) | Low — rules evaluated per operation, not per user session | Acceptable at this scale; denormalize isAdmin if costs become visible |
| Cloud Function cold starts | Low traffic, infrequent calls | Already set `maxInstances: 10`; acceptable |
| Dual-codebase rule drift | Will recur if not addressed | Canonical rules file in PWA repo + deploy protocol |

---

## Build Order Implications

**Phase 1 must address rules before features.** All other work depends on a stable Firebase backend. The order within Phase 1 is:

1. **Diagnose which rules are currently live** — compare `firebase firestore:get rules` output against both local files
2. **Fix Firestore rules** — merge both versions, deploy from PWA repo
3. **Create and deploy Storage rules** — add public Cloud Function path, block direct unauthenticated reads
4. **Verify external integrations** — test Squarespace embed and Salesforce after rules fix; check Cloud Function CORS if still failing
5. **Verify PWA event registration** — RSVP flow should work once rules allow proper userId/admin writes
6. **Build AppDownloadBanner** — only after core functionality is confirmed working

**Why this order:**
- Rules changes are global and instantaneous — a bad deploy can break the native app mid-review
- Verification after each rule change confirms no regression before moving to the next fix
- The banner is cosmetic and carries zero Firebase dependency — build it last, ship it confidently

**Gate between Phase 1 and Phase 2 (if phased):** Before building the banner, confirm event RSVP works for a real user, and confirm Squarespace embed loads photos. These are the two most visible failure modes.

---

## Sources

- Direct codebase inspection: `Level-Up-App/firestore.rules` vs `LevelUp-Fresh/firestore.rules` (HIGH confidence — files read directly)
- Direct codebase inspection: `LevelUp-Fresh/storage.rules` (HIGH confidence — new Storage rules confirmed auth-required for all reads)
- Direct codebase inspection: `functions/index.js` `getPhoto` function — Admin SDK usage confirmed, CORS `*` confirmed (HIGH confidence)
- Direct codebase inspection: `AppShell.jsx` and `App.jsx` — component structure and existing modal pattern confirmed (HIGH confidence)
- Firebase documentation on Security Rules evaluation: rules are evaluated per-request, Admin SDK bypasses rules (HIGH confidence — well-established Firebase behavior)
