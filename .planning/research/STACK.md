# Technology Stack

**Project:** Level Up App — PWA Stabilization & Native App Transition
**Researched:** 2026-03-10
**Note:** WebSearch and WebFetch were unavailable during this research session. All findings are based on direct codebase inspection and Firebase ecosystem knowledge through August 2025. Items flagged LOW confidence should be validated against current Firebase docs before implementation.

---

## Context: What We're Solving

Three distinct problem areas, each with its own tooling:

1. **Firebase rule/config conflict diagnosis** — PWA broke after the native app build made changes to the shared Firebase project (`level-up-app-c9f47`). Need to find what changed and why.
2. **Firebase Storage access repair** — The `getPhoto`, `listUserPhotos`, and `coaches`/`students` Cloud Functions use Admin SDK to bypass Storage rules, but something broke external access from Squarespace and Salesforce.
3. **PWA-to-native transition banner** — A non-intrusive prompt in the PWA directing users to download the native app.

---

## Recommended Stack

### 1. Firebase Rule Diagnosis Tools

| Tool | Version / Location | Purpose | Why |
|------|--------------------|---------|-----|
| **Firebase CLI** | `firebase-tools` (latest, ~13.x) | Deploy rules, compare deployed vs. local, read current production rules | Only official way to diff production rules against local files |
| **Firebase Emulator Suite** | Bundled with Firebase CLI | Run rules locally against test data without touching production | Safe sandbox — does not affect production state |
| **`@firebase/rules-unit-testing`** | `^3.0.0` (devDep) | Automated rule test suite with `assertSucceeds` / `assertFails` | Catches rule regressions before deployment; the project already has `firebase-functions-test ^3.1.0` in devDeps but no rules test library |
| **Firebase Console Rules Playground** | https://console.firebase.google.com | Interactive rule simulation against real user UIDs and paths | Fastest way to test "does this authenticated user have access to this path?" without writing test code |
| **Cloud Logging (Google Cloud Console)** | Built-in Firebase | Filter by function name, read structured logs from `firebase-functions/logger` | The codebase already writes structured logs — they just need to be read |

**Confidence:** HIGH for all of the above — these are the official Firebase toolchain, unchanged for years.

**Key diagnosis commands (Firebase CLI):**
```bash
# See currently-deployed Firestore rules in production
firebase firestore:rules:list --project level-up-app-c9f47

# See currently-deployed Storage rules in production
firebase storage:rules:list --project level-up-app-c9f47

# Validate local rules file without deploying
firebase firestore:rules:validate firestore.rules

# View recent function logs
firebase functions:log --project level-up-app-c9f47

# View logs for a specific function
firebase functions:log --only getPhoto --project level-up-app-c9f47
```

**Confidence:** MEDIUM — `firestore:rules:list` syntax should be verified against current Firebase CLI docs. The pattern is correct but the exact subcommand may vary by CLI version.

---

### 2. Firebase Storage Access — Current Architecture

The existing architecture is correct and should work. The `getPhoto` and `coaches`/`students` functions all use `admin.storage().bucket()` via the Admin SDK, which **bypasses Storage security rules entirely**. This means Storage rules are not the root cause of the external integration breakage.

| Layer | Tool | Confidence |
|-------|------|------------|
| **Admin SDK storage access** | `firebase-admin 13.4.0` — `admin.storage().bucket()` | HIGH — Admin SDK always bypasses client-side Storage rules |
| **Public URL generation** | `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media` | HIGH — This URL format is stable and publicly documented |
| **CORS for external callers** | `res.set('Access-Control-Allow-Origin', '*')` on `getPhoto` / `listUserPhotos` | HIGH — Already implemented correctly with wildcard |

**What actually broke (diagnosis pointers):**
- `getPhoto` and `listUserPhotos` use `functions.https.onRequest` (v1 API) while newer functions use `onRequest` from `firebase-functions/v2/https`. Mixed v1/v2 in the same `index.js` is fine, but v1 functions deploy to a different URL path format.
- The `coaches` and `students` functions use `cors: true` in options (v2 pattern) which automatically handles CORS. This is correct.
- The most likely break cause: if the native app's `firebase.json` was deployed to the same project, it may have overwritten the Storage rules (if the native project had a `storage.rules` file) or changed which functions are deployed.
- **There is no `storage.rules` file in the PWA repo** — this is a gap. If Storage rules were never explicitly defined here but were defined in the native app's project config, deploying from the native app side could have changed production Storage rules from permissive to restrictive.

**What to check first (no new tooling needed):**
1. Open Firebase Console > Storage > Rules tab — read what is currently deployed
2. Compare against what's in the native app's Firebase config (the PROJECT.md references `/Users/jimrodarte/Level Up App/LevelUp-Fresh`)
3. Check if production Storage rules require authentication (`request.auth != null`) — if so, the public URL pattern `?alt=media` will return 403 for unauthenticated callers (Squarespace embed, Salesforce)

