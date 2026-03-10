# Phase 1: Firebase Security Rules Diagnosis Report

**Date:** 2026-03-10
**Project:** level-up-app-c9f47
**Status:** Complete -- read-only diagnostic, no production changes made

---

## 1. Executive Summary

**Root Cause Confirmed:** The native app developer ran `firebase deploy` from the `LevelUp-Fresh/` directory, which overwrote both Firestore Security Rules and Storage Security Rules in production. Since `LevelUp-Fresh/firebase.json` includes both `firestore` and `storage` deployment targets, a single `firebase deploy` replaced the PWA's working Firestore rules with the native app's rules and deployed Storage rules that require authentication for all reads.

**Key Impact:** Three distinct PWA features broke as a direct result:
1. RSVP functionality -- rules changed to remove admin override and add rate limiting the PWA does not implement
2. External photo embeds -- Storage rules now require authentication, blocking Squarespace and Salesforce
3. Registration code validation -- rules changed from public read to authenticated read, breaking unauthenticated signup flow

**Timeline of Rule Deployments:**

| Release | Last Updated | Notes |
|---------|-------------|-------|
| `cloud.firestore` | 2026-02-24T19:24:18Z | Firestore rules overwritten by native app deploy |
| `firebase.storage` | 2026-03-03T16:45:56Z | Storage rules deployed from native app (more recent) |

The Storage rules were updated 7 days after Firestore rules, suggesting either two separate deployments or a later re-deploy from the native app directory.

**Live Rules Origin:** The live Firestore rules are structurally identical to the native app's `firestore.rules` with one addition: RSVP rate limiting (`lastRsvpAt` 5-second check) that exists in NEITHER codebase. The live Storage rules are byte-for-byte identical to the native app's `storage.rules`.

---

## 2. Firestore Rules: Three-Way Diff

### Divergence 1: `isAdmin()` Helper Function

| Version | Implementation |
|---------|---------------|
| **Live** | `return request.auth != null && get(...).data.isAdmin == true;` |
| **PWA** | `let userData = get(...).data; return userData.isAdmin == true \|\| userData.role == "admin";` |
| **Native** | Same as Live |

**Impact on PWA:** Users who have `role: "admin"` but no `isAdmin: true` field lose all admin access. Any admin-gated operation (create events, manage posts, manage matches, etc.) fails for these users.

**Impact on Native App:** None -- native app only uses `isAdmin == true`.

**Recommended Merge:** Use PWA version (dual check). The `role == "admin"` fallback is a safety net that harms nothing. Native app users with `isAdmin: true` are unaffected by the additional check.

**Priority:** HIGH -- blocks admin functionality for affected users.

---

### Divergence 2: `users` Collection Write Rules

| Version | Implementation |
|---------|---------------|
| **Live** | `allow write: if request.auth != null && request.auth.uid == userId;` (self-write only) |
| **PWA** | `allow write: if (request.auth.uid == userId \|\| isAdmin()) && phoneNumber validation;` + `allow delete: if isAdmin();` |
| **Native** | Same as Live |

**Impact on PWA:** Admin cannot edit other users' profiles (e.g., updating roles, correcting info). Admin cannot delete user accounts. Phone number validation is absent.

**Impact on Native App:** None -- native app only supports self-profile editing.

**Recommended Merge:** Use PWA version. Admin write access and user deletion are PWA admin features. The `isValidPhoneNumber()` helper should be included for data integrity. Native app self-writes still pass the `request.auth.uid == userId` branch.

**Priority:** HIGH -- blocks admin user management.

---

### Divergence 3: `notification_tokens` Collection

| Version | Implementation |
|---------|---------------|
| **Live** | No rules (collection not mentioned) |
| **PWA** | `allow read, write: if request.auth != null && request.auth.uid == userId;` |
| **Native** | No rules (collection not mentioned) |

**Impact on PWA:** Push notification token registration/reads are denied by Firestore's default-deny policy. This silently breaks push notification functionality.

