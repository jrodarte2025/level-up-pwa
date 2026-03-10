# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Runner:**
- **Not configured.** No test framework (Jest, Vitest, etc.) installed or configured.
- No test files (`.test.js`, `.spec.js`) found in `src/` directory
- `package.json` has no testing scripts or test dependencies

**Assertion Library:**
- Not applicable; no testing framework in use

**Run Commands:**
```bash
# Currently: No test command available
# npm test                    # Not configured
# npm run test:watch         # Not configured
# npm run test:coverage      # Not configured
```

## Test File Organization

**Status:** Testing not implemented in this codebase.

**Recommended Pattern (when implemented):**
- Location: Co-located with source files (e.g., `EventCard.jsx` next to `EventCard.test.jsx`)
- Naming: `[FileName].test.jsx` or `[FileName].spec.jsx`
- Structure:
  ```
  src/
  ├── components/
  │   ├── EventCard.jsx
  │   ├── EventCard.test.jsx
  │   └── ...
  ├── utils/
  │   ├── eventUtils.js
  │   ├── eventUtils.test.js
  │   └── ...
  └── pages/
      ├── UserDashboard.jsx
      ├── UserDashboard.test.jsx
      └── ...
  ```

## Test Structure

**Recommended Framework:** Vitest (pairs well with Vite; faster than Jest)

**Suite Organization Pattern:**
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventCard from './EventCard';

describe('EventCard', () => {
  let mockEvent;

  beforeEach(() => {
    mockEvent = {
      id: '123',
      name: 'Test Event',
      date: { seconds: Date.now() / 1000 },
      location: 'Cincinnati, OH',
      timeRange: '10:00 AM - 11:00 AM',
      groups: ['students', 'coaches']
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render event name', () => {
      render(<EventCard event={mockEvent} />);
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onRSVP when RSVP button clicked', () => {
      const mockOnRSVP = jest.fn();
      render(<EventCard event={mockEvent} onRSVP={mockOnRSVP} />);

      const button = screen.getByRole('button', { name: /RSVP/i });
      fireEvent.click(button);

      expect(mockOnRSVP).toHaveBeenCalledWith('123');
    });
  });
});
```

**Patterns:**
- Setup: Use `beforeEach` for common mock data
- Cleanup: Use `afterEach` to clear mocks
- Assertion: Expect semantic queries (`screen.getByRole`, `screen.getByText`) over implementation details
- Organization: Group related tests in `describe` blocks

## Mocking

**Recommended Framework:** Vitest or Jest with `@testing-library/react`

**Patterns:**

**Firebase Mocking:**
```javascript
import { vi } from 'vitest';

// Mock Firebase module
vi.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-123', email: 'test@example.com' }
  },
  db: {},
  storage: {}
}));

// Mock Firestore operations
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({
    docs: [{ id: 'doc1', data: () => ({ name: 'Test' }) }]
  })),
  onSnapshot: vi.fn((ref, callback) => {
    callback({ docs: [] });
    return () => {}; // unsubscribe
  })
}));
```

**Component Mocking:**
```javascript
// Mock child components
vi.mock('../components/EventCard', () => ({
  default: ({ event, onRSVP }) => (
    <div data-testid="event-card-mock">
      {event.name}
      <button onClick={() => onRSVP(event.id)}>RSVP</button>
    </div>
  )
}));
```

**What to Mock:**
- Firebase operations (auth, Firestore reads/writes)
- External API calls
- Child components (in unit tests of parent)
- `window.localStorage`
- `window.matchMedia` (for theme/media queries)

**What NOT to Mock:**
- React components being tested
- MUI components (use `@testing-library/react` helpers)
- Theme/styling utilities (theme context should be real)
- Utility functions (test them directly unless they have external dependencies)

## Fixtures and Factories

**Test Data Pattern:**
```javascript
// fixtures/eventFixtures.js
export const createMockEvent = (overrides = {}) => ({
  id: '123',
  name: 'Test Event',
  description: 'Test Description',
  date: { seconds: Math.floor(Date.now() / 1000) },
  timeRange: '10:00 AM - 11:00 AM',
  location: 'Cincinnati, OH',
  headerImage: 'https://example.com/image.jpg',
  groups: ['students', 'coaches'],
  required: false,
  ...overrides
});

export const createMockUser = (overrides = {}) => ({
  uid: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'student',
  ...overrides
});
```

**Location:**
- Fixtures should live in `src/__tests__/fixtures/` or `tests/fixtures/`
- Factory functions prefixed with `createMock` for clarity
- One fixture file per domain (e.g., `eventFixtures.js`, `userFixtures.js`)

## Coverage

**Requirements:** Not enforced

**Current Status:** 0% — No tests exist

**Recommended Target:**
- Critical paths (auth, RSVP, Firebase operations): 80%+
- Utility functions: 100%
- UI components: 60%+ (focus on user interactions, not implementation)

**View Coverage:**
```bash
# When framework is configured:
npm run test:coverage
# or
vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and components
- Approach: Test in isolation with mocked dependencies
- Example: Testing `eventUtils.js` functions with different time range formats
  ```javascript
  describe('getTimeMinutes', () => {
    it('should parse "10:00 AM - 11:30 AM" correctly', () => {
      expect(getTimeMinutes("10:00 AM - 11:30 AM")).toBe(600);
    });
    it('should parse "2:00 PM - 3:00 PM" correctly', () => {
      expect(getTimeMinutes("2:00 PM - 3:00 PM")).toBe(840);
    });
  });
  ```

**Integration Tests:**
- Scope: Component behavior with real Firebase setup (or Firebase emulator)
- Approach: Test user workflows end-to-end at component level
- Example: Testing that clicking RSVP button updates user state and writes to Firestore
  ```javascript
  describe('UserDashboard RSVP flow', () => {
    it('should add event to rsvps when user clicks RSVP', async () => {
      render(<UserDashboard />);
      const rsvpButton = screen.getByRole('button', { name: /RSVP/i });

      fireEvent.click(rsvpButton);

      await waitFor(() => {
        expect(mockSetDoc).toHaveBeenCalled();
      });
    });
  });
  ```

**E2E Tests:**
- Framework: Not currently used (Cypress, Playwright, etc.)
- Recommended: Add Playwright or Cypress for critical user flows
- Scenarios: Login → RSVP for event → See it in dashboard → Share event link

## Common Patterns

**Async Testing:**
```javascript
// Pattern 1: Using async/await with waitFor
it('should load events on mount', async () => {
  render(<UserDashboard />);

  await waitFor(() => {
    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });
});

// Pattern 2: Return Promise directly
it('should handle network error', () => {
  vi.mocked(getDocs).mockRejectedValueOnce(new Error('Network error'));

  return expect(loadEvents()).rejects.toThrow('Network error');
});
```

**Error Testing:**
```javascript
it('should show error message on login failure', async () => {
  vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({
    code: 'auth/wrong-password',
    message: 'Wrong password'
  });

  render(<Login />);

  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'test@example.com' }
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'wrong' }
  });
  fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

  await waitFor(() => {
    expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
  });
});
```

**React Hook Testing:**
```javascript
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';

it('should return theme object', () => {
  const { result } = renderHook(() => useTheme());

  expect(result.current).toBeDefined();
  expect(result.current.palette).toBeDefined();
});
```

## Configuration (Recommended)

When testing framework is added, create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.test.js',
        '**/*.spec.js'
      ],
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60
    }
  }
});
```

---

*Testing analysis: 2026-03-10*
