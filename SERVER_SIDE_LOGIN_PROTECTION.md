# Server-Side Login Protection — What Changed & Why

This document explains, in plain language, how page/URL access control was
moved from **client-side only** (easy to bypass) to **server-side enforced**
(secure), and every file that was touched to make that happen.

---

## 1. The problem we started with

Before these changes, "you must log in to see `/management` or `/calendar`"
was enforced **only in the browser**, by a React component
(`RequireAuth.jsx`) that checked `sessionStorage` and redirected if empty.

That's not real security, because:

- Anyone could open the browser console and manually set the
  `sessionStorage` key, or just call the backend APIs directly
  (e.g. with `curl` or Postman) — the **API itself had zero authentication**.
  Every endpoint (`/api/workspace`, `/api/calendar`, `/api/meetings`,
  `/api/calls`) would happily return real data to anyone, logged in or not.
- Typing a protected URL directly (or refreshing the page) only worked
  correctly because a JavaScript component *happened* to run after the page
  loaded. Nothing on the server ever said "no".

**Goal:** the server (not just the browser) must be the one deciding "is
this person logged in?" — for both the pages *and* the data.

---

## 2. The solution, in one sentence

The server now issues a secure, `httpOnly` login cookie when an employee
signs in, and:
1. every protected **API route** requires that cookie, and
2. every protected **page URL** is checked for that cookie *before* the
   page is ever sent to the browser (in production, and — via a Vite dev
   plugin — in development too).

---

## 3. Backend changes (the real security)

### 3.1 `backend/mme_node_express_backend/package.json`
**What:** Added two new dependencies: `cookie-parser` and `jsonwebtoken`.
**Why:** Needed to read/write cookies (`cookie-parser`) and to create a
signed, tamper-proof session token (`jsonwebtoken`).

### 3.2 `backend/mme_node_express_backend/.env` and `.env.example`
**What:** Added a `JWT_SECRET` value.
**Why:** This is the secret key used to sign and verify the login token.
Without it, anyone could forge a fake "I'm logged in" cookie.

### 3.3 `backend/mme_node_express_backend/src/middleware/employeeAuth.js` *(new file)*
**What:** A new file with three small functions:
- `setEmployeeCookie(res, employee)` — creates a signed token for the
  employee and attaches it to the response as an `httpOnly` cookie named
  `mme_session` (expires after 8 hours).
- `requireEmployee(req, res, next)` — Express middleware. If the request
  has no valid `mme_session` cookie, it immediately replies
  `401 Login required.` and stops. Used to protect API routes.
- `isValidSession(req)` — a simple `true`/`false` check (used by the page
  redirect logic, since that needs a yes/no answer, not an error response).

**Why:** This is the single place that knows how to create and check a
login session. Every other file just calls into this one instead of
re-implementing cookie/token logic.

### 3.4 `backend/mme_node_express_backend/src/routes/employees.js`
**What:**
- `POST /identify` (the existing login endpoint) now calls
  `setEmployeeCookie(...)` right after a successful login, so the browser
  receives the session cookie automatically.
- Added `GET /me` — returns the currently logged-in employee based on the
  cookie (used by the dev-server guard, see §4.3).
- Added `POST /logout` — clears the cookie server-side.

**Why:** Login needs to *create* the server-side session, and logout needs
to *destroy* it. Previously "login" and "logout" only ever touched
`sessionStorage` in the browser — the server never knew who was logged in.

### 3.5 `backend/mme_node_express_backend/src/server.js`
**What:**
- Registered `cookie-parser` (`app.use(cookieParser())`) so every request
  can read its cookies.
