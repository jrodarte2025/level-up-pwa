# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `EventCard.jsx`, `HeaderBar.jsx`, `AppShell.jsx`)
- Utility functions: camelCase with `.js` extension (e.g., `eventUtils.js`, `imageValidation.js`, `notifications.js`)
- Pages/routes: PascalCase with `.jsx` extension (e.g., `UserDashboard.jsx`, `AdminPanel.jsx`, `Login.jsx`)
- Context providers: PascalCase with `Context` suffix (e.g., `TypingContext.jsx`)
- Configuration files: camelCase or lowercase (e.g., `firebase.js`, `theme.js`, `eslint.config.js`)

**Functions:**
- Event handlers: `handle` prefix, camelCase (e.g., `handleEmailLogin`, `handlePasswordReset`, `handleRSVP`)
- Async functions: camelCase, no special prefix (e.g., `fetchMatch`, `loadRole`, `registerForNotifications`)
- Utility/helper functions: camelCase, descriptive name (e.g., `getTimeMinutes`, `validateImageFile`, `filterUpcomingEvents`, `getImageDimensions`)
- React hooks: `use` prefix, camelCase (e.g., `useTheme()`, `useState`, `useEffect`, `useRef`)
- Getters: `get` prefix (e.g., `getEmojiKey`, `getOptimalImageSize`, `getTheme`)
- Validators: `validate` prefix (e.g., `validateImageFile`, with return object `{ isValid, errors }`)
- Filters/processors: descriptive verb-noun pattern (e.g., `filterUpcomingEvents`, `processUpcomingEvents`, `sortEventsByDateTime`)

**Variables:**
- State variables: camelCase (e.g., `user`, `isRSVPed`, `showProfile`, `loginError`, `selectedTab`)
- Boolean state: `is`/`has`/`show` prefix followed by adjective or noun (e.g., `isAdmin`, `hasNotifications`, `showProfile`, `isEditing`, `isMobile`)
- Constants: UPPERCASE_SNAKE_CASE for global constants (e.g., `VAPID_KEY`, `MAX_SIZE`, `THIRTY_DAYS`)
- Local constants: camelCase if not globally exported (e.g., `validTypes`, `maxSize`, `emailRegex`)
- Event data fields: Snake_case from Firebase (e.g., `coachId`, `studentId`, `eventId`, `userId`) — match database schema exactly

**Types:**
- Objects with shape definitions use descriptive camelCase properties
- No TypeScript in use; JSDoc comments describe object shapes where needed
- Firebase documents are treated as objects with specific shape assumptions (e.g., `event.date?.seconds * 1000` for timestamps)

## Code Style

**Formatting:**
- Vite with default ESLint config (ESLint 9.x)
- No Prettier configured; rely on ESLint rules
- 2-space indentation (observed in jsx/js files)
- Semicolons used throughout
- Single quotes vs double quotes: mixed in codebase; prefer single quotes but double quotes acceptable (e.g., `"react"` in imports, `"email"` in strings)

**Linting:**
- ESLint config: `eslint.config.js` (flat config format)
- Key rules:
  - `no-unused-vars`: Error, with pattern `^[A-Z_]` ignored (allows unused uppercase/underscore-prefixed variables)
  - React hooks linting enabled via `eslint-plugin-react-hooks`
  - React Refresh warnings for component exports
- Run: `npm run lint`

## Import Organization

**Order:**
1. React and core libraries (e.g., `import React from "react"`)
2. Third-party UI libraries (e.g., `@mui/material`, `@mui/icons-material`)
3. Third-party utilities (e.g., `react-markdown`, `dompurify`, `lucide-react`)
4. Firebase imports (e.g., `firebase/auth`, `firebase/firestore`)
5. Local components and contexts (relative paths, e.g., `./EventCard`, `../components/HeaderBar`)
6. Local utilities and helpers (e.g., `../utils/eventUtils`)
7. Local configuration (e.g., `../firebase`, `../theme`)
8. Styles/CSS (e.g., `./animations.css`, `../App.css`)

**Path Aliases:**
- No path aliases configured; all imports use relative paths (`../`, `./`)
- Example: `import { db } from "../firebase"` rather than `@/firebase`

## Error Handling

