# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** React SPA with Firebase Backend and Layered Component Architecture

The Level Up App follows a **client-side rendered single-page application (SPA)** pattern built on React 19 with Material-UI components. All state management flows through Firestore real-time listeners and React hooks. The app uses a tab-based navigation model with role-based rendering (student/coach/admin views).

**Key Characteristics:**
- Client-side routing with React Router v7 (no server-side routing)
- Real-time Firestore data with reactive subscriptions via `onSnapshot`
- Role-based conditional rendering (student, coach, board, admin, future-coach)
- Shared Material-UI theme with Level Up brand colors
- Firebase Cloud Functions for server-side operations (notifications, admin tasks)
- Service Worker for background push notifications and PWA capabilities

## Layers

**Presentation Layer (React Components):**
- Purpose: Render UI and handle user interactions
- Location: `src/components/` and `src/pages/`
- Contains: Page components, reusable UI components, modals, cards, forms
- Depends on: Theme, Firebase services, contexts
- Used by: React Router (pages) and parent components (UI components)
- Examples: `AppShell.jsx` (layout shell), `EventCard.jsx` (event display), `ProfileModal.jsx` (user editing), `BottomNavBar.jsx` (navigation)

**Routing & Page Layer:**
- Purpose: Define page-level routes and provide shared UI shell
- Location: `src/pages/`
- Key files:
  - `App.jsx`: Main app component with auth state, tab management, route definitions
  - `RoutesWrapper.jsx`: Alternate router implementation (deprecated, not actively used)
  - `UserDashboard.jsx`: Events dashboard for students/coaches
  - `AdminPanel.jsx`: Admin panel for event/post/user management
  - `Directory.jsx`: User directory with filtering
  - `EventLandingPage.jsx`: Public event landing page (no auth required)
  - `Login.jsx` / `Signup.jsx`: Authentication pages
  - `PostPage.jsx`: Individual post view
  - `Updates.jsx`: Feed of posts/updates
  - `Resources.jsx`: Static resources page
- Depends on: Auth context, Firestore, components
- Used by: Browser router

**Context & State Management Layer:**
- Purpose: Global state and reactive subscriptions
- Location: `src/contexts/`
- Key abstractions:
  - `TypingContext.jsx`: Real-time typing indicators for collaborative editing on posts. Manages per-post typing states and provides `useTyping()` hook.
- Depends on: Firebase Auth, Firestore
- Used by: Any component needing global state

**Firebase Integration Layer:**
- Purpose: Initialize and configure Firebase services
- Location: `src/firebase.js`
- Exports: `auth`, `db` (Firestore), `functions`, `messaging`, `storage`, `googleProvider`
- Provides: Cloud Messaging setup, Functions emulator detection
- Critical: Service worker receives messages; client-side listener prevents duplicate notifications

**Utilities & Helpers:**
- Purpose: Shared logic functions
- Location: `src/utils/`
- Key modules:
  - `eventUtils.js`: Event filtering and sorting (`filterUpcomingEvents`, `sortEventsByDateTime`, `processUpcomingEvents`)
  - `notifications.js`: Push notification registration via Firebase Cloud Messaging
  - `imageValidation.js`: Image file type and size checking
  - `phoneValidation.js`: Phone number formatting and validation
  - `cropImage.js`: Image cropping utility
  - `resizeImage.js`: Image resizing before upload
  - `loadGoogleMapsScript.js`: Dynamic Google Maps API loading
- Depends on: External libraries and Firebase
- Used by: Pages and components for data processing

**Theme & Styling Layer:**
- Purpose: Centralized brand styling
- Location: `src/theme.js`, `src/brandColors.js`
- Exports: Material-UI theme via `getTheme()`, brand color constants
- Used by: All components via Material-UI's `useTheme()` hook
- Brand colors follow Level Up Cincinnati design system (primary blue/coral, secondary soft blue/light coral, etc.)

**Cloud Functions Layer:**
- Purpose: Server-side operations triggered by client actions or Firestore events
- Location: `functions/index.js`
- Key functions:
  - `sendUpdateNotification`: Triggered when a post is created; filters users by role and sends push notifications via Firebase Cloud Messaging
  - `sendTestPush`: HTTP endpoint for testing notification delivery; handles invalid FCM token cleanup
- Depends on: Firebase Admin SDK, Firestore
- Used by: Firebase emulator in dev, production deployment

## Data Flow

**User Authentication & Session:**

1. Browser loads `src/main.jsx`
2. App renders, sets up BrowserRouter and Material-UI theme
3. `App.jsx` calls `onAuthStateChanged()` to check Firebase Auth state
4. On auth change:
   - If user exists: fetch user document from Firestore (`users/{uid}`)
   - Load user profile data (firstName, lastName, company, role, headshotUrl)
   - Check `isAdmin` flag to determine admin panel access
   - Set `authLoaded` to true (removes loading screen)
5. If user is unauthenticated, render Login/Signup pages only
6. If authenticated, render full app with tabs and AppShell

