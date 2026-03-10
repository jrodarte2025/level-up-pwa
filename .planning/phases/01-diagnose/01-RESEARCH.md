# Phase 1: Diagnose - Research

**Researched:** 2026-03-10
**Domain:** Firebase Security Rules diagnostics, CLI tooling, rule comparison
**Confidence:** HIGH

## Summary

Phase 1 is a read-only diagnostic phase. The goal is to capture the live Firebase Security Rules (Firestore + Storage), diff them against both the PWA and native app codebases, and map each reported symptom to a specific rule change. No deployments occur in this phase.

Research has confirmed that the Firebase CLI is authenticated (Jim@levelupcincinnati.org), the project is `level-up-app-c9f47`, and the REST API at `firebaserules.googleapis.com` can retrieve live-deployed rules using the CLI's stored access token. All four required Cloud Functions (`getPhoto`, `listUserPhotos`, `coaches`, `students`) are confirmed deployed. The live rules were successfully fetched during research, providing a complete baseline for comparison.

**Primary recommendation:** Use the Firebase Rules REST API (via the CLI's stored OAuth token) to programmatically fetch live rules, then perform structured diffs against both codebases. The live Firestore rules are a modified version of the native app's rules (not the PWA's), confirming the suspected root cause.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Firebase CLI to fetch currently-deployed Firestore and Storage rules from production
- Compare live rules against both codebases: PWA (`Level-Up-App/firestore.rules`) and native app (`LevelUp-Fresh/firestore.rules` + `storage.rules`)
- Firebase CLI is authenticated and ready on this machine
- Native app developer likely ran `firebase deploy` from the native app directory, which would have deployed both `firestore.rules` and `storage.rules` simultaneously
- Diagnosis scope covers: Firestore rules, Storage rules, Cloud Functions, API key restrictions, CORS configuration, issue reproduction
- Single `DIAGNOSIS.md` report in the phase directory
- Include specific fix recommendations for each divergence (merged rules that work for both apps)
- Map each reported symptom to a specific root cause

### Claude's Discretion
- Exact reproduction test methodology
- Report section ordering and formatting
- Whether to include a "risk assessment" section for each proposed fix

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIAG-01 | Diff live Firestore rules against both codebases' rule files to identify all divergences | REST API method confirmed for fetching live rules; both codebase files located; live rules fetched and confirmed as native-app-derived |
| DIAG-02 | Diff live Storage rules against both codebases to identify access changes | REST API method confirmed; live storage rules fetched; PWA has NO storage.rules file (confirmed gap); native app storage.rules located |
| DIAG-03 | Document all rule changes and their impact on PWA, external integrations, and native app | All Cloud Functions confirmed deployed; CORS config located; complete rule content available for impact analysis |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Firebase CLI | 14.15.2 | Authenticated CLI for project access | Already installed and authenticated as Jim@levelupcincinnati.org |
| Firebase Rules REST API | v1 | Fetch live-deployed rules programmatically | Only reliable way to get exact deployed rules (no CLI `get` command exists) |
| Node.js | v22.18.0 | Script runtime for token extraction and API calls | Already installed via nvm |
| curl | system | HTTP requests to REST API | Standard Unix tool, no install needed |
| diff (CLI) | system | Text comparison of rule files | Standard Unix tool for structured comparison |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `firebase functions:list` | Verify deployed Cloud Functions | Confirming all expected functions are live |
| `firebase projects:list` | Verify project context | Confirming correct project is targeted |
| `jq` or `node -e` | Parse JSON API responses | Extracting rule content from REST API response |

### Alternatives Considered
None -- this is a diagnostic phase using existing tools only.

## Architecture Patterns

### File Locations (Confirmed)

```
/Users/jimrodarte/Documents/GitHub/Level-Up-App/    (PWA repo)
  firestore.rules              # PWA's Firestore rules
  firebase.json                # NO storage key -- significant gap
  functions/index.js           # Cloud Functions source
  cors.json                    # CORS configuration for Storage bucket

/Users/jimrodarte/Level Up App/LevelUp-Fresh/       (Native app repo)
  firestore.rules              # Native app's Firestore rules
  storage.rules                # Native app's Storage rules
  firebase.json                # Deploys BOTH firestore.rules AND storage.rules
  functions/index.js           # Native app's Cloud Functions (OG previews, deep links)
```

### Pattern: Fetching Live Rules via REST API

**What:** Use the Firebase Rules REST API with the Firebase CLI's stored OAuth token to retrieve the exact rules currently deployed in production.

**Why:** The Firebase CLI has no `firestore:rules:get` or `storage:rules:get` command. The only programmatic way to fetch live rules is via the REST API at `firebaserules.googleapis.com`.

**Step 1: Get the access token**
```bash
TOKEN=$(node -e "const { configstore } = require('firebase-tools/lib/configstore'); console.log(configstore.get('tokens').access_token);")
```

**Step 2: List releases to find current ruleset IDs**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/releases"
```

Returns JSON with `rulesetName` for each release (Firestore and Storage).

**Step 3: Fetch ruleset content**
```bash
# Firestore rules
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/rulesets/{RULESET_ID}"

# Storage rules
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/rulesets/{RULESET_ID}"
```

Returns JSON with `source.files[0].content` containing the full rule text.

**Step 4: Extract and save to temp files for diffing**
```bash
# Extract content from JSON, unescape, save to file
node -e "const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.source.files[0].content);"
```

### Pattern: Structured Diff Approach

For each rule file, produce a three-way comparison:
1. **Live vs PWA** -- identifies what the native app deployment changed relative to what was working
2. **Live vs Native App** -- identifies if live matches what was deployed (confirms root cause)
3. **PWA vs Native App** -- identifies all divergences that need merging in Phase 2

### Anti-Patterns to Avoid
- **Do NOT use the Firebase Console for rule capture** -- copying from the web UI is error-prone and not reproducible
- **Do NOT modify any rules in this phase** -- Phase 1 is read-only diagnosis
- **Do NOT run `firebase deploy` from either directory** -- risk of overwriting live rules

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching live rules | Manual copy from Firebase Console | REST API with CLI token | Reproducible, exact, scriptable |
| Text diffing | Manual side-by-side comparison | `diff -u` or `diff --color` | Standard, reliable, well-understood output |
| JSON parsing | Manual string extraction | `node -e` with JSON.parse | Handles escaping correctly (rules content has `\n`, `\u003e` etc.) |

## Common Pitfalls

### Pitfall 1: OAuth Token Expiry
**What goes wrong:** The Firebase CLI's stored access token expires (typically 1 hour).
**Why it happens:** OAuth tokens have a TTL and the Firebase CLI refreshes them on demand during normal use, but not when accessed directly from configstore.
**How to avoid:** Run any `firebase` CLI command first (e.g., `firebase projects:list`) which triggers a token refresh, then extract the token immediately.
**Warning signs:** REST API returns 401 Unauthorized.

### Pitfall 2: JSON Escaping in Rule Content
**What goes wrong:** Rule content from the REST API contains JSON-escaped characters (`\n` for newlines, `\u003e` for `>`, `\u003c` for `<`).
**Why it happens:** The content is embedded in a JSON response string.
**How to avoid:** Always parse the JSON properly with `JSON.parse()` before saving to a file. Never use regex or string replacement.
**Warning signs:** Diff shows spurious differences that are actually encoding artifacts.

### Pitfall 3: Assuming Live Rules Match Either Codebase
**What goes wrong:** The live rules may have been manually edited in the Firebase Console, or deployed from a third source.
**Why it happens:** Multiple people have Firebase project access.
**How to avoid:** Always diff live rules against BOTH codebases independently. Check the `updateTime` on releases to understand when rules were last deployed.
**Warning signs:** Live rules don't exactly match either codebase file.

### Pitfall 4: Missing `storage` Key in PWA's firebase.json
**What goes wrong:** Running `firebase deploy` from the PWA directory does NOT deploy storage rules because `firebase.json` has no `storage` key.
**Why it happens:** The PWA was built before Storage rules were a concern.
**How to avoid:** Document this gap clearly in diagnosis. Phase 2 must add a `storage` key to the PWA's `firebase.json`.
**Warning signs:** The PWA directory has no `storage.rules` file at all.

### Pitfall 5: RSVP Rate Limiting in Live Rules
**What goes wrong:** The live Firestore rules contain RSVP rate limiting (5-second `lastRsvpAt` check) that exists in NEITHER codebase file.
**Why it happens:** Someone deployed a modified version that added rate limiting beyond what either repo contains.
**How to avoid:** The diff must capture this as a "live-only" divergence, not attributable to either codebase.
**Warning signs:** Live rules have features not found in any repo file.

## Code Examples

### Fetching and Saving Live Rules (Complete Script)
```bash
# Refresh token first
firebase projects:list --project level-up-app-c9f47 > /dev/null 2>&1

# Get fresh token
TOKEN=$(node -e "const { configstore } = require('firebase-tools/lib/configstore'); console.log(configstore.get('tokens').access_token);")

# Fetch releases
RELEASES=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/releases")

# Extract ruleset IDs
FIRESTORE_RULESET=$(echo "$RELEASES" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const r = d.releases.find(r => r.name.includes('cloud.firestore'));
  console.log(r.rulesetName.split('/').pop());
")

STORAGE_RULESET=$(echo "$RELEASES" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const r = d.releases.find(r => r.name.includes('firebase.storage'));
  console.log(r.rulesetName.split('/').pop());
")

# Fetch and save rule content
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/rulesets/$FIRESTORE_RULESET" \
  | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.source.files[0].content);" \
  > /tmp/live-firestore.rules

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/level-up-app-c9f47/rulesets/$STORAGE_RULESET" \
  | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.source.files[0].content);" \
  > /tmp/live-storage.rules
```

### Diffing Rules
```bash
# Live vs PWA Firestore
diff -u /tmp/live-firestore.rules /Users/jimrodarte/Documents/GitHub/Level-Up-App/firestore.rules

# Live vs Native App Firestore
diff -u /tmp/live-firestore.rules "/Users/jimrodarte/Level Up App/LevelUp-Fresh/firestore.rules"

# Live vs Native App Storage
diff -u /tmp/live-storage.rules "/Users/jimrodarte/Level Up App/LevelUp-Fresh/storage.rules"
```

## Key Findings from Research (Pre-Diagnosis)

### Live Rules Are Native-App-Derived (CONFIRMED - HIGH)
The live Firestore rules fetched via REST API are structurally identical to the native app's `firestore.rules`, with one addition: RSVP rate limiting (5-second `lastRsvpAt` check) that exists in neither codebase. This confirms the hypothesis that the native app developer ran `firebase deploy` from the LevelUp-Fresh directory.

### Live Storage Rules Match Native App Exactly (CONFIRMED - HIGH)
The live Storage rules are byte-for-byte identical to the native app's `storage.rules`. All reads require authentication (`request.auth != null`), which blocks external embeds (Squarespace, Salesforce) that access photos without Firebase auth tokens.

### Firestore Releases Timeline
| Release | Last Updated |
|---------|-------------|
| `cloud.firestore` | 2026-02-24T19:24:18Z |
| `firebase.storage` | 2026-03-03T16:45:56Z |

Storage rules were updated more recently than Firestore rules.

### Known Divergences (Live vs PWA) - Confirmed
1. **`isAdmin()`** -- Live: only `isAdmin == true`. PWA: also checks `role == "admin"`. **Impact:** Users with `role: "admin"` but no `isAdmin: true` field lose admin access.
2. **`users` write** -- Live: self-write only. PWA: allows admin writes. **Impact:** Admin cannot edit other users' profiles.
3. **`comments` create** -- Live: has rate limit (10s) + timestamp validation. PWA: simple `userId` match. **Impact:** PWA comment creation may fail if it doesn't set `timestamp == request.time`.
4. **`rsvps` write/delete** -- Live: owner-only (no admin override) + rate limiting. PWA: includes admin override. **Impact:** Admin cannot manage RSVPs on behalf of users; RSVP creation may fail without `lastRsvpAt` handling.
5. **`registrationCodes` read** -- Live: `request.auth != null`. PWA: `allow read: if true` (public). **Impact:** Unauthenticated signup validation is broken -- but note the live rule requires auth, not admin-only. The native app file requires admin-only, but live requires just auth.
6. **`notification_tokens`** -- Live: no rules at all. PWA: has `read, write: if auth.uid == userId`. **Impact:** Token operations fail silently or are denied.
7. **Wildcard catch-all** -- Live: absent. PWA: `match /{document=**} { allow list }`. **Impact:** Collection listing for any collection not explicitly matched may fail.
8. **`resources` write validation** -- PWA: has `isValidRoles()` function. Live: admin-only, no role validation. **Impact:** Resources can be created without valid role restrictions.
9. **`matches` update** -- PWA: allows admin update. Live: only allows admin create/delete (no update). **Impact:** Admin cannot update existing matches.
10. **Storage rules** -- Live: auth required for ALL reads. PWA: has NO storage rules file. **Impact:** External photo embeds (Squarespace, Salesforce, direct URLs) return 403.

### Cloud Functions Status (CONFIRMED - HIGH)
All critical functions are deployed and running on `us-central1`:

| Function | Version | Trigger | Runtime |
|----------|---------|---------|---------|
| `getPhoto` | v2 | HTTPS | nodejs22 |
| `listUserPhotos` | v2 | HTTPS | nodejs22 |
| `coaches` | v2 | HTTPS | nodejs22 |
| `students` | v2 | HTTPS | nodejs22 |
| `adminResetPassword` | v2 | HTTPS | nodejs22 |
| `sendTestPush` | v2 | HTTPS | nodejs22 |
| `sendUpdateNotification` | v2 | Firestore create | nodejs22 |
| `sendEventNotification` | v2 | Firestore create | nodejs22 |
| `sendEventPublishedNotification` | v2 | Firestore update | nodejs22 |
| `sendNewUserNotification` | v2 | Firestore create | nodejs22 |
| `eventPreview` | v2 | HTTPS | nodejs20 |
| `postPreview` | v2 | HTTPS | nodejs20 |
| `cascadeDeleteUserData` | v2 | Firestore delete | nodejs20 |
| `onCommentCreated` | v2 | Firestore create | nodejs20 |
| `onEventCreated` | v2 | Firestore create | nodejs20 |
| `onRSVPCreated` | v2 | Firestore create | nodejs20 |

Functions deployed from native app (`eventPreview`, `postPreview`, `cascadeDeleteUserData`, `onCommentCreated`, `onEventCreated`, `onRSVPCreated`) run on nodejs20. Functions from PWA repo run on nodejs22.

### CORS Configuration
- `cors.json` exists in PWA repo with 5 allowed origins (localhost:5173, localhost:5174, firebaseapp.com, web.app, app.levelupcincinnati.org)
- `getPhoto` and `listUserPhotos` use wildcard CORS (`'*'`), so they are accessible from any origin
- `adminResetPassword` uses explicit origin allowlist
- `coaches` and `students` use `cors: true` in v2 config (allows all origins)

### Symptom-to-Cause Mapping (Preliminary)

| Symptom | Likely Root Cause |
|---------|------------------|
| Blank RSVP screen | RSVP rules changed: no admin override, rate limiting added, `userId` validation differs |
| 403 photo errors (Squarespace/Salesforce) | Storage rules require `request.auth != null` for ALL reads -- external embeds have no auth token |
| Registration code validation failure | `registrationCodes` read changed from public (`if true`) to auth-required (`if request.auth != null`) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual diagnostic (no automated test framework for security rules in this project) |
| Config file | none -- see Wave 0 |
| Quick run command | `diff -u /tmp/live-firestore.rules <codebase-rules>` |
| Full suite command | Run all three diffs + function list + CORS check + reproduction tests |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIAG-01 | Firestore rules diffed against both codebases | smoke | `diff -u /tmp/live-firestore.rules firestore.rules` | No (temp files created at runtime) |
| DIAG-02 | Storage rules diffed against both codebases | smoke | `diff -u /tmp/live-storage.rules "/Users/jimrodarte/Level Up App/LevelUp-Fresh/storage.rules"` | No (temp files created at runtime) |
| DIAG-03 | All changes documented with impact | manual-only | Review DIAGNOSIS.md for completeness | N/A -- output is a document |

### Sampling Rate
- **Per task commit:** Verify diffs produce expected output
- **Per wave merge:** N/A (single-wave phase)
- **Phase gate:** DIAGNOSIS.md exists with all sections populated, every divergence mapped to impact

### Wave 0 Gaps
- [ ] No existing `storage.rules` in PWA repo -- must note in diagnosis (Phase 2 fix)
- [ ] No `@firebase/rules-unit-testing` setup -- out of scope (v2 requirement TEST-01)

## Open Questions

1. **Who deployed the RSVP rate limiting?**
   - What we know: Live Firestore rules contain a 5-second `lastRsvpAt` rate limit on RSVP creation that exists in NEITHER the PWA nor native app codebase files
   - What's unclear: Whether this was deployed via Console edit or a third-party deploy
   - Recommendation: Note as a "live-only modification" in the diagnosis; ask Jim if he or another team member made this change

2. **Are API key restrictions in Google Cloud Console changed?**
   - What we know: The CONTEXT.md lists this as a diagnostic item; we have not checked Google Cloud Console API key settings
   - What's unclear: Whether API keys have been restricted in ways that block PWA requests
   - Recommendation: Check Google Cloud Console during execution; `gcloud` auth is not available, so this requires manual Console check or finding an alternative programmatic approach

3. **Does `registrationCodes` need public read or just auth read?**
   - What we know: PWA has `allow read: if true` (public). Live has `allow read: if request.auth != null`. Native app has `allow read: if isAdmin()`.
   - What's unclear: Whether signup flow occurs before or after authentication
   - Recommendation: Check the PWA's registration flow to determine if the user is authenticated when they validate a registration code

## Sources

### Primary (HIGH confidence)
- Firebase Rules REST API (live fetch) -- fetched actual deployed Firestore and Storage rules via `firebaserules.googleapis.com/v1` endpoints
- `firebase functions:list` output -- confirmed all deployed functions, versions, and runtimes
- Local filesystem -- read both codebase rule files and `firebase.json` configs directly

### Secondary (MEDIUM confidence)
- [Firebase Manage and Deploy Rules docs](https://firebase.google.com/docs/rules/manage-deploy) -- confirmed REST API approach
- [Firebase CLI Reference](https://firebase.google.com/docs/cli) -- confirmed no built-in rule-get command exists
- [Firebase Rules API Reference](https://firebase.google.com/docs/reference/rules/rest) -- REST API structure for releases and rulesets

### Tertiary (LOW confidence)
- None -- all findings verified against live production data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- tools confirmed working, token extraction verified, REST API returns valid data
- Architecture: HIGH -- file paths confirmed, all three rule versions available, diffs producible
- Pitfalls: HIGH -- discovered RSVP rate limiting divergence during research (not documented in CONTEXT.md), token expiry tested
- Key findings: HIGH -- live rules fetched directly from production, not inferred

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- Firebase CLI and REST API are mature)
