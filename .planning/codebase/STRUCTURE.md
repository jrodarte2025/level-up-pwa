# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
Level-Up-App/
├── src/                          # React source code
│   ├── pages/                    # Page components (routes)
│   ├── components/               # Reusable UI components
│   ├── contexts/                 # React Context providers
│   ├── utils/                    # Utility functions
│   ├── assets/                   # Static images and icons
│   ├── App.css                   # Global app styles
│   ├── index.css                 # Base styles
│   ├── main.jsx                  # Application entry point
│   ├── firebase.js               # Firebase initialization
│   ├── theme.js                  # Material-UI theme configuration
│   └── brandColors.js            # Brand color constants
├── functions/                    # Firebase Cloud Functions
│   ├── index.js                  # Function definitions
│   ├── package.json
│   └── node_modules/
├── public/                       # Static assets served by browser
│   ├── firebase-messaging-sw.js  # Service worker for push notifications
│   ├── manifest.json             # PWA manifest
│   ├── logo.png                  # Main logo
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── icons/                    # PWA icon sizes
├── dist/                         # Production build output (generated)
├── .firebase/                    # Firebase emulator data (local dev)
├── .planning/                    # GSD planning documents
├── vite.config.js                # Vite build configuration
├── firebase.json                 # Firebase hosting/functions config
├── eslint.config.js              # ESLint configuration
├── package.json                  # Frontend dependencies
├── package-lock.json
├── cors.json                     # CORS configuration
└── node_modules/                 # Dependencies (not committed)
```

## Directory Purposes

**`src/`:**
- Purpose: All React source code for the web application
- Contains: Components, pages, utilities, assets, configuration
- Key files: `main.jsx` (entry point), `firebase.js` (initialization)

**`src/pages/`:**
- Purpose: Page-level components corresponding to routes
- Contains: Full page layouts with route-specific logic
- Key files:
  - `App.jsx`: Root app component with auth management and route definitions
  - `UserDashboard.jsx`: Events feed for students/coaches
  - `AdminPanel.jsx`: Admin interface for events, posts, resources, user matching
  - `Directory.jsx`: User directory with filtering and search
  - `EventLandingPage.jsx`: Public event details page (no auth required)
  - `Login.jsx`: Authentication page
  - `Signup.jsx`: User registration page
  - `PostPage.jsx`: Individual post view with comments
  - `CommentThreadPage.jsx`: Reply thread for a comment
  - `Updates.jsx`: Feed of all posts
  - `Resources.jsx`: Static resources/links
  - `AdminMatches.jsx`: Admin interface for coach-student matching
  - `RoutesWrapper.jsx`: Legacy router wrapper (not in active use)

**`src/components/`:**
- Purpose: Reusable UI components
- Contains: React components, modals, cards, bars, editors
- Key files:
  - `AppShell.jsx`: Layout wrapper (header + content + nav)
  - `HeaderBar.jsx`: Top navigation bar with logo and profile
  - `BottomNavBar.jsx`: Tab-based bottom navigation
  - `ProfileModal.jsx`: User profile editing modal
  - `EventCard.jsx`: Event card display component
  - `PostCard.jsx`: Post card with comments preview
  - `Comment.jsx`: Individual comment with threading
  - `CommentInput.jsx`: Comment input field with formatting
  - `CreateUpdate.jsx`: Post/update creation modal
  - `RichTextEditor.jsx`: TipTap-based markdown editor
  - `NotificationPrompt.jsx`: Permission request for push notifications
  - `ToastManager.jsx`: Toast notification display
  - `TypingIndicator.jsx`: Shows "X is typing..." indicator
  - `GuestCountModal.jsx`: RSVP guest count input
  - `CropModal.jsx`: Image cropping interface
  - `EmojiPicker.jsx`: Emoji selector for comments
  - `ReactionBar.jsx`: Reaction emojis on posts/comments
  - `AvatarList.jsx`: Avatar group display
  - `MatchMakingPanel.jsx`: Coach-student pairing interface
  - `PasswordResetPanel.jsx`: Password reset management
  - `ApprovalsPanel.jsx`: Admin user approval queue
  - `UpdateRequestModal.jsx`: Request to edit posts
  - `CardWrapper.jsx`: Simple card wrapper utility

**`src/contexts/`:**
- Purpose: React Context providers for global state
- Contains: Context definitions and hooks
- Key file: `TypingContext.jsx` - Manages real-time typing indicators via `useTyping()` hook

**`src/utils/`:**
- Purpose: Utility functions and helpers
- Contains: Data processing, validation, Firebase helpers
- Key files:
  - `eventUtils.js`: Event filtering (`filterUpcomingEvents`, `sortEventsByDateTime`, `processUpcomingEvents`)
  - `notifications.js`: Push notification registration and handling
  - `imageValidation.js`: File type/size validation for images
  - `phoneValidation.js`: Phone number formatting and validation
  - `cropImage.js`: Image cropping utility
  - `resizeImage.js`: Image resizing before Firebase Storage upload
  - `loadGoogleMapsScript.js`: Dynamic Google Maps API loader
  - `notificationTest.js`: Test utilities for notifications (private)

**`src/assets/`:**
- Purpose: Static media files
- Contains: Images, icons
- Subdirectories: `icons/` for SVG icon files

**`functions/`:**
- Purpose: Firebase Cloud Functions (backend)
- Contains: Server-side code triggered by client or Firestore events
- Key file: `index.js` with function definitions
- Main functions:
  - `sendUpdateNotification`: Triggered on post creation; sends push notifications
  - `sendTestPush`: HTTP endpoint for testing notifications
- Also contains: `package.json`, `.env` file (environment config)

**`public/`:**
- Purpose: Static assets served directly by Firebase Hosting
- Contains: Service worker, PWA manifest, favicons, logos
- Key files:
  - `firebase-messaging-sw.js`: Service worker handling background push messages
  - `manifest.json`: PWA configuration
  - `logo.png`: Main application logo (512x512)
  - `favicon.ico`: Browser tab icon
  - `icons/`: PWA icon set at various sizes

**`dist/`:**
- Purpose: Production-ready build output
- Generated by: `npm run build` (Vite)
- Deployed to: Firebase Hosting
- Contents: Bundled JavaScript, CSS, HTML, static assets

## Key File Locations

**Entry Points:**
- `src/main.jsx`: Web app initialization, React root, BrowserRouter, service worker registration
- `functions/index.js`: Cloud Functions definitions (backend entry)
- `public/index.html`: HTML document loaded by Vite (typically `<div id="root">`)

**Configuration:**
- `vite.config.js`: Build tool configuration (React plugin, SVG support)
- `firebase.json`: Firebase Hosting/Functions deployment config
- `eslint.config.js`: Linting rules
- `package.json`: Frontend dependencies and build scripts
- `functions/package.json`: Backend dependencies
- `public/manifest.json`: PWA configuration
- `src/firebase.js`: Firebase SDK initialization and exports

**Core Logic:**
- `src/pages/App.jsx`: Auth state, route definitions, tab management
- `src/pages/UserDashboard.jsx`: Event feed and RSVP logic
- `src/pages/AdminPanel.jsx`: Event/post creation, admin operations
- `src/pages/Directory.jsx`: User search and filtering
- `src/contexts/TypingContext.jsx`: Real-time typing indicators
- `src/utils/notifications.js`: Push notification registration

**Testing & Utilities:**
- `public/firebase-messaging-sw.js`: Service worker for background messages
- `utils/notificationTest.js`: Testing notification functionality
- `functions/sms-example.js`: Example SMS integration (not active)

**Styling & Theme:**
- `src/theme.js`: Material-UI theme with brand colors
- `src/brandColors.js`: Brand color constants and CSS variable definitions
- `src/App.css`: Global app styles
- `src/index.css`: Base/reset styles
- `src/components/animations.css`: Animation definitions

## Naming Conventions

**Files:**
- React components: PascalCase `.jsx` (e.g., `EventCard.jsx`, `ProfileModal.jsx`)
- Utility functions: camelCase `.js` (e.g., `eventUtils.js`, `imageValidation.js`)
- Styles: kebab-case `.css` (e.g., `animations.css`)
- Configuration: camelCase or lowercase (e.g., `vite.config.js`, `firebase.json`)

**Directories:**
- Feature directories: lowercase (e.g., `components/`, `pages/`, `utils/`)
- Asset directories: lowercase (e.g., `assets/`, `icons/`)

**React Components:**
- Props: camelCase (e.g., `onTabChange`, `profileImage`, `visibleTo`)
- State variables: camelCase (e.g., `selectedTab`, `userRole`, `events`)
- Handlers: `handle{ActionName}` or `on{EventName}` (e.g., `handleSignOut`, `onProfileClick`)
- Hooks: `use{HookName}` (e.g., `useTheme()`, `useTyping()`)
- Context: `{Name}Context` (e.g., `TypingContext`)

**Firestore Collections & Fields:**
- Collections: lowercase plural (e.g., `events`, `users`, `posts`, `comments`, `rsvps`)
- Documents: camelCase (e.g., `firstName`, `eventId`, `userId`, `visibleTo`)
- Timestamps: `timestamp`, `createdAt`, `updatedAt`

**CSS Classes:**
- Global: camelCase (e.g., `.app-container`, `.page-content`, `.button-link`)
- Component-scoped: Use inline styles with Material-UI `useTheme()`
- Brand classes: `.luc-` prefix (e.g., `.luc-brand-primary`)

## Where to Add New Code

**New Feature (e.g., messaging system):**
- Primary code: Create folder `src/features/messaging/` with:
  - `pages/MessagingPage.jsx` - Route handler
  - `components/MessageCard.jsx`, `ChatWindow.jsx` - Reusable components
  - `utils/messageUtils.js` - Helpers
  - Context if shared state needed: `contexts/MessageContext.jsx`
- Tests: `src/features/messaging/__tests__/` (if testing exists)
- Update: `src/pages/App.jsx` to add route

**New Page/Route:**
- Create file: `src/pages/{PageName}.jsx`
- Add to routes in `src/pages/App.jsx`:
  ```jsx
  <Route path="/your-route" element={<YourPage />} />
  ```
- Add to tabs if navigable via bottom nav
- Import any needed components/utilities

**New Reusable Component:**
- Create file: `src/components/{ComponentName}.jsx`
- Import in pages/other components as needed
- Use Material-UI `useTheme()` hook for styling
- Pass data via props; callbacks for events

**New Utility/Helper:**
- Create file: `src/utils/{utilityName}.js`
- Export named functions (not default)
- Example:
  ```js
  export const myHelper = (input) => { return processed; };
  ```
- Import in components: `import { myHelper } from '../utils/...'`

**New Firebase Cloud Function:**
- Add export to `functions/index.js`:
  ```js
  exports.myFunction = onRequest(async (req, res) => { ... });
  // or
  exports.myFunction = onDocumentCreated('collection/{docId}', async (event) => { ... });
  ```
- Deploy: `firebase deploy --only functions`
- Call from client: `httpsCallable(functions, 'myFunction')`

**New Context/Provider:**
- Create file: `src/contexts/{ContextName}.jsx`
- Follow `TypingContext.jsx` pattern:
  ```jsx
  const MyContext = createContext();
  export const useMyContext = () => useContext(MyContext);
  export const MyProvider = ({ children }) => {
    const [state, setState] = useState(...);
    return <MyContext.Provider value={{...}}>{children}</MyContext.Provider>;
  };
  ```
- Wrap `<App />` or specific page in provider in `src/main.jsx` or relevant component

## Special Directories

**`.firebase/`:**
- Purpose: Firebase emulator local data storage
- Generated: By Firebase emulator on `firebase emulators:start`
- Committed: No (in `.gitignore`)
- Used for: Local development only

**`.planning/`:**
- Purpose: GSD (Guided Software Development) planning documents
- Generated: By `/gsd:` commands
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`dist/`:**
- Purpose: Production build output
- Generated: By `npm run build`
- Committed: No (in `.gitignore`)
- Deployed: To Firebase Hosting via `firebase deploy`

**`node_modules/`:**
- Purpose: Frontend dependencies
- Generated: By `npm install`
- Committed: No (in `.gitignore`)
- Contains: React, Material-UI, Firebase, routing, etc.

**`functions/node_modules/`:**
- Purpose: Cloud Functions dependencies
- Generated: By `npm install` in `functions/` directory
- Committed: No (in `.gitignore`)
- Contains: firebase-admin, firebase-functions, nodemailer, etc.

---

*Structure analysis: 2026-03-10*
