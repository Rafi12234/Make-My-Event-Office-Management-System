# Attendance System Version 1 — Project-Specific Implementation Guide

## Make My Event Office Management System

> This guide is written specifically for the existing **Make My Event Office Management System** project after reviewing the current mobile app, backend, authentication flow, database setup, and admin-panel architecture.

---

# 1. Feature Overview

Version 1 adds a simple employee attendance system to the existing application.

## Employee Features

Employees can:

- Open the Attendance screen from the mobile app.
- Sign In when entering the office.
- Sign Out when leaving the office.
- Allow foreground location access before Sign In or Sign Out.
- Capture the employee's current GPS latitude, longitude, and accuracy during both actions.
- View today's attendance state.
- View attendance history.

## Admin Features

Admins can:

- View employee attendance records from the existing admin web panel.
- Filter attendance by employee.
- Filter attendance by date or date range.
- View Sign In and Sign Out locations.
- View GPS accuracy.
- View calculated working duration.

---

# 2. Version 1 Scope

## Included

### Employee

- Attendance tab/screen.
- Sign In.
- Sign Out.
- Android/iOS foreground location permission.
- Current GPS location capture.
- GPS accuracy capture.
- Today's attendance status.
- Attendance history.

### Admin

- Attendance Management page.
- Attendance list.
- Employee filter.
- Date/date-range filter.
- Sign In location view.
- Sign Out location view.
- Working-duration display.

## Not Included

Version 1 does **not** include:

- Continuous GPS tracking.
- Background GPS tracking.
- Geofencing.
- Wi-Fi verification.
- Face recognition.
- Selfie verification.
- QR attendance.
- Automatic late/early-leave rules.
- Leave management.
- Payroll calculation.
- Automatic attendance reports.

These can be introduced in later versions.

---

# 3. Existing Project Architecture

The existing project already uses the following architecture:

```text
React Native + Expo Mobile App
        |
        | Bearer JWT
        |
        v
Node.js + Express Backend
        |
        | Prisma ORM
        |
        v
MySQL / MariaDB
        ^
        |
        | Admin session cookie
        |
React Admin Web Panel
```

Important:

- The employee mobile app and admin web panel use the **same backend/database**.
- They do **not** use the same authentication middleware.
- Employee mobile requests use a **Bearer JWT**.
- Admin web requests use the existing **admin session cookie**.

---

# 4. Authentication Architecture

## 4.1 Employee Mobile Authentication

The current mobile app already stores the employee JWT and sends it with API requests.

Flow:

```text
Employee Login
     |
     v
JWT issued by backend
     |
     v
Stored securely in mobile app
     |
     v
Authorization: Bearer <token>
     |
     v
attachBearerToken
     |
     v
requireEmployee
     |
     v
req.employee.id
```

### Important Security Rule

The mobile app must **never send `employeeId`** during Sign In or Sign Out.

Wrong:

```json
{
  "employeeId": 20,
  "latitude": 23.7808,
  "longitude": 90.4075
}
```

Correct:

```json
{
  "latitude": 23.7808,
  "longitude": 90.4075,
  "accuracy": 15
}
```

The backend determines the employee from:

```js
req.employee.id
```

---

# 5. Admin Authentication

The admin website uses its existing admin session authentication.

Admin attendance routes must be protected with the project's existing admin middleware.

Conceptually:

```text
Admin Browser
     |
     v
mme_admin_session cookie
     |
     v
requireAdmin
     |
     v
Admin Attendance API
```

Do not protect admin attendance routes with employee JWT middleware.

---

# 6. Business Time / Attendance Date

Attendance time must be created by the backend.

The mobile app must not send:

- `attendanceDate`
- `signInAt`
- `signOutAt`

The backend should use the project's existing **Asia/Dhaka business-time handling** when determining the attendance day.

This is important because the production server may run in UTC.

Example:

```text
Dhaka Time:
29 Aug 2026, 01:30 AM

UTC Server Time:
28 Aug 2026, 07:30 PM
```