**Event Feed & RSVP Flow:**

1. `UserDashboard.jsx` (or `AdminPanel.jsx`) mounts
2. Query Firestore `events` collection with `orderBy` and `where` filters
3. Set up `onSnapshot` listener to watch event changes in real-time
4. When user clicks RSVP button:
   - Check existing RSVP document (`rsvps/{userId}-{eventId}`)
   - If exists and `attending: true`, delete it (unRSVP)
   - If not exists or `attending: false`, create/update with `attending: true`
5. Listener fires, component re-renders with updated RSVP count
6. If user has a matched coach/student, show match's RSVPs for comparison

**Post & Comment Feed:**

1. `Updates.jsx` queries Firestore `posts` collection
2. For each post, conditionally render based on visibility:
   - `visibleTo` array matches current user's role
3. Click post → navigate to `PostPage.jsx` with `postId` param
4. `PostPage.jsx` queries single post and its subcollection `comments`
5. On comment submit:
   - Validate input via `RichTextEditor.jsx`
   - Create comment document in `posts/{postId}/comments`
   - Update post's comment count
   - TypingContext listener fires if other users typing
6. Click comment thread → navigate to `CommentThreadPage.jsx` to show nested replies

**Profile Management:**

1. Click profile icon in header → show `ProfileModal.jsx`
2. Modal displays form fields populated from Firestore user document
3. On field change, update local React state
4. On submit:
   - If uploading image: call `uploadBytes()` to Firebase Storage
   - Update Firestore user document with `setDoc(..., { merge: true })`
   - Update local `profileImage` state and localStorage
5. Profile reminder shows if fields missing (checks on component mount and after load)

**Admin Operations (Events):**

1. Admin enters `AdminPanel.jsx` with `tab="events"`
2. Fetch all events, filter by admin state
3. Form to create event:
   - Text fields (title, description, date, location)
   - Image upload → crop → resize → Firebase Storage
   - Visibility controls (visibleTo: student/coach/board)
4. On submit: `addDoc(collection(db, 'events'), {...})`
5. Real-time listener fires, event appears in list
6. Edit button → populate form, `updateDoc()` on submit
7. Delete button → `deleteDoc()`

**Push Notifications:**

1. Service worker registers in `src/main.jsx` via `navigator.serviceWorker.register('/firebase-messaging-sw.js')`
2. Notification prompt shows after 7 days (tracked in localStorage)
3. User clicks "Enable" → `registerForNotifications()` from `utils/notifications.js`
4. Function calls `getToken()` and stores token in `notification_tokens` collection
5. When post created with `visibleTo` audience:
   - Firestore trigger fires `sendUpdateNotification` Cloud Function
   - Function queries users matching roles in `visibleTo`
   - Gets notification tokens for those users
   - Sends via Firebase Cloud Messaging
6. Service worker receives message in `firebase-messaging-sw.js`:
   - If notification payload present: Firebase auto-shows (no manual handling)
   - If data-only: manually show via `self.registration.showNotification()`
7. User clicks notification → opens app via `notificationclick` listener

**Admin Notifications:**

1. Admin creates update/post with `visibleTo` array
2. `sendUpdateNotification` Cloud Function triggered automatically
3. Function sends push to all users whose role matches `visibleTo`

**State Management:**

- **React Local State**: Form inputs, modals, tab selection, expanded/collapsed sections
- **Firestore Real-time Listeners** (via `onSnapshot`): Events, posts, comments, RSVPs, user data, typing indicators
- **localStorage**: Profile image URL, last notification prompt timestamp, admin tab selection
- **sessionStorage**: Redirect path after login, profile reminder dismissal

## Key Abstractions

**EventCard Component:**
- Purpose: Display single event with RSVP button, attendee count, details
- Located: `src/components/EventCard.jsx`
- Pattern: Stateless component receiving event data and callback props
- Used by: `UserDashboard.jsx`, `AdminPanel.jsx` event lists

**ProfileModal:**
- Purpose: Unified user profile editing for all roles
- Located: `src/components/ProfileModal.jsx`
- Pattern: Modal overlay with form fields, image upload, submit handler
- Responsibilities:
  - Display/edit firstName, lastName, company, title, major, graduation year, LinkedIn, phone
  - Role-conditional fields (student sees major/graduationYear; coach sees company/title)
  - Admin toggle to switch between admin/user views
  - Sign out
- Used by: App.jsx when profile icon clicked

**CreateUpdate Component:**
- Purpose: Rich text editor for creating posts/updates
- Located: `src/components/CreateUpdate.jsx`
- Uses: `RichTextEditor.jsx` (TipTap-based markdown editor) with emoji picker
- Responsibilities:
  - Format content as markdown
  - Select target audience (visibleTo roles)
  - Upload featured image
  - Validate before submit
- Used by: `AdminPanel.jsx` for post creation; also available as test route `/test-update`