---

### 3. Storage Rules Pattern for Multi-App Shared Project

When both a PWA and a native app share one Firebase project, Storage rules must explicitly allow the access patterns both apps need.

**Recommended `storage.rules` pattern:**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // User profile images — authenticated users read their own and others
    // Admin SDK (Cloud Functions) bypasses these rules entirely
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Legacy headshots path — authenticated read (both apps need this)
    match /headshots/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Event and resource attachments
    match /events/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Critical point:** The external integrations (Squarespace, Salesforce) do NOT hit Storage directly — they call the `getPhoto` and `coaches` Cloud Functions, which use Admin SDK. So Storage rules are irrelevant for those callers. The Storage rules only affect direct client-side SDK reads (PWA users viewing images). This means a restrictive Storage rule change would break in-app image display but NOT the Cloud Function endpoints — unless there's something else going on (CORS on the function URL, or the function itself failing).

**Confidence:** HIGH for the rules pattern. MEDIUM for the diagnosis conclusion — needs live verification.

---

### 4. Firebase `storage.rules` Missing — Add to `firebase.json`

The current `firebase.json` has no `storage` section. This means `firebase deploy` never touches Storage rules. **This is fine if you want to manage them manually in the Console, but it means there's no version-controlled record of what's deployed.** Add this to `firebase.json` after creating the rules file:

```json
"storage": {
  "rules": "storage.rules"
}
```

**Why:** Version-controlling rules prevents the "mystery deploy" problem that likely caused this breakage. Any future `firebase deploy` from either codebase will be explicit about what rules it's changing.

**Confidence:** HIGH — standard Firebase project hygiene.

---

### 5. PWA-to-Native Transition Banner

**Recommended approach: Custom React component, no third-party library.**

| Option | Assessment | Use? |
|--------|-----------|------|
| **Custom React banner component** | 10-20 lines of JSX + one `localStorage` key to dismiss. Full control over styling (uses Level Up brand colors). No dependency to maintain. | YES — recommended |
| **`react-mobile-app-banner`** | Small npm package, but last meaningful update was 2021. Abandoned. | NO |
| **`smartbanner.js`** | jQuery-era library. Designed for `<meta>` tag Smart App Banners. Unnecessary overhead for a React app. | NO |
| **Native iOS Smart App Banner** (HTML meta tag) | `<meta name="apple-itunes-app" content="app-id=XXXXXX">` — Safari automatically shows a native OS-level banner. Zero JS required. Zero maintenance. | YES as a supplement — for iOS Safari users before the React banner loads |
| **Google Play Install Prompt** | PWA Install API (`beforeinstallprompt`) — not what we want. We want to direct to the native app, not install the PWA. | NO |

**Recommended implementation:**

```jsx
// src/components/AppDownloadBanner.jsx
// Shown once per session (or until dismissed), only on mobile
import { useState, useEffect } from 'react';

const IOS_APP_STORE_URL = 'https://apps.apple.com/app/idXXXXXXXXX'; // replace
const ANDROID_PLAY_URL = 'https://play.google.com/store/apps/details?id=XXX'; // replace
const DISMISSED_KEY = 'app_banner_dismissed_v1';

export default function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (!dismissed && isMobile) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  const isIos = /iPhone|iPad/i.test(navigator.userAgent);
  const storeUrl = isIos ? IOS_APP_STORE_URL : ANDROID_PLAY_URL;

  if (!visible) return null;

  return (
    <div style={{ background: '#18264E', color: '#fff', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Level Up logo mark here */}
      <div style={{ flex: 1 }}>
        <strong>Level Up Cincinnati</strong>
        <div style={{ fontSize: 13, color: '#d8d9df' }}>
          Get the app for the best experience
        </div>
      </div>
      <a href={storeUrl} style={{ background: '#F15F5E', color: '#fff',
                                   borderRadius: 6, padding: '6px 14px',
                                   textDecoration: 'none', fontWeight: 600 }}>
        Download
      </a>
      <button onClick={dismiss} style={{ background: 'none', border: 'none',
                                          color: '#9ca3af', cursor: 'pointer',
                                          fontSize: 20, lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}
```

**iOS Smart App Banner (supplement, add to `index.html` `<head>`):**
```html
<meta name="apple-itunes-app" content="app-id=XXXXXXXXX">
```
This shows a native iOS banner in Safari — no JS, no maintenance, renders before React loads.

**Confidence:** HIGH for the custom component approach. MEDIUM for the Smart App Banner — the `app-id` value requires the App Store listing to be approved first (currently in review per PROJECT.md).

---

### 6. CORS Fix Tooling for Cloud Functions