**Patterns:**
- Try-catch blocks for async operations that interact with Firebase, auth, or file operations
- Example from `src/pages/Login.jsx`:
  ```javascript
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Success path
  } catch (error) {
    // Handle specific error codes with switch statement
    switch (error.code) {
      case 'auth/wrong-password':
        setLoginError("Invalid email or password. Please try again.");
        break;
      default:
        setLoginError("Unable to sign in. Please try again.");
    }
  }
  ```
- Firebase error codes mapped to user-friendly messages (not raw error objects shown to users)
- Console logging for debugging (`console.error`, `console.warn`, `console.log`)
- Validation functions return `{ isValid, errors }` object pattern (see `src/utils/imageValidation.js`)

**Error Communication:**
- User-facing errors in state variables (e.g., `loginError`, `resetMessage`)
- Rendered conditionally (e.g., `{loginError && <p>{loginError}</p>}`)
- Technical errors logged to console with descriptive prefix (e.g., `console.error('Login failed:', error)`)

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.log()`: General information, function entry points, state changes
- `console.warn()`: Non-critical issues, fallbacks (e.g., `console.warn('DOMPurify failed, falling back to text:', error)`)
- `console.error()`: Errors from try-catch blocks, failed operations
- Prefix with emoji for visibility during development (e.g., `console.log("🔔 Showing toast:", msg)`, `console.warn("❌ Failed to load profile image")`)
- Location logging uncommon; trust browser DevTools for stack traces

**When to Log:**
- Firebase operations: log success callback results and error codes
- Auth state changes: log on `onAuthStateChanged` listener
- Async operations: log at entry and error points
- Avoided in render path to prevent noise

## Comments

**When to Comment:**
- Complex business logic (e.g., handling legacy string vs array formats for event groups)
- Non-obvious Firebase query patterns
- Workarounds for known issues (marked with `//` inline or block)
- Disabled code sections with explanation (marked with `/* ... */` multi-line block and `UNCOMMENT` notes)
- Example from `src/components/EventCard.jsx`:
  ```javascript
  // Handle both array format ["students", "coaches"] and legacy string format "both"
  const groups = event.groups;
  const isForCoaches = Array.isArray(groups)
    ? groups.includes("coaches")
    : groups === "both" || groups === "coaches";
  ```

**JSDoc/TSDoc:**
- JSDoc used in utility functions to document parameters and return types
- Example from `src/utils/eventUtils.js`:
  ```javascript
  /**
   * Parse a time range string and extract the start time in minutes since midnight
   * @param {string} timeRange - Format like "10:00AM - 11:30AM" or "11:00AM - 2:00PM"
   * @returns {number} Minutes since midnight (e.g., 10:00AM = 600 minutes)
   */
  export const getTimeMinutes = (timeRange) => {
  ```
- JSDoc less common in React components; inline comments preferred for complex render logic
- No TypeScript, so JSDoc serves as type documentation

## Function Design

**Size:** Generally 50-300 lines; longer functions split into smaller utility functions or hooks
- Example: `UserDashboard.jsx` is ~30KB — large file, could benefit from composition
- Example: Utility functions like `eventUtils.js` are 10-80 lines each

**Parameters:**
- React components: destructure props object (e.g., `function EventCard({ event, onRSVP, expanded = false })`)
- Utility functions: 1-3 parameters preferred; pass objects for related data
- Default values: Use destructuring defaults (e.g., `expanded = false`) or ESLint-safe patterns

**Return Values:**
- Components: Always return JSX (wrapped in a fragment or root element)
- Utility functions: Return plain values, objects, Promises, or objects with status shape (e.g., `{ isValid, errors }`)
- Async functions: Return Promise (implicit for `async` functions)
- Example from `src/utils/imageValidation.js`:
  ```javascript
  return {
    isValid: errors.length === 0,
    errors
  };
  ```

## Module Design

**Exports:**
- `export default` used for page components and main components (`AppShell.jsx`, `HeaderBar.jsx`)
- `export const` used for utility functions and helpers
- Mix of default and named exports in same file not observed; be consistent per file

**Barrel Files:**
- Not used; imports are direct to component/utility files
- Example: `import EventCard from "./components/EventCard"` rather than `import { EventCard } from "./components/index"`
- Contexts use default export: `export default TypingProvider`

**Organization Within Files:**
- Imports at top
- Constants (VAPID_KEY, validators) after imports
- Component/function definition with JSDoc (if applicable)
- Internal helper functions defined inside or below main export
- Styles: inline `style` objects or imported CSS files (not CSS Modules)

---

*Convention analysis: 2026-03-10*
