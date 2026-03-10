# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**Email Delivery:**
- EmailJS (@emailjs/browser 4.4.1) - Client-side email sending
  - Used in: `src/components/UpdateRequestModal.jsx`
  - Requires: EmailJS public key configuration

- Nodemailer (7.0.6) - Server-side email sending in Cloud Functions
  - Used in: `functions/index.js` (testEmail, sendNewUserNotification functions)
  - Requires: Email service credentials (SMTP or OAuth)

**Maps (Planned/Referenced):**
- Google Maps API
  - Key variable: VITE_GOOGLE_MAPS_API_KEY (in .env.example)
  - Loader: `src/utils/loadGoogleMapsScript.js`
  - Status: Configured but integration not fully active in current codebase

## Data Storage

**Database:**
- Firestore (Google Cloud NoSQL)
  - Connection: Configured via Firebase SDK `src/firebase.js`
  - Environment variables: VITE_FIREBASE_PROJECT_ID and related
  - Collections: users, notification_tokens, posts, comments, reactions, matches, events, resources, rsvps, registrationCodes, admin_actions
  - Access control: Defined in `firestore.rules`
  - Client SDK: firebase 11.7.3 (getFirestore)
  - Admin SDK: firebase-admin 13.4.0 (in Cloud Functions)

**File Storage:**
- Firebase Cloud Storage
  - Used for: User profile images, event photos, resource attachments
  - Client SDK: firebase 11.7.3 (getStorage)
  - Admin SDK: firebase-admin 13.4.0 (in Cloud Functions)
  - Functions: `functions/index.js` exports getPhoto, listUserPhotos

**Caching:**
- Browser caching - Cache-Control headers set for manifest.json, firebase-messaging-sw.js, and index.html in `firebase.json`
- Service Worker caching via `public/firebase-messaging-sw.js`

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Method: Google Sign-In (GoogleAuthProvider in `src/firebase.js`)
  - Email/password authentication also supported
  - Configuration: VITE_FIREBASE_AUTH_DOMAIN in environment
  - Admin password reset: `functions/index.js` exports adminResetPassword (Cloud Function)
  - Password reset links: Generated via firebase-admin API

**Session Management:**
- Firebase Auth tokens (ID tokens and refresh tokens)
- Token-based authorization for Cloud Functions
- Manual token verification in adminResetPassword function

## Notifications & Messaging

**Push Notifications:**
- Firebase Cloud Messaging (FCM)
  - Client SDK: firebase 11.7.3 (getMessaging, getToken, onMessage)
  - Admin SDK: firebase-admin 13.4.0 (sendEachForMulticast)
  - Service Worker: `public/firebase-messaging-sw.js` for background notifications
  - Token storage: Firestore collection `notification_tokens`
  - Messaging sender ID: VITE_FIREBASE_MESSAGING_SENDER_ID

**Push Notification Triggers (Cloud Functions):**
- `sendTestPush` - HTTP endpoint to send test notifications to all registered devices
- `sendUpdateNotification` - Triggered on new post creation; filters users by role
- `sendEventNotification` - Triggered on new event creation; filters users by group
- `sendEventPublishedNotification` - Triggered when event status changes from draft to published
- `sendNewUserNotification` - Triggered on new user registration

**Notification Token Management:**
- Token registration/storage: Clients store FCM tokens in `notification_tokens` collection
- Token cleanup: Invalid tokens removed during failed send attempts

## Monitoring & Observability

**Error Tracking:**
- Firebase Functions logging via firebase-functions/logger
  - Logs sent to Cloud Logging (Google Cloud Console)
  - Functions log method calls with structured data

**Logs:**
- Client-side: console.log statements throughout codebase
- Server-side: firebase-functions logger.info, logger.warn, logger.error in Cloud Functions
- Service Worker: console.log in `public/firebase-messaging-sw.js`