The CORS configuration in `functions/index.js` uses an explicit allowlist for most functions but uses `cors: true` (which allows all origins) for `coaches`, `students`, and `adminResetPassword`. Mixed patterns across functions.

**Current state:**
- `getPhoto`, `listUserPhotos`: manually set `Access-Control-Allow-Origin: *` (wildcard, correct for public endpoints)
- `coaches`, `students`: `cors: true` in v2 options — this defaults to allowing all origins (equivalent to `*`)
- `adminResetPassword`, `sendTestPush`: explicit allowlist (correct for auth-sensitive endpoints)

**Recommendation:** No CORS library changes needed. The issue is more likely a deployment mismatch than a code problem. Tools to verify:

| Tool | Purpose |
|------|---------|
| **`curl -I -X OPTIONS`** | Test CORS preflight from terminal without browser involvement |
| **Browser DevTools > Network tab** | See exact 4xx status and response headers on failed requests |
| **Firebase Console > Functions > Logs** | Confirm function is being invoked at all (404 vs. 403 vs. 500) |

```bash
# Test CORS on getPhoto function
curl -I -X OPTIONS \
  -H "Origin: https://www.levelupcincinnati.org" \
  -H "Access-Control-Request-Method: GET" \
  "https://us-central1-level-up-app-c9f47.cloudfunctions.net/getPhoto?path=test"
```

**Confidence:** HIGH — standard HTTP debugging.

---

### 7. `@firebase/rules-unit-testing` for Rule Regression Prevention

The project currently has `firebase-functions-test ^3.1.0` in devDependencies but no Firestore or Storage rules test suite. Adding rules tests prevents future breakage when deploying rules updates from either codebase.

| Package | Version | Dev or Prod | Purpose |
|---------|---------|-------------|---------|
| `@firebase/rules-unit-testing` | `^3.0.0` | devDependency | Write tests that assert specific paths succeed or fail under specific auth conditions |
| Firebase Emulator Suite | Bundled with `firebase-tools` | Local only | Required runtime for rules unit tests |

**Confidence:** HIGH for the tooling. MEDIUM for version — `^3.0.0` was current as of August 2025; verify `npm show @firebase/rules-unit-testing version` before pinning.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Banner library | Custom component | `react-mobile-app-banner` | Unmaintained since 2021 |
| Banner library | Custom component | `smartbanner.js` | jQuery-era, non-React, unnecessary |
| Rule testing | `@firebase/rules-unit-testing` | Manual console testing | Manual testing doesn't catch regressions across deployments |
| Rule deploy | Version-controlled `storage.rules` | Console-only management | Console-only changes are invisible to git history; this is likely what caused current breakage |
| CORS library | No change needed | `cors` npm package (already present) | Already used in functions; issue is deployment not code |

---

## What NOT to Use

**Do not add a Storage rules management library.** Firebase Security Rules are a DSL, not JavaScript. No npm package improves on the Firebase Console Rules Playground + `@firebase/rules-unit-testing` for testing them.

**Do not use `firebase-admin` Storage signed URLs for the public photo endpoints.** The current approach of generating `?alt=media` public URLs is correct for public content. Signed URLs expire (default 15 min to 7 days) and would require a regeneration mechanism. The existing pattern is right.

**Do not redirect users from the PWA to the native app.** Per PROJECT.md, the correct approach is a dismissible banner (not a redirect). 28+ active users are relying on the PWA during the App Store review period.

---

## Installation (if adding rules testing)

```bash
# In project root
npm install -D @firebase/rules-unit-testing

# Firebase emulator (if not already installed via firebase-tools)
npm install -g firebase-tools
firebase setup:emulators:firestore
firebase setup:emulators:storage
```

---

## Sources

| Source | Confidence | Notes |
|--------|-----------|-------|
| Direct codebase inspection (`functions/index.js`, `firestore.rules`, `firebase.json`) | HIGH | Primary source for current architecture findings |
| Firebase ecosystem knowledge (training data through August 2025) | HIGH for stable tooling, MEDIUM for version numbers | Firebase CLI, Admin SDK patterns, CORS behavior are stable |
| PROJECT.md, STACK.md, INTEGRATIONS.md (codebase analysis) | HIGH | Confirms runtime versions, SDK versions, integration patterns |
| WebSearch / WebFetch | UNAVAILABLE | Could not verify current Firebase CLI subcommand syntax or `@firebase/rules-unit-testing` latest version |

**Items requiring verification before implementation:**
- Exact `firebase firestore:rules:list` CLI syntax — verify with `firebase help firestore:rules`
- `@firebase/rules-unit-testing` current version — run `npm show @firebase/rules-unit-testing version`
- Apple App Store ID for Smart App Banner meta tag — available once app is approved