**RichTextEditor:**
- Purpose: TipTap-based markdown editor with formatting toolbar
- Located: `src/components/RichTextEditor.jsx`
- Pattern: Wrapper around TipTap extensions (link, placeholder, sanitization)
- Used by: `CreateUpdate.jsx`, `Comment.jsx` for rich text input

**TypingContext / useTyping Hook:**
- Purpose: Real-time typing indicators on posts
- Located: `src/contexts/TypingContext.jsx`
- Pattern: React Context with Firestore collection listener per post
- API:
  - `startTyping(postId)`: Create typing indicator document
  - `stopTyping(postId)`: Remove typing indicator
  - `markCommentAsNew(commentId)`: Highlight new comments for 5 seconds
  - `isCommentNew(commentId)`: Check if comment is newly highlighted
  - `typingUsers`: Object map of `{ postId: [users] }`
- Handles: Auto-cleanup after 3 seconds of inactivity, timeout-based deletion

**AppShell:**
- Purpose: Shared layout wrapper (header + content + bottom nav)
- Located: `src/components/AppShell.jsx`
- Pattern: Renders HeaderBar, main content area (children), BottomNavBar
- Handles: Scroll-to-top on tab change, safe area insets for mobile
- Used by: All authenticated pages

## Entry Points

**Web App Entry Point:**
- Location: `src/main.jsx`
- Triggers: Page load
- Responsibilities:
  - Initialize React root
  - Set up BrowserRouter
  - Apply Material-UI theme (light mode)
  - Register service worker for Firebase Messaging
  - Render `<App />` component

**Auth Entry Point (`App.jsx`):**
- Location: `src/pages/App.jsx`
- Triggers: Component mount
- Responsibilities:
  - Listen for Firebase Auth state changes
  - Fetch user profile from Firestore
  - Determine user role and admin status
  - Show loading screen until auth verified
  - Redirect unauthenticated users to /login
  - Render appropriate tabs (admin vs regular user)
  - Manage top-level modals (profile, notification prompt, profile reminder)
  - Define all app routes and their components

**Admin Entry Point:**
- Location: `src/pages/AdminPanel.jsx`
- Triggered by: Admin user clicking "Admin" tab or accessing admin view
- Responsibilities:
  - Provide event/post/user management interface
  - Support tab-based filtering (events, posts, resources, admin matches)
  - Handle bulk operations (publish posts, create events, manage matches)

**Public Entry Point (EventLandingPage):**
- Location: `src/pages/EventLandingPage.jsx`
- Triggered by: Direct link `/event/:eventId` (no auth required)
- Responsibilities:
  - Display event details without requiring login
  - Show RSVP count and attendee list
  - Provide signup link if user not authenticated

## Error Handling

**Strategy:** Try-catch blocks in async operations with console logging and user-facing toast notifications

**Patterns:**

1. **Auth Errors:**
   - `Auth.onAuthStateChanged()` catches state changes; missingProfile docs handled with retry delay
   - Sign-out clears localStorage cache before firing logout
   - Session timeout (disabled) would trigger automatic sign-out

2. **Firestore Errors:**
   - `getDocs()`, `getDoc()`, `setDoc()`, `updateDoc()` wrapped in try-catch
   - Failed image uploads show toast error, don't update profile
   - Comment/post submission shows toast on error

3. **Push Notification Errors:**
   - `registerForNotifications()` returns `{ success: boolean, error?: string }`
   - Invalid tokens caught by `sendUpdateNotification` Cloud Function and batch-deleted
   - Service worker errors logged to console, don't crash app

4. **Image Processing Errors:**
   - `imageValidation.js` checks file type/size before upload
   - `cropImage.js` and `resizeImage.js` handle canvas errors
   - Fallback to placeholder image if URL fails to load

5. **Firebase Storage Errors:**
   - Profile image upload failure → fallback to `/default-avatar.png` or placeholder
   - Event image upload failure → show toast, don't create event
   - Missing storage references → console error, no blocking

## Cross-Cutting Concerns

**Logging:**
- Console logging for debugging: `console.log()`, `console.error()`, `console.warn()`
- Firebase Functions use `logger.info()`, `logger.warn()`, `logger.error()`
- No centralized logging service; relies on browser console and Firebase Logs

**Validation:**
- Input validation at component level (form fields, required checks)
- Image validation in `utils/imageValidation.js` (type, size, dimensions)
- Phone validation in `utils/phoneValidation.js` (format, country code support)
- Firestore rules enforce permission-based access (read Firestore security rules)

**Authentication:**
- Firebase Auth handles user identity
- Firestore user documents store role, admin status, approval state
- JWT tokens handled by Firebase (no manual token management)
- Session timeout disabled (code present but commented out)

**Authorization:**
- Role checks at component level: `if (userRole === "student") {...}`
- Admin checks: `if (isAdmin) {...}` before rendering admin panels
- Firestore security rules enforce document-level permissions
- Public events accessible via `/event/:eventId` without auth

---

*Architecture analysis: 2026-03-10*
