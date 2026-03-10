# Phase 2: Stabilize - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Merge Firebase rules and restore PWA event registration and external photo integrations — without breaking the native app. Create a canonical `storage.rules` file. Deploy merged rules and verify across user roles and external integrations (Squarespace, Salesforce).

</domain>

<decisions>
## Implementation Decisions

### Rule Merge Strategy
- Native app rules are the **baseline** — the PWA adapts to work within them, not the other way around
- Merged rules are a superset: start from native app rules, add back only what's needed for PWA functionality
- Keep native app improvements (comment rate limiting, timestamp validation) — they benefit both apps
- Keep the orphaned live-only RSVP rate limiting — codify it in the canonical rules file so it's tracked in code
- Add back admin override on RSVP write/delete (PWA admin panel needs it; doesn't break native app)
- `registrationCodes` stays admin-only read — PWA signup is no longer needed, new users register through native app only
- `notification_tokens` rules from PWA need to be added (native app omitted them entirely)
- PWA's `isAdmin()` with `role == "admin"` fallback should be in merged rules (native app only checks `isAdmin == true`)

### Storage Access Design
- Create canonical `storage.rules` in PWA repo, registered in `firebase.json`
- Public read access on `users/{uid}/profile.*` paths — this is where all current profile photos live
- `headshots/` paths don't exist in Storage yet (future native app feature) — no rule needed now, but functions already have fallback paths for them
- All other Storage paths remain auth-required (native app's default)
- The `students`, `coaches`, and `getPhoto` Cloud Functions use Admin SDK (bypasses rules) to find files, then return direct Storage URLs — the browser loading those URLs is what needs public read access

### Deploy & Rollback
- Deploy directly to production, verify live — low risk since we're adding permissions back, not restricting
- Save backup of current live rules before deploying (for fast rollback if needed)
- Rollback plan: redeploy previous rules via Firebase CLI (~30 seconds)
- All rule deployments from `Level-Up-App/` only — native app rules are reference copies

### Verification Plan
- Jim verifies with admin account and coach account after deployment
- Admin covers: event creation, RSVP management, user edits (most privileged path)
- Coach covers: view events, RSVP, view profiles (standard authenticated user path)
- Student/board roles share same read/RSVP permissions as coach — if coach works, they work
- 5 user roles in system: `student`, `coach`, `coach-board`, `board`, `admin`
- Jim checks Squarespace website to confirm scholar/coach photo carousels load
- Jim checks Salesforce to confirm contact photos load
- Both Squarespace and Salesforce use Cloud Functions (`students`, `coaches`, `getPhoto`) that return direct Storage URLs

### Claude's Discretion
- Exact rule syntax and ordering in merged files
- Whether to consolidate redundant rule patterns during merge
- Backup file naming and storage location
- Order of deployment (Firestore rules first vs Storage rules first vs simultaneous)

</decisions>

<specifics>
## Specific Ideas

- "The new app (native) takes priority over the PWA — all changes should prioritize its functionality over the PWA"
- PWA signup is no longer needed — users will only register through the native app going forward
- Photos are stored at `users/{uid}/profile.jpg` (or .png) — no `headshots/` folders exist yet in Storage
- Squarespace uses `students` and `coaches` Cloud Function endpoints which return `headshotUrl` fields with direct Storage URLs
- Salesforce uses the `getPhoto` Cloud Function endpoint

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules` (PWA): Known-good baseline with admin overrides and public registrationCodes — source of PWA-specific rules to merge
- `functions/index.js`: `students` (line 904), `coaches` (line 813), `getPhoto` (line 663) — Cloud Functions that serve photo data to external integrations
- Native app `firestore.rules` at `/Users/jimrodarte/Level Up App/LevelUp-Fresh/firestore.rules` — the baseline for merged rules

### Established Patterns
- PWA `isAdmin()` checks both `isAdmin == true` and `role == "admin"` — merged rules need both
- Cloud Functions use wildcard CORS (`cors: true`) for external access
- Admin SDK in Cloud Functions bypasses rules — functions work, but URLs they return hit rules directly
- 7 Firestore divergences + 1 Storage divergence documented in Phase 1 diagnosis

### Integration Points
- `firebase.json` needs a `storage` key added (currently missing — PWA never had canonical storage.rules)
- Storage rules deploy alongside Firestore rules via `firebase deploy`
- Squarespace HTML embeds call Cloud Function URLs at `us-central1-level-up-app-c9f47.cloudfunctions.net`
- Salesforce integration calls `getPhoto` endpoint at same base URL

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-stabilize*
*Context gathered: 2026-03-10*
