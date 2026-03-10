# Phase 1: Diagnose - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Read live Firebase state (Firestore rules, Storage rules, Cloud Functions, API keys, CORS) and confirm the root cause of all reported breakage before any deployment. Produce a single diagnosis report with findings and fix recommendations for Phase 2. No changes are deployed in this phase.

</domain>

<decisions>
## Implementation Decisions

### Live Rule Verification
- Use Firebase CLI to fetch currently-deployed Firestore and Storage rules from production
- Compare live rules against both codebases: PWA (`Level-Up-App/firestore.rules`) and native app (`LevelUp-Fresh/firestore.rules` + `storage.rules`)
- Firebase CLI is authenticated and ready on this machine
- Native app developer likely ran `firebase deploy` from the native app directory, which would have deployed both `firestore.rules` and `storage.rules` simultaneously

### Diagnosis Scope — Full Coverage
- **Firestore rules**: Diff all three versions (live, PWA repo, native app repo)
- **Storage rules**: Diff live vs native app's `storage.rules` (PWA has no storage.rules file)
- **Cloud Functions**: Verify `getPhoto`, `listUserPhotos`, `coaches`, `students` are deployed and callable
- **API key restrictions**: Check if Firebase API key restrictions were changed in Google Cloud Console
- **CORS configuration**: Verify allowed origins haven't changed in deployed Cloud Functions
- **Reproduce issues**: Attempt to hit actual endpoints and reproduce the blank screen, test photo URLs against Storage

### Output Format
- Single `DIAGNOSIS.md` report in the phase directory
- Covers: rule diffs, function status, reproduction results, CORS/API key findings
- Include specific fix recommendations for each divergence (merged rules that work for both apps)
- Map each reported symptom to a specific root cause

### Claude's Discretion
- Exact reproduction test methodology
- Report section ordering and formatting
- Whether to include a "risk assessment" section for each proposed fix

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard diagnostic approach with full coverage across rules, functions, API keys, and CORS.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules` (PWA): Known-good baseline rules that were working before native app deployment
- `firebase.json` (PWA): Does NOT include `storage` key — significant gap to address in Phase 2

### Established Patterns
- PWA's `isAdmin()` includes `role == "admin"` fallback; native app only checks `isAdmin == true` — merged rule needs both
- PWA's RSVP rules include admin override; native app removed it — merged rule should restore admin override
- PWA's `registrationCodes` are public read; native app made admin-only — this breaks signup flow

### Integration Points
- Native app codebase at `/Users/jimrodarte/Level Up App/LevelUp-Fresh`
- Native app's `firebase.json` deploys both `firestore.rules` and `storage.rules`
- Native app's `storage.rules` requires auth for ALL reads — blocks external embeds
- Cloud Functions in `functions/index.js`: `getPhoto` and `listUserPhotos` use Admin SDK (bypasses rules) but return Storage URLs that ARE subject to rules

### Known Divergences (7 Firestore + 1 Storage)
1. `isAdmin()` — PWA has `role == "admin"` fallback; native app doesn't
2. `users` write — PWA allows admin writes; native app only self-write
3. `comments` create — Native app added 10s rate limit + timestamp validation
4. `rsvps` — PWA has admin override on write/delete; native app removed it
5. `registrationCodes` — PWA: public read; Native: admin only (BREAKS SIGNUP)
6. `notification_tokens` — PWA has rules; native app omits entirely
7. PWA has wildcard `allow list` catch-all; native app doesn't
8. Storage rules — Native app requires auth for ALL reads (BREAKS EXTERNAL EMBEDS)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-diagnose*
*Context gathered: 2026-03-10*