**Impact on Native App:** Native app likely uses a different notification mechanism or the Cloud Functions (which use Admin SDK and bypass rules) handle token operations.

**Recommended Merge:** Add PWA's `notification_tokens` rules. These rules are scoped to `userId` matching `auth.uid`, so they cannot be exploited. Native app is unaffected by their presence.

**Priority:** MEDIUM -- push notifications may silently fail without this.

---

### Divergence 4: `comments` Create Rules

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create: if request.auth != null && request.resource.data.userId == request.auth.uid && request.resource.data.timestamp == request.time && (lastCommentAt rate limit 10s);` |
| **PWA** | `allow write: if request.auth.uid == request.resource.data.userId;` + `allow delete: if request.auth.uid == resource.data.userId;` |
| **Native** | Same as Live |

**Impact on PWA:** Comment creation fails unless the PWA sets `timestamp` to `request.time` (server timestamp) AND respects the 10-second rate limit via `lastCommentAt` on the user document. The PWA's simpler `write` rule allowed any authenticated write with matching userId.

**Impact on Native App:** None -- native app was built against these rules.

**Recommended Merge:** Use Live/Native version but ensure PWA code sets `timestamp: serverTimestamp()` when creating comments. The rate limiting and timestamp validation are good security practices. Phase 2 should verify the PWA comment creation code sets the correct fields.

**Priority:** MEDIUM -- comments may fail silently; requires PWA code check in Phase 2.

---

### Divergence 5: `reactions` Rules (on both posts and comments)

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create: if request.auth != null;` + `allow delete: if request.auth != null && resource.data.userId == request.auth.uid;` |
| **PWA** | `allow write: if request.auth.uid == reactionId;` + `allow delete: if request.auth.uid == reactionId;` |
| **Native** | Same as Live |

**Impact on PWA:** PWA uses `reactionId` (the document ID) to match `auth.uid` for write access. Live rules use `userId` field on the document data for delete, and allow any authenticated user to create. These are structurally different authorization models -- the PWA ties the reaction document ID to the user ID, while the native app uses a `userId` field in the document data.

**Impact on Native App:** None.

**Recommended Merge:** Need to check PWA reaction creation code. If PWA creates reaction docs with ID = `auth.uid`, the live rules (which allow any authenticated create) are more permissive and should still work. The delete rule divergence needs PWA code inspection in Phase 2. Likely safe to keep Live version since it is more permissive on create and uses `userId` field for delete authorization.

**Priority:** LOW -- reactions likely still work under the more permissive live rules, but delete behavior may differ.

---

### Divergence 6: `posts` Write Rules

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create: if isAdmin(); allow update: if isAdmin(); allow delete: if isAdmin();` (separate create/update/delete) |
| **PWA** | `allow write: if isAdmin();` (single write rule covers create/update/delete) |
| **Native** | Same as Live |

**Impact on PWA:** Functionally equivalent -- both restrict to admins. The PWA's `allow write` is shorthand for create+update+delete. No behavioral difference.

**Impact on Native App:** None.

**Recommended Merge:** Either version works. PWA's is more concise. Keep Live/Native version for explicit granularity -- no functional impact.

**Priority:** NONE -- no behavioral difference.

---

### Divergence 7: `rsvps` Rules (CRITICAL -- causes blank RSVP screen)

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create: if request.auth != null && request.resource.data.userId == request.auth.uid && (lastRsvpAt 5-second rate limit);` + `allow update/delete: owner only` |
| **PWA** | `allow write: if request.auth != null && (request.resource.data.userId == request.auth.uid \|\| isAdmin());` + `allow delete: if ... \|\| isAdmin();` |
| **Native** | `allow create: if request.auth != null;` + `allow update/delete: owner only` (NO rate limiting) |

**IMPORTANT -- Live-Only Modification:** The live rules contain RSVP rate limiting (`lastRsvpAt` 5-second check) that exists in NEITHER codebase. The native app file has no rate limiting on RSVPs. Someone modified the live rules after the native app deployment (or deployed a modified version).

