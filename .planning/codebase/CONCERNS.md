# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Monolithic Page Components:**
- Issue: Several page components exceed safe complexity thresholds. `AdminPanel.jsx` is 2,588 lines (contains 5 separate feature domains), `Directory.jsx` is 1,414 lines, `EventLandingPage.jsx` is 1,085 lines.
- Files: `src/pages/AdminPanel.jsx`, `src/pages/Directory.jsx`, `src/pages/EventLandingPage.jsx`
- Impact: Difficult to test, harder to maintain, increases bundle size, makes debugging harder, increased cognitive load for contributors.
- Fix approach: Break each into 3-5 smaller sub-components focusing on single responsibilities. See `REFACTORING_PLAN.md` Phase 3 for detailed guidance.

**Duplicated Clipboard Logic:**
- Issue: Copy-to-clipboard functionality appears in 4+ locations with identical fallback patterns.
- Files: `src/pages/Directory.jsx` (lines 76-100), `src/components/ProfileModal.jsx` (lines 84-108), `src/pages/EventLandingPage.jsx`, `src/components/ApprovalsPanel.jsx`
- Impact: Maintenance burden if clipboard API changes, inconsistent behavior, missed improvements.
- Fix approach: Extract to shared utility `src/utils/clipboard.js` exporting `copyToClipboard(text)`.

**Dead Code:**
- Issue: Commented code blocks left in production files indicating incomplete implementations.
- Files: `src/pages/App.jsx` (lines 85-135 - session timeout), `src/pages/Login.jsx` (lines 65-113 - password reset), `src/pages/AdminPanel.jsx` (lines 1-53 - role options)
- Impact: Confusion during code reviews, false sense of incomplete features, clutters codebase.
- Fix approach: Remove commented blocks entirely. Create GitHub issues for incomplete features if needed rather than keeping stubs in code.

**Hardcoded Firebase Credentials:**
- Issue: Firebase config exposed in source code at `src/firebase.js` lines 10-17.
- Files: `src/firebase.js`
- Impact: Public API keys visible in git history. While Firebase config is technically non-secret, best practice requires environment variables.
- Fix approach: Move to `.env` file using `import.meta.env.VITE_*` pattern. Add `.env.example` template.

**Hardcoded VAPID Key:**
- Issue: Push notification VAPID key hardcoded in source.
- Files: `src/utils/notifications.js` (line 5: `const VAPID_KEY = "BEi0...w"`)
- Impact: Exposed in git history and deployed code.
- Fix approach: Move to environment variable `VITE_FIREBASE_VAPID_KEY`.

**Magic Numbers Throughout Codebase:**
- Issue: Timing constants, pagination limits, image sizes scattered as hardcoded values.
- Examples: `3000` (toast duration), `5000` (timeouts), `800` (image size), `7 * 24 * 60 * 60 * 1000` (7 days)
- Impact: Hard to maintain, difficult to adjust across app, inconsistent values in different places.
- Fix approach: Create `src/constants/index.js` with centralized definitions.

---

## Known Bugs

**Push Notifications Unreliable:**
- Symptoms: Users report inconsistent FCM token registration, especially on iOS Safari and Firefox. Some users never receive notifications despite permission granted.
- Files: `src/utils/notifications.js`, `src/components/NotificationPrompt.jsx`, Firebase Cloud Messaging configuration
- Trigger: Mobile Safari after PWA installation, Firefox, or first login on weak connections
- Workaround: Users can manually re-request notifications from profile modal. Service worker re-registration sometimes helps.
- Root cause: Multiple race conditions in notification flow (service worker timing), Safari PWA limitations with FCM, timeout configuration (10 second limit may be too aggressive).

**Session Timeout Disabled:**
- Symptoms: Session timeout protection is currently disabled.
- Files: `src/pages/App.jsx` (lines 85-135)
- Trigger: N/A - feature completely disabled
- Current state: Code is commented out, not yet re-implemented
- Impact: Users can remain logged in indefinitely, which may pose security/data freshness issues.