If the backend uses the wrong timezone when deriving `attendanceDate`, attendance may be saved under the previous day.

Therefore:

```text
Attendance Date = Asia/Dhaka business date
```

Use the existing project date/time utility rather than creating a separate timezone system.

---

# 7. Database Design

Create one new Attendance model/table.

Recommended fields:

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `employeeId` | Foreign key to Employee |
| `attendanceDate` | Bangladesh business date |
| `signInAt` | Backend-generated Sign In timestamp |
| `signInLatitude` | Sign In latitude |
| `signInLongitude` | Sign In longitude |
| `signInAccuracy` | GPS accuracy in meters |
| `signOutAt` | Backend-generated Sign Out timestamp; nullable |
| `signOutLatitude` | Sign Out latitude; nullable |
| `signOutLongitude` | Sign Out longitude; nullable |
| `signOutAccuracy` | Sign Out GPS accuracy; nullable |
| `createdAt` | Created timestamp |
| `updatedAt` | Updated timestamp |

Relationship:

```text
Employee 1 -------- N Attendance
```

## Important Type Rule

The existing Employee primary key uses an unsigned BigInt.

Therefore `Attendance.employeeId` must use the matching type.

Conceptually:

```prisma
employeeId BigInt @db.UnsignedBigInt
```

Do not use a normal 32-bit integer if the Employee ID is BigInt.

---

# 8. One Attendance Record Per Employee Per Day

Version 1 uses one attendance record for one employee on one business date.

Rule:

```text
One Employee + One Attendance Date
            =
One Attendance Record
```

Database constraint:

```text
UNIQUE(employeeId, attendanceDate)
```

This prevents accidental duplicate Sign In records.

Example:

```text
Employee 15 + 2026-08-28
```

can appear only once.

---

# 9. Prisma + SQL Migration

The project already uses Prisma and deployment SQL migration files.

Implementation must include both:

```text
backend/mme_node_express_backend/prisma/schema.prisma
```

and an additive SQL migration file, following the existing project convention, for example:

```text
backend/mme_node_express_backend/database/add_attendance_system_migration.sql
```

Do **not** drop or recreate the current production database just to add attendance.

The attendance change should be additive and backward-compatible.

---

# 10. Recommended Backend Structure

Follow the project's existing backend conventions.

Recommended files:

```text
backend/mme_node_express_backend/src/

controllers/
    attendanceController.js
    adminAttendanceController.js

routes/
    attendance.js
    adminAttendance.js
```

A new `services/attendanceService.js` layer is **not required for Version 1** because the current project normally allows controllers to work directly with Prisma.

If attendance logic becomes much larger later, it can be extracted into a service layer.

---

# 11. Employee Attendance APIs

Employee attendance routes use:

```text
attachBearerToken
        +
requireEmployee
```

Recommended base path:

```text
/api/attendance
```

---

## 11.1 Get Today's Attendance

```http
GET /api/attendance/today
```

Backend:

1. Validate employee JWT.
2. Read `req.employee.id`.
3. Determine today's Asia/Dhaka business date.
4. Find today's attendance record.
5. Return the attendance data and calculated status.

Possible calculated statuses:

```text
No record
    |
    v
Absent
```

```text
signInAt exists
signOutAt is null
    |
    v
Working
```

```text
signInAt exists
signOutAt exists
    |
    v
Completed
```

Do not store a separate status column for Version 1.

---

# 12. Sign In API

```http
POST /api/attendance/sign-in
```

Request body:

```json
{
  "latitude": 23.7808,
  "longitude": 90.4075,
  "accuracy": 15
}
```

## Backend Process

1. Validate employee JWT.
2. Read employee from `req.employee`.
3. Validate latitude.
4. Validate longitude.
5. Validate accuracy.
6. Determine current Asia/Dhaka attendance date.
7. Generate Sign In timestamp on the backend.
8. Check whether today's attendance record already exists.
9. If already signed in, return an appropriate error.
10. Otherwise create the attendance record.
11. Return the created attendance state.