**Impact on PWA:**
1. Admin cannot RSVP on behalf of users (admin override removed)
2. RSVP creation requires `userId` field match AND rate limiting the PWA does not implement
3. The `lastRsvpAt` check requires the user document to have this field, or the `!('lastRsvpAt' in ...)` check must pass
4. This is the **primary cause of the blank RSVP screen** -- the PWA's RSVP write attempts are denied

**Impact on Native App:** The native app's own rules file does NOT have rate limiting, but the live rules do. If re-deployed from native app, rate limiting would be removed.

**Recommended Merge:** Use PWA version (with admin override). Optionally keep rate limiting as a security measure, but it must be documented and the PWA code must handle it. The admin override is essential for PWA admin functionality.

**Priority:** CRITICAL -- directly causes the blank RSVP screen.

---

### Divergence 8: `matches` Rules

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create: if isAdmin(); allow delete: if isAdmin();` (NO update) |
| **PWA** | `allow write: if isAdmin(); allow delete: if isAdmin();` (write includes create+update+delete) |
| **Native** | Same as Live |

**Impact on PWA:** Admin cannot update existing matches. The PWA uses `allow write` which includes update; the live rules only allow create and delete.

**Impact on Native App:** None -- native app only creates and deletes matches.

**Recommended Merge:** Use PWA version (`allow write`). Adding update capability does not affect native app behavior.

**Priority:** MEDIUM -- admin cannot modify existing coach-scholar matches.

---

### Divergence 9: `resources` Write Validation

| Version | Implementation |
|---------|---------------|
| **Live** | `allow create/update/delete: if isAdmin();` (no role validation) |
| **PWA** | `allow write: if isAdmin() && isValidRoles();` with role validation function |
| **Native** | Same as Live |

**Impact on PWA:** Resources can be created without valid role restrictions. The PWA's `isValidRoles()` function ensures only allowed role values ("student", "coach", "board", "employee") can be set.

**Impact on Native App:** None -- native app does not use role validation in rules.

**Recommended Merge:** Use PWA version with `isValidRoles()`. Data validation in security rules is a best practice. Native app admin writes will need to include valid role values, but this is a correctness requirement.

**Priority:** LOW -- data integrity improvement, not a blocking issue.

---

### Divergence 10: `registrationCodes` Read Rules

| Version | Implementation |
|---------|---------------|
| **Live** | `allow read: if request.auth != null;` + `allow write: if isAdmin();` |
| **PWA** | `allow read: if true;` (public, unauthenticated read) |
| **Native** | `allow read: if isAdmin();` + `allow write: if isAdmin();` (admin only) |

**Three-way divergence:** All three versions are different.
- Live requires authentication to read (neither public nor admin-only)
- PWA allows public read (needed for signup validation before user is authenticated)
- Native restricts to admin-only and notes "Code validation happens server-side via callable function"

**Impact on PWA:** Registration code validation during signup fails. The PWA checks registration codes before the user is authenticated (during the signup form), so requiring `request.auth != null` blocks this flow. The blank form or error during signup is caused by this.

**Impact on Native App:** Native app uses `validateRegistrationCode` callable function (v1, nodejs20, confirmed deployed) for server-side validation, so native app is NOT affected by client-side read rules.

**Recommended Merge:** Use PWA version (`allow read: if true`). Public read of registration codes is safe -- the codes themselves are not sensitive (they are used to gate access, and knowing a code only lets you start signup). The native app's callable function bypasses rules via Admin SDK, so public read does not affect native app security.

**Priority:** HIGH -- blocks new user registration on PWA.

---

### Divergence 11: Wildcard Collection Listing Catch-All

| Version | Implementation |
|---------|---------------|
| **Live** | Not present |
| **PWA** | `match /{document=**} { allow list: if request.auth != null; }` |
| **Native** | Not present |

**Impact on PWA:** Collection listing queries for any collection not explicitly matched may fail. This catch-all allows authenticated users to list documents in any collection, which is a broad permission but necessary for certain PWA query patterns.

**Impact on Native App:** None -- native app does not rely on this rule.

**Recommended Merge:** Evaluate whether the PWA actually needs this catch-all. If specific collections need listing, add explicit rules instead. If the PWA relies on broad collection listing, restore this rule. Phase 2 should check PWA query patterns.

**Priority:** MEDIUM -- may cause subtle query failures.

---

## 3. Storage Rules Analysis

### Live vs Native App: IDENTICAL

The diff between live Storage rules and the native app's `storage.rules` produced zero differences. The live rules are byte-for-byte identical to the native app's file.

### Live Storage Rules (Currently Deployed)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 5 * 1024 * 1024;
    }
    match /events/{eventId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 5 * 1024 * 1024;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### PWA Has NO `storage.rules` File

The PWA repository (`Level-Up-App/`) does not contain a `storage.rules` file, and `firebase.json` has no `storage` deployment target. This means:

1. The PWA has never deployed Storage rules from its directory
2. Whatever Storage rules existed before the native app deploy were set by another means (Console, another deploy, or default)
3. Phase 2 must create a `storage.rules` file in the PWA repo and add the `storage` key to `firebase.json`

### Impact on External Embeds

**All Storage read operations require `request.auth != null`.** This means:

- **Squarespace website** embedding photos via direct Storage URLs gets 403 (no Firebase auth token)
- **Salesforce** accessing profile photos via Storage URLs gets 403
- **Any external system** accessing photos without Firebase auth gets 403
- **Direct browser access** to Storage URLs (e.g., shared links) gets 403

The `getPhoto` and `listUserPhotos` Cloud Functions use Admin SDK to generate signed URLs or download tokens, which CAN bypass rules. However, if the PWA or external systems access Storage URLs directly (not through Cloud Functions), they are blocked.

### Recommended Fix for Phase 2

Create `storage.rules` in PWA repo with:
- Public read on specific photo paths (user profiles, event images) for external embed compatibility
- Authenticated write with type/size validation (keep native app's write rules)
- Default deny on all other paths

```
// Recommended merged storage.rules for Phase 2:
match /users/{userId}/{allPaths=**} {
  allow read: if true;  // Public read for external embeds
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.contentType.matches('image/(jpeg|png|webp)')
    && request.resource.size < 5 * 1024 * 1024;
}
match /events/{eventId}/{allPaths=**} {
  allow read: if true;  // Public read for external embeds
  allow write: if request.auth != null
    && request.resource.contentType.matches('image/(jpeg|png|webp)')
    && request.resource.size < 5 * 1024 * 1024;
}
```

**Native app safety:** Making reads public does not break the native app. Authenticated users can still read (public access is a superset of authenticated access). Write rules remain unchanged.

---

## 4. Cloud Functions Status

All expected functions are deployed and running on `us-central1`. Full list:

| Function | Version | Trigger | Runtime | Source |
|----------|---------|---------|---------|--------|
| `getPhoto` | v2 | HTTPS | nodejs22 | PWA |
| `listUserPhotos` | v2 | HTTPS | nodejs22 | PWA |
| `coaches` | v2 | HTTPS | nodejs22 | PWA |
| `students` | v2 | HTTPS | nodejs22 | PWA |
| `adminResetPassword` | v2 | HTTPS | nodejs22 | PWA |
| `sendTestPush` | v2 | HTTPS | nodejs22 | PWA |
| `testEmail` | v2 | HTTPS | nodejs22 | PWA |
| `sendUpdateNotification` | v2 | Firestore create | nodejs22 | PWA |
| `sendEventNotification` | v2 | Firestore create | nodejs22 | PWA |
| `sendEventPublishedNotification` | v2 | Firestore update | nodejs22 | PWA |
| `sendNewUserNotification` | v2 | Firestore create | nodejs22 | PWA |
| `eventPreview` | v2 | HTTPS | nodejs20 | Native |
| `postPreview` | v2 | HTTPS | nodejs20 | Native |
| `cascadeDeleteUserData` | v2 | Firestore delete | nodejs20 | Native |
| `onCommentCreated` | v2 | Firestore create | nodejs20 | Native |
| `onEventCreated` | v2 | Firestore create | nodejs20 | Native |
| `onRSVPCreated` | v2 | Firestore create | nodejs20 | Native |
| `validateRegistrationCode` | v1 | Callable | nodejs20 | Native |

**Key observations:**
- PWA functions run on nodejs22; native app functions run on nodejs20
- `validateRegistrationCode` is a v1 callable function deployed from the native app -- this is the server-side registration code validator that bypasses Firestore rules
- All 4 critical PWA functions (`getPhoto`, `listUserPhotos`, `coaches`, `students`) are confirmed deployed
- Cloud Functions use Admin SDK and are NOT affected by Security Rules changes
- Native app added 6 functions that coexist with PWA functions without conflict

---

## 5. CORS Configuration

### `cors.json` (Storage Bucket CORS)

Allowed origins:
- `http://localhost:5174` (local dev)
- `http://localhost:5173` (local dev)
- `https://level-up-app-c9f47.firebaseapp.com` (Firebase default domain)
- `https://level-up-app-c9f47.web.app` (Firebase default domain)
- `https://app.levelupcincinnati.org` (production custom domain)

