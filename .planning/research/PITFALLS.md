# Domain Pitfalls

**Domain:** Firebase PWA Stabilization + Shared-Project Native App Transition
**Researched:** 2026-03-10
**Confidence:** HIGH — grounded in direct codebase inspection of both the PWA (`/Level-Up-App/`) and the native app skeleton (`LevelUp-Fresh-fixes/`), plus the actual deployed rules and Cloud Functions.

---

## Critical Pitfalls

Mistakes that cause broken production apps, App Store rejection, or irreversible data loss.

---

### Pitfall 1: Blind Deployment of Native App's Firebase Rules

**What goes wrong:** The native app has its own `firestore.rules` file (PROJECT.md confirms: "LevelUp-Fresh has its own firestore.rules that may have been deployed, overwriting the PWA's rules"). When `firebase deploy` is run from the native app's project directory, it atomically replaces the entire live rules set. There is no merge — it's a full overwrite. If the native app's rules tighten or restructure access (e.g., requiring new fields, removing the wildcard `/{document=**}` list rule, or changing the `isAdmin()` helper), the PWA breaks immediately for all 28+ active users.

**Why it happens:** Developers building a new app against a shared project treat their local rules file as the source of truth. The rules file is modified to fit the native app's data access patterns without checking whether the PWA still requires the old patterns. The `firebase deploy` command has no "preview diff" step built in by default — it just applies.

**Consequences:**
- Event registration breaks (blank screen, the current symptom)
- RSVP writes fail silently — no error shown to user since there is no error boundary
- Storage rule overwrites could break the Squarespace and Salesforce photo embeds
- The native app currently in App Store review may pass review with one rules set, then face a different rules set at launch if the PWA fix deployment overwrites again

**Warning signs:**
- PWA worked before the native app build started, then broke around the same time the native app was being developed
- The current symptom (blank screen / broken fields on event registration) matches the pattern of a Firestore permission error hitting a component with no error boundary — it fails silently
- `firebase.json` in the PWA repo points to `firestore.rules` — if the native app's `firebase.json` also points to a `firestore.rules`, whoever deploys last wins

**Prevention:**
1. Before touching any rules: run `firebase firestore:rules:get` to capture the currently-live rules as a snapshot
2. Diff the live rules against both the PWA's `firestore.rules` and the native app's `firestore.rules` to identify exactly what changed
3. Establish one canonical rules file — the PWA's `firestore.rules` — as the single source of truth going forward
4. Never deploy rules from the native app's directory without first merging and reviewing both sets
5. Use `firebase deploy --only firestore:rules` (never bare `firebase deploy`) so you know exactly what you're deploying

**Phase:** Phase 1 (Diagnosis) — must be resolved before any fixes are applied

---

### Pitfall 2: CORS Allowlist Doesn't Include the Native App's Origin