- The routers for `/api/workspace`, `/api/calendar`, `/api/meetings`, and
  `/api/calls` now require `requireEmployee` before they run.
  (`/api/employees` and `/api/auth` stay open — you have to be able to
  reach the login endpoint itself before you're logged in!)
- Added a small middleware that runs right before the page is served: if
  the requested path starts with `/management` or `/calendar` **and**
  the request has no valid session, it responds with a
  `302 redirect to /login` — the actual HTML page is never sent.

**Why:** This is the two-part fix:
1. Protecting the API routes stops anyone from reading real data without
   logging in — regardless of what the browser UI does.
2. The page-redirect stops a protected URL from ever loading in the first
   place when opened directly or refreshed.

---

## 4. Frontend changes

### 4.1 `frontend/.../src/services/managementStorage.js`,
    `calendarStorage.js`, `callsStorage.js`, `meetingsStorage.js`
**What:** Every `fetch()` call now includes `credentials: "include"`.
**Why:** Cookies aren't sent automatically on cross-origin requests (the
React app runs on port `5173`/`5174`, the API on port `5000`) unless you
explicitly ask for it. Without this, the login cookie would never actually
reach the backend on later requests.

### 4.2 `managementStorage.js` — `clearCurrentEmployee()`
**What:** Now also calls `POST /employees/logout` in the background (in
addition to clearing `sessionStorage`).
**Why:** Logging out needs to clear the session on **both** sides — the
browser's local copy and the server's cookie — otherwise the old cookie
would still work even after "logging out".

### 4.3 `frontend/.../vite.config.js`
**What:** Added a small custom Vite plugin (`serverSideAuthGuard`) that
runs only while developing (`npm run dev`). For any full-page request to
`/management*` or `/calendar*`, it asks the backend
(`GET /api/employees/me`, forwarding the browser's cookie) "is this person
logged in?" and redirects to `/login` if not.
**Why:** In development, Vite serves the app directly — it never goes
through `server.js` at all — so the server.js redirect (§3.5) had no effect
when testing on `http://localhost:5173`. This plugin makes the dev server
behave the same way the production server does, using the backend as the
single source of truth (no duplicated logic).
> ⚠️ Restarting `vite dev` is required for this to take effect — Vite
> doesn't hot-reload this kind of plugin config.

### 4.4 `frontend/.../src/App.jsx` and `src/components/RequireAuth.jsx`
**What:** Removed the `RequireAuth` wrapper component from all routes, and
deleted the file entirely.
**Why:** Once the server enforces login on every real page load (§3.5,
§4.3), the client-side wrapper was redundant for that purpose — it was only
a UI convenience, not real protection.

### 4.5 `ManagementPage.jsx`, `CalendarPage.jsx`, `CalendarDayPage.jsx`,
    `ClientMeetingsPage.jsx`, `ClientCallsPage.jsx`
**What:** These pages each had their own leftover "if no employee, show a
login popup right here" logic (`EmployeeIdentityModal`, an "Identify"
button, etc.). All of that was removed. In its place, every one of these
pages now has the same simple rule:
```js
useEffect(() => {
  if (!employee) {
    navigate("/login", { replace: true });
  }
}, [employee, navigate]);
```
**Why:** This was needed to fix a real bug you hit: logging out from the
Calendar page and clicking the browser **Back** button landed you back on
`/management` — a pure in-app navigation that never touches the server —
and the leftover inline modal popped up *on top of* the `/management` URL
instead of sending you to the dedicated `/login` page. Now every page
consistently redirects to `/login` instead of showing its own login UI.
`EmployeeIdentityModal` is rendered from exactly one place now:
`LoginPage.jsx`.

---

## 5. Before vs. After

| | Before | After |
|---|---|---|
| API data (`/api/workspace`, `/api/calendar`, etc.) | Open to anyone, no login required | Requires a valid session cookie (`401` otherwise) |
| Typing a protected URL directly | Page loaded, then JS redirected you | Server redirects you to `/login` before the page is even sent |
| Dev server (`vite dev`, port 5173) | Not protected at all | Same server-backed check via a Vite plugin |
| Logging out | Only cleared browser storage | Clears browser storage **and** the server-side cookie |
| Login UI | Could pop up inline on almost any page | Only ever shown on the dedicated `/login` page |

---

## 6. Known limitation (by design)

Because this is a single-page app, React Router can navigate between
*already-loaded* pages purely on the client side (no network request at
all — e.g. clicking an in-app link). The server-side page guard can only
step in on a **real** page load (first visit, refresh, or typed URL). If a
session cookie expires while you're already sitting on a page, you won't be
kicked out until the next full reload or the next API call (which will
correctly fail with `401`). This is an inherent trade-off of SPA routing,
not a bug.