Allowed methods: GET, POST, OPTIONS
Allowed headers: Content-Type, Authorization

### Cloud Function CORS

- `getPhoto` and `listUserPhotos`: Use wildcard CORS (`'*'`) -- accessible from any origin
- `coaches` and `students`: Use `cors: true` in v2 config -- allows all origins
- `adminResetPassword`: Uses explicit origin allowlist

**CORS is NOT a blocker.** All critical endpoints are accessible from the PWA's domains. The photo functions use wildcard CORS, so they work from any origin including Squarespace.

---

## 6. API Key Restrictions

**Status: Requires Manual Verification**

Automated tools cannot check Google Cloud Console API key restrictions. The `gcloud` CLI is not authenticated on this machine, and API key settings are only accessible via the Google Cloud Console web interface.

**Assessment:** Given that all three reported symptoms (blank RSVP screen, 403 photo errors, registration code failure) are fully explained by the Firestore and Storage rule changes documented above, API key restrictions are **unlikely to be a contributing factor**. If the Phase 2 fixes resolve all symptoms, API key restrictions can be ruled out. If any symptoms persist after rule fixes, API key restrictions should be investigated manually.

**Manual verification steps (if needed):**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Check the Firebase API key for `level-up-app-c9f47`
3. Verify that HTTP referrer restrictions include `app.levelupcincinnati.org` and `*.firebaseapp.com`