**What goes wrong:** The CORS allowlist in `functions/index.js` is hardcoded to five specific origins:
```
http://localhost:5174
http://localhost:5173
https://level-up-app-c9f47.firebaseapp.com
https://level-up-app-c9f47.web.app
https://app.levelupcincinnati.org
```
The native iOS/Android app does not send an `Origin` header at all (native apps don't have browser-enforced CORS). However, if the native app ever calls these Cloud Functions via a WebView component, React Native web API, or during Expo's bundler development (`exp://`), those requests will be silently rejected. More immediately: the Squarespace website embed and Salesforce integration are external origins — if either calls a function directly (not just fetches a Storage URL), they are not in the allowlist and will fail.

**Critically:** `getPhoto` and `listUserPhotos` use `res.set('Access-Control-Allow-Origin', '*')` — wildcard, open to all. But `adminResetPassword`, `coaches`, and `students` use the explicit allowlist. If the Squarespace embed or Salesforce ever calls the `coaches` or `students` endpoints, it will fail with a CORS error that looks like a network error.

**Why it happens:** CORS lists grow by exception — a new origin breaks, someone adds it, then forgets to document it. The native app was built without needing to add its origin (native apps bypass CORS), but the habit of treating the list as complete means external integrations get missed.

**Consequences:**
- External integrations (Squarespace, Salesforce) silently receive no data
- Errors appear to be network failures, not configuration issues — extremely hard to debug without knowing to check CORS
- Adding a new origin to fix one integration can inadvertently expose another endpoint

**Warning signs:**
- Photo embeds work in some browsers but not others (CORS is browser-enforced; Postman/curl will work fine)
- Salesforce shows photos intermittently — some endpoints work (`*` wildcard), others don't (explicit list)
- Any "blocked by CORS policy" error in browser dev tools

**Prevention:**
1. Audit which Cloud Function endpoints each external integration calls — Squarespace embed and Salesforce may only need `getPhoto`/`listUserPhotos` (both use `*`) or may need `coaches`/`students` too
2. Document the intended consumers for each endpoint in a comment block in `functions/index.js`
3. If the Squarespace embed calls `coaches` or `students`, add the Squarespace domain to the allowlist — but verify the actual embed domain first (it may be a custom domain on Squarespace, not `squarespace.com`)
4. Never assume "it works in development" means "CORS is fine" — local dev bypasses CORS in many setups

**Phase:** Phase 1 (Diagnosis) + Phase 2 (Fix)

---

### Pitfall 3: Fixing the PWA Breaks the App in App Store Review

**What goes wrong:** The native app is currently in App Store review. Apple's review process uses the live Firebase backend — the same Firestore, the same Storage rules, the same Cloud Functions that the PWA uses. Any change to Firestore rules, Storage rules, or Cloud Function behavior that gets deployed while the app is under review could cause the reviewer's test session to behave differently than the developer's test session. If the reviewer encounters broken behavior that wasn't there when the app was submitted, it's flagged or rejected.

**Why it happens:** Teams treating the PWA fix and the native app review as independent workstreams. The constraint that they share one backend means they are not independent.

**Consequences:**
- App Store rejection or extended review delay
- Rules changes that are additive (making the PWA work again) might tighten access that the native app's mock layer (`firebase.ts` uses all mock data — no real Firebase calls) was never exercised against
- The native app in review is using mock Firebase (`LevelUp-Fresh-fixes/firebase.ts` is entirely mock data — it doesn't connect to the live project at all). This means App Store review is testing UI only, not real data. A rules change during review would only matter if the actual production Firebase-connected version is what's under review

**Warning signs:**
- The `LevelUp-Fresh-fixes/firebase.ts` file is 100% mock — `signIn` returns `mock-uid-1`, `getEvents` returns an empty snapshot, `getUserProfile` returns hardcoded Jim Rodarte data. This is significant: if this is what was submitted, the reviewer cannot see real data and rules changes are likely safe during review
- Verify whether the submitted app binary connects to the real Firebase project before making any backend changes

**Prevention:**
1. Confirm with certainty whether the submitted native app binary uses real Firebase or the mock layer before deploying any rules changes
2. If mock: rules changes are safe during review — proceed with fixes
3. If real Firebase: make only additive rules changes (expand permissions, never restrict) until the app passes review
4. Keep a change log of every Firebase deployment timestamped against the review timeline

**Phase:** Phase 1 (Diagnosis) — must be confirmed before any deployment

---

### Pitfall 4: Storage Rules Missing Entirely

**What goes wrong:** There is no `storage.rules` file in the PWA repository (confirmed via Glob search — the file does not exist). Firebase Storage has its own rules system, separate from Firestore rules. If no `storage.rules` file was ever committed or deployed from the PWA's project, the Storage bucket is running on whatever default was set at project creation — or on rules deployed from the native app. The photo access breakage for Squarespace and Salesforce is most likely a Storage rules problem, not a Firestore rules problem, because those integrations fetch image files (JPGs), not Firestore documents.

**Why it happens:** Storage rules are often treated as an afterthought. Developers set them once in the Firebase console and never codify them. When the native app introduced its own deployment pipeline, it may have deployed Storage rules (or reset them to a locked-down default) without anyone in the PWA codebase being aware.

**Consequences:**
- Photo embeds on Squarespace return 403 Forbidden
- Salesforce integration gets 403 on direct Storage URL fetches
- `getPhoto` function uses Admin SDK (bypasses rules entirely) — so the function itself works, but direct browser fetches to `firebasestorage.googleapis.com` URLs fail
- Profile photo uploads from PWA users may also fail if Storage rules require authentication and the upload path changed

**Warning signs:**
- The `getPhoto` function returns a `firebasestorage.googleapis.com/v0/b/.../o/...?alt=media` URL — if the Storage bucket's rules require authentication for reads, that URL will return 403 when fetched by a browser or Salesforce without credentials
- No `storage.rules` in the git repo means no version history of what the rules were

**Prevention:**
1. Immediately fetch the current live Storage rules via `firebase storage:rules:get` and commit the output as `storage.rules`
2. The correct rule for photos served to external embeds is `allow read: if true` on the relevant path prefix (e.g., `headshots/` and `users/`)
3. Add `storage.rules` to `firebase.json` so future deployments are intentional and tracked
4. Distinguish between profile photos (may require auth) and headshots served to public embeds (must be public)

**Phase:** Phase 1 (Diagnosis) + Phase 2 (Fix)

---

## Moderate Pitfalls

---

### Pitfall 5: FCM Token Collision Between PWA and Native App

**What goes wrong:** Both the PWA (web push via FCM) and the native app (mobile push via APNs/FCM) store FCM tokens in the same `notification_tokens` Firestore collection, keyed by `userId`. When a user migrates to the native app, they'll register a new mobile FCM token. The existing Cloud Functions (`sendUpdateNotification`, `sendEventNotification`, etc.) fetch all tokens for a userId and send to all of them. A user who has both the PWA installed and the native app installed will receive duplicate notifications. Worse: if the native app registers under the same document ID as the PWA token, it overwrites it — and vice versa.

**Why it happens:** The token storage schema assumes one token per user. Expanding to two platforms (web + mobile) without updating the schema creates the collision.

**Warning signs:**
- Users report receiving the same notification twice
- Tokens disappear intermittently (one platform's token write overwrites the other's)

**Prevention:**
1. Update the `notification_tokens` schema to support multiple tokens per user: store tokens as a map or subcollection keyed by platform (`web`, `ios`, `android`) or by token value
2. The token cleanup logic in Cloud Functions already handles invalid tokens — extend it to handle the multi-token-per-user case
3. Do this before the native app launches to real users, not after

**Phase:** Phase 3 (Transition Architecture)

---

### Pitfall 6: PWA Cached Service Worker Survives After Native App Adoption

**What goes wrong:** PWA users who install the native app may still have an active service worker running in their browser. The service worker intercepts network requests and delivers background push notifications. If the user's FCM web token remains registered in Firestore after they switch to the native app, the old service worker will continue waking up their browser and showing duplicate notifications. Users cannot easily tell that a stale browser service worker is the source.

**Why it happens:** Service workers persist until explicitly unregistered or until the user clears browser data. Most users never do either.

**Warning signs:**
- Migrated users report getting notifications in both the native app and as browser push notifications
- `notification_tokens` collection has both a web token and a mobile token for the same user

**Prevention:**
1. When a user downloads the native app and logs in, have the native app write a flag to their Firestore user document (e.g., `nativeAppActive: true`)
2. The PWA should read this flag on load and unregister its service worker if the native app is active
3. Alternatively: the migration banner in the PWA can include an "I've downloaded the app" button that explicitly unregisters the service worker and deletes the web FCM token from Firestore
4. Cloud Functions should filter out web tokens for users with `nativeAppActive: true`

**Phase:** Phase 3 (Transition Architecture)

---

### Pitfall 7: The `isAdmin()` Function Makes an Extra Firestore Read on Every Authenticated Request

**What goes wrong:** The current `firestore.rules` `isAdmin()` helper does a `get()` call to fetch the user's document to check their role. This is counted as a Firestore read. Every write operation that requires admin check (events, posts, matches, resources) fires this extra read. With 28+ users and frequent admin operations, this compounds fast. More critically: if the native app's deployed rules removed this `get()` call and replaced it with a simpler check (custom claims, for example), the PWA's admin functionality will break silently — not with an error, but by denying writes that should be allowed.

**Why it happens:** Rule-based `get()` calls are a common pattern but their cost and fragility are underappreciated. When two teams work on the same rules file, one side may "optimize" this away without realizing the other side depends on it.

**Warning signs:**
- Admin users suddenly cannot create events or posts
- Firestore read costs spike unexpectedly
- The native app's rules file uses custom claims (`request.auth.token.admin`) instead of `get()`

**Prevention:**
1. When reconciling the two apps' rules files, explicitly compare the `isAdmin()` implementation in each
2. If the native app uses custom claims, the PWA must also set custom claims at login — or both must use the `get()` pattern
3. Set Firebase custom claims for admin users via Cloud Function during the fix phase — this eliminates the extra read and works for both apps simultaneously

**Phase:** Phase 2 (Fix)

---

### Pitfall 8: No Error Visibility Means Silent Rule Failures Look Like UI Bugs

**What goes wrong:** The PWA has no error boundary and no centralized error logging (confirmed in CONCERNS.md). When a Firestore permission error occurs — which is the likely cause of the blank screen on event registration — React silently renders nothing. The developer sees a blank screen and assumes the problem is in the component, the state management, or a missing data fetch. The actual error is a Firebase `permission-denied` exception that was never caught and surfaced.

**Why it happens:** Without error boundaries, promise rejections from Firebase operations either propagate silently or appear only in the browser console, which production users never see.

**Warning signs:**
- Blank screen on event registration with no visible error message to the user
- `console.error` logs showing `FirebaseError: Missing or insufficient permissions` — only visible in browser DevTools
- The symptom appeared after a Firebase deployment, not after a code change

**Prevention:**
1. Before debugging any Firebase rule issue, open browser DevTools → Console → reproduce the blank screen — look for `FirebaseError` messages
2. Add a minimal error boundary wrapping the app root before starting rule debugging — this surfaces caught errors to the UI and makes root cause visible immediately
3. Wrap all Firebase write operations (RSVP, event creation, profile update) in try/catch and surface errors to the user
4. Do not assume a blank screen means missing data — check the network tab and console for 403/permission errors first

**Phase:** Phase 1 (Diagnosis) — add error visibility before diagnosing root cause

---

## Minor Pitfalls

---

### Pitfall 9: App Download Banner Triggers PWA "Add to Home Screen" Conflict

**What goes wrong:** The planned "download the native app" banner in the PWA will appear on the same screens where iOS Safari shows its "Add to Home Screen" / PWA install prompt. Users on iOS who already have the PWA installed as a home screen app will see both prompts — one asking them to use the native app, one offering to install the PWA more deeply. This creates confusion about which "app" is the right one.

**Prevention:**
1. Detect whether the PWA is already running in standalone mode (`window.navigator.standalone === true` on iOS) before showing the download banner — if it is, the user already has the PWA installed; make the banner more prominent, not less
2. On iOS, detect user agent and link directly to the App Store listing; on Android, link to Google Play — do not show both links on the same button
3. The banner should have a persistent dismissal state (stored in `localStorage`) so users who consciously choose to stay on the PWA are not re-prompted every session

**Phase:** Phase 3 (Transition Architecture)

---

### Pitfall 10: Hardcoded `localhost` Emulator Detection Breaks Local Debugging of Rules

**What goes wrong:** `src/firebase.js` connects to the Functions emulator only when `window.location.hostname === 'localhost'`. This means the emulator detection is environment-blind — it doesn't check `VITE_ENVIRONMENT`. If a developer tries to debug the rules issue using the Firebase Emulator Suite on a non-`localhost` hostname (e.g., in a Docker container, a tunneled dev environment, or `127.0.0.1`), the app silently connects to production Firebase instead of the emulator. A rule change tested "locally" may actually be executing against the live production database.

**Prevention:**
1. Switch emulator detection to `import.meta.env.VITE_ENVIRONMENT === 'development'` (already defined in the env vars list) rather than hostname sniffing
2. When debugging rules, always verify in the Firebase console → Firestore → Rules → Monitor that the rule evaluation is happening in the emulator, not production
3. Never test rule changes against the production database when the emulator is available

**Phase:** Phase 1 (Diagnosis) — affects accuracy of local rule debugging

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Diagnosing rule breakage | Blind to silent permission errors without error boundary | Add minimal error boundary first, then check DevTools console for `FirebaseError: permission-denied` before touching any rules |
| Fetching live rules | Assuming the committed `firestore.rules` matches what's deployed | Always run `firebase firestore:rules:get` to pull the live rules before editing — the committed file may be stale |
| Fixing Storage photo access | Assuming Firestore rules are the problem | Storage has a completely separate rules system; the missing `storage.rules` file is the most likely root cause for photo embed breakage |
| Reconciling both apps' rules | Making the native app's rules the new baseline | Diff both files against the live state; preserve all PWA access patterns; never remove the wildcard list rule or the `isAdmin()` helper without confirming native app doesn't depend on a different auth check |
| Deploying any rule fix | Not knowing if native app review uses real Firebase | Confirm mock vs. real Firebase in the submitted binary before any deployment; `LevelUp-Fresh-fixes/firebase.ts` is all mock data, which suggests review is safe |
| Building the download banner | App Store / PWA install prompt collision on iOS | Check `window.navigator.standalone` before rendering; use platform-specific App Store links |
| Native app launch (post-review) | FCM token collision and duplicate notifications | Update token schema to support multiple tokens per user before real users have both apps installed |
| Long-term transition | Stale PWA service workers sending duplicate browser notifications | Build explicit deactivation flow into the migration banner; store `nativeAppActive` flag in Firestore user document |

---

## Sources

- Direct inspection of `/Users/jimrodarte/Documents/GitHub/Level-Up-App/firestore.rules` (confirmed no storage.rules exists)
- Direct inspection of `/Users/jimrodarte/Documents/GitHub/Level-Up-App/functions/index.js` (CORS allowlist, token storage schema, Admin SDK usage)
- Direct inspection of `/Users/jimrodarte/Documents/GitHub/Level-Up-App/LevelUp-Fresh-fixes/firebase.ts` (confirmed full mock implementation — no real Firebase connections)
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/PROJECT.md` (project constraints, shared Firebase project context)
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/codebase/CONCERNS.md` (no error boundary, no error logging, fragile auth state, notification race conditions)
- `/Users/jimrodarte/Documents/GitHub/Level-Up-App/.planning/codebase/INTEGRATIONS.md` (CORS config, Storage integration, Firestore rules access patterns)
- Confidence: HIGH for pitfalls 1–8 (grounded in actual code); MEDIUM for pitfalls 9–10 (standard PWA/mobile patterns)
