# Make My Event — Android Mobile App Implementation Handbook

> **Project:** Make My Event Office Management System  
> **Mobile target:** Android  
> **Mobile framework:** React Native + Expo(SDK version 54) 
> **Language:** JavaScript only (`.js` / `.jsx`)  
> **Existing backend:** Node.js + Express  
> **Existing ORM:** Prisma  
> **Existing database:** MySQL/MariaDB  
> **Existing hosting:** cPanel / Passenger  
> **Architecture rule:** The Android app is a second client of the same backend and same database.  
> **Document purpose:** This is the implementation plan that should be followed chunk-by-chunk from project setup through APK distribution.

---

# 0. Read This First

The mobile app is **not a new independent system**.

You already have the important business system:

- employees
- authentication
- clients
- dynamic management sheet
- calls
- next calls
- meetings
- next meetings
- meeting requirements/items
- meeting images
- final image selections
- calendar
- admin functionality
- Prisma
- MySQL/MariaDB
- uploaded files
- cPanel deployment

The Android app should reuse those existing capabilities through HTTPS APIs.

The final system should look like this:

```text
                         MAKE MY EVENT PLATFORM

             ┌──────────────────────────────────────┐
             │                                      │
             │          Existing cPanel Server      │
             │                                      │
             │  Express API + Prisma + Uploads      │
             │                  │                   │
             │                  ▼                   │
             │           MySQL / MariaDB            │
             │                                      │
             └─────────────▲────────────▲───────────┘
                           │            │
                    HTTPS API      HTTPS API
                           │            │
               ┌───────────┘            └───────────┐
               │                                    │
               ▼                                    ▼

        Existing React Web App              New Android App
        React + Vite                        React Native + Expo
        Desktop management                  Employee daily workflow
        Cookie authentication               Bearer-token authentication
```

## Most important rule

Never connect the Android app directly to MySQL.

Wrong:

```text
Android App
    ↓
MySQL
```

Correct:

```text
Android App
    ↓ HTTPS
Express API
    ↓
Prisma
    ↓
MySQL
```

The mobile app must never contain:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- cPanel passwords
- database credentials
- private backend secrets

---

# 1. Current Existing Project Snapshot

The uploaded project currently has this main structure:

```text
Make-My-Event-Office-Management-System-main/
│
├── .github/
│   └── workflows/
│
├── backend/
│   └── mme_node_express_backend/
│       ├── database/
│       ├── prisma/
│       ├── scripts/
│       ├── src/
│       │   ├── config/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── utils/
│       │   └── server.js
│       ├── uploads/
│       ├── package.json
│       └── ...
│
├── frontend/
│   └── make my event office management system/
│       ├── src/
│       │   ├── components/
│       │   ├── data/
│       │   ├── pages/
│       │   ├── services/
│       │   └── utils/
│       ├── package.json
│       └── ...
│
└── README.md
```

Add the mobile project at the repository root:

```text
Make-My-Event-Office-Management-System-main/
│
├── backend/
├── frontend/
├── mobile/                    ← NEW
├── .github/
└── README.md
```

Do **not** put the mobile source inside the backend.

Do **not** put the mobile source inside the web frontend.

Keep all three applications logically separate:

```text
frontend = web client
mobile   = Android client
backend  = shared server
```

---

# 2. Do You Host the `mobile/` Folder on cPanel?

## No.

The source directory:

```text
mobile/
```

does **not** need to be uploaded to cPanel for the Android app to work.

The mobile source is compiled into an Android binary.

Development/build flow:

```text
mobile/ source
     ↓
Expo / EAS Build
     ↓
APK or AAB
     ↓
Installed on Android
```

Runtime flow:

```text
Installed Android App
     ↓ HTTPS
Existing cPanel API
     ↓
Existing Express server
     ↓
Prisma
     ↓
Existing database
```

## What remains on cPanel

Your cPanel environment should continue containing the production parts that the phone needs to reach over the internet:

```text
Express backend
Prisma generated client
Node dependencies
production environment variables
React web production files
uploads/
MySQL/MariaDB database
```

## What remains local/GitHub

```text
mobile/
```

Your mobile source should normally live:

- on your development PC
- in your Git repository

## What employees receive

They receive:

```text
MakeMyEvent.apk
```

or later the app through Google Play.

---

# 3. Recommended JavaScript Mobile Technology Stack

Use the following stack.

| Requirement | Technology |
|---|---|
| Mobile UI | React Native |
| Mobile framework/tooling | Expo |
| Language | JavaScript |
| Screen routing | Expo Router |
| API requests | Native `fetch()` |
| Server-state/cache | TanStack Query |
| Auth app-state | React Context |
| JWT storage | Expo SecureStore |
| Forms | React Hook Form |
| Gallery/camera selection | Expo ImagePicker |
| Remote image display | Expo Image |
| Date/time | `@react-native-community/datetimepicker` |
| Network awareness | `@react-native-community/netinfo` |
| Icons | `@expo/vector-icons` |
| Android phone call links | React Native `Linking` |
| APK/AAB build | EAS Build |
| Push notifications later | Expo Notifications |
| Backend | Existing Express |
| ORM | Existing Prisma |
| Database | Existing MySQL/MariaDB |

## Do not add these initially unless a real need appears

Do not complicate V1 with:

- Redux
- Redux Toolkit
- MobX
- GraphQL
- Apollo
- Firebase database
- Supabase database
- Realm
- SQLite synchronization
- a second backend
- a second database
- a separate mobile user table

The existing REST backend should remain the source of truth.

---

# 4. Responsibilities of Each Layer

## Mobile app responsibilities

The Android app should:

- render screens
- collect user input
- validate basic UI input
- store the authentication token securely
- call backend APIs
- display server data
- show loading/error/empty states
- allow camera/gallery image selection
- upload images
- refresh cached data after changes
- open the phone dialer
- show the employee's calendar
- later receive push notifications

## Backend responsibilities

The backend must remain responsible for:

- checking login credentials
- identifying the authenticated employee
- authorization
- database validation
- business rules
- meeting/call assignment rules
- timestamps
- database writes
- image storage
- checking ownership
- audit values such as `createdById`
- data integrity
- finalization rules
- deleting related records safely

## Database responsibilities

The existing database remains the single source of truth for:

- employees
- roles
- clients
- management-sheet data
- calls
- next calls
- meetings
- next meetings
- items
- images
- finalizations
- calendar events

---

# 5. Mobile V1 Scope

Do not reproduce the desktop site screen-for-screen.

The website is suitable for large spreadsheet-style administration.

The phone should focus on daily employee operations.

## Mobile V1 — build these

### Authentication

- employee login
- restore login on app launch
- mandatory password change
- logout

### Dashboard

- today's calls
- today's meetings
- overdue calls
- upcoming calls
- upcoming meetings
- next activities

### Clients

- client list
- search
- basic filtering
- client details
- phone number
- venue
- event date
- shift
- guest count
- quick actions

### Calls

- call history
- create a call
- update call discussion
- schedule next call
- assign next call to an employee
- delete call when allowed

### Meetings

- meeting history
- create meeting
- update next meeting
- assign next meeting
- mark meeting complete
- requirements/items
- quantities
- custom "Other" items
- meeting images
- requirement-item images
- final image selections
- finalization

### Calendar

- month view
- day view
- calls
- meetings
- next calls
- next meetings
- manual events

### Follow-ups

- assigned next calls
- assigned next meetings
- overdue follow-ups
- today's follow-ups
- upcoming follow-ups

### Profile

- employee name
- email
- change password
- logout
- app version

## Leave these for later unless employees truly require them

- Excel import
- Excel export
- dynamic column management
- full desktop spreadsheet editor
- admin portal
- employee account administration
- complex bulk edits
- full offline synchronization
- advanced reporting
- push notifications
- Play Store distribution
- EAS Update
- biometric login

---

# 6. Mobile UX Must Not Copy the Desktop Spreadsheet

The desktop management page is a large dynamic sheet.

Do not squeeze that into a phone.

## Desktop representation

```text
Client | Phone | Venue | Shift | Guests | Event Date | Last Call | Next Call | ...
```

## Mobile representation

Use a card:

```text
┌──────────────────────────────────────┐
│ Rahim Ahmed                          │
│ Wedding                              │
│ Bashundhara Convention Hall         │
│                                      │
│ Event: 22 Aug 2026                   │
│ Guests: 500                          │
│ Phone: 017XXXXXXXX                   │
│                                      │
│ Next Call: Today, 5:30 PM            │
│ Next Meeting: 18 Aug, 3:00 PM        │
│                                      │
│ [Open Client]                        │
└──────────────────────────────────────┘
```

Then the client detail screen becomes the central mobile workflow.

---

# 7. Target Repository Structure

Use this structure:

```text
Make-My-Event-Office-Management-System-main/
│
├── backend/
│   └── mme_node_express_backend/
│
├── frontend/
│   └── make my event office management system/
│
├── mobile/
│   │
│   ├── app/
│   │   │
│   │   ├── _layout.jsx
│   │   ├── index.jsx
│   │   │
│   │   ├── (auth)/
│   │   │   ├── _layout.jsx
│   │   │   ├── login.jsx
│   │   │   └── change-password.jsx
│   │   │
│   │   └── (app)/
│   │       │
│   │       ├── _layout.jsx
│   │       │
│   │       ├── (tabs)/
│   │       │   ├── _layout.jsx
│   │       │   ├── index.jsx
│   │       │   ├── clients.jsx
│   │       │   ├── calendar.jsx
│   │       │   ├── follow-ups.jsx
│   │       │   └── profile.jsx
│   │       │
│   │       ├── clients/
│   │       │   └── [rowKey]/
│   │       │       ├── index.jsx
│   │       │       ├── edit.jsx
│   │       │       │
│   │       │       ├── calls/
│   │       │       │   ├── index.jsx
│   │       │       │   ├── create.jsx
│   │       │       │   └── [callId].jsx
│   │       │       │
│   │       │       └── meetings/
│   │       │           ├── index.jsx
│   │       │           ├── create.jsx
│   │       │           └── [meetingId].jsx
│   │       │
│   │       └── calendar/
│   │           └── [date].jsx
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppButton.jsx
│   │   │   ├── AppInput.jsx
│   │   │   ├── AppHeader.jsx
│   │   │   ├── AppCard.jsx
│   │   │   ├── ScreenContainer.jsx
│   │   │   ├── LoadingScreen.jsx
│   │   │   ├── ErrorState.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── ConfirmModal.jsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── SummaryCard.jsx
│   │   │   └── ActivityCard.jsx
│   │   │
│   │   ├── clients/
│   │   │   ├── ClientCard.jsx
│   │   │   ├── ClientHeader.jsx
│   │   │   └── ClientInfoSection.jsx
│   │   │
│   │   ├── calls/
│   │   │   ├── CallCard.jsx
│   │   │   ├── CallForm.jsx
│   │   │   └── NextCallSection.jsx
│   │   │
│   │   ├── meetings/
│   │   │   ├── MeetingCard.jsx
│   │   │   ├── MeetingForm.jsx
│   │   │   ├── MeetingItemCard.jsx
│   │   │   ├── MeetingImageGrid.jsx
│   │   │   └── ImagePickerSheet.jsx
│   │   │
│   │   └── calendar/
│   │       ├── CalendarEventCard.jsx
│   │       └── DaySchedule.jsx
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.js
│   │   │   ├── authApi.js
│   │   │   ├── dashboardApi.js
│   │   │   ├── clientsApi.js
│   │   │   ├── callsApi.js
│   │   │   ├── meetingsApi.js
│   │   │   ├── calendarApi.js
│   │   │   ├── employeesApi.js
│   │   │   └── uploadsApi.js
│   │   │
│   │   └── storage/
│   │       ├── authStorage.js
│   │       └── preferencesStorage.js
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useDashboard.js
│   │   ├── useClients.js
│   │   ├── useClient.js
│   │   ├── useCalls.js
│   │   ├── useMeetings.js
│   │   └── useCalendar.js
│   │
│   ├── context/
│   │   └── AuthContext.jsx
│   │
│   ├── providers/
│   │   └── QueryProvider.jsx
│   │
│   ├── constants/
│   │   ├── colors.js
│   │   ├── config.js
│   │   ├── queryKeys.js
│   │   └── meetingItems.js
│   │
│   ├── utils/
│   │   ├── dates.js
│   │   ├── clients.js
│   │   ├── formatters.js
│   │   ├── validation.js
│   │   ├── permissions.js
│   │   └── errors.js
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   │
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── app.json
│   ├── eas.json
│   ├── jsconfig.json
│   ├── package.json
│   └── package-lock.json
│
└── README.md
```

---

# 8. Existing API Endpoints You Already Have

The current backend mounts these employee modules:

```text
/api/employees
/api/workspace
/api/calendar
/api/meetings
/api/calls
```

Current key employee routes include:

## Employee

```text
GET  /api/employees
POST /api/employees/identify
GET  /api/employees/me
POST /api/employees/logout
POST /api/employees/change-password
```

## Workspace

```text
GET /api/workspace/default
PUT /api/workspace/default
```

## Calls

```text
GET    /api/calls/:rowKey
POST   /api/calls/:rowKey
PUT    /api/calls/:rowKey/:callId
DELETE /api/calls/:rowKey/:callId
```

## Meetings

```text
GET    /api/meetings/:rowKey
POST   /api/meetings/:rowKey
PUT    /api/meetings/:rowKey/:meetingId
PATCH  /api/meetings/:rowKey/:meetingId/complete
DELETE /api/meetings/:rowKey/:meetingId
```

Meeting image routes:

```text
POST   /api/meetings/:rowKey/:meetingId/images
DELETE /api/meetings/:rowKey/:meetingId/images/:imageId

PATCH  /api/meetings/:rowKey/images/:imageId/tag
PATCH  /api/meetings/:rowKey/images/:imageId/final

POST   /api/meetings/:rowKey/finalize
```

Meeting item routes:

```text
POST   /api/meetings/:rowKey/:meetingId/items
PUT    /api/meetings/:rowKey/:meetingId/items/:itemId
DELETE /api/meetings/:rowKey/:meetingId/items/:itemId

POST   /api/meetings/:rowKey/:meetingId/items/:itemId/images
DELETE /api/meetings/:rowKey/:meetingId/items/:itemId/images/:imageId
```

## Calendar

```text
GET    /api/calendar?year=YYYY&month=M
POST   /api/calendar/events
PUT    /api/calendar/events/:id
DELETE /api/calendar/events/:id
```

## Upload URLs

Current meeting files are stored under:

```text
/uploads/meeting-images/
```

and Express exposes:

```text
/uploads
```

as a static public path.

The mobile app should build full image URLs from the server origin:

```text
https://YOUR_DOMAIN.com/uploads/meeting-images/filename.jpg
```

---

# 9. Backend Changes Required Before Building Most Mobile Features

This is **Chunk 1** of the work and should be completed before the mobile feature screens.

Your current web authentication is cookie-based.

That is correct for the web app.

For the native app, use:

```text
Authorization: Bearer <JWT>
```

## Keep both methods

Final backend behavior:

```text
Web browser
    ↓
mme_session cookie
    ↓
requireEmployee


Android app
    ↓
Authorization: Bearer JWT
    ↓
requireEmployee
```

The same `requireEmployee` middleware should understand both.

---

# 10. Backend Security Fix A — Never Trust Acting `employeeId` From the App

This is required before mobile expansion.

The current controllers repeatedly accept:

```js
req.body.employeeId
```

for the employee performing an action.

Examples currently include:

- workspace save
- create call
- update call
- create meeting
- update meeting
- complete meeting
- finalization
- meeting item creation/update
- image upload
- calendar event creation/update

This must stop.

## New rule

The client may send an employee ID only when it represents a **different semantic value**, such as:

```text
nextCallAssignedEmployeeId
nextMeetingAssignedEmployeeId
assignedEmployeeId
```

The client must **not** send its own acting identity.

The backend determines the actor from the authenticated JWT:

```js
const employeeId = BigInt(req.employee.id);
```

or use the correct ID type consistently in your current Prisma implementation.

## Mobile request should look like

Wrong:

```json
{
  "callDiscussion": "Client confirmed.",
  "employeeId": 5
}
```

Correct:

```json
{
  "callDiscussion": "Client confirmed."
}
```

The backend knows who made the request.

---

# 11. Backend Security Fix B — Change `requireEmployee` to Cookie + Bearer

Current middleware only reads:

```js
req.cookies?.mme_session
```

Refactor it conceptually:

```js
function getBearerToken(req) {
  const header = req.headers.authorization;

  if (!header) return null;
  if (!header.startsWith("Bearer ")) return null;

  return header.slice(7).trim() || null;
}

function getEmployeeToken(req) {
  return (
    getBearerToken(req) ||
    req.cookies?.[SESSION_COOKIE] ||
    null
  );
}
```

Then:

```js
export async function requireEmployee(req, res, next) {
  const token = getEmployeeToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Login required.",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Session expired, please log in again.",
    });
  }

  // Query the employee from DB.
  // Confirm account still exists and is active.
  // Then attach trusted identity to req.employee.

  req.employee = {
    id: decoded.id,
    role: decoded.role,
  };

  next();
}
```

## Important

Do not remove cookie support.

Your existing React web app should continue functioning unchanged.

---

# 12. Backend Security Fix C — Add Dedicated Mobile Login

Do not make the existing web login expose its JWT in the JSON response.

Why?

The web app currently benefits from an HTTP-only cookie.

Returning the web token to browser JavaScript would weaken that security model.

Use a dedicated native login route.

Recommended:

```text
POST /api/mobile/auth/login
```

Request:

```json
{
  "email": "employee@yourdomain.com",
  "password": "password"
}
```

Response:

```json
{
  "data": {
    "accessToken": "eyJ...",
    "employee": {
      "id": 5,
      "fullName": "Employee Name",
      "email": "employee@yourdomain.com",
      "role": "Employee",
      "mustChangePassword": false
    }
  }
}
```

## Suggested files

Backend:

```text
src/
├── controllers/
│   └── mobileAuthController.js
└── routes/
    └── mobileAuth.js
```

Mount:

```js
app.use("/api/mobile/auth", mobileAuthRoutes);
```

## Do not duplicate password logic

Extract credential validation so web and mobile can share the same logic.

Possible helper:

```text
src/services/employeeAuthService.js
```

Concept:

```js
export async function authenticateEmployee(email, password) {
  // normalize email
  // find employee
  // ensure active
  // reject Admin account from Employee portal
  // ensure password exists
  // bcrypt.compare
  // update lastUsedAt
  // return employee
}
```

Then:

```text
web identifyEmployee
      ↓
authenticateEmployee()
      ↓
set HTTP-only cookie


mobileLogin
      ↓
authenticateEmployee()
      ↓
return Bearer token
```

---

# 13. Mobile JWT Lifetime

Do not use the current approximately 100-year employee-cookie lifetime for the mobile bearer token.

Recommended V1:

```env
MOBILE_ACCESS_TOKEN_EXPIRES_IN=12h
```

You can choose a slightly longer internal-company policy later.

V1 behavior:

```text
token expires
    ↓
API returns 401
    ↓
mobile clears SecureStore
    ↓
user returns to login
```

Later, if repeated login becomes inconvenient, implement:

```text
short-lived access token
+
rotating refresh token
```

Do not add refresh-token complexity before the basic app is working.

---

# 14. Backend Security Fix D — Password Change Enforcement

Current frontend redirects employees who must change their password.

Enforce this server-side too.

After authentication, query:

```text
mustChangePassword
```

Allow these routes:

```text
GET  /api/employees/me
POST /api/employees/change-password
```

Block other business APIs while the flag is true.

Example middleware:

```js
export function requirePasswordChanged(req, res, next) {
  if (req.employee.mustChangePassword) {
    return res.status(403).json({
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Change your password before continuing.",
    });
  }

  next();
}
```

Then protect:

```text
workspace
calls
meetings
calendar
employee directory
mobile dashboard
```

---

# 15. Backend Security Fix E — Protect Employee Directory

The current:

```text
GET /api/employees
```

should not remain public.

Mobile needs this list for assigning next calls/meetings.

Protect it:

```js
router.get(
  "/",
  requireEmployee,
  listEmployeeDirectory
);
```

The response can remain lightweight:

```json
{
  "data": [
    {
      "id": 5,
      "fullName": "Rafi",
      "email": "..."
    }
  ]
}
```

If email is not needed for assignment UI, return only:

```text
id
fullName
```

---

# 16. Backend Security Fix F — Calendar Ownership

Before mobile uses manual calendar events, fix update/delete authorization.

Current update/delete works by event ID.

It should also enforce the business ownership rule.

Decide one rule.

Recommended initial rule:

An employee may edit/delete a manual calendar event only if:

```text
createdById === current employee
```

or implement your desired assignment permission explicitly.

Do not allow:

```text
authenticated Employee A
    ↓
guesses event ID created by Employee B
    ↓
updates/deletes it
```

---

# 17. Backend Improvement — Mobile Dashboard Endpoint

Do not make the home screen download the entire workspace and several histories just to calculate four numbers.

Add:

```text
GET /api/mobile/dashboard
```

It should use:

```text
req.employee.id
```

and return a small summary.

Example:

```json
{
  "data": {
    "counts": {
      "todayMeetings": 2,
      "todayCalls": 5,
      "overdueCalls": 1,
      "upcomingMeetings": 3
    },
    "nextActivities": [
      {
        "type": "meeting",
        "rowKey": "uuid",
        "clientName": "Rahim Ahmed",
        "datetime": "2026-08-16T15:30"
      },
      {
        "type": "call",
        "rowKey": "uuid",
        "clientName": "Karim Hasan",
        "datetime": "2026-08-16T17:30"
      }
    ]
  }
}
```

Recommended route:

```text
GET /api/mobile/dashboard
```

This is not harmful API duplication.

It is an aggregation endpoint specifically optimized for a dashboard.

---

# 18. Backend Improvement — Client API

For the first working version, you can use:

```text
GET /api/workspace/default
```

because it already returns:

- columns
- rows
- values
- row keys
- last/next meeting information
- call timing context

However, mobile should eventually avoid downloading the full dynamic workspace when it only needs client cards.

Recommended later API:

```text
GET /api/clients
GET /api/clients/:rowKey
PATCH /api/clients/:rowKey
```

Do not block the mobile project waiting for this API.

V1 can map the existing workspace response.

---

# 19. Important Workspace Warning

The existing employee web workspace save:

```text
PUT /api/workspace/default
```

sends the entire sheet.

The backend deletes rows that are absent from that submitted workspace.

That design is dangerous for multiple users editing simultaneously.

Therefore:

## Mobile V1

Prefer client data to be **read-only** initially.

Do not make the Android app save the entire workspace.

Later implement granular endpoints:

```text
POST  /api/clients
PATCH /api/clients/:rowKey
DELETE /api/clients/:rowKey
```

or:

```text
PATCH /api/workspace/rows/:rowKey
```

The mobile app should never send an old full workspace snapshot to update one client field.

---

# 20. CHUNK 1 — Backend Mobile Readiness

## Goal

Make the existing server safe and ready for both:

```text
web cookie authentication
+
mobile bearer authentication
```

## Files likely changed

```text
backend/mme_node_express_backend/
└── src/
    ├── server.js
    ├── middleware/
    │   └── employeeAuth.js
    ├── controllers/
    │   ├── employeesController.js
    │   ├── callsController.js
    │   ├── meetingsController.js
    │   ├── calendarController.js
    │   ├── workspaceController.js
    │   ├── mobileAuthController.js
    │   └── mobileDashboardController.js
    └── routes/
        ├── employees.js
        ├── mobileAuth.js
        └── mobileDashboard.js
```

## Tasks

- [ ] Add Bearer-token extraction.
- [ ] Keep existing cookie extraction.
- [ ] Add mobile login endpoint.
- [ ] Stop trusting acting `employeeId` from request bodies.
- [ ] Protect employee directory.
- [ ] Fix calendar authorization.
- [ ] Enforce mandatory password change server-side.
- [ ] Add dashboard endpoint.
- [ ] Configure a sensible mobile token expiry.
- [ ] Ensure `JWT_SECRET` is required in production.
- [ ] Consider login rate limiting.
- [ ] Test web login after changes.
- [ ] Test admin login after changes.
- [ ] Test mobile bearer request manually.

## Manual test with an API tool

Login:

```http
POST /api/mobile/auth/login
Content-Type: application/json

{
  "email": "employee@example.com",
  "password": "..."
}
```

Then:

```http
GET /api/employees/me
Authorization: Bearer eyJ...
```

Expected:

```text
200 OK
```

Try without token:

```text
401
```

Try deactivated employee:

```text
401 or 403 according to chosen policy
```

## Definition of done

Chunk 1 is finished only when:

1. existing website employee login still works;
2. existing admin login still works;
3. a Bearer token can call `/api/employees/me`;
4. a forged `employeeId` in a request body cannot change the audit employee;
5. expired/invalid token returns `401`;
6. deactivated employee token is rejected.

---

# 21. CHUNK 2 — Create the Expo Project

## Goal

Create the new JavaScript mobile project.

Current Expo guidance uses the multi-screen default project with Expo Router already configured.

Create the project from the repository root.

Example:

```powershell
cd D:\YourProject\Make-My-Event-Office-Management-System-main

npx create-expo-app@latest --template default@sdk-57
```

When asked for the name:

```text
mobile
```

Result:

```text
Make-My-Event-Office-Management-System-main/
├── backend/
├── frontend/
└── mobile/
```

## JavaScript-only conversion

The current default Expo multi-screen template includes TypeScript configuration.

You want JavaScript.

After project creation:

1. rename application `.tsx` files to `.jsx`;
2. rename application `.ts` files to `.js`;
3. remove TypeScript-specific syntax;
4. remove TypeScript config if no longer needed;
5. optionally create `jsconfig.json` for editor path aliases.

For example:

```text
app/_layout.tsx  → app/_layout.jsx
app/index.tsx    → app/index.jsx
```

Remove TypeScript syntax such as:

```ts
const value: string = "x";
```

and use:

```js
const value = "x";
```

Remove interfaces/types.

If TypeScript packages are present only for application typing and you want a pure JS setup, remove them after conversion.

## Keep Expo Router

Do not remove Expo Router.

The router works with JavaScript route files.

## Run once

```powershell
cd mobile
npm install
npx expo start
```

For the modern SDK you can develop with:

- Android emulator; or
- an Expo development build.

## Definition of done

- [ ] Expo project starts.
- [ ] No TypeScript application files remain.
- [ ] `app/_layout.jsx` loads.
- [ ] `app/index.jsx` renders.
- [ ] Router navigation works.
- [ ] No backend integration yet.

---

# 22. CHUNK 3 — Install Core Packages

From:

```text
mobile/
```

install:

```powershell
npm install @tanstack/react-query
npm install react-hook-form

npx expo install expo-secure-store
npx expo install expo-image-picker
npx expo install expo-image
npx expo install @react-native-community/datetimepicker
npx expo install @react-native-community/netinfo
```

Expo Router is normally already included by the default template.

## Later packages

Do not install these until their chunk:

```powershell
npx expo install expo-notifications expo-device expo-constants
```

## Why use `npx expo install` for Expo/native packages?

It selects a package version compatible with the Expo SDK in the project.

## Definition of done

- [ ] All packages install without peer-dependency errors.
- [ ] App still starts after installations.
- [ ] Commit `package-lock.json`.

---

# 23. CHUNK 4 — Mobile Configuration and Environment Variables

Create:

```text
mobile/.env
```

Example:

```env
EXPO_PUBLIC_API_URL=https://YOUR-PRODUCTION-DOMAIN.com/api
EXPO_PUBLIC_APP_ENV=development
```

Create:

```text
mobile/.env.example
```

Example:

```env
EXPO_PUBLIC_API_URL=https://example.com/api
EXPO_PUBLIC_APP_ENV=development
```

## Never add secrets

Do not put:

```env
JWT_SECRET=
DB_PASSWORD=
CPANEL_PASSWORD=
```

in the mobile project.

Values prefixed with `EXPO_PUBLIC_` become visible to the app bundle.

The API URL is not a secret.

## Create

```text
mobile/constants/config.js
```

Example:

```js
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not configured."
  );
}

export const API_URL =
  apiUrl.replace(/\/$/, "");

export const API_ORIGIN =
  API_URL.replace(/\/api$/, "");
```

This gives:

```text
API_URL
https://domain.com/api

API_ORIGIN
https://domain.com
```

The origin is needed for existing image paths:

```text
/uploads/meeting-images/...
```

## Definition of done

- [ ] App can read `EXPO_PUBLIC_API_URL`.
- [ ] No secrets are included.
- [ ] Production backend uses HTTPS.
- [ ] `/api/health` works from the phone's network.

---

# 24. CHUNK 5 — Secure Token Storage

Create:

```text
mobile/services/storage/authStorage.js
```

Example:

```js
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY =
  "mme_mobile_access_token";

export async function saveAccessToken(token) {
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_KEY,
    token
  );
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(
    ACCESS_TOKEN_KEY
  );
}

export async function removeAccessToken() {
  await SecureStore.deleteItemAsync(
    ACCESS_TOKEN_KEY
  );
}
```

## Do not save password

Never store:

```text
email + raw password
```

for automatic login.

Store the signed session/access token.

## Definition of done

- [ ] Token can be saved.
- [ ] Token persists after closing/reopening the app.
- [ ] Logout removes token.
- [ ] Password is never persisted.

---

# 25. CHUNK 6 — Build One Shared API Client

Create:

```text
mobile/services/api/client.js
```

Use one request function for almost every JSON request.

Example:

```js
import {
  API_URL
} from "../../constants/config";

import {
  getAccessToken,
  removeAccessToken
} from "../storage/authStorage";

export class ApiError extends Error {
  constructor(
    message,
    status,
    code = null,
    data = null
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function apiRequest(
  path,
  options = {}
) {
  const token = await getAccessToken();

  const headers = {
    Accept: "application/json",
    ...(options.body instanceof FormData
      ? {}
      : {
          "Content-Type": "application/json",
        }),
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  const payload =
    await response.json().catch(() => ({}));

  if (response.status === 401) {
    await removeAccessToken();
  }

  if (!response.ok) {
    throw new ApiError(
      payload.message ||
        `Request failed (${response.status}).`,
      response.status,
      payload.code || null,
      payload
    );
  }

  return payload.data ?? payload;
}
```

## Why one API client?

Without it, you will duplicate:

```text
base URL
token lookup
Authorization header
JSON parsing
401 handling
server error parsing
```

across every feature.

Your current web frontend has this duplication in multiple services.

Do not repeat that architecture in mobile.

## Definition of done

- [ ] `apiRequest()` can call `/employees/me`.
- [ ] Bearer token is attached automatically.
- [ ] Invalid session clears SecureStore.
- [ ] JSON errors become a consistent `ApiError`.

---

# 26. CHUNK 7 — TanStack Query Provider

Create:

```text
mobile/providers/QueryProvider.jsx
```

Example:

```jsx
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function QueryProvider({
  children
}) {
  return (
    <QueryClientProvider
      client={queryClient}
    >
      {children}
    </QueryClientProvider>
  );
}
```