**Password Reset Not Functional:**
- Symptoms: Password reset directs users to email support instead of sending reset link.
- Files: `src/pages/Login.jsx` (lines 56-113, currently commented out)
- Trigger: User clicks "Forgot Password"
- Current state: Temporary message shown directing users to contact support
- Impact: Users cannot self-serve password resets; increases support burden.
- Notes: Requires Firebase email template configuration before uncommenting code.

---

## Security Considerations

**Environment Variables Missing:**
- Risk: Credentials and config stored in source code rather than environment.
- Files: `src/firebase.js` (lines 10-17), `src/utils/notifications.js` (line 5)
- Current mitigation: None - credentials are visible in repo
- Recommendations:
  1. Create `.env.example` with all required variables
  2. Update `src/firebase.js` to read from `import.meta.env.VITE_*`
  3. Add `.env` to `.gitignore` (verify it's already there)
  4. Document deployment steps for env var injection

**Unvalidated Form Inputs:**
- Risk: User-submitted data (names, URLs, phone numbers) not consistently validated before saving to Firestore.
- Files: `src/pages/Signup.jsx` (minimal validation), `src/components/ProfileModal.jsx` (phone validation exists but inconsistent), `src/pages/AdminPanel.jsx` (event/post creation)
- Current mitigation: Some validation exists for phone numbers via `src/utils/phoneValidation.js`, but email, names, URLs lack validation.
- Recommendations:
  1. Create `src/utils/validation.js` with reusable validators (email, phone, URL, displayName)
  2. Apply validators to all form inputs before submission
  3. Show validation errors inline before saving

**XSS Risk via HTML Content:**
- Risk: User-generated HTML content (posts, event descriptions) is rendered via `dangerouslySetInnerHTML` after DOMPurify sanitization.
- Files: `src/components/PostCard.jsx` (lines 104-109), `src/pages/EventLandingPage.jsx` (line 891), `src/pages/AdminPanel.jsx` (line 2494), `src/components/EventCard.jsx` (line 283)
- Current mitigation: DOMPurify sanitization with whitelist of allowed tags/attributes
- Risk level: Medium (sanitization is in place, but multiple implementations increase bug surface)
- Recommendations:
  1. Consolidate sanitization into single utility function
  2. Use consistent allowed tag/attribute lists everywhere
  3. Consider using `ReactMarkdown` with sanitization (already used in some places) instead of HTML rendering

**Admin Code Hardcoded:**
- Risk: Signup admin code `"LU-ADMIN-2025"` hardcoded in source.
- Files: `src/pages/Signup.jsx` (line 3)
- Impact: Anyone with repo access or ability to view deployed source can create admin accounts.
- Recommendations:
  1. Move to environment variable checked server-side (or Firebase Function)
  2. Rotate codes regularly
  3. Consider two-factor verification for admin creation

---

## Performance Bottlenecks

**N+1 Firebase Queries:**
- Problem: Sequential Firestore queries instead of parallel execution in several places.
- Files: `src/pages/AdminMatches.jsx` (lines 28-45 query sequentially), `src/pages/Directory.jsx` (lines 30-59)
- Cause: Using `async/await` in loops instead of `Promise.all()`
- Example: Fetching match data, student data, coach data sequentially instead of in parallel
- Improvement path: Wrap multiple `getDocs()` calls in `Promise.all([...])` to execute in parallel
- Expected impact: 3-4x faster initial data load for affected pages

**Unbounded Comment Loading:**
- Problem: Updates page creates individual listeners for every post's comments without pagination.
- Files: `src/pages/Updates.jsx` (lines 64-96)
- Cause: With 50 posts, creates 50+ active Firestore listeners, each listening to all comments on that post
- Impact: High Firestore read costs, memory leak potential, slow page load
- Improvement path: Use `collectionGroup` query for all comments at once, OR fetch comments only on post expand, OR denormalize comment count
- Expected savings: 90%+ reduction in Firestore listeners and reads

**Large Bundle from Unused Dependencies:**
- Problem: Multiple markdown/HTML parsing libraries included (ReactMarkdown, remark plugins, rehype-sanitize).
- Files: `package.json` includes several overlapping libraries
- Impact: ~100-200KB added to bundle
- Improvement path: Audit which markdown features are actually used; consider consolidating to single parser

**Inefficient User List Rendering:**
- Problem: Directory page renders all users at once without virtualization.
- Files: `src/pages/Directory.jsx` (lines 116+), `src/components/Directory/*` (if split)
- Scale impact: With 100+ users, noticeable lag on load and scroll
- Improvement path: Implement React virtualization (react-window) or lazy loading with intersection observer

---

## Fragile Areas

**Firebase Configuration Initialization:**
- Files: `src/firebase.js`
- Why fragile: Direct initialization of Firebase app with hardcoded config; no error handling if config is invalid; functions emulator only connects on `localhost` (fragile environment detection)
- Safe modification: Test with invalid config values before deploying; consider wrapping in try/catch
- Test coverage: No unit tests for Firebase setup

**Authentication State Management:**
- Files: `src/pages/App.jsx` (lines 42-83), repeated in multiple pages
- Why fragile: Auth state checked in multiple components independently; no single source of truth; race conditions possible between auth state changes and Firestore reads
- Safe modification: Create `useAuth()` hook (see REFACTORING_PLAN.md Phase 1.3) to centralize; requires testing all login/logout flows
- Test coverage: No unit tests for auth state

**Notification System:**
- Files: `src/utils/notifications.js` (entire file is fragile), `src/firebase.js` messaging initialization
- Why fragile: Multiple race conditions (service worker timing, messaging initialization timing, token retrieval timeout), browser/platform-specific code paths, heavy console logging for debugging
- Safe modification: Add comprehensive error handling, increase timeouts from 10s to 15-20s, refactor into state machine instead of linear flow
- Test coverage: No unit tests; manual testing on multiple browsers required

**Profile Image Upload and Crop:**
- Files: `src/components/CropModal.jsx`, `src/utils/cropImage.js`, `src/utils/resizeImage.js`
- Why fragile: Image processing with canvas API can fail silently; no validation of output dimensions; file upload can timeout with large images
- Safe modification: Add try/catch around canvas operations; validate cropped output before upload
- Test coverage: Manual testing only

**Event Date/Time Parsing:**
- Files: `src/components/EventCard.jsx` (lines 46-50 - date parsing with string manipulation), `src/pages/EventLandingPage.jsx` (calendar link generation)
- Why fragile: Parsing `timeRange` string like `"10:00 AM–2:00 PM"` with string splitting; no validation; can produce invalid dates for calendar links
- Safe modification: Use proper time parsing library or validate format before splitting
- Test coverage: No unit tests for date formatting

---

## Scaling Limits

**Firestore Read Costs:**
- Current capacity: Monitoring unknown; no usage tracking visible
- Limit: With current N+1 query patterns and multiple listeners, costs will scale poorly. 100 users + 50 posts + 500 comments = thousands of daily reads
- Scaling path: Implement pagination, batch queries, reduce listener count, implement read quotas/alarms in Firebase console

**Image Storage Optimization:**
- Current capacity: Users upload original sizes; resizing happens client-side
- Limit: No cleanup of old images; no CDN or image optimization; bandwidth usage grows linearly
- Scaling path: Implement Cloud Functions to resize on upload, add image optimization middleware, implement image versioning to clean old versions

**Database Query Indexes:**
- Current capacity: Likely auto-indexed, but no Composite indexes confirmed
- Limit: Complex queries (e.g., filtered event search with pagination) may become slow as data grows
- Scaling path: Monitor query performance in Firebase console; add Composite indexes as needed

---

## Dependencies at Risk

**React Router v7:**
- Risk: Very recent version (7.6.0) with limited production history; upgrade from v6 required breaking changes
- Impact: Router API changes, navigation patterns changed
- Migration plan: Monitor release notes; lock version if stability issues found

**Firebase SDK v11:**
- Risk: Recent major version; modular imports required
- Impact: If Firebase changes API again, codebase uses relatively new patterns (good for future)
- Migration plan: Monitor Firebase blog for deprecations; current setup is modern

**TipTap Editor (v3):**
- Risk: Rich text editor used for content creation; newer version may have breaking changes
- Impact: User-generated content formatting could break
- Migration plan: Lock version; monitor releases for security updates

---

## Missing Critical Features

**Error Boundary:**
- Problem: No error boundary component; entire app crashes if any component throws
- Blocks: Graceful error handling, debug information
- Impact: Users see white screen on component errors
- Priority: High
- Reference: REFACTORING_PLAN.md Phase 1.1

**Logging and Error Tracking:**
- Problem: No centralized error logging or monitoring (Sentry, DataDog, etc.)
- Blocks: Production debugging, error analytics
- Impact: Bugs in production go undetected unless users report
- Priority: Medium

**Loading States:**
- Problem: Many async operations lack loading indicators
- Blocks: User feedback during long operations
- Impact: Users unsure if action succeeded, may retry
- Priority: Medium

**Offline Support:**
- Problem: No offline mode; app completely non-functional without internet
- Blocks: Offline-first capability
- Impact: Users in areas with poor connectivity have poor experience
- Priority: Low

---

## Test Coverage Gaps

**Zero Unit Test Coverage:**
- What's not tested: Entire codebase has no unit tests
- Files: All source files
- Risk: Refactoring is risky; bugs introduced easily; no regression protection
- Priority: High
- Recommended approach: Start with critical paths (auth, data fetching, forms)

**No Integration Tests:**
- What's not tested: Firebase interactions, Firestore queries, upload flows
- Files: All data layer code
- Risk: Complex flows may have subtle bugs
- Priority: High

**No E2E Tests:**
- What's not tested: User journeys (signup, RSVP, event creation)
- Risk: Full workflow bugs slip to production
- Priority: Medium

**No Accessibility Tests:**
- What's not tested: ARIA labels, keyboard navigation, screen reader compat
- Files: `src/components/BottomNavBar.jsx`, form components, modals
- Risk: App inaccessible to users with disabilities
- Priority: Medium
- Reference: REFACTORING_PLAN.md Phase 4 for details

---

## Known Workarounds in Production

**Firebase Emulator Detection:**
- Location: `src/firebase.js` lines 33-34
- Workaround: Only connects to emulator on `localhost`
- Issue: Breaks in dev environments with custom hosts or Docker
- Should be: Environment-based flag instead of hostname detection

**Notification Permission Re-request:**
- Location: `src/components/NotificationPrompt.jsx`
- Workaround: Shows prompt every 7 days to users who haven't granted permission
- Issue: Annoying for users who intentionally denied; no "don't ask again" option
- Should be: Respect denied permissions; only ask once per browser session

---

## Recommended Refactoring Priorities

**Phase 1 - Foundation (Critical):**
1. Add ErrorBoundary component
2. Extract clipboard utility
3. Create useAuth hook

**Phase 2 - Performance (High):**
1. Parallelize Firebase queries
2. Add pagination to Updates and Directory
3. Reduce notification listeners

**Phase 3 - Code Quality (High):**
1. Split AdminPanel into 5 sub-components
2. Split Directory.jsx into 4 sub-components
3. Split EventLandingPage into 4 sub-components

**Phase 4-7:** See REFACTORING_PLAN.md for accessibility, cleanup, services, and security phases.

---

*Concerns audit: 2026-03-10*
*Complete refactoring plan available in REFACTORING_PLAN.md*