## Coordinate Validation

Backend must validate:

```text
Latitude:
-90 <= latitude <= 90

Longitude:
-180 <= longitude <= 180

Accuracy:
accuracy >= 0
```

The backend must not blindly trust GPS values received from the phone.

---

# 13. Sign Out API

```http
POST /api/attendance/sign-out
```

Request body:

```json
{
  "latitude": 23.7810,
  "longitude": 90.4079,
  "accuracy": 12
}
```

## Backend Process

1. Validate employee JWT.
2. Read employee from `req.employee`.
3. Validate latitude/longitude/accuracy.
4. Determine current Asia/Dhaka attendance date.
5. Find today's attendance record.
6. If there is no Sign In record, reject the Sign Out.
7. If already signed out, reject the duplicate request.
8. Generate Sign Out timestamp on the backend.
9. Save Sign Out coordinates and GPS accuracy.
10. Return updated attendance.

---

# 14. Employee Attendance History API

The original Version 1 scope includes attendance history, so the API must exist.

Recommended:

```http
GET /api/attendance/history
```

Optional pagination:

```http
GET /api/attendance/history?limit=30
```

Important:

The employee ID must still come from:

```js
req.employee.id
```

The mobile app must not be allowed to request another employee's attendance history by sending another employee ID.

---

# 15. Admin Attendance APIs

Admin routes must use the existing admin authentication middleware.

Recommended base path:

```text
/api/admin/attendance
```

## Attendance List

```http
GET /api/admin/attendance
```

Supported filters can include:

```http
GET /api/admin/attendance?date=2026-08-28
```

```http
GET /api/admin/attendance?employeeId=15
```

```http
GET /api/admin/attendance?from=2026-08-01&to=2026-08-31
```

```http
GET /api/admin/attendance?employeeId=15&date=2026-08-28
```

## Attendance Detail

Optional but recommended:

```http
GET /api/admin/attendance/:attendanceId
```

This can return the complete record including both locations and GPS accuracy.

---

# 16. Backend Route Registration

Creating route files is not enough.

The routes must also be mounted in the project's existing backend server configuration.

Conceptually:

```text
/api/attendance
      |
      v
attachBearerToken
      |
      v
requireEmployee
      |
      v
attendance routes
```

and separately:

```text
/api/admin/attendance
      |
      v
requireAdmin
      |
      v
admin attendance routes
```

Follow the same registration pattern already used by the existing backend routes.

---

# 17. Mobile Installation

Install Expo Location using:

```bash
npx expo install expo-location
```

Only **foreground location** is required for Version 1.

Do not request background-location permission.

---

# 18. Important Expo Build Requirement

`expo-location` contains native functionality.

Because this project uses custom Expo development/preview builds, adding `expo-location` may require rebuilding the installed app.

Recommended flow:

```text
Install expo-location
        |
        v
Update Expo location permission configuration
        |
        v
Rebuild development-client / preview APK
        |
        v
Install the new APK
        |
        v
Test location permission and GPS
```

Do not assume an old custom development-client APK automatically contains a newly added native module.

---

# 19. Mobile File Structure

The existing mobile project uses Expo Router tabs, API services, hooks, and centralized query keys.

Recommended attendance structure:

```text
mobile/

app/
    (tabs)/
        attendance.jsx

hooks/
    useAttendance.js

services/
    api/
        attendanceApi.js

    locationService.js

constants/
    queryKeys.js
```

Also update:

```text
app/(tabs)/_layout.jsx
```

to expose the Attendance screen in the tab navigation.

Example:

```text
Dashboard | Clients | Attendance
```

---

# 20. Location Permission Gate — Required Behavior

This is a critical Version 1 rule.

When the employee taps **SIGN IN**, the app must **not immediately send the Sign In API request**.

The app must first confirm that location permission has been granted and that a valid current location has been obtained.

## Sign In Permission Flow