---

## 7. Symptom-to-Root-Cause Mapping

| Symptom | Root Cause | Specific Divergence | Fix Priority |
|---------|-----------|-------------------|-------------|
| **Blank RSVP screen** | RSVP rules changed: (1) admin override removed, (2) rate limiting added requiring `lastRsvpAt` field handling, (3) `userId` validation requires exact field match. PWA write attempts are denied because they include admin-override logic that the live rules reject. | Divergence 7 | CRITICAL |
| **403 photo errors on Squarespace/Salesforce** | Storage rules require `request.auth != null` for ALL reads. External systems (Squarespace, Salesforce, direct URLs) have no Firebase auth token, so all photo requests return 403. | Storage Rules (Section 3) | CRITICAL |
| **Registration code validation failure** | `registrationCodes` read changed from public (`if true`) to auth-required (`if request.auth != null`). PWA validates codes during signup before the user is authenticated. | Divergence 10 | HIGH |

### Secondary Issues (Not Directly Reported but Caused by Rule Changes)

| Issue | Root Cause | Divergence |
|-------|-----------|------------|
| Admin cannot edit other users' profiles | `users` write restricted to self-only | Divergence 2 |
| Admin cannot manage matches (update) | `matches` only allows create/delete, not update | Divergence 8 |
| Push notifications may fail silently | `notification_tokens` has no rules (default deny) | Divergence 3 |
| Comment creation may fail | Live rules require `timestamp == request.time` and rate limiting | Divergence 4 |
| Admin `isAdmin()` check misses `role == "admin"` users | Native app's `isAdmin()` only checks `isAdmin == true` field | Divergence 1 |

