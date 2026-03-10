# Phase 2: Stabilize - Research

**Researched:** 2026-03-10
**Domain:** Firebase Security Rules (Firestore + Storage) merge, deployment, and verification
**Confidence:** HIGH

## Summary

Phase 2 is a surgical Firebase Security Rules merge-and-deploy. The Phase 1 diagnosis identified 11 Firestore divergences and 1 Storage divergence caused by the native app developer running `firebase deploy` from the wrong directory. The fix is straightforward: create a merged `firestore.rules` and a new canonical `storage.rules` in the PWA repo, update `firebase.json`, deploy, and verify.

The risk profile is LOW. We are restoring permissions that previously worked, not inventing new access patterns. The merged rules are a superset of the native app's rules, so nothing the native app does today will break. The Firebase CLI is installed (v14.15.2) and authenticated. Rollback is a 30-second `firebase deploy` of the backed-up rules.

**Primary recommendation:** Build the merged rules files from the Phase 1 diagnosis recommendations, deploy from `Level-Up-App/` only, and verify with Jim using admin + coach accounts plus external integration checks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Native app rules are the **baseline** -- the PWA adapts to work within them, not the other way around
- Merged rules are a superset: start from native app rules, add back only what's needed for PWA functionality
- Keep native app improvements (comment rate limiting, timestamp validation) -- they benefit both apps
- Keep the orphaned live-only RSVP rate limiting -- codify it in the canonical rules file so it's tracked in code
- Add back admin override on RSVP write/delete (PWA admin panel needs it; doesn't break native app)
- `registrationCodes` stays admin-only read -- PWA signup is no longer needed, new users register through native app only
- `notification_tokens` rules from PWA need to be added (native app omitted them entirely)
- PWA's `isAdmin()` with `role == "admin"` fallback should be in merged rules (native app only checks `isAdmin == true`)
- Create canonical `storage.rules` in PWA repo, registered in `firebase.json`
- Public read access on `users/{uid}/profile.*` paths -- this is where all current profile photos live
- `headshots/` paths don't exist in Storage yet -- no rule needed now
- All other Storage paths remain auth-required (native app's default)
- Deploy directly to production, verify live -- low risk since we're adding permissions back
- Save backup of current live rules before deploying (for fast rollback if needed)
- Rollback plan: redeploy previous rules via Firebase CLI (~30 seconds)
- All rule deployments from `Level-Up-App/` only -- native app rules are reference copies
- Jim verifies with admin account and coach account after deployment
- 5 user roles in system: `student`, `coach`, `coach-board`, `board`, `admin`
- Jim checks Squarespace website to confirm scholar/coach photo carousels load
- Jim checks Salesforce to confirm contact photos load

### Claude's Discretion
- Exact rule syntax and ordering in merged files
- Whether to consolidate redundant rule patterns during merge
- Backup file naming and storage location
- Order of deployment (Firestore rules first vs Storage rules first vs simultaneous)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RULE-01 | Create canonical `storage.rules` file in PWA repo, registered in `firebase.json` | Storage rules template derived from native app baseline + public read on profile photo paths; `firebase.json` needs `"storage": {"rules": "storage.rules"}` added |
| RULE-02 | Merge Firestore rules to work for both PWA and native app simultaneously | All 11 divergences documented in Phase 1 diagnosis with merge recommendation for each; native app baseline + PWA additions approach confirmed |
| RULE-03 | Restore public read access on Storage paths used by external photo embeds | Cloud Functions generate `firebasestorage.googleapis.com` URLs that hit Storage rules directly; `allow read: if true` on `users/{userId}/{allPaths=**}` restores access |
| RULE-04 | Restore `registrationCodes` public read access | **OVERRIDDEN BY USER DECISION**: CONTEXT.md locks `registrationCodes` to admin-only read -- PWA signup is no longer needed. This requirement is satisfied by the user's decision to keep admin-only access. |
| RULE-05 | Restore RSVP write permissions and admin override | Merged RSVP rules: keep live rate limiting + add admin override from PWA; both userId match and isAdmin() paths needed |
| RULE-06 | Validate all rule changes against native app compatibility before deploying | All merge recommendations verified as superset -- native app operations unchanged; verification checklist provided |
| INTG-01 | Fix Squarespace website photo embed | `coaches` and `students` Cloud Functions return direct Storage URLs; public read on Storage paths fixes 403 errors |
| INTG-02 | Fix Salesforce photo integration | `getPhoto` Cloud Function returns direct Storage URLs; same public read fix resolves Salesforce 403 errors |
| INTG-03 | Verify `getPhoto` and `listUserPhotos` Cloud Functions are deployed and accessible | Phase 1 confirmed all 4 photo functions deployed on us-central1 (nodejs22); CORS is wildcard -- no changes needed |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Firebase CLI | 14.15.2 | Deploy Firestore rules, Storage rules | Already installed and authenticated on this machine |
| Firebase Security Rules | rules_version '2' | Access control for Firestore and Storage | Both codebases already use rules_version 2 |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `firebase deploy --only firestore:rules` | CLI flag | Deploy Firestore rules without touching functions/hosting | Use for rule-only deployment |
| `firebase deploy --only storage` | CLI flag | Deploy Storage rules only | Use for Storage rule deployment |
| Firebase Console | Web UI | Fetch current live rules for backup | Pre-deployment backup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct production deploy | Firebase Emulator Suite for local testing | Adds complexity; user decision is direct deploy since we're adding permissions back |
| Manual Console edits | CLI deployment from repo | CLI is correct -- tracked in code, reproducible |

## Architecture Patterns

### Merged Firestore Rules Structure

The merged `firestore.rules` should follow this ordering (native app baseline structure, with PWA additions clearly commented):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Helper functions ----
    isValidPhoneNumber()   // From PWA -- data validation
    isAdmin()              // MERGED: native app base + PWA's role == "admin" fallback

    // ---- Collections (alphabetical or grouped by function) ----
    /events/{eventId}      // Native app baseline (no changes needed)
    /matches/{matchId}     // Native + PWA: allow write (not just create/delete)
    /notification_tokens/{userId}  // PWA addition (native app omitted)
    /posts/{postId}        // Native app baseline (keep comment rate limiting)
      /comments/{commentId}  // Native app (keep timestamp + rate limit)
        /reactions/{reactionId}  // Native app baseline
      /reactions/{reactionId}    // Native app baseline
    /registrationCodes/{codeId}  // Admin-only (user decision)
    /resources/{resourceId}      // Native + PWA: add isValidRoles()
    /rsvps/{rsvpId}              // MERGED: live rate limiting + PWA admin override
    /users/{userId}              // Native + PWA: admin write + phone validation

    // ---- Catch-all ----
    /{document=**}         // PWA's authenticated list catch-all
  }
}
```

### Canonical Storage Rules Structure

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User profile photos -- PUBLIC read for external embeds
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 5 * 1024 * 1024;
    }

    // Event images -- keep auth-required (not used by external integrations)
    match /events/{eventId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 5 * 1024 * 1024;
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Key decision:** Only `users/{userId}/` paths get public read. Event images stay auth-required because Squarespace/Salesforce only need profile photos. This minimizes the attack surface.

### firebase.json Change

Add `storage` key to existing `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  ...existing hosting and functions config...
}
```

### Anti-Patterns to Avoid
- **Deploying from native app directory:** All deployments MUST come from `Level-Up-App/`. The native app's `firebase.json` includes both `firestore` and `storage` targets, so `firebase deploy` from there would overwrite everything again.
- **Using `firebase deploy` without `--only` flags:** Always use `--only firestore:rules` or `--only storage` to avoid accidentally redeploying functions or hosting.
- **Forgetting the backup:** Always save current live rules before deploying. The Firebase Console Rules tab shows the current version with timestamps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rule backup | Custom backup script | `firebase firestore:get-rules` or copy from Console | CLI already supports fetching current rules |
| Rule deployment | Manual Console edits | `firebase deploy --only firestore:rules,storage` | Console edits aren't tracked in code |
| Photo URL generation | Custom signed URL logic | Keep existing `firebasestorage.googleapis.com` URL pattern | Cloud Functions already generate these; public read rules make them work |

## Common Pitfalls

### Pitfall 1: RSVP Rate Limiting + Admin Override Interaction
**What goes wrong:** The live RSVP rate limiting checks `lastRsvpAt` on the user document. If the admin override (`isAdmin()`) is added as an alternative to the rate limit check, admins bypass rate limiting entirely. If it's added incorrectly, admins could still be blocked by rate limiting.
**Why it happens:** The `allow create` rule needs two branches: (1) owner with rate limiting, OR (2) admin without rate limiting.
**How to avoid:** Structure the RSVP create rule as:
```
allow create: if request.auth != null && (
  // Regular user path: userId match + rate limiting
  (request.resource.data.userId == request.auth.uid && (rate limit check))
  ||
  // Admin path: no rate limiting
  isAdmin()
);
```
**Warning signs:** Admins unable to RSVP on behalf of users, or rate limiting error messages for admins.

### Pitfall 2: Storage URL Format Requires Public Read
**What goes wrong:** The Cloud Functions (`coaches`, `students`, `getPhoto`) generate URLs in the format `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media`. These URLs are loaded by the browser (Squarespace embed, Salesforce iframe, etc.) and hit Storage Security Rules directly.
**Why it happens:** The Admin SDK bypasses rules when the Cloud Function reads Storage metadata, but the URL it returns is a direct Storage URL that the browser fetches -- and that fetch is subject to Storage rules.
**How to avoid:** The `allow read: if true` on `users/{userId}/{allPaths=**}` is the correct fix. The Cloud Functions don't need changes.
**Warning signs:** Functions return 200 with valid URLs, but the browser shows broken images / 403 errors.

### Pitfall 3: firebase.json Storage Key Must Be Added
**What goes wrong:** Creating `storage.rules` without adding the `storage` key to `firebase.json` means `firebase deploy --only storage` will fail or silently not deploy the rules.
**Why it happens:** The PWA repo never had a `storage.rules` file or the corresponding `firebase.json` entry.
**How to avoid:** Add `"storage": {"rules": "storage.rules"}` to `firebase.json` before deploying.
**Warning signs:** `firebase deploy --only storage` reports "nothing to deploy" or ignores the rules file.

### Pitfall 4: Wildcard Catch-All Rule Ordering
**What goes wrong:** Firebase Security Rules evaluate all matching `match` statements. The wildcard `match /{document=**} { allow list: if request.auth != null; }` at the end of the Firestore rules grants authenticated list access to ALL collections, including ones that should be more restricted.
**Why it happens:** Firestore rules are OR-based -- if ANY matching rule grants access, access is granted.
**How to avoid:** This is the existing PWA behavior and is intentional. Keep it, but be aware that it means any authenticated user can list any collection. The native app is unaffected because it uses specific queries, not broad collection listing.
**Warning signs:** None in normal operation, but it's a broad permission to be aware of.

### Pitfall 5: registrationCodes Decision Contradicts REQUIREMENTS.md
**What goes wrong:** REQUIREMENTS.md RULE-04 says "Restore `registrationCodes` public read access (required for signup flow)." But CONTEXT.md locks the decision: "`registrationCodes` stays admin-only read -- PWA signup is no longer needed."
**Why it happens:** The user made a deliberate decision after the requirements were written: new users now register through the native app only.
**How to avoid:** Follow CONTEXT.md (the later, more specific decision). The merged rules should use admin-only read for `registrationCodes`, matching the native app's approach. RULE-04 is satisfied by the user's intentional decision to not restore public read.
**Warning signs:** If someone tries to sign up via the PWA, registration code validation will fail. This is expected and intentional per user decision.

## Code Examples

### Merged isAdmin() Helper (Verified from both codebases)

```javascript
// Source: PWA firestore.rules line 12 + native app firestore.rules isAdmin()
function isAdmin() {
  let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
  return userData.isAdmin == true || userData.role == "admin";
}
```

### Merged RSVP Rules (Combines live rate limiting + PWA admin override)

```javascript
// Source: Live firestore rules (rate limiting) + PWA firestore.rules line 81-87 (admin override)
match /rsvps/{rsvpId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && (
    // Regular user: userId match + 5-second rate limiting
    (request.resource.data.userId == request.auth.uid
      && (
        !('lastRsvpAt' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data)
        || request.time >= get(/databases/$(database)/documents/users/$(request.auth.uid)).data.lastRsvpAt + duration.value(5, 's')
      )
    )
    // Admin override: no rate limiting
    || isAdmin()
  );
  allow update: if request.auth != null
    && (resource.data.userId == request.auth.uid || isAdmin());
  allow delete: if request.auth != null
    && (resource.data.userId == request.auth.uid || isAdmin());
}
```

### Firebase CLI Deployment Commands

```bash
# Backup current live rules first
firebase firestore:get > /tmp/backup-firestore-$(date +%Y%m%d).rules