```text
Employee taps SIGN IN
        |
        v
Does app already have foreground
location permission?
        |
   +----+----+
   |         |
  YES        NO
   |         |
   |         v
   |   Android/iOS permission prompt
   |         |
   |    +----+----+
   |    |         |
   |  ALLOW      DENY
   |    |         |
   |    |         v
   |    |    DO NOT SIGN IN
   |    |         |
   |    |         v
   |    |    Show:
   |    |    "Location permission is
   |    |     required to Sign In."
   |    |
   +----+
        |
        v
Check location service/GPS
        |
        v
Get CURRENT location
        |
        v
Validate location was obtained
        |
        v
Send latitude + longitude + accuracy
to Sign In API
        |
        v
Backend creates attendance
        |
        v
Refresh attendance UI
```

### Very Important

The following condition must be true before the Sign In API is called:

```text
Location permission granted
        AND
Valid current location obtained
```

If either condition fails:

```text
DO NOT call POST /api/attendance/sign-in
```

---

# 21. First-Time Android Location Permission

On first use, Android can display a system permission dialog similar to:

```text
Allow Make My Event to access this device's location?

- While using the app
- Only this time
- Don't allow
```

Exact wording can vary by Android version.

Version 1 requires foreground permission such as:

```text
While using the app
```

or:

```text
Only this time
```

Both can allow the current Sign In/Sign Out operation.

---

# 22. Permission Previously Denied

If permission was denied earlier:

1. The user taps Sign In.
2. The app checks permission.
3. The app requests permission again if Android allows another prompt.
4. If permission remains denied, Sign In must stop.
5. Show an understandable message.

Example:

```text
Location permission is required to Sign In.
Please allow location access and try again.
```

If the user has permanently blocked permission, the app can guide the user to device settings.

Version 1 should still **not Sign In without location**.

---

# 23. GPS / Location Service Disabled

Permission and GPS availability are different things.

Example:

```text
Location permission = Allowed
GPS/location service = Disabled
```

In this case:

```text
DO NOT Sign In
```

Show:

```text
Please enable location services and try again.
```

Then the user can retry Sign In.

---

# 24. Getting the Current Location

The location used for attendance should be the employee's **current location at the moment of the attendance action**.

Store:

```text
latitude
longitude
accuracy
```

Do not use location continuously in the background.

Do not continuously track the employee after Sign In.

---

# 25. Sign Out Uses the Same Location Gate

The Sign Out button must use the same protection.

```text
Employee taps SIGN OUT
        |
        v
Check/request foreground location permission
        |
        v
Permission granted?
        |
     NO +------> DO NOT Sign Out
        |
       YES
        |
        v
Check location service
        |
        v
Get current GPS location
        |
        v
Valid location obtained?
        |
     NO +------> DO NOT Sign Out
        |
       YES
        |
        v
POST /api/attendance/sign-out
        |
        v
Backend stores Sign Out time + location
        |
        v
Refresh UI
```

Therefore both attendance actions require a valid location.

---

# 26. Mobile Attendance Screen States

The Attendance screen should clearly represent the current state.

## State A — Not Signed In

```text
Today's Attendance

Status: Not Signed In

[ SIGN IN ]
```

Sign Out should be unavailable.

---

## State B — Signed In / Working

```text
Today's Attendance

Status: Working
Sign In: 09:15 AM

[ SIGN OUT ]
```

Sign In should be unavailable.

---

## State C — Completed

```text
Today's Attendance

Status: Completed

Sign In:  09:15 AM
Sign Out: 06:10 PM
Duration: 8h 55m
```

Both Sign In and Sign Out should be unavailable for that day.

---

# 27. Prevent Multiple Button Requests

During a Sign In or Sign Out mutation, disable the corresponding button.

Example:

```text
Tap SIGN IN
    |
    v
Button disabled
    |
    v
Getting location...
    |
    v
Sending request...
```

This reduces accidental double requests.

The database unique constraint and backend validation provide additional protection.

---

# 28. React Query Integration

The existing mobile app already uses TanStack React Query.

Update the existing centralized query-key file:

```text
mobile/constants/queryKeys.js
```

Recommended conceptual keys:

```js
["attendance", "today"]
["attendance", "history"]
```

Create:

```text
mobile/hooks/useAttendance.js
```

Queries:

```text
attendance today
attendance history
```

Mutations:

```text
sign in
sign out
```

After successful Sign In:

```text
Invalidate today's attendance
Invalidate attendance history
```

After successful Sign Out:

```text
Invalidate today's attendance
Invalidate attendance history
```

The UI should then refresh automatically.

---

# 29. Attendance API Service

Create:

```text
mobile/services/api/attendanceApi.js
```

It should use the project's existing API client so the employee JWT is attached automatically.

Recommended methods:

```text
getTodayAttendance()
getAttendanceHistory()
signIn(location)
signOut(location)
```

Do not create a second HTTP client only for attendance.

Reuse the existing authenticated mobile API architecture.

---

# 30. Location Service

Create a reusable location helper, for example:

```text
mobile/services/locationService.js
```

Responsibilities:

```text
Check foreground permission
        |
        v
Request foreground permission if needed
        |
        v
Verify location service
        |
        v
Get current location
        |
        v
Return:
latitude
longitude
accuracy
```

The helper should throw/return meaningful errors when:

- Permission denied.
- Location services disabled.
- Location unavailable.
- Current location request fails.
- Location request times out.

---

# 31. Admin Panel Integration

Follow the existing admin frontend structure.

Recommended additions:

```text
frontend/.../src/

pages/admin/
    AdminAttendancePage.jsx

services/
    adminAttendanceService.js
```

Update existing files such as:

```text
components/AdminSidebar.jsx
App.jsx
```

to add:

```text
Attendance Management
```

and an admin route such as:

```text
/admin/attendance
```

---

# 32. Admin Attendance Table

Recommended columns:

| Employee | Date | Sign In | Sign Out | Duration | Location |
|---|---|---|---|---|---|

Example:

| Employee | Date | Sign In | Sign Out | Duration |
|---|---|---|---|---|
| Rafi | 28 Aug 2026 | 09:15 | 18:10 | 8h 55m |

Duration should be calculated from:

```text
signOutAt - signInAt
```

Do not store a separate duration column for Version 1.

---

# 33. Admin Location View

Admin should be able to view both attendance locations.

Example:

```text
Employee: Rafi
Date: 28 Aug 2026

Sign In
--------
Latitude: 23.7808
Longitude: 90.4075
Accuracy: 15 m

[ Open Map ]

Sign Out
--------
Latitude: 23.7810
Longitude: 90.4079
Accuracy: 12 m

[ Open Map ]
```

The map/location viewer is for displaying where the device reported the location when the employee performed the attendance action.

---

# 34. Location Is Not Strong Office Verification in Version 1

Version 1 captures the mobile device's reported location.

It should not be described as guaranteed proof that the employee was physically inside the office.

Possible limitations include:

- GPS accuracy variation.
- Indoor GPS weakness.
- Device/location spoofing.
- Network/environmental limitations.

Therefore the admin UI should use language such as:

```text
Sign In Location
Sign Out Location
GPS Accuracy
```

rather than:

```text
Verified Office Presence
```

Stronger verification can be added in Version 2 with:

- Office geofence.
- Wi-Fi verification.
- Selfie verification.
- QR verification.

---

# 35. Error Handling

## Already Signed In

```text
You already signed in today.
```

Recommended HTTP response:

```text
409 Conflict
```

---

## Sign Out Without Sign In

```text
Please sign in first.
```

---

## Already Signed Out

```text
You already signed out today.
```

---

## Location Permission Denied

```text
Location permission is required to Sign In.
```

or:

```text
Location permission is required to Sign Out.
```

---

## GPS / Location Service Disabled

```text
Please enable location services and try again.
```

---

## Location Unavailable

```text
Unable to get your current location.
Please try again.
```

---

## Network Error

