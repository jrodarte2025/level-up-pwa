# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- JavaScript (ES2020+) - Client-side React application
- JavaScript (Node.js) - Firebase Cloud Functions backend

**Secondary:**
- Firestore Query Language (Database rules in `firestore.rules`)

## Runtime

**Environment:**
- Node.js v22 (specified in `functions/package.json`)
- Browser runtime (ES2020+ compatible browsers)

**Package Manager:**
- npm (v10+)
- Lockfile: `package-lock.json` present (root and functions directory)

## Frameworks

**Core:**
- React 19.1.0 - Web application framework
- React Router 7.6.0 - Client-side routing at `src/pages/App.jsx`

**UI & Styling:**
- Material-UI (MUI) 7.1.0 - Component library
  - @mui/material, @mui/icons-material, @mui/styles, @mui/x-date-pickers
- Emotion (@emotion/react 11.14.0, @emotion/styled 11.14.0) - CSS-in-JS styling

**Testing:**
- Not detected (no test framework found in package.json)

**Build/Dev:**
- Vite 6.3.5 - Build tool and dev server
- @vitejs/plugin-react 4.4.1 - Vite React plugin
- vite-plugin-svgr 4.3.0 - SVG as React components

**Linting:**
- ESLint 9.25.0 with @eslint/js
  - Configuration: `eslint.config.js` (flat config format)
  - Plugins: react-hooks, react-refresh

## Key Dependencies

**Critical:**
- firebase 11.7.3 - Firebase SDK for Auth, Firestore, Messaging, Storage, Functions
- firebase-admin 13.4.0 (Cloud Functions) - Server-side Firebase admin access
- firebase-functions 6.0.1 (Cloud Functions) - Firebase Functions runtime

**Content & Editing:**
- react-markdown 10.1.0 - Markdown rendering
- @tiptap/react 3.1.0 - Rich text editor with extensions (link, placeholder)
- @tiptap/starter-kit 3.1.0 - Tiptap editor core
- @uiw/react-md-editor 4.0.7 - Markdown editor component
- dompurify 3.2.6 - HTML sanitization
- rehype-sanitize 6.0.0 - Markdown HTML sanitization

**Date/Time:**
- date-fns 2.29.3 - Date manipulation and formatting
- @mui/x-date-pickers 8.3.1 - MUI date/time picker components

**Image Processing:**
- react-easy-crop 5.4.1 - Image cropping UI component

**Other Utilities:**
- lucide-react 0.511.0 - Icon library
- cors 2.8.5 - CORS middleware (both root and functions)
- dotenv 17.2.3 (Cloud Functions) - Environment variable loading
- nodemailer 7.0.6 (Cloud Functions) - Email sending library
- @emailjs/browser 4.4.1 - Email sending from browser
- @babel/runtime 7.27.1 - Babel runtime helpers
- lucide-react - Icon library

## Configuration

**Environment:**
- `.env.example` present with required Firebase config variables:
  - VITE_GOOGLE_MAPS_API_KEY
  - VITE_FIREBASE_* (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID, measurement ID)
  - VITE_FIREBASE_DATABASE_URL
  - VITE_BACKEND_URL
  - VITE_ENVIRONMENT

- Cloud Functions `.env` file present (contains secrets, never committed)

**Build:**
- `vite.config.js` - Configured for React with SVG plugin
- `eslint.config.js` - Flat config format with React rules
- `firebase.json` - Firebase hosting and Firestore configuration
  - Firestore rules: `firestore.rules`
  - Hosting output: `dist/` directory
  - Cloud Functions source: `functions/` directory
  - Cache control for manifest.json, firebase-messaging-sw.js, index.html
  - SPA rewrite rules enabled

**Service Workers:**
- `public/firebase-messaging-sw.js` - Background push notification handler

**Web Manifest:**
- `public/manifest.json` - PWA metadata (start_url: "/", display: "standalone")

## Platform Requirements

**Development:**
- Node.js v22
- npm
- Firebase CLI (for local emulator and deployment)
- Vite dev server (runs on http://localhost:5173 or 5174)

**Production:**
- Firebase Hosting (provided by Google Cloud)
- Firebase Cloud Functions (Node.js runtime, 256MB-512MB memory)
- Cloud Firestore (NoSQL database)
- Firebase Storage (file storage)
- Firebase Authentication (identity provider)
- Firebase Cloud Messaging (push notifications)

## Build & Deployment

**Build Output:**
- `vite build` produces `dist/` directory with bundled React app
- Deployed to Firebase Hosting at `https://app.levelupcincinnati.org` (custom domain)
- Also available at `https://level-up-app-c9f47.web.app` (default Firebase domain)

**Cloud Functions Deployment:**
- Node.js 22 runtime
- Location: us-central1
- Max instances: 10
- Timeout: 60 seconds (default for most functions)
- Entry point: `functions/index.js`

---

*Stack analysis: 2026-03-10*