# Deploy Firestore rules only
firebase deploy --only firestore:rules

# Deploy Storage rules only
firebase deploy --only storage

# Deploy both at once
firebase deploy --only firestore:rules,storage
```

### firebase.json With Storage Added

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": "dist",
    ...existing config...
  },
  "functions": {
    "source": "functions"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Console-based rule editing | CLI deployment from repo | Best practice since Firebase CLI v6+ | Rules tracked in code, reproducible |
| Single rules file per project | Multiple deployment targets | Firebase CLI v8+ | Can deploy rules independently from hosting/functions |

**No deprecated patterns apply** -- Firebase Security Rules syntax (rules_version '2') is current and stable.

## Open Questions

1. **Does the PWA comment creation code use `serverTimestamp()`?**
   - What we know: Native/live rules require `request.resource.data.timestamp == request.time` for comment creation. PWA rules only checked userId.
   - What's unclear: Whether the PWA React code sets `timestamp: serverTimestamp()` when creating comments.
   - Recommendation: Keep native app's stricter comment rules (per user decision). If PWA comments break post-deploy, investigate the PWA code and update it to use `serverTimestamp()`. This is a MEDIUM priority secondary issue, not a phase blocker.

2. **Does the wildcard catch-all list rule cause any issues?**
   - What we know: PWA has `match /{document=**} { allow list: if request.auth != null; }`. Native app doesn't have it.
   - What's unclear: Which specific PWA queries depend on this catch-all.
   - Recommendation: Include it in merged rules (it was working before). If security audit is needed later, that's a future concern.

3. **Will `firebase firestore:get` work for backup?**
   - What we know: Firebase CLI v14.15.2 is installed and authenticated.
   - What's unclear: Whether `firestore:get` is the correct subcommand (it may be `firebase firestore:rules:get` or require using the Console).
   - Recommendation: Verify the exact backup command before deployment. Worst case, copy rules from Firebase Console Rules tab.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no automated tests exist in this project |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RULE-01 | `storage.rules` exists and is registered in `firebase.json` | manual | Check file existence + JSON key | N/A |
| RULE-02 | Merged Firestore rules compile without errors | manual | `firebase deploy --only firestore:rules --dry-run` (if available) | N/A |
| RULE-03 | Public read on Storage profile photo paths | manual-only | Jim loads Squarespace page, photos appear | N/A -- requires live deploy |
| RULE-04 | registrationCodes admin-only (per user decision) | manual | Verify rules file syntax | N/A |
| RULE-05 | RSVP create + admin override works | manual-only | Jim RSVPs with admin account + coach account | N/A -- requires live deploy |
| RULE-06 | Native app compatibility validated | manual | Review merged rules against native app operations | N/A |
| INTG-01 | Squarespace photos load | manual-only | Jim checks website photo carousels | N/A -- requires live deploy |
| INTG-02 | Salesforce photos load | manual-only | Jim checks Salesforce contacts | N/A -- requires live deploy |
| INTG-03 | Cloud Functions deployed and accessible | manual | `firebase functions:list` or `curl` endpoints | N/A |

### Sampling Rate
- **Per task commit:** Manual syntax review of rules files
- **Per wave merge:** Jim performs live verification with admin + coach accounts
- **Phase gate:** All 5 success criteria from phase description confirmed

### Wave 0 Gaps
- No automated test infrastructure exists for this project
- Firebase Security Rules testing (`@firebase/rules-unit-testing`) is a v2 requirement (TEST-01), not in scope for Phase 2
- All verification is manual for this phase -- Jim's admin/coach account testing is the primary validation method
- This is appropriate given the phase scope: we're deploying known-good rule patterns, not writing new logic

## Sources

### Primary (HIGH confidence)
- Phase 1 Diagnosis Report (`.planning/phases/01-diagnose/01-DIAGNOSIS.md`) -- all 11 divergences, root cause analysis, merge recommendations
- PWA `firestore.rules` (`Level-Up-App/firestore.rules`) -- current PWA rule file (100 lines)
- Native app `firestore.rules` (`/Users/jimrodarte/Level Up App/LevelUp-Fresh/firestore.rules`) -- native app baseline
- Native app `storage.rules` (`/Users/jimrodarte/Level Up App/LevelUp-Fresh/storage.rules`) -- identical to live
- Live Firestore rules (`/tmp/live-firestore.rules`) -- currently deployed, includes orphaned RSVP rate limiting
- PWA `firebase.json` -- current config, missing `storage` key
- Cloud Functions source (`functions/index.js`) -- confirmed URL generation pattern for photo functions
- Firebase CLI v14.15.2 -- confirmed installed and available

### Secondary (MEDIUM confidence)
- Firebase Security Rules documentation (training data) -- rules_version '2' syntax, match patterns, helper functions
- Firebase CLI deployment flags (`--only firestore:rules`, `--only storage`) -- standard CLI usage

### Tertiary (LOW confidence)
- `firebase firestore:get` backup command syntax -- needs verification before use

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Firebase CLI confirmed installed, rules syntax verified from both codebases
- Architecture: HIGH -- merged rule patterns derived directly from Phase 1 diagnosis with clear recommendations
- Pitfalls: HIGH -- all pitfalls observed from actual code analysis (URL format, rule ordering, firebase.json)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain -- Firebase Security Rules syntax doesn't change frequently)