```text
Unable to connect to the server.
Please check your internet connection and try again.
```

---

## Session Expired

Use the mobile app's existing authentication/session behavior.

Do not create a separate attendance-specific authentication flow.

---

# 36. Suggested API Response Shape

A consistent attendance object can look conceptually like:

```json
{
  "id": "101",
  "attendanceDate": "2026-08-28",
  "signInAt": "2026-08-28T09:15:00+06:00",
  "signInLatitude": 23.7808,
  "signInLongitude": 90.4075,
  "signInAccuracy": 15,
  "signOutAt": null,
  "signOutLatitude": null,
  "signOutLongitude": null,
  "signOutAccuracy": null,
  "status": "working",
  "durationMinutes": null
}
```

`status` and `durationMinutes` may be calculated in the API response rather than stored in the database.

---

# 37. Implementation Order

## Phase 1 — Database

1. Add Attendance model to Prisma schema.
2. Add Employee → Attendance relationship.
3. Add unique employee/date constraint.
4. Create additive SQL migration.
5. Apply migration safely.
6. Verify table and relation.

---

## Phase 2 — Employee Backend

1. Create employee attendance controller.
2. Create employee attendance routes.
3. Protect with employee JWT middleware.
4. Implement today's attendance.
5. Implement Sign In.
6. Implement Sign Out.
7. Implement history.
8. Add coordinate validation.
9. Add duplicate-request handling.
10. Register routes in backend server.

---

## Phase 3 — Admin Backend

1. Create admin attendance controller/routes.
2. Protect with existing admin-session middleware.
3. Add attendance list.
4. Add employee filtering.
5. Add date/date-range filtering.
6. Add attendance detail/location data.
7. Register routes.

---

## Phase 4 — Mobile Native Setup

1. Install `expo-location`.
2. Configure foreground location permission.
3. Rebuild the required development/preview APK if necessary.
4. Install the rebuilt app on the Android device.
5. Verify the Android location permission prompt appears.

---

## Phase 5 — Mobile Attendance Feature

1. Add Attendance tab.
2. Create attendance API service.
3. Create location service.
4. Add centralized React Query keys.
5. Create `useAttendance.js`.
6. Implement today's attendance state.
7. Implement permission-gated Sign In.
8. Implement permission-gated Sign Out.
9. Implement attendance history.
10. Add loading/error states.
11. Prevent double taps.

---

## Phase 6 — Admin Frontend

1. Add Attendance Management sidebar item.
2. Add admin attendance route.
3. Create Attendance page.
4. Create admin attendance service.
5. Display attendance table.
6. Add employee filter.
7. Add date/date-range filters.
8. Add Sign In/Sign Out location viewer.
9. Display working duration.

---

## Phase 7 — Testing

Test the complete employee and admin flow on real physical Android devices.

---

# 38. Testing Checklist

## Employee Authentication

- [ ] Employee can log in.
- [ ] Mobile JWT is attached automatically.
- [ ] Attendance API identifies employee from JWT.
- [ ] Mobile never sends employee ID for Sign In/Out.

## First Sign In Permission Test

- [ ] Fresh install / permission not granted.
- [ ] Tap Sign In.
- [ ] Android location permission popup appears.
- [ ] Select Allow.
- [ ] App gets current location.
- [ ] Sign In API is called only after location succeeds.
- [ ] Attendance is created.

## Permission Denied Test

- [ ] Tap Sign In.
- [ ] Deny location permission.
- [ ] Sign In API is NOT called.
- [ ] Attendance is NOT created.
- [ ] Correct message is shown.

## GPS Disabled Test

- [ ] Location permission allowed.
- [ ] Disable device location service.
- [ ] Tap Sign In.
- [ ] Sign In is blocked.
- [ ] User is asked to enable location service.

## Sign In Test

- [ ] Valid latitude saved.
- [ ] Valid longitude saved.
- [ ] Accuracy saved.
- [ ] Backend time saved.
- [ ] Correct Bangladesh attendance date saved.
- [ ] Status becomes Working.