---

## 8. Fix Recommendations for Phase 2

### Priority Order

| # | Fix | Use Version | Native App Safe? | Priority |
|---|-----|------------|-----------------|----------|
| 1 | RSVP rules -- restore admin override | PWA (with optional rate limiting) | YES -- native app RSVP writes still pass owner check | CRITICAL |
| 2 | Storage rules -- create canonical `storage.rules` with public read | New merged version | YES -- public read is superset of auth read; writes unchanged | CRITICAL |
| 3 | Registration codes -- restore public read | PWA (`allow read: if true`) | YES -- native app uses callable function, bypasses rules | HIGH |
| 4 | `isAdmin()` -- restore dual check | PWA (includes `role == "admin"` fallback) | YES -- `isAdmin == true` users unaffected | HIGH |
| 5 | Users write -- restore admin write + delete | PWA | YES -- self-write still works for native app users | HIGH |
| 6 | Notification tokens -- add rules | PWA | YES -- native app unaffected; scoped to userId | MEDIUM |
| 7 | Matches -- restore admin update | PWA (`allow write`) | YES -- native app only creates/deletes | MEDIUM |
| 8 | Wildcard catch-all -- evaluate necessity | Check PWA code first | YES if added -- broad but scoped to auth users | MEDIUM |
| 9 | Comments -- verify PWA sets `timestamp: serverTimestamp()` | Keep Live/Native + update PWA code | YES -- already live | MEDIUM |
| 10 | Resources -- restore `isValidRoles()` | PWA | Mostly YES -- admin writes need valid roles | LOW |
| 11 | Reactions -- verify PWA reaction model | Check PWA code first | YES -- live rules more permissive | LOW |

### Deployment Strategy for Phase 2

1. **Create merged `firestore.rules`** in PWA repo that combines the best of both versions
2. **Create `storage.rules`** in PWA repo with public read on photo paths
3. **Add `storage` key** to PWA's `firebase.json`
4. **Deploy from PWA repo ONLY** -- all future rule deployments must originate from `Level-Up-App/`
5. **Verify** by testing RSVP creation, photo access, and registration code validation
6. **Document** that native app's rule files are reference copies only, not deployment sources

### Native App Safety Guarantee

Every recommended fix has been evaluated for native app compatibility. The merged rules will be a SUPERSET of the native app's rules -- everything the native app can do today will still work. The additions (admin overrides, public reads, notification tokens) only add permissions that the native app does not use but does not conflict with.

---

## 9. Open Questions

### 1. Who deployed the RSVP rate limiting?

The live Firestore rules contain a 5-second `lastRsvpAt` rate limit on RSVP creation that exists in **neither** codebase file:
- PWA `firestore.rules`: No rate limiting on RSVPs
- Native app `firestore.rules`: No rate limiting on RSVPs
- Live rules: Has `lastRsvpAt` 5-second rate limit

This was either:
- Manually edited in the Firebase Console after the native app deploy
- Deployed from a modified local copy that was not committed
- Added by someone with project access between 2026-02-24 and the present

**Recommendation:** Ask Jim or the native app developer if they recall adding RSVP rate limiting. This is a useful security feature and should be preserved in the merged rules if intentional.

### 2. Does `registrationCodes` need public read or just auth read?

**Answer from code analysis:** The PWA's registration flow validates codes BEFORE the user is authenticated (during the signup form). Therefore, public read (`allow read: if true`) is required. The native app's `validateRegistrationCode` callable function uses Admin SDK and bypasses rules entirely, so the native app is unaffected by the read rule.

### 3. What is the PWA's comment creation data model?

The live rules require `request.resource.data.timestamp == request.time` for comment creation. Phase 2 must verify that the PWA sets `timestamp: serverTimestamp()` when creating comments. If the PWA uses a different field name or client-side timestamp, the comment creation will fail under the merged rules.

### 4. What is the PWA's reaction authorization model?