Later integrate React Native connectivity/focus if needed.

## Query-key strategy

Create:

```text
constants/queryKeys.js
```

Example:

```js
export const queryKeys = {
  me: ["me"],

  dashboard: ["dashboard"],

  employees: ["employees"],

  workspace: ["workspace"],

  client: (rowKey) => [
    "client",
    rowKey
  ],

  calls: (rowKey) => [
    "calls",
    rowKey
  ],

  meetings: (rowKey) => [
    "meetings",
    rowKey
  ],

  calendar: (year, month) => [
    "calendar",
    year,
    month
  ],
};
```

## Definition of done

- [ ] Provider wraps the app.
- [ ] One test query can load.
- [ ] Query errors are visible.
- [ ] Refetch works.

---

# 27. CHUNK 8 — Authentication API Service

Create:

```text
services/api/authApi.js
```

Example:

```js
import {
  API_URL
} from "../../constants/config";

import {
  apiRequest
} from "./client";

export async function mobileLogin({
  email,
  password
}) {
  const response = await fetch(
    `${API_URL}/mobile/auth/login`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  const payload =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.message || "Login failed."
    );
  }

  return payload.data ?? payload;
}

export function getCurrentEmployee() {
  return apiRequest("/employees/me");
}

export function changePassword({
  currentPassword,
  newPassword
}) {
  return apiRequest(
    "/employees/change-password",
    {
      method: "POST",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }
  );
}
```

The login function is separate because there is no token before login.

---

# 28. CHUNK 9 — Auth Context

Create:

```text
context/AuthContext.jsx
hooks/useAuth.js
```

State:

```text
employee
isAuthenticated
isBootstrapping
login
logout
refreshEmployee
changePassword
```

## Startup flow

```text
App Starts
    ↓
Read token from SecureStore
    ↓
No token? ─────────────→ Login
    ↓
Token exists
    ↓
GET /employees/me
    ↓
Valid? ────────────────→ Main App
    ↓ invalid
Delete token
    ↓
Login
```

## Login flow

```text
Login form
   ↓
POST /mobile/auth/login
   ↓
Receive token + employee
   ↓
SecureStore.setItemAsync()
   ↓
Set employee in AuthContext
   ↓
mustChangePassword?
   ├── yes → Change Password
   └── no  → Main App
```

## Logout flow

For a stateless mobile JWT V1:

```text
Remove token
    ↓
clear TanStack Query cache
    ↓
clear employee state
    ↓
go to Login
```

You can later add server-side token revocation/session versioning.

---

# 29. CHUNK 10 — Router and Protected Screens

Recommended route groups:

```text
app/
├── _layout.jsx
├── index.jsx
│
├── (auth)/
│   ├── _layout.jsx
│   ├── login.jsx
│   └── change-password.jsx
│
└── (app)/
    ├── _layout.jsx
    └── ...
```

## `app/index.jsx`

Its only job should be deciding initial navigation based on auth state.

## Protected app rules

If:

```text
!isAuthenticated
```

user must not reach:

```text
(app)
```

If:

```text
employee.mustChangePassword === true
```

user must go to:

```text
change-password
```

and not business screens.

## Bottom tabs

Use:

```text
Home
Clients
Calendar
Follow-ups
Profile
```

Recommended labels/icons:

```text
Home       → home
Clients    → people
Calendar   → calendar
Follow-ups → checkmark-circle
Profile    → person
```

---

# 30. CHUNK 11 — Shared UI Components

Build the reusable UI before large feature screens.

Create:

```text
components/common/
```

## `ScreenContainer`

Responsible for:

- safe-area spacing
- standard background
- horizontal padding
- optional scroll behavior

## `AppButton`

Variants:

```text
primary
secondary
danger
ghost
```

States:

```text
normal
disabled
loading
```

## `AppInput`

Support:

- label
- value
- error
- password visibility
- keyboard type
- multiline
- required marker

## `LoadingScreen`

Use during:

- auth bootstrap
- initial dashboard
- client detail load

## `ErrorState`

Display:

- readable message
- retry button

## `EmptyState`

Examples:

```text
No calls recorded yet.
No meetings found.
No events for this date.
```

## `ConfirmModal`

Use before destructive actions.

Never delete immediately on one tap.

---

# 31. UI Theme

Keep the mobile app professional and simple.

Suggested concept:

```text
Background:
light neutral gray

Cards:
white

Primary text:
near black

Secondary text:
gray

Primary action:
brand color

Success:
green

Warning:
amber

Error / Overdue:
red
```

Create:

```text
constants/colors.js
```

Do not hard-code random colors throughout screens.

Example:

```js
export const colors = {
  background: "#F6F7F9",
  surface: "#FFFFFF",

  text: "#161616",
  mutedText: "#6B7280",

  primary: "#111111",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",

  border: "#E5E7EB",
};
```

Adjust to your actual Make My Event branding later.

---

# 32. CHUNK 12 — Login Screen

Route:

```text
app/(auth)/login.jsx
```

Form fields:

```text
Email
Password
```

Buttons:

```text
Login
```

States:

- idle
- submitting
- invalid form
- bad credentials
- deactivated employee
- backend unavailable
- no internet

## Validation

Email:

```text
required
trimmed
lowercase before submit
```

Password:

```text
required
```

Do not reveal whether an email exists more than the backend policy already does.

## Successful navigation

```text
mustChangePassword = true
    ↓
change-password

false
    ↓
Home
```

## Definition of done

- [ ] Login works against production/staging API.
- [ ] Wrong password displays a message.
- [ ] Token persists after reopening app.
- [ ] Deactivated user cannot enter.
- [ ] Loading button prevents double-submit.

---

# 33. CHUNK 13 — Password Change Screen

Route:

```text
app/(auth)/change-password.jsx
```

Fields:

```text
Current Password
New Password
Confirm New Password
```

Client validation:

- current password required
- new password required
- confirm matches
- follow backend minimum
- new password different from old

Backend call:

```text
POST /api/employees/change-password
```

Body:

```json
{
  "currentPassword": "...",
  "newPassword": "..."
}
```

After success:

- update employee context
- `mustChangePassword = false`
- route to Home

---

# 34. CHUNK 14 — Employee Directory

Service:

```text
services/api/employeesApi.js
```

API:

```text
GET /api/employees
```

Use it for:

- next call assignment
- next meeting assignment
- manual calendar assignment

Do not download this list repeatedly.

TanStack Query can cache it.

Example key:

```text
["employees"]
```

---

# 35. CHUNK 15 — Dashboard

Route:

```text
app/(app)/(tabs)/index.jsx
```

Recommended UI:

```text
Good Afternoon, Rafi

┌──────────────┐  ┌──────────────┐
│ Meetings     │  │ Calls        │
│      3       │  │      5       │
│ Today        │  │ Today        │
└──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐
│ Upcoming     │  │ Overdue      │
│      4       │  │      2       │
└──────────────┘  └──────────────┘

Today's Schedule

3:00 PM
Meeting with Rahim Ahmed

5:30 PM
Call Karim Hasan
```

API:

```text
GET /api/mobile/dashboard
```

## Refresh

Support pull-to-refresh.

On refresh:

```text
invalidate/refetch dashboard
```

## Tap behavior

Meeting activity:

```text
client → meetings → meeting
```

Call activity:

```text
client → calls → call
```

---

# 36. CHUNK 16 — Load Clients From Existing Workspace

Initially call:

```text
GET /api/workspace/default
```

Current response shape is approximately:

```json
{
  "data": {
    "id": "...",
    "name": "...",
    "columns": [
      {
        "id": "column-key",
        "name": "Client Name",
        "type": "text",
        "width": 180,
        "required": true
      }
    ],
    "rows": [
      {
        "id": "row-uuid",
        "rowNumber": 1,
        "values": {},
        "lastCallDatetime": "",
        "nextCallDatetime": ""
      }
    ]
  }
}
```

## Important dynamic-column problem

Column IDs are not guaranteed to be readable names.

Do not assume:

```js
row.values.client_name
```

Instead map columns by:

```text
column.name
```

## Create helper

```text
utils/clients.js
```

Concept:

```js
function findColumnKey(
  columns,
  columnName
) {
  const column = columns.find(
    (item) =>
      item.name
        .trim()
        .toLowerCase() ===
      columnName
        .trim()
        .toLowerCase()
  );

  return column?.id || null;
}
```

Then create a normalized mobile client object:

```js
export function normalizeClient(
  row,
  columns
) {
  const get = (name) => {
    const key = findColumnKey(
      columns,
      name
    );

    return key
      ? row.values?.[key] ?? ""
      : "";
  };

  return {
    rowKey: row.id,

    clientName:
      get("Client Name"),

    phone:
      get("Client Phone Number"),

    venue:
      get("Venue"),

    shift:
      get("Shift"),

    floor:
      get("Floor"),

    guestCount:
      get("Guest Count"),

    eventDate:
      get("Event Date"),

    lastCallDatetime:
      row.lastCallDatetime || "",

    nextCallDatetime:
      row.nextCallDatetime || "",
  };
}
```

This protects mobile code from dynamic UUID column keys.

---

# 37. CHUNK 17 — Client List Screen

Route:

```text
app/(app)/(tabs)/clients.jsx
```

Use:

```text
FlatList
```

not a giant `ScrollView` for many clients.

## Features

- search bar
- pull to refresh
- filter chips
- client cards
- empty state
- loading skeleton/spinner
- retry on error

## Search fields

Search across:

```text
client name
phone
venue
```

For a first version, client-side search is acceptable after workspace loading.

For a larger dataset, later add server-side pagination/search.

## Client card

Show only useful summary data.

Do not show every workspace field.

Suggested:

```text
Client Name
Venue
Event Date
Phone
Next Call
```

Tap:

```text
clients/[rowKey]
```

---

# 38. CHUNK 18 — Client Detail Screen

Route:

```text
app/(app)/clients/[rowKey]/index.jsx
```

Suggested structure:

```text
Client Name
Event Type / Event Date

Phone
Venue
Shift
Guest Count

Quick Actions
[Call Phone]
[Add Call]
[Add Meeting]

Next Follow-up

Tabs/Sections
Call History
Meeting History
Client Information
```

## Quick phone call

Use React Native `Linking`.

Concept:

```js
import {
  Linking
} from "react-native";

await Linking.openURL(
  `tel:${phone}`
);
```

Flow:

```text
Client detail
    ↓
Tap phone icon
    ↓
Android dialer
    ↓
Employee makes call
    ↓
Return to app
    ↓
Add Call
```