## Duplicate Sign In Test

- [ ] Sign In once successfully.
- [ ] Attempt another Sign In.
- [ ] Duplicate attendance is not created.
- [ ] Appropriate error is shown.

## Sign Out Test

- [ ] Signed-in employee taps Sign Out.
- [ ] Location permission checked.
- [ ] Current location obtained.
- [ ] Sign Out time saved.
- [ ] Sign Out coordinates saved.
- [ ] Accuracy saved.
- [ ] Status becomes Completed.

## Sign Out Without Sign In

- [ ] Employee with no Sign In attempts Sign Out.
- [ ] Request is rejected.

## Duplicate Sign Out

- [ ] Completed employee attempts another Sign Out.
- [ ] Second Sign Out is rejected.

## Attendance History

- [ ] Employee can view own history.
- [ ] Employee cannot access another employee's history.

## Admin

- [ ] Admin can open Attendance Management.
- [ ] Admin route requires admin session.
- [ ] Admin can view attendance list.
- [ ] Admin can filter employee.
- [ ] Admin can filter date.
- [ ] Admin can filter date range.
- [ ] Admin can view Sign In location.
- [ ] Admin can view Sign Out location.
- [ ] Admin can view GPS accuracy.
- [ ] Admin can view working duration.

## Timezone

- [ ] Attendance date uses Asia/Dhaka.
- [ ] Test around midnight Bangladesh time.
- [ ] Verify the production server timezone does not shift attendance into the wrong date.

---

# 39. Version 2 Improvements

After Version 1 is stable, possible improvements include:

- Office geofence.
- Wi-Fi verification.
- Selfie attendance.
- QR attendance.
- Late arrival calculation.
- Early leave calculation.
- Attendance reports.
- Monthly summary.
- Leave management.
- Payroll integration.
- Stronger anti-location-spoofing controls.
- Admin attendance corrections with audit logs.

---

# 40. Final Version 1 Workflow

## Employee Sign In

```text
Employee opens Attendance
        |
        v
Tap SIGN IN
        |
        v
Check foreground location permission
        |
        +------ denied ------> Stop + show message
        |
       allowed
        |
        v
Check location service
        |
        +------ disabled ----> Stop + show message
        |
       enabled
        |
        v
Get current GPS location
        |
        +------ failed ------> Stop + show message
        |
      success
        |
        v
latitude + longitude + accuracy
        |
        v
POST /api/attendance/sign-in
        |
        v
Employee identified from JWT
        |
        v
Backend gets Asia/Dhaka date/time
        |
        v
Create today's attendance
        |
        v
React Query refresh
        |
        v
Status = Working
```

## Employee Sign Out

```text
Tap SIGN OUT
        |
        v
Check/request foreground location permission
        |
        v
Get current GPS location
        |
        v
POST /api/attendance/sign-out
        |
        v
Employee identified from JWT
        |
        v
Find today's attendance
        |
        v
Backend saves Sign Out time + GPS
        |
        v
React Query refresh
        |
        v
Status = Completed
```

## Admin

```text
Admin Login
     |
     v
Existing admin session cookie
     |
     v
Attendance Management
     |
     v
GET /api/admin/attendance
     |
     v
Filter / View Records
     |
     +--> Sign In location
     |
     +--> Sign Out location
     |
     +--> GPS accuracy
     |
     +--> Working duration
```

---

# 41. Final Rules to Keep

1. **No location = no Sign In.**
2. **No location = no Sign Out.**
3. Employee ID comes from the authenticated JWT.
4. Admin attendance APIs use admin-session authentication.
5. Attendance timestamps are generated by the backend.
6. Attendance date must use Asia/Dhaka business time.
7. Only one attendance record exists per employee per day.
8. Foreground location only in Version 1.
9. Do not continuously track employees.
10. React Query refreshes attendance state after successful mutations.
11. Add attendance through a safe additive database migration.
12. Location in Version 1 is recorded evidence, not guaranteed proof of office presence.

---

# End