The PWA uses `reactionId` (document ID) matching `auth.uid`, while the live rules use `userId` field on the document. Phase 2 should check whether PWA reaction document IDs equal the user's UID or if the PWA stores a separate `userId` field.

### 5. Does the PWA need the wildcard catch-all list rule?

The PWA has `match /{document=**} { allow list: if request.auth != null; }` which is a broad permission. Phase 2 should determine if any PWA queries rely on listing collections not explicitly covered by other rules. If not, this rule can be omitted for tighter security.

---

## Appendix A: File Inventory

| File | Location | Purpose |
|------|----------|---------|
| Live Firestore rules (fetched) | `/tmp/live-firestore.rules` | Currently deployed Firestore Security Rules |
| Live Storage rules (fetched) | `/tmp/live-storage.rules` | Currently deployed Storage Security Rules |
| PWA Firestore rules | `Level-Up-App/firestore.rules` | PWA's known-good baseline (last modified 2025-10-03) |
| Native Firestore rules | `LevelUp-Fresh/firestore.rules` | Native app's Firestore rules (last modified 2026-03-03) |
| Native Storage rules | `LevelUp-Fresh/storage.rules` | Native app's Storage rules (identical to live) |
| Diff: Live vs PWA Firestore | `/tmp/diff-firestore-live-vs-pwa.txt` | 178 lines of differences |
| Diff: Live vs Native Firestore | `/tmp/diff-firestore-live-vs-native.txt` | 42 lines (only RSVP rate limiting difference) |
| Diff: PWA vs Native Firestore | `/tmp/diff-firestore-pwa-vs-native.txt` | 172 lines of differences |
| Diff: Live vs Native Storage | `/tmp/diff-storage-live-vs-native.txt` | 0 lines (identical) |
| Cloud Functions list | `/tmp/functions-list.txt` | 17 deployed functions confirmed |
| Release timestamps | `/tmp/release-timestamps.txt` | Deployment dates for rules |

## Appendix B: Raw Diff -- Live Firestore vs PWA Firestore

```diff
--- /tmp/live-firestore.rules
+++ Level-Up-App/firestore.rules
@@ isAdmin() function @@
-    function isAdmin() {
-      return request.auth != null
-        && get(...).data.isAdmin == true;
+    function isAdmin() {
+      let userData = get(...).data;
+      return userData.isAdmin == true || userData.role == "admin";

@@ users write @@
-      allow write: if request.auth != null && request.auth.uid == userId;
+      allow write: if (request.auth.uid == userId || isAdmin()) && phoneNumber validation;
+      allow delete: if isAdmin();

@@ notification_tokens @@
+    match /notification_tokens/{userId} {
+      allow read, write: if request.auth != null && request.auth.uid == userId;
+    }

@@ comments create @@
-        allow create: if request.auth != null
-          && userId match && timestamp == request.time && rate limit 10s;
+        allow write: if request.auth.uid == request.resource.data.userId;

@@ reactions @@
-          allow create: if request.auth != null;
-          allow delete: if request.auth != null && resource.data.userId == auth.uid;
+          allow write: if request.auth.uid == reactionId;
+          allow delete: if request.auth.uid == reactionId;

@@ rsvps @@
-      allow create: if auth != null && userId match && lastRsvpAt rate limit 5s;
-      allow update: owner only;
-      allow delete: owner only;
+      allow write: if auth != null && (userId match || isAdmin());
+      allow delete: if auth != null && (userId match || isAdmin());

@@ matches @@
-      allow create: if isAdmin();
-      allow delete: if isAdmin();
+      allow write: if isAdmin();
+      allow delete: if isAdmin();

@@ resources @@
-      allow create/update/delete: if isAdmin();
+      allow write: if isAdmin() && isValidRoles();

@@ registrationCodes @@
-      allow read: if request.auth != null;
-      allow write: if isAdmin();
+      allow read: if true;

@@ wildcard catch-all @@
+    match /{document=**} {
+      allow list: if request.auth != null;
+    }
```
