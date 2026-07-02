# Firestore Write Contract — Level Up PWA (`level-up-pwa`)

**Repo:** `/Users/jimrodarte/Projects/level-up/level-up-pwa` (commit `d92d045`)
**Scope:** every client-side Firestore write and Storage upload in `src/`. This is the tripwire document: the native mobile app reads the same Firestore project (`level-up-app-c9f47`), so any change to a shape below is a cross-app breaking-change risk.

**Search method:** grepped for `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `batch.*`, `runTransaction`, `.set(`, `.update(`, `.add(`, `.delete(`, `arrayUnion`, `arrayRemove`, `increment(`, `deleteField`, `serverTimestamp`, `uploadBytes`, `uploadString`, `httpsCallable`, plus helper-wrapper tracing through `src/firebase.js`. No batch/transaction/arrayUnion/arrayRemove/increment writes exist in this codebase (the `writeBatch` import in `MatchMakingPanel.jsx:8` is dead — never called). No write helpers exist in `src/firebase.js` or `src/utils` (only `httpsCallable` is re-exported and it is never used; the one Cloud Function call is raw `fetch`).

## Summary Table

| Collection / path | Write sites | Files involved |
|---|---|---|
| `users/{uid}` | 12 | Signup.jsx, App.jsx, UserDashboard.jsx, Directory.jsx |
| `posts/{postId}` | 3 | CreateUpdate.jsx, ProfileModal.jsx, AdminPanel.jsx |
| `posts/{postId}/comments/{commentId}` | 5 | PostPage.jsx, CommentThreadPage.jsx |
| `posts/{postId}/reactions/{userId}` | 6 | Updates.jsx, PostPage.jsx |
| `posts/{postId}/comments/{commentId}/reactions/{userId}` | 6 | PostPage.jsx, CommentThreadPage.jsx |
| `matches/{autoId}` | 4 | MatchMakingPanel.jsx, AdminMatches.jsx |
| `rsvps/{userId}_{eventId}` | 7 | UserDashboard.jsx, EventLandingPage.jsx, AdminPanel.jsx |
| `events/{eventId}` | 3 | AdminPanel.jsx |
| `resources/{resourceId}` | 3 | AdminPanel.jsx |
| `notification_tokens/{uid}` | 2 | utils/notifications.js, utils/notificationTest.js |
| `typing/{postId}/users/{userId}` | 2 | contexts/TypingContext.jsx |
| **Firestore total** | **53** | 15 files |
| Storage uploads | 5 | CreateUpdate.jsx, AdminPanel.jsx, Signup.jsx, UserDashboard.jsx, App.jsx |
| Cloud Function (HTTP, server-side writes) | 1 | PasswordResetPanel.jsx |

Read-only collections in this app (no client writes, listed for completeness): `registrationCodes` (read in Signup.jsx:147-148, ApprovalsPanel.jsx:39), `admin_actions` (read in PasswordResetPanel.jsx:43; written server-side by the `adminResetPassword` function).

---

## users

Doc ID: Firebase Auth UID (except Directory admin edits, which use the listed doc id).

### 1. Signup — profile creation (full overwrite)
- **File:** `src/pages/Signup.jsx:133` — `setDoc(doc(db, "users", userCred.user.uid), profileData)` — **create, NO merge**
- **Fields (always):** `uid`, `email`, `displayName` (`"${firstName} ${lastName}"`), `firstName`, `lastName`, `role`, `registrationCodeVerified: true` (boolean), `isAdmin` (boolean, from `codeData.isAdmin === true`), `headshotUrl` (string, `""` if upload failed), `linkedinUrl`, `phoneNumber` (normalized via `normalizePhoneNumber`, or `""`), `registrationCodeUsed` (trimmed code string)
- **Conditional:** if `role === "student"` → `major`, `graduationYear`; if role in `["coach","board","employee"]` → `company`, `title`

### 2. App — headshot URL after profile image upload
- **File:** `src/pages/App.jsx:289` — `setDoc(userRef, { headshotUrl: url }, { merge: true })` — **merge update**
- **Fields:** `headshotUrl` (Storage download URL string)

### 3. App — ProfileModal save
- **File:** `src/pages/App.jsx:401-412` — `setDoc(userRef, {...}, { merge: true })` — **merge update**
- **Fields (always):** `firstName`, `lastName`, `displayName` (`"${firstName} ${lastName}"`), `linkedinUrl`, `phoneNumber`
- **Conditional:** student → `major`, `graduationYear`; coach/board/employee → `company`, `title` (note: state var is `jobTitle` but the field written is `title`)

### 4. UserDashboard — inline profile save
- **File:** `src/pages/UserDashboard.jsx:744-755` — `setDoc(userRef, {...}, { merge: true })` — **merge update**
- **Fields (always):** `firstName`, `lastName`, `displayName` (`"${firstName} ${lastName}"`)
- **Conditional:** `userRole === "student"` → `major`, `graduationYear`; **else** → `company`, `title` (note: any non-student role gets company/title here, unlike App.jsx)

### 5–8. Directory — admin user edit block A (desktop layout)
- **`src/pages/Directory.jsx:815`** — `setDoc(userRef, dataToSave, { merge: true })` — **merge update** of `users/{selectedUser.id}`
  - **Fields (full editForm spread):** `firstName`, `lastName`, `email`, `phoneNumber` (normalized or `""`), `title`, `company`, `major`, `graduationYear`, `linkedinUrl`, `boardRole`, `role`, `alumni` (boolean). All 12 fields written every save (empty-string defaults), regardless of role.
- **`src/pages/Directory.jsx:835`** — `deleteDoc(doc(db, "users", selectedUser.id))` — **delete** (admin delete user)
- **`src/pages/Directory.jsx:871`** — `setDoc(userRef, { isAdmin: true }, { merge: true })` — **merge update**
- **`src/pages/Directory.jsx:894`** — `setDoc(userRef, { isAdmin: false }, { merge: true })` — **merge update**

### 9–12. Directory — admin user edit block B (duplicate mobile layout, identical shapes)
- **`src/pages/Directory.jsx:1334`** — `setDoc(userRef, dataToSave, { merge: true })` — same 12-field editForm shape as line 815
- **`src/pages/Directory.jsx:1348`** — `deleteDoc(doc(db, "users", selectedUser.id))` — **delete**
- **`src/pages/Directory.jsx:1378`** — `setDoc(userRef, { isAdmin: true }, { merge: true })`
- **`src/pages/Directory.jsx:1397`** — `setDoc(userRef, { isAdmin: false }, { merge: true })`

---

## posts

Doc ID: auto-ID (`doc(collection(db, "posts"))` pre-generated) for new posts; existing ID when editing.

### 1. CreateUpdate — create/edit post (full overwrite, used by both Updates feed and AdminPanel)
- **File:** `src/components/CreateUpdate.jsx:78-89` — `setDoc(postRef, {...})` — **create or full overwrite on edit (NO merge — editing rewrites the whole doc)**
- **Fields:** `title`, `body` (rich-text HTML string), `type` (post type, default `"announcement"`), `link` (string, `""` default), `imageUrl` (Storage URL or `""`), `visibleTo` (**array** of `"student"`/`"coach"`/`"board"`), `uid` (author UID), `displayName`, `headshotUrl` (string, `""` default), `timestamp: serverTimestamp()` ⚠️
- ⚠️ Tripwire: AdminPanel's post list reads `p.roles` (AdminPanel.jsx:2559) but this write uses `visibleTo` — the visibility field of record is `visibleTo`.

### 2. ProfileModal — headshot fan-out to all of a user's posts
- **File:** `src/components/ProfileModal.jsx:561` — `updateDoc(doc.ref, { headshotUrl: url })` — **update**, looped over every doc from `query(collection(db,"posts"), where("userId","==",user.uid))`
- **Fields:** `headshotUrl` (Storage download URL)
- ⚠️ Tripwire: the query filters on `userId`, but CreateUpdate writes the author field as `uid` — this fan-out only matches posts that have a `userId` field (legacy/mobile-written posts).

### 3. AdminPanel — delete post
- **File:** `src/pages/AdminPanel.jsx:2571` — `deleteDoc(doc(db, "posts", p.id))` — **delete** (no cascade; comments/reactions subcollections are orphaned)

---

## posts/{postId}/comments

Doc ID: auto-ID.

### 1. PostPage — add comment/reply
- **File:** `src/pages/PostPage.jsx:284` (data built 270-282) — `addDoc(commentRef, commentData)` — **create**
- **Fields:** `userId` (`user?.uid || user?.email` ⚠️ can be an email string), `displayName`, `text`, `timestamp: serverTimestamp()` ⚠️, `parentCommentId` (comment ID string or **`null`** for top-level), `replyToUser` (string or `null`), `replyToText` (first 50 chars + `"..."`, or `null`), `headshotUrl` (string, `""` default)

### 2. PostPage — delete comment
- **File:** `src/pages/PostPage.jsx:333` — `deleteDoc(doc(db, "posts", postId, "comments", c.id))` — **delete** (reactions subcollection orphaned; replies keep dangling `parentCommentId`)

### 3. PostPage — edit comment text
- **File:** `src/pages/PostPage.jsx:350` — `setDoc(ref, { text: editedCommentText }, { merge: true })` — **merge update**; fields: `text` only

### 4. CommentThreadPage — edit parent comment text
- **File:** `src/pages/CommentThreadPage.jsx:100` — `setDoc(doc(db,"posts",postId,"comments",parentComment.id), { text: editedCommentText }, { merge: true })` — **merge update**; fields: `text` only

### 5. CommentThreadPage — edit reply text
- **File:** `src/pages/CommentThreadPage.jsx:134` — same shape as above, doc `reply.id` — **merge update**; fields: `text` only

---

## posts/{postId}/reactions (post-level reactions)

Doc ID: **the reacting user's ID** (`user?.uid || user?.email` ⚠️) — one reaction per user per post.

### 1–2. Updates feed — legacy heart toggle
- **File:** `src/pages/Updates.jsx:115` — `deleteDoc(reactionRef)` — **delete** (un-like)
- **File:** `src/pages/Updates.jsx:117-121` — `setDoc(reactionRef, {...})` — **create (full overwrite)**
- **Fields:** `emoji: "❤️"` (hardcoded), `userId`, `timestamp: serverTimestamp()` ⚠️ — note: **no `emojiKey`** on this path

### 3–4. Updates feed — emoji reaction toggle
- **File:** `src/pages/Updates.jsx:139` — `deleteDoc(reactionRef)` — **delete** (same emoji tapped again)
- **File:** `src/pages/Updates.jsx:142-147` — `setDoc(reactionRef, {...})` — **create/replace**
- **Fields:** `emoji` (emoji char), `emojiKey` (e.g. `"thumbs_up"`, `"heart"`, `"laughing"`, `"wow"`, `"sad"`, `"fire"`, `"clap"`, `"celebration"`), `userId`, `timestamp: serverTimestamp()` ⚠️

### 5–6. PostPage — post emoji reaction toggle
- **File:** `src/pages/PostPage.jsx:160` — `deleteDoc(reactionRef)` — **delete**
- **File:** `src/pages/PostPage.jsx:163-168` — `setDoc(reactionRef, {...})` — **create/replace**
- **Fields:** `emoji`, `emojiKey`, `userId`, `timestamp: serverTimestamp()` ⚠️

---

## posts/{postId}/comments/{commentId}/reactions (comment-level reactions)

Doc ID: reacting user's ID (`user.uid || user.email` ⚠️).

### 1–2. PostPage — legacy heart toggle on comment
- **File:** `src/pages/PostPage.jsx:112` — `deleteDoc(reactionRef)` — **delete**
- **File:** `src/pages/PostPage.jsx:119-123` — `setDoc(reactionRef, {...})` — **create**
- **Fields:** `emoji: "❤️"` (hardcoded), `userId`, `timestamp: serverTimestamp()` ⚠️ (no `emojiKey`)

### 3–4. PostPage — emoji reaction toggle on comment
- **File:** `src/pages/PostPage.jsx:140` — `deleteDoc(reactionRef)` — **delete**
- **File:** `src/pages/PostPage.jsx:143-148` — `setDoc(reactionRef, {...})` — **create/replace**
- **Fields:** `emoji`, `emojiKey`, `userId`, `timestamp: serverTimestamp()` ⚠️

### 5–6. CommentThreadPage — heart toggle in thread view
- **File:** `src/pages/CommentThreadPage.jsx:27` — `deleteDoc(reactionRef)` — **delete**
- **File:** `src/pages/CommentThreadPage.jsx:29-33` — `setDoc(reactionRef, {...})` — **create**
- **Fields:** `emoji: "❤️"` (hardcoded), `userId`, `timestamp: serverTimestamp()` ⚠️ (no `emojiKey`)

---

## matches

Doc ID: auto-ID. Minimal two-field contract — mobile app must not assume any other fields exist.

### 1. MatchMakingPanel — create pair
- **File:** `src/components/MatchMakingPanel.jsx:131-134` — `addDoc(collection(db, "matches"), {...})` — **create**
- **Fields:** `coachId` (users doc ID), `studentId` (users doc ID) — nothing else, no timestamp

### 2. MatchMakingPanel — unpair
- **File:** `src/components/MatchMakingPanel.jsx:150` — `deleteDoc(doc(db, "matches", matchId))` — **delete**

### 3. AdminMatches — create pair (legacy page, identical shape)
- **File:** `src/pages/AdminMatches.jsx:52-55` — `addDoc` — **create**; fields: `coachId`, `studentId`

### 4. AdminMatches — delete pair
- **File:** `src/pages/AdminMatches.jsx:63` — `deleteDoc(doc(db, "matches", matchId))` — **delete**

---

## rsvps

Doc ID convention: **`${userId}_${eventId}`** (deterministic composite key) in all write paths. ⚠️ Two different cancel semantics exist: UserDashboard **deletes** the doc; EventLandingPage **overwrites with `attending: false`**. ⚠️ Two different timestamp types: `serverTimestamp()` (UserDashboard) vs `Timestamp.now()` client time (EventLandingPage, AdminPanel).

### 1. UserDashboard — cancel RSVP
- **File:** `src/pages/UserDashboard.jsx:261` — `deleteDoc(rsvpDocRef)` — **delete**

### 2. UserDashboard — RSVP (no guests)
- **File:** `src/pages/UserDashboard.jsx:270-276` — `setDoc(rsvpDocRef, {...})` — **create (full overwrite)**
- **Fields:** `userId`, `eventId`, `attending: true`, `guestCount: 0`, `rsvpTimestamp: serverTimestamp()` ⚠️

### 3. UserDashboard — RSVP with guests (via GuestCountModal)
- **File:** `src/pages/UserDashboard.jsx:287-293` — `setDoc(rsvpDocRef, {...})` — **create (full overwrite)**
- **Fields:** `userId`, `eventId`, `attending: true`, `guestCount` (number from modal), `rsvpTimestamp: serverTimestamp()` ⚠️

### 4. EventLandingPage — RSVP (denormalized shape ⚠️ superset of the others)
- **File:** `src/pages/EventLandingPage.jsx:188-197` — `setDoc(rsvpRef, {...})` — **create (full overwrite)**
- **Fields:** `userId`, `eventId`, `attending: true`, `guestCount` (number), `rsvpTimestamp: Timestamp.now()` ⚠️ client time, **plus denormalized user data:** `userName` (`user.fullName || user.email`), `userAvatar` (`user.profileImage || user.headshotUrl || null` — can be **`null`**)

### 5. EventLandingPage — cancel RSVP (overwrite, not delete)
- **File:** `src/pages/EventLandingPage.jsx:241-247` — `setDoc(rsvpRef, {...})` — **full overwrite**
- **Fields:** `userId`, `eventId`, `attending: false`, `guestCount: 0`, `rsvpTimestamp: Timestamp.now()` ⚠️ — note: `userName`/`userAvatar` are **dropped** on cancel

### 6. AdminPanel — remove attendee
- **File:** `src/pages/AdminPanel.jsx:1855` — `deleteDoc(doc(db, "rsvps", u.rsvpDocId))` — **delete**

### 7. AdminPanel — admin-added RSVP
- **File:** `src/pages/AdminPanel.jsx:2030-2036` — `setDoc(doc(db, "rsvps", \`${userId}_${rsvpEvent.id}\`), {...})` — **create (full overwrite)**
- **Fields:** `userId`, `eventId`, `attending: true`, `guestCount: 0`, `rsvpTimestamp: Timestamp.now()` ⚠️ (no denormalized user fields)

---

## events

Doc ID: auto-ID. All writes in AdminPanel only.

### 1. AdminPanel — delete event
- **File:** `src/pages/AdminPanel.jsx:351` — `deleteDoc(doc(db, "events", eventId))` — **delete** (RSVPs for the event are orphaned)

### 2. AdminPanel — edit event
- **File:** `src/pages/AdminPanel.jsx:471-485` — `updateDoc(doc(db, "events", editingId), {...})` — **update**
- **Fields:** `name`, `date` (`Timestamp.fromDate(...)` ⚠️ Firestore Timestamp at local midnight), `timeRange` (string `"h:mm AM – h:mm PM"` — contains an **en-dash `–`** ⚠️), `location`, `description` (HTML string), `groups` (**array**: `["students","coaches"]` when "both", else `[singleGroup]`), `required` (boolean), `allowGuests` (boolean), `headerImage` (`headerImageUrl || existingHeaderImage || ""`), `slug` (string or `""`), `additionalRegistrationUrl` (`""` default), `additionalRegistrationText` (`""` default), `status` (`"draft"` default / `"published"`)
- Note: `createdBy` is NOT rewritten on edit.

### 3. AdminPanel — create event
- **File:** `src/pages/AdminPanel.jsx:488-503` — `addDoc(collection(db, "events"), {...})` — **create**
- **Fields:** same 13 fields as edit **plus** `createdBy` (`auth.currentUser?.email || "unknown"`); `headerImage` is `headerImageUrl` (may be `""`)

---

## resources

Doc ID: auto-ID. All writes in AdminPanel only.

### 1. AdminPanel — edit resource
- **File:** `src/pages/AdminPanel.jsx:166` (object built 148-156) — `updateDoc(doc(db, "resources", editingResourceId), newResource)` — **update**
- **Fields:** `title`, `section`, `role` (**array** of audience roles — validated non-empty), `type`, `url`, `description`, `timestamp: Timestamp.now()` ⚠️ client time, overwritten on every edit

### 2. AdminPanel — add resource
- **File:** `src/pages/AdminPanel.jsx:175` — `addDoc(collection(db, "resources"), newResource)` — **create**; same 7-field shape

### 3. AdminPanel — delete resource
- **File:** `src/pages/AdminPanel.jsx:2360` — `deleteDoc(doc(db, "resources", r.id))` — **delete**

---

## notification_tokens

Doc ID: Firebase Auth UID. One FCM web-push token per user.

### 1. notifications.js — save token on registration
- **File:** `src/utils/notifications.js:115` — `setDoc(tokenRef, { token }, { merge: true })` — **merge update**
- **Fields:** `token` (FCM token string). ⚠️ Merge preserves any other fields the mobile app stores on this doc.

### 2. notificationTest.js — diagnostic save
- **File:** `src/utils/notificationTest.js:123-125` — `setDoc(doc(db, 'notification_tokens', auth.currentUser.uid), { token: results.token })` — **⚠️ full overwrite, NO merge** — would wipe any extra fields (e.g. platform/device fields written by mobile). Only runs when the doc doesn't already exist (guarded by a `getDoc` exists check at :118), which softens but doesn't remove the risk.

---

## typing (presence)

Path: `typing/{postId}/users/{userId}`. Ephemeral typing indicators for post comment threads.

### 1. TypingContext — start typing
- **File:** `src/contexts/TypingContext.jsx:70-74` — `setDoc(doc(db, 'typing', postId, 'users', userId), {...})` — **create (full overwrite)**
- **Fields:** `displayName` (`auth.currentUser.displayName || email || 'Anonymous User'`), `timestamp: serverTimestamp()` ⚠️, `userId`

### 2. TypingContext — stop typing
- **File:** `src/contexts/TypingContext.jsx:96` — `deleteDoc(doc(db, 'typing', postId, 'users', userId))` — **delete** (auto after 3s inactivity; no cleanup if the tab dies mid-typing)

---

## Firebase Storage uploads (separate contract)

| # | File:Line | Storage path | Payload | Downstream Firestore field |
|---|---|---|---|---|
| 1 | `src/components/CreateUpdate.jsx:65-66` | `posts/{postRef.id}/image.jpg` | raw selected image (no resize) | `posts.imageUrl` |
| 2 | `src/pages/AdminPanel.jsx:461-462` | `headers/{Date.now()}-{originalFilename}` | resized JPEG (800px, q0.8) | `events.headerImage` |
| 3 | `src/pages/Signup.jsx:101-102` | `users/{uid}/profile.jpg` | raw headshot file | `users.headshotUrl` |
| 4 | `src/pages/UserDashboard.jsx:657-658` | `users/{uid}/profile.jpg` | raw file ⚠️ **no Firestore update** — only local state; `users.headshotUrl` goes stale-but-same-URL | (none) |
| 5 | `src/pages/App.jsx:282-283` | `users/{uid}/profile.jpg` | cropped/resized file (via ProfileModal → CropModal) | `users.headshotUrl` (App.jsx:289) + fan-out to `posts.headshotUrl` (ProfileModal.jsx:561) |

Canonical profile image path: `users/{uid}/profile.jpg` — overwritten in place, so the download URL stays stable across re-uploads. Unused import: `uploadBytes` in `src/pages/Updates.jsx:11` (never called).

---

## Cloud Function calls that cause server-side writes

- **`src/components/PasswordResetPanel.jsx:86`** — raw `fetch` POST to `https://us-central1-level-up-app-c9f47.cloudfunctions.net/adminResetPassword` with Bearer ID token; body: `{ userEmail, newPassword?, generateResetLink }`. The function (owned by the mobile repo per this repo's CLAUDE.md) performs Auth password changes and logs to `admin_actions` — the panel reads `admin_actions` at line 43 but the PWA never writes it directly.

---

## Cross-cutting tripwires for the mobile app

1. **`userId` may be an email, not a UID** — every reaction/comment path uses `user?.uid || user?.email` for both doc IDs and the `userId` field.
2. **Mixed timestamp types** — `serverTimestamp()` (posts, comments, reactions, typing, UserDashboard rsvps) vs client `Timestamp.now()` (EventLandingPage/AdminPanel rsvps, resources) vs `Timestamp.fromDate()` (events.date).
3. **RSVP cancel is inconsistent** — delete (UserDashboard) vs `attending:false` overwrite (EventLandingPage). Mobile must treat both "missing doc" and `attending:false` as not attending.
4. **RSVP doc shape varies by writer** — only EventLandingPage writes `userName`/`userAvatar` (and drops them on cancel); `userAvatar` can be `null`.
5. **Post edit is a full `setDoc` overwrite** (CreateUpdate) — any extra fields the mobile app adds to a post doc are destroyed when an admin edits it in the PWA. Same for reaction docs, rsvps, and typing docs (all no-merge `setDoc`).
6. **`notificationTest.js:123` writes `{token}` without merge** — clobbers extra token-doc fields if it ever runs against an existing doc state race.
7. **Author field split:** posts written by PWA use `uid`; ProfileModal's headshot fan-out queries `userId`. Reads/writes keying on one or the other will miss the PWA's docs.
8. **No cascading deletes** — deleting posts, events, or users orphans comments/reactions, rsvps, matches, and typing docs.
9. **`events.timeRange` embeds an en-dash (`–`)** and both PWA parsers regex-split on `[-–—]`; mobile parsing must tolerate all three dash types.
10. **Directory admin save writes all 12 profile fields unconditionally** (empty strings for the irrelevant role's fields), so students can end up with empty `company`/`title` fields and vice versa.