This should be a key mobile workflow.

---

# 39. CHUNK 19 — Calls API Service

Create:

```text
services/api/callsApi.js
```

## Load

```js
export function getCalls(rowKey) {
  return apiRequest(
    `/calls/${rowKey}`
  );
}
```

Current server returns:

```text
rowKey
clientName
calls[]
```

A call contains values such as:

```text
id
callDatetime
callDiscussion
nextCallDatetime
nextCallAssignedEmployeeId
nextCallAssignedEmployeeName
assignedByEmployeeName
createdByName
updatedByName
createdAt
updatedAt
```

## Create

After backend actor-ID fix:

```js
export function createCall(
  rowKey,
  { callDiscussion }
) {
  return apiRequest(
    `/calls/${rowKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        callDiscussion,
      }),
    }
  );
}
```

Do not send:

```text
callDatetime
employeeId
```

The server already sets the actual call time.

## Update

```js
export function updateCall(
  rowKey,
  callId,
  {
    callDiscussion,
    nextCallDatetime,
    nextCallAssignedEmployeeId
  }
) {
  return apiRequest(
    `/calls/${rowKey}/${callId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        callDiscussion,
        nextCallDatetime,
        nextCallAssignedEmployeeId,
      }),
    }
  );
}
```

## Delete

```js
export function deleteCall(
  rowKey,
  callId
) {
  return apiRequest(
    `/calls/${rowKey}/${callId}`,
    {
      method: "DELETE",
    }
  );
}
```

---

# 40. CHUNK 20 — Calls Screens

Routes:

```text
clients/[rowKey]/calls/index.jsx
clients/[rowKey]/calls/create.jsx
clients/[rowKey]/calls/[callId].jsx
```

## Call list

Each card:

```text
Call time
Discussion
Created by
Assigned by
Next call
Next assignee
```

## Create call form

Form:

```text
Discussion
```

Do not let employee manually set the historical call timestamp.

Server creates the timestamp.

After create:

```text
POST succeeds
    ↓
invalidate calls query
    ↓
invalidate client/workspace query
    ↓
invalidate dashboard
    ↓
invalidate calendar if timing is affected
```

## Update call

Allow:

```text
discussion
next call datetime
next call assignee
```

## Next-call date

Use native date/time picker.

Convert selected device value to the backend's expected local datetime string.

Example format:

```text
YYYY-MM-DDTHH:mm
```

Do not accidentally convert it to UTC `Z` format unless backend contract is changed to accept UTC.

---

# 41. CHUNK 21 — Meetings API Service

Create:

```text
services/api/meetingsApi.js
```

## Load meetings

```text
GET /api/meetings/:rowKey
```

## Create

After actor-ID hardening:

```text
POST /api/meetings/:rowKey
```

with an empty or minimal body:

```json
{}
```

The server creates the actual meeting time.

## Update

```text
PUT /api/meetings/:rowKey/:meetingId
```

Example body:

```json
{
  "nextMeetingDatetime": "2026-08-20T16:00",
  "nextMeetingAssignedEmployeeId": 5
}
```

Legacy `requirements` should only be sent if still needed.

Prefer the current Meeting Items feature.

## Complete

```text
PATCH /api/meetings/:rowKey/:meetingId/complete
```

No actor ID should be required from mobile after backend fix.

## Delete

```text
DELETE /api/meetings/:rowKey/:meetingId
```

---

# 42. CHUNK 22 — Meeting List and Details

Routes:

```text
clients/[rowKey]/meetings/index.jsx
clients/[rowKey]/meetings/[meetingId].jsx
```

## Meeting list card

Show:

```text
meeting date/time
created by
assigned by
completed status
next meeting date/time
next assignee
```

## Meeting detail sections

Use sections instead of one huge form:

```text
Summary
Requirements
Images
Next Meeting
Completion
Finalization
```

Example:

```text
Meeting #3

16 Aug 2026 • 3:00 PM

Requirements
────────────
Stage
Royal red stage
Qty: 1

Entry Gate
Flower arch
Qty: 1

Images
────────────
[img] [img] [img]

Next Meeting
────────────
20 Aug • 4:00 PM
Assigned to Rafi

[Mark Complete]
```

---

# 43. CHUNK 23 — Meeting Items

Current API supports:

```text
POST /:rowKey/:meetingId/items
PUT /:rowKey/:meetingId/items/:itemId
DELETE /:rowKey/:meetingId/items/:itemId
```

Current body fields include:

```text
itemKey
customLabel
description
quantity
```

Do not send acting employee ID after hardening.

## Item picker

Create:

```text
constants/meetingItems.js
```

Keep your website's current business list synchronized.

Examples from the system include items such as:

```text
Stage
Entry Gate
Head Table
Photo Booth
Ceiling Decoration
Walkway
Mirror Ramp
Welcome Stand
Sound System
LED
Other
```

Use the backend's accepted `itemKey` values exactly.

For:

```text
Other
```

require:

```text
customLabel
```

---

# 44. CHUNK 24 — Image Selection

Install:

```text
expo-image-picker
```

Use it for:

```text
camera
gallery
```

Create a reusable selector:

```text
components/meetings/ImagePickerSheet.jsx
```

Actions:

```text
Take Photo
Choose From Gallery
Cancel
```

## Permissions

Request only when needed.

If permission is denied:

- show clear explanation
- allow user to retry
- optionally direct them to system settings

## Mobile image object

Expo's selected asset typically gives you:

```text
uri
fileName
mimeType
width
height
fileSize (when available)
```

Convert it into React Native `FormData`.

---

# 45. CHUNK 25 — Image Upload Service

Create:

```text
services/api/uploadsApi.js
```

Do not use JSON for image files.

Use `FormData`.

## Meeting image upload

Endpoint:

```text
POST /api/meetings/:rowKey/:meetingId/images
```

Backend expects field:

```text
images
```

Maximum current backend configuration:

```text
10 files
8 MB per file
```

Allowed MIME types currently:

```text
image/jpeg
image/png
image/gif
image/webp
```

Example:

```js
import {
  API_URL
} from "../../constants/config";

import {
  getAccessToken
} from "../storage/authStorage";

export async function uploadMeetingImages(
  rowKey,
  meetingId,
  assets,
  tagNames = []
) {
  const token =
    await getAccessToken();

  const formData =
    new FormData();

  assets.forEach(
    (asset, index) => {
      formData.append(
        "images",
        {
          uri: asset.uri,
          name:
            asset.fileName ||
            `meeting-${Date.now()}-${index}.jpg`,
          type:
            asset.mimeType ||
            "image/jpeg",
        }
      );
    }
  );

  if (tagNames.length) {
    formData.append(
      "tagNames",
      JSON.stringify(tagNames)
    );
  }

  const response = await fetch(
    `${API_URL}/meetings/${rowKey}/${meetingId}/images`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          `Bearer ${token}`,
      },
      body: formData,
    }
  );

  // Parse and handle response...
}
```

## Important

Do **not** manually set:

```text
Content-Type: multipart/form-data
```

with a hard-coded boundary.

Let the native fetch implementation create the correct multipart boundary.

## Item image upload

Endpoint:

```text
POST /api/meetings/:rowKey/:meetingId/items/:itemId/images
```

Same file field:

```text
images
```

---

# 46. Resolve Uploaded Image URLs

Backend returns paths like:

```text
/uploads/meeting-images/abc.jpg
```

Create:

```text
utils/formatters.js
```

or an image helper:

```js
import {
  API_ORIGIN
} from "../constants/config";

export function resolveImageUrl(url) {
  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `${API_ORIGIN}${url}`;
}
```

Use `expo-image` to display remote files.

---

# 47. CHUNK 26 — Image Tags and Final Selection

Current routes:

```text
PATCH /api/meetings/:rowKey/images/:imageId/tag
PATCH /api/meetings/:rowKey/images/:imageId/final
```

Tag body:

```json
{
  "tagName": "Stage"
}
```

Final selection endpoint toggles final state.

Client finalization:

```text
POST /api/meetings/:rowKey/finalize
```

After backend actor fix, do not send `employeeId`.

## UI

For each image:

```text
thumbnail
tag
selected-final badge
```

Actions:

```text
Rename tag
Select/Unselect Final
Delete
```

Show a clear finalization confirmation.

---

# 48. CHUNK 27 — Calendar API

Service:

```text
services/api/calendarApi.js
```

Load:

```text
GET /api/calendar?year=2026&month=8
```

Current backend combines multiple activity types into calendar data.

Use it rather than independently recomputing all dates in mobile.

## Month screen

Route:

```text
app/(app)/(tabs)/calendar.jsx
```

Show markers for days with activity.

## Day screen

Route:

```text
app/(app)/calendar/[date].jsx
```

Group by type:

```text
Meetings
Calls
Next Meetings
Next Calls
Manual Events
```

Use consistent badges.

---

# 49. CHUNK 28 — Manual Calendar Events

Current create body includes fields such as:

```text
title
description
eventDate
eventTime
eventType
clientName
companyName
priority
status
linkedRowKey
assignedEmployeeId
```

After backend fix, remove acting:

```text
employeeId
```

from mobile.

## Create

```text
POST /api/calendar/events
```

## Update

```text
PUT /api/calendar/events/:id
```

## Delete

```text
DELETE /api/calendar/events/:id
```

Only show edit/delete controls when the authenticated employee is authorized.

Backend authorization must remain the final authority.

---

# 50. CHUNK 29 — Follow-ups

Route:

```text
app/(app)/(tabs)/follow-ups.jsx
```

This should be one of the most useful mobile screens.

Categories:

```text
Overdue
Today
Upcoming
```

Filter:

```text
All
Calls
Meetings
```

Each card:

```text
Client Name
Type
Datetime
Assignee
Status
```

Tap call follow-up:

```text
client calls
```

Tap meeting follow-up:

```text
client meetings
```

## Data source

You can initially derive follow-ups from:

```text
calendar endpoint
```

if the returned event data has sufficient assignment/type details.

If not, add:

```text
GET /api/mobile/follow-ups
```

that returns only follow-ups for:

```text
req.employee.id
```

This is preferable to complicated client filtering.

---

# 51. CHUNK 30 — Profile

Route:

```text
app/(app)/(tabs)/profile.jsx
```

Display:

```text
Full Name
Email
Role
App Version
```

Actions:

```text
Change Password
Logout
```

Do not allow profile to edit security-sensitive employee fields unless the backend explicitly supports it.

---

# 52. Date and Time Strategy

Your backend currently contains explicit business-timezone date helpers.

Your business operates in Bangladesh.

Be consistent.

## For API date-only values

Use:

```text
YYYY-MM-DD
```

Example:

```text
2026-08-16
```

## For local date-time fields currently expected by backend

Use:

```text
YYYY-MM-DDTHH:mm
```

Example:

```text
2026-08-20T16:30
```

Do not blindly do:

```js
date.toISOString()
```

for these existing local-time API fields.

`toISOString()` converts to UTC and ends with `Z`, which can shift the displayed time.

## Create one formatter

```text
utils/dates.js
```

Functions should include:

```text
formatDateOnlyForApi()
formatLocalDateTimeForApi()
formatDisplayDate()
formatDisplayTime()
isToday()
isPast()
```

Do not spread date-string manipulation across every screen.

---

# 53. Network Handling

Mobile users will experience unstable mobile data.

Use:

```text
@react-native-community/netinfo
```

## Required behavior

If offline:

- keep app UI available where possible
- show "No internet connection"
- do not pretend a mutation succeeded
- allow retry

For V1, do not queue database writes offline.

Wrong V1 behavior:

```text
No network
↓
pretend "Call saved"
↓
later maybe sync
```

Correct V1:

```text
No network
↓
show "Unable to save while offline"
↓
keep form contents
↓
retry when online
```

Offline write synchronization can be a future feature.

---

# 54. TanStack Query Invalidation Rules

When server data changes, invalidate related queries.

## Create/update/delete call

Invalidate:

```text
calls(rowKey)
workspace/client
dashboard
calendar
follow-ups
```

## Create/update/delete meeting

Invalidate:

```text
meetings(rowKey)
workspace/client
dashboard
calendar
follow-ups
```

## Update meeting item/image

Invalidate:

```text
meetings(rowKey)
```

## Create/update/delete calendar event

Invalidate:

```text
calendar(year, month)
dashboard if relevant
```

## Change password

Invalidate/update:

```text
me
```

Do not manually mutate five different copies of the same data unless necessary.

---

# 55. Loading State Rules

Every data screen must have:

1. initial loading
2. error
3. empty
4. loaded content
5. refreshing state

Example:

```jsx
if (isLoading) {
  return <LoadingScreen />;
}

if (isError) {
  return (
    <ErrorState
      message={error.message}
      onRetry={refetch}
    />
  );
}

if (!data?.length) {
  return (
    <EmptyState
      message="No calls recorded yet."
    />
  );
}
```

Avoid blank white screens.

---

# 56. Mutation Rules

Every save button must:

- disable while request is in progress
- show activity indicator
- prevent double submissions
- show backend validation errors
- only navigate after success

Pattern:

```text
Tap Save
    ↓
button loading
    ↓
API
    ├── success → invalidate queries → navigate/show success
    └── error   → stay on form → show error
```

---

# 57. Error Handling Policy

Mobile messages should not show raw database/Prisma errors.

Backend should return clean user messages.

Mobile can classify:

```text
400/422 → validation error
401     → session expired
403     → forbidden / password change / account rule
404     → record no longer exists
409     → conflict
500     → server problem
network → connection problem
```

## Special 401 behavior

Central API client:

```text
401
 ↓
delete stored token
 ↓
AuthContext notices session unavailable
 ↓
Login screen
```

Optionally display:

```text
Your session expired. Please log in again.
```

---

# 58. Mobile Permissions

Only ask for permissions at the moment they are needed.

## Gallery

Request when employee selects:

```text
Choose From Gallery
```

## Camera

Request when employee selects:

```text
Take Photo
```

Do not request unrelated device permissions on first app launch.

The app does not need:

- contacts
- location
- microphone

unless a future feature specifically requires them.

---

# 59. Security Checklist for the Mobile App

- [ ] Production API uses HTTPS.
- [ ] JWT stored in SecureStore.
- [ ] Password is not stored.
- [ ] Database credentials are not in app.
- [ ] JWT secret is not in app.
- [ ] Acting employee ID comes from token.
- [ ] Employee directory requires auth.
- [ ] Calendar update/delete checks authorization.
- [ ] Expired JWT causes logout.
- [ ] Deactivated account token is rejected.
- [ ] Mandatory password change enforced by backend.
- [ ] Mobile JWT lifetime is reasonable.
- [ ] Login rate limiting considered.
- [ ] Production backend requires a real `JWT_SECRET`.
- [ ] Upload type/size still validated server-side.
- [ ] Destructive actions require confirmation.
- [ ] No raw internal server errors shown to users.

---

# 60. cPanel and CORS Notes

Your server currently uses browser CORS configuration for the web frontend.

A native Android app is not a browser page, so normal browser CORS restrictions are not the same runtime constraint.

Do not weaken your web CORS policy simply because you added the mobile app.

Continue allowing the existing web frontend origin.

Mobile authentication is based on:

```text
Authorization: Bearer ...
```

not cross-site cookies.

## Production API

Use:

```text
https://your-domain.com/api
```

Never use production:

```text
http://
```

for employee authentication.

---

# 61. Do Not Use `localhost` From a Physical Phone

If your backend is on your laptop:

```text
http://localhost:5000
```

inside the Android phone refers to the phone itself, not your PC.

Because your backend is already hosted on cPanel, the easiest development approach is:

```text
mobile app
    ↓
production/staging HTTPS API
```

For safe development, a staging server/database is better than using production data.

If you test against production, be very careful with create/delete operations.

---

# 62. Recommended Staging Strategy

Best setup:

```text
Production:
https://office.yourdomain.com/api

Staging:
https://staging-office.yourdomain.com/api
```

Then:

Development `.env`:

```env
EXPO_PUBLIC_API_URL=https://staging-office.yourdomain.com/api
```

Production EAS environment:

```text
EXPO_PUBLIC_API_URL=https://office.yourdomain.com/api
```

Avoid experimenting with destructive endpoints against production.

---

# 63. Git Strategy

Add:

```text
mobile/
```

to the same repository.

Use commits per chunk.

Examples:

```text
feat(mobile): initialize expo javascript app
feat(api): support mobile bearer authentication
fix(api): derive acting employee from jwt
feat(mobile): add secure auth flow
feat(mobile): add client list
feat(mobile): add calls
feat(mobile): add meetings
feat(mobile): add image uploads
feat(mobile): add calendar
```

Do not commit:

```text
mobile/node_modules/
mobile/.env
```

Commit:

```text
mobile/.env.example
mobile/package-lock.json
```

---

# 64. Suggested `mobile/.gitignore`

Include at least:

```gitignore
node_modules/
.expo/
dist/
web-build/

.env
.env.local
.env.*.local

*.jks
*.keystore
*.p8
*.p12
*.key
*.mobileprovision

android/
ios/
```

Whether you ignore generated `android/`/`ios/` depends on whether you adopt Expo Continuous Native Generation/prebuild workflow.

For an Expo-managed/CNG project, generally do not manually maintain native folders unless you intentionally need them.

---

# 65. App Configuration

Configure:

```text
mobile/app.json
```

Example concept:

```json
{
  "expo": {
    "name": "Make My Event",
    "slug": "make-my-event-office",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "makemyevent",
    "userInterfaceStyle": "light",
    "android": {
      "package": "com.makemyevent.office"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Make My Event to select meeting images.",
          "cameraPermission": "Allow Make My Event to take meeting photos."
        }
      ]
    ]
  }
}
```

Choose your final Android package name carefully.

Once distributed through Play Store, changing package identity creates a different application.

---

# 66. App Naming and Versioning

Recommended initial:

```text
Display Name:
Make My Event

Android package:
com.makemyevent.office
```

Use semantic app versions:

```text
1.0.0
1.0.1
1.1.0
2.0.0
```

Meaning:

```text
patch:
bug fix

minor:
backward-compatible feature

major:
large/breaking app change
```

---

# 67. CHUNK 31 — Android Development Build

As the project starts using native capabilities, use an Expo development build.

Install EAS CLI:

```powershell
npm install -g eas-cli
```

Login:

```powershell
eas login
```

Inside:

```text
mobile/
```

run:

```powershell
eas build:configure
```

Add development profile in:

```text
eas.json
```

Concept:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Development build:

```powershell
eas build --platform android --profile development
```

Install it on your test phone.

Then use:

```powershell
npx expo start --dev-client
```

for development.

---

# 68. CHUNK 32 — Build an Installable APK

For internal employee distribution:

```powershell
eas build --platform android --profile preview
```

The output should be an installable:

```text
.apk
```

Employees can install it directly according to Android's installation/security rules.

## APK use case

Best for:

- internal testing
- employee-only deployment
- small controlled group
- QA

---

# 69. CHUNK 33 — Production AAB

If later publishing through Google Play:

```powershell
eas build --platform android --profile production
```

Production Play builds normally use:

```text
.aab
```

Do not confuse:

```text
APK = directly installable package

AAB = app bundle used for store distribution
```

---

# 70. What Changes Require a New APK?

## Mobile UI/code changes

Examples:

```text
new screen
new native package
new button behavior
new navigation
new client-side feature
```

Normally require an updated mobile build or an appropriate Expo Update strategy later.

For V1, keep the mental model simple:

```text
mobile source changed
    ↓
build new APK
```

## Backend-only changes

If you change:

```text
callsController.js
```

but keep the same compatible API request/response contract:

```text
deploy backend to cPanel
```

The already installed app uses the new behavior immediately.

No new APK is necessary for purely compatible server-side logic.

---

# 71. Backend Deployment After Mobile Changes

You do **not** upload `mobile/` to cPanel.

You **do** deploy backend files when adding:

```text
mobile auth
bearer middleware
dashboard API
security fixes
client APIs
notification APIs
```

Your existing GitHub/cPanel workflow can continue handling backend deployment.

If database schema changes are required, apply those migrations carefully according to your cPanel database process.

---

# 72. Existing Database Migration Warning

Your project currently contains both:

```text
prisma/migrations/
```

and several separate SQL migration files under:

```text
database/
```

Before mobile introduces new tables, make the database migration process authoritative and reproducible.

This matters particularly before adding future tables like:

```text
employee_devices
refresh_tokens
mobile_sessions
```

Do not create production tables manually without documenting them in the canonical migration path.

---

# 73. Testing Strategy

Test at three levels.

## 1. Backend/API tests

Critical:

- mobile login
- invalid login
- bearer auth
- expired token
- deactivated employee
- password-change restriction
- employee spoofing prevention
- calls
- meetings
- calendar authorization
- image uploads

## 2. Mobile component/logic tests

Useful for:

- date formatting
- client workspace normalization
- validation helpers
- query invalidation logic
- auth reducer/context behavior

## 3. Real-device integration tests

Test on an actual Android phone:

- login
- app restart
- bad network
- phone dialer
- camera permission
- gallery permission
- image upload
- large image
- call create
- meeting create
- next assignment
- calendar
- logout

---

# 74. Minimum Pre-Release Manual Test Checklist

## Authentication

- [ ] Valid employee can login.
- [ ] Wrong password rejected.
- [ ] Admin cannot login as employee if that remains the business rule.
- [ ] Deactivated employee rejected.
- [ ] App restarts while logged in.
- [ ] Expired token returns to login.
- [ ] Mandatory password change works.
- [ ] Logout removes token.

## Clients

- [ ] Client list loads.
- [ ] Search works.
- [ ] Client details map correct dynamic columns.
- [ ] Missing data does not crash screen.
- [ ] `N/A` displays acceptably.
- [ ] Phone link opens dialer.

## Calls

- [ ] Calls load.
- [ ] New call uses server time.
- [ ] Discussion saves.
- [ ] Next call saves.
- [ ] Next call employee assignment saves.
- [ ] Refresh shows new call.
- [ ] Web app immediately sees mobile-created call.

## Meetings

- [ ] Meetings load.
- [ ] New meeting uses server time.
- [ ] Previous items/images copy-forward correctly.
- [ ] Next meeting saves.
- [ ] Assignee saves.
- [ ] Complete toggle works.
- [ ] Web app sees changes.

## Items

- [ ] Create item.
- [ ] Update description.
- [ ] Update quantity.
- [ ] Other custom label works.
- [ ] Delete item.

## Images

- [ ] Camera permission.
- [ ] Gallery permission.
- [ ] Upload one image.
- [ ] Upload multiple.
- [ ] 10-file limit handled.
- [ ] Oversized image error handled.
- [ ] Unsupported type error handled.
- [ ] Image appears on web.
- [ ] Delete image.
- [ ] Final selection works.

## Calendar

- [ ] Month loads.
- [ ] Correct dates in Bangladesh timezone.
- [ ] Day screen loads.
- [ ] Calls shown.
- [ ] Meetings shown.
- [ ] Next calls shown.
- [ ] Next meetings shown.
- [ ] Manual event create/update/delete.
- [ ] Cannot edit unauthorized employee event.

## Network

- [ ] App shows meaningful offline state.
- [ ] Failed mutation does not pretend success.
- [ ] Retry works after network returns.

---

# 75. Performance Rules

## Client list

Use:

```text
FlatList
```

Do not render hundreds of clients in a plain `ScrollView`.

## Images

Use:

```text
expo-image
```

Use appropriately sized thumbnails instead of loading huge images full-size in every card.

## Queries

Do not refetch everything after every small UI event.

Use query-specific invalidation.

## Dashboard

Use a compact dashboard API rather than loading all business data.

## Future client endpoint

If client count grows large, add:

```text
pagination
search query
server-side filters
```

Example:

```text
GET /api/clients?page=1&limit=30&search=rahim
```

---

# 76. Mobile App Data Ownership Rule

Remember:

```text
TanStack Query cache
```

is not the source of truth.

```text
React state
```

is not the source of truth.

```text
SecureStore
```

is not the source of business data.

The source of truth is:

```text
MySQL database
```

through:

```text
Express API
```

The mobile app should refetch/invalidate after successful changes.

---

# 77. Suggested Feature API Files

## `authApi.js`

```text
mobileLogin
getCurrentEmployee
changePassword
```

## `dashboardApi.js`

```text
getDashboard
```

## `clientsApi.js`

V1:

```text
getWorkspace
getNormalizedClients
getNormalizedClient
```

Later:

```text
getClients
getClient
updateClient
```

## `callsApi.js`

```text
getCalls
createCall
updateCall
deleteCall
```

## `meetingsApi.js`

```text
getMeetings
createMeeting
updateMeeting
toggleMeetingComplete
createMeetingItem
updateMeetingItem
deleteMeetingItem
toggleFinalImage
updateImageTag
finalizeClient
deleteMeeting
```

## `uploadsApi.js`

```text
uploadMeetingImages
uploadMeetingItemImages
```

## `calendarApi.js`

```text
getCalendarMonth
createCalendarEvent
updateCalendarEvent
deleteCalendarEvent
```

## `employeesApi.js`

```text
getEmployeeDirectory
```

---

# 78. Suggested Custom Hooks

## `useDashboard.js`

Returns:

```text
data
isLoading
isError
refetch
```

## `useClients.js`

Returns normalized client list.

## `useClient.js`

Selects one normalized client by `rowKey`.

## `useCalls.js`

Loads:

```text
["calls", rowKey]
```

## `useMeetings.js`

Loads:

```text
["meetings", rowKey]
```

## `useCalendar.js`

Loads:

```text
["calendar", year, month]
```

## `useAuth.js`

Reads AuthContext.

---

# 79. Navigation Map

Final main navigation:

```text
Login
 └── Change Password
      └── Main App

Main App
├── Home
├── Clients
│   └── Client Details
│       ├── Calls
│       │   ├── New Call
│       │   └── Call Detail
│       │
│       └── Meetings
│           ├── New Meeting
│           └── Meeting Detail
│               ├── Items
│               └── Images
│
├── Calendar
│   └── Day
│
├── Follow-ups
│
└── Profile
    ├── Change Password
    └── Logout
```

---

# 80. Screen-by-Screen Data Source

| Screen | Primary API |
|---|---|
| Login | `POST /api/mobile/auth/login` |
| Auth restore | `GET /api/employees/me` |
| Change password | `POST /api/employees/change-password` |
| Home | `GET /api/mobile/dashboard` |
| Clients | `GET /api/workspace/default` initially |
| Client detail | workspace + calls/meetings as needed |
| Calls | `GET /api/calls/:rowKey` |
| Create call | `POST /api/calls/:rowKey` |
| Update call | `PUT /api/calls/:rowKey/:callId` |
| Meetings | `GET /api/meetings/:rowKey` |
| Create meeting | `POST /api/meetings/:rowKey` |
| Update meeting | `PUT /api/meetings/:rowKey/:meetingId` |
| Complete meeting | `PATCH .../complete` |
| Meeting image | `POST .../images` |
| Meeting item | `POST/PUT/DELETE .../items` |
| Item image | `POST .../items/:itemId/images` |
| Calendar | `GET /api/calendar` |
| Manual event | `/api/calendar/events` |
| Follow-ups | calendar initially or new mobile endpoint |
| Employee assignee list | `GET /api/employees` |

---

# 81. Recommended Complete Work Order

Do not jump randomly between features.

Follow this order.

## Chunk 1 — Backend hardening

```text
Bearer auth
actor ID security
password-change enforcement
directory auth
calendar ownership
dashboard endpoint
```

## Chunk 2 — Expo JavaScript project

```text
create project
convert TS template to JS
router works
```

## Chunk 3 — Core packages

```text
TanStack Query
SecureStore
React Hook Form
ImagePicker
Image
DateTimePicker
NetInfo
```

## Chunk 4 — Configuration

```text
.env
API URL
config.js
```

## Chunk 5 — API foundation

```text
SecureStore
apiRequest
ApiError
QueryProvider
```

## Chunk 6 — Authentication UI

```text
AuthContext
Login
restore session
change password
logout
route protection
```

## Chunk 7 — Shared UI

```text
buttons
inputs
cards
loading
error
empty states
modal
```

## Chunk 8 — Dashboard

```text
summary
today's schedule
refresh
```

## Chunk 9 — Clients read-only

```text
workspace loading
dynamic column mapping
search
client card
client details
phone dialer
```

## Chunk 10 — Calls

```text
history
create
edit
next call
assignment
delete
```

## Chunk 11 — Meetings

```text
history
create
next meeting
assignment
complete
delete
```

## Chunk 12 — Meeting items

```text
create/update/delete
quantity
other label
```

## Chunk 13 — Images

```text
camera/gallery
meeting uploads
item uploads
delete
tags
final selection
```

## Chunk 14 — Calendar

```text
month
day
manual event
```

## Chunk 15 — Follow-ups

```text
overdue
today
upcoming
calls/meetings filters
```

## Chunk 16 — Polish

```text
network states
pull-to-refresh
empty states
confirmations
performance
```

## Chunk 17 — Real-device QA

```text
full test checklist
```

## Chunk 18 — APK

```text
EAS
preview profile
APK
internal distribution
```

## Chunk 19 — Production release

```text
versioning
production API
final backend deploy
final APK/AAB
```

---

# 82. Do Not Start a Chunk Until the Previous Foundation Is Stable

Examples:

Do not build Meetings before:

```text
authentication
API client
query provider
client rowKey navigation
```

Do not build image uploads before:

```text
meeting detail
bearer auth
multipart upload API tested
```

Do not build notifications before:

```text
core calendar/follow-up workflow works correctly
```

This prevents debugging many layers at once.

---

# 83. Definition of Mobile V1 Done

The mobile application is V1-ready when an employee can:

1. install the APK;
2. log in with the same employee account used by the web system;
3. be forced to change a temporary password when required;
4. reopen the app and remain logged in while the token is valid;
5. view clients from the existing database;
6. search clients;
7. open a client;
8. tap the client's phone number and open Android dialer;
9. record a call;
10. schedule/assign the next call;
11. view meeting history;
12. create a meeting;
13. schedule/assign the next meeting;
14. manage meeting items;
15. take/select and upload meeting images;
16. view images uploaded through the web app;
17. mark final image selections;
18. use the employee calendar;
19. see follow-ups;
20. log out;
21. see all mobile changes immediately in the existing web application.

And the following must also be true:

- the web app still works;
- the admin app still works;
- both clients use the same backend/database;
- mobile source is not hosted as a web folder on cPanel;
- database credentials never exist in the APK;
- acting employee identity cannot be spoofed through request body IDs.

---

# 84. Future Phase — Push Notifications

Do this only after V1.

Use:

```text
expo-notifications
```

Potential notifications:

```text
Meeting in 30 minutes
Call follow-up at 5:30 PM
New meeting assignment
New call assignment
Overdue follow-up
```

Likely database table:

```text
employee_devices
```

Fields:

```text
id
employee_id
expo_push_token
platform
device_name
is_active
created_at
updated_at
last_used_at
```

Flow:

```text
Employee logs in
     ↓
app gets push token
     ↓
POST /api/mobile/devices
     ↓
backend stores device token
```

Backend can later send reminders.

Do not couple basic mobile login to notifications.

---

# 85. Future Phase — Refresh Tokens / Session Revocation

V1 can use a reasonable access-token lifetime.

Later implement stronger native sessions.

Possible model:

```text
mobile_sessions
```

Fields:

```text
id
employee_id
refresh_token_hash
device_name
expires_at
revoked_at
created_at
last_used_at
```

Then:

```text
access token = short-lived
refresh token = long-lived
```

Password reset/deactivation should revoke sessions.

---

# 86. Future Phase — Offline Support

Do not implement true offline editing in V1.

Later architecture could be:

```text
server data
   ↓
local persisted cache
   ↓
offline drafts
   ↓
sync queue
   ↓
conflict resolution
```

This becomes complicated because the same client may be edited from:

```text
web
+
multiple phones
```

Only add it when the business needs it.

---

# 87. Future Phase — Client Editing

When you want client editing from Android, first create safe granular backend APIs.

Recommended:

```text
GET    /api/clients
GET    /api/clients/:rowKey
POST   /api/clients
PATCH  /api/clients/:rowKey
DELETE /api/clients/:rowKey
```

Do not use:

```text
PUT /api/workspace/default
```

for a one-field mobile edit.

This prevents stale phone data from accidentally deleting changes created by other employees.

---

# 88. Future Phase — Mobile Admin

Do not mix admin and employee V1.

If needed later, add a separate route group:

```text
(app)/
└── admin/
```

or a separate app if security/UX requirements become very different.

Admin mobile could later support:

- dashboard
- employee status
- activity
- missed follow-ups
- calendar
- quick client lookup

But desktop remains better for account administration and bulk spreadsheet work.

---

# 89. Recommended AI/Copilot Development Rules

If using GitHub Copilot/AI coding agents, add a project-specific instruction file in `mobile/`.

For example:

```text
mobile/AGENTS.md
```

or the tool-specific instruction mechanism you use.

Important rules to include:

```text
- JavaScript only; no TypeScript.
- Use Expo Router.
- Use TanStack Query for backend/server state.
- Use React Context only for authentication/global session.
- Use SecureStore for JWT.
- Never store passwords.
- Never connect directly to MySQL.
- Never send the acting employee ID to APIs.
- Reuse services/api/client.js for JSON APIs.
- Use FormData only for image uploads.
- Do not manually set multipart boundary.
- Keep route components small.
- Put reusable UI in components/.
- Put backend calls in services/api/.
- Put reusable server queries in hooks/.
- Keep Bangladesh date/time handling centralized in utils/dates.js.
- Do not recreate backend business rules in mobile.
- Never modify production database schema from mobile code.
- Existing web APIs must remain backward-compatible.
```

This will help prevent AI tools from creating a second architecture accidentally.

---

# 90. Recommended Documentation Files

Inside `mobile/` maintain:

```text
README.md
ARCHITECTURE.md
API_NOTES.md
```

## `README.md`

Include:

```text
install
environment variables
run development
EAS build
APK build
```

## `ARCHITECTURE.md`

Include:

```text
folder ownership
state management
routing
auth flow
query conventions
```

## `API_NOTES.md`

Include:

```text
endpoint
method
request
response
query invalidation
```

This handbook can serve as the starting implementation document.

---

# 91. Production Release Procedure

Use this exact mental model.

## Step 1 — Backend

Merge backend mobile-support changes.

## Step 2 — Database

If database changes exist:

- backup database;
- apply reviewed migration;
- verify schema.

## Step 3 — cPanel deploy

Deploy:

```text
backend changes
web changes if any
```

Do not deploy `mobile/` as web content.

## Step 4 — Verify server

Check:

```text
/api/health
mobile login
/me
clients
calls
meetings
calendar
images
```

## Step 5 — Set mobile production environment

Ensure:

```text
EXPO_PUBLIC_API_URL
```

points to production HTTPS API.

## Step 6 — Increment version

Example:

```text
1.0.0
```

## Step 7 — EAS preview build

Create internal APK.

## Step 8 — QA APK on a real Android phone

Complete release checklist.

## Step 9 — Distribute

Internal:

```text
APK
```

or later:

```text
Google Play / AAB
```

---

# 92. What Happens When Mobile Creates Data?

Example call:

```text
Employee opens Android
     ↓
Client "Rahim"
     ↓
Add Call
     ↓
POST /api/calls/{rowKey}
     ↓
cPanel Express
     ↓
callsController
     ↓
Prisma
     ↓
client_calls table
```

Then the employee/admin opens the website:

```text
React web
    ↓
same /api
    ↓
same database
```

The call is already there.

No "mobile-to-web sync" is required.

They are both reading the same database through the same server.

---

# 93. What Happens When Web Creates Data?

The reverse is also true.

```text
Website creates next meeting
     ↓
backend
     ↓
database
```

The Android app then:

```text
refetches
     ↓
shows next meeting
```

Again, no separate sync database exists.

---

# 94. What Happens With Images?

Mobile:

```text
camera/gallery
    ↓
FormData
    ↓
POST /api/meetings/.../images
    ↓
Multer
    ↓
cPanel uploads/meeting-images/
    ↓
image row in database
```

Web:

```text
GET meeting
    ↓
receives same image URL
    ↓
loads /uploads/meeting-images/...
```

Web and mobile display the same physical file.

---

# 95. Final Architecture Summary

```text
                            USERS

                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼

        Desktop / Browser          Android Phone

        React + Vite              React Native + Expo
        Existing Web              New Mobile App
        Cookie JWT                Bearer JWT
                 │                       │
                 │       HTTPS API       │
                 └───────────┬───────────┘
                             │
                             ▼

                Existing cPanel Server
              ┌──────────────────────────┐
              │ Express                  │
              │ Authentication           │
              │ Authorization            │
              │ Calls                    │
              │ Meetings                 │
              │ Calendar                 │
              │ Workspace/Clients        │
              │ Uploads                  │
              └─────────────┬────────────┘
                            │
                          Prisma
                            │
                            ▼

                   Existing MySQL DB
```

Separate build/deployment:

```text
Web/Backend
GitHub
   ↓
existing cPanel deployment


Mobile
mobile/ source
   ↓
EAS Build
   ↓
APK / AAB
   ↓
Android devices
```

---

# 96. Technology/Tooling Notes Verified for This Plan

At the time this handbook was prepared, Expo's current documentation recommends creating a new multi-screen Expo project using the SDK 57 default template, which includes Expo Router and TypeScript configuration. This project deliberately converts the application files to JavaScript because this codebase has chosen JavaScript.

Official references:

- [Expo — create-expo-app](https://docs.expo.dev/more/create-expo/)
- [Expo Router — Introduction](https://docs.expo.dev/router/introduction/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Expo Network / NetInfo references](https://docs.expo.dev/versions/latest/sdk/netinfo/)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Android APK builds](https://docs.expo.dev/build-reference/apk/)
- [TanStack Query — React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)

When starting implementation later, always let:

```text
npx expo install
```

choose SDK-compatible Expo/native-package versions instead of manually copying old package versions from tutorials.

---

# 97. Master Checklist

## Existing backend

- [ ] Backup production database before structural changes.
- [ ] Add cookie + bearer `requireEmployee`.
- [ ] Add mobile login endpoint.
- [ ] Use trusted `req.employee.id` for actor.
- [ ] Remove acting `employeeId` requirement from mobile-facing mutations.
- [ ] Protect employee directory.
- [ ] Fix calendar ownership.
- [ ] Enforce password-change server-side.
- [ ] Use sensible mobile token expiry.
- [ ] Add mobile dashboard.
- [ ] Test existing web after backend changes.

## Mobile foundation

- [ ] Create `mobile/`.
- [ ] Use JavaScript only.
- [ ] Keep Expo Router.
- [ ] Install core packages.
- [ ] Add `.env`.
- [ ] Add config.
- [ ] Add SecureStore.
- [ ] Add API client.
- [ ] Add QueryProvider.
- [ ] Add AuthContext.
- [ ] Add protected routing.

## UI

- [ ] Common components.
- [ ] Login.
- [ ] Change password.
- [ ] Tabs.
- [ ] Dashboard.
- [ ] Clients.
- [ ] Client detail.
- [ ] Calls.
- [ ] Meetings.
- [ ] Items.
- [ ] Images.
- [ ] Calendar.
- [ ] Follow-ups.
- [ ] Profile.

## Quality

- [ ] Network states.
- [ ] Error states.
- [ ] Loading states.
- [ ] Empty states.
- [ ] Pull-to-refresh.
- [ ] Mutation loading.
- [ ] Delete confirmations.
- [ ] Date/time verified.
- [ ] Real device tested.
- [ ] Same data visible on web/mobile.

## Release

- [ ] Configure EAS.
- [ ] Configure Android package.
- [ ] Configure app icon/splash.
- [ ] Configure production API URL.
- [ ] Build preview APK.
- [ ] Full QA.
- [ ] Build production release.
- [ ] Distribute APK or AAB.

---

# 98. Final Rule Set

When implementing this application, keep these rules visible:

1. **One backend.**
2. **One database.**
3. **Two clients: Web + Android.**
4. **Do not host React Native source on cPanel.**
5. **Build `mobile/` into APK/AAB.**
6. **Android calls the cPanel API over HTTPS.**
7. **Never expose database credentials to Android.**
8. **Use JavaScript only in mobile.**
9. **Use Expo Router for navigation.**
10. **Use TanStack Query for server state.**
11. **Use SecureStore for JWT.**
12. **Use React Context for auth state.**
13. **Use React Hook Form for forms.**
14. **Use ImagePicker + FormData for meeting photos.**
15. **Never trust acting `employeeId` from the app.**
16. **The backend owns business rules.**
17. **The mobile app owns mobile UX.**
18. **Do not copy the desktop spreadsheet UI to mobile.**
19. **Build features chunk-by-chunk.**
20. **Do not proceed to APK release until real-device end-to-end tests pass.**

---

# 99. Starting Point

The first actual development work should **not** be the Home screen.

Start with:

```text
CHUNK 1
Backend mobile readiness + security hardening
```

Then:

```text
CHUNK 2
Create the Expo JavaScript project
```

Then:

```text
CHUNKS 3–10
Foundation + authentication + shared UI
```

Only after that begin the business features:

```text
Dashboard
Clients
Calls
Meetings
Images
Calendar
Follow-ups
```

That order gives the project a stable base and prevents duplicated or insecure API logic from spreading through the Android codebase.