**Performance Metrics:**
- Firebase Performance Monitoring available but not actively configured
- Vite build metrics via build output

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting
  - Primary domain: https://app.levelupcincinnati.org
  - Default domain: https://level-up-app-c9f47.web.app
  - Fallback domain: https://level-up-app-c9f47.firebaseapp.com
  - Deployment via: `firebase deploy` command

**Cloud Functions Deployment:**
- Deployed via: `firebase deploy --only functions`
- Function logs: `firebase functions:log` command
- Emulation: `firebase emulators:start --only functions` for local development
- Deployment script: `functions/package.json` includes deploy target

**Local Development:**
- Functions emulator runs on localhost:5001 (configured in `src/firebase.js`)
- Vite dev server runs on localhost:5173 or 5174
- Automatic connection to Functions emulator when hostname is localhost

## Environment Configuration

**Required env vars (Client):**
- VITE_GOOGLE_MAPS_API_KEY - Google Maps API key
- VITE_FIREBASE_API_KEY - Firebase API key (exposed by design)
- VITE_FIREBASE_AUTH_DOMAIN - Firebase auth domain
- VITE_FIREBASE_PROJECT_ID - Firestore project ID
- VITE_FIREBASE_STORAGE_BUCKET - Cloud Storage bucket
- VITE_FIREBASE_MESSAGING_SENDER_ID - FCM sender ID
- VITE_FIREBASE_APP_ID - Firebase app ID
- VITE_FIREBASE_MEASUREMENT_ID - Google Analytics measurement ID (optional)
- VITE_FIREBASE_DATABASE_URL - Realtime database URL (if used)
- VITE_BACKEND_URL - Backend API URL
- VITE_ENVIRONMENT - Environment name (development/production)

**Required env vars (Cloud Functions):**
- EMAILJS_SERVICE_ID - EmailJS service configuration
- EMAILJS_TEMPLATE_ID - EmailJS email template
- EMAILJS_PUBLIC_KEY - EmailJS public key
- SMTP credentials (if using Nodemailer with SMTP)

**Secrets location:**
- `.env` file (not committed, contains sensitive credentials)
- `.env.example` - Template for required variables
- Cloud Functions use `functions/.env` for local development
- Production secrets: Google Cloud Secret Manager (recommended but not configured in current setup)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected - Cloud Functions are called via HTTP or triggered by Firestore changes

**Outgoing Webhooks:**
- Firestore triggers Cloud Functions:
  - Posts created → sendUpdateNotification
  - Events created → sendEventNotification
  - Events updated → sendEventPublishedNotification
  - Users created → sendNewUserNotification
- Cloud Messaging sends notifications to client devices via FCM

**HTTP Endpoints (Cloud Functions):**
- POST /sendTestPush - Send test push to all users
- POST /adminResetPassword - Generate password reset link (requires auth)
- GET /getPhoto - Retrieve user photos from Storage
- GET /listUserPhotos - List user's photos
- GET /coaches - Get coaches data (filtered)
- GET /students - Get students data (filtered)
- POST /testEmail - Test email sending via Nodemailer

## CORS Configuration

**Allowed Origins:**
- http://localhost:5174 (local dev)
- http://localhost:5173 (local dev)
- https://level-up-app-c9f47.firebaseapp.com
- https://level-up-app-c9f47.web.app
- https://app.levelupcincinnati.org (production)

**Allowed Methods:**
- GET, POST, OPTIONS

**Response Headers:**
- Content-Type, Authorization

**Max Age:**
- 3600 seconds (1 hour)

## Data Access Patterns

**Firestore Security Rules (`firestore.rules`):**
- Authentication: All reads/writes require `request.auth != null` (except public registration code reads)
- Authorization:
  - Users can read all users, write only own documents
  - Posts: Admins write, all authenticated users read
  - Events: Admins write, all authenticated users read
  - Matches: Admins write/delete, all authenticated users read
  - RSVPs: Users create own, admins can manage
  - Registration codes: Public read (for signup validation)
- Phone number validation: Enforced on user write operations
- Role validation: Resources collection validates role values

---

*Integration audit: 2026-03-10*
