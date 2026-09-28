# Attendance System — Mobile-Dedicated Build Guide

## Scope

This module is dedicated to the **mobile app** (employee Sign In / Sign Out with
GPS capture). It lives self-contained under `mobile/Attendance/`, mirroring how
`Accounts/` is a self-contained module sitting outside the main `backend/` and
`frontend/` projects but wired into both.

The Admin web-panel view of attendance (list/filter/location viewer) is **not**
part of this folder — it belongs to the existing `backend/mme_node_express_backend`
+ `frontend/.../src/pages/admin` structure, same as every other admin feature.
Build that later as a separate step if/when needed.

---

## 0. Folder structure (already scaffolded)

```text
mobile/Attendance/
  backend/
    controllers/
    routes/
  frontend/
    components/
    pages/
    services/
```

Files still to create in each folder are listed per phase below.

---

## 1. Wiring model (mirrors `Accounts/` exactly)

### Backend side — two-way cross-require

- `mobile/Attendance/backend/controllers/attendanceController.js` requires the
  **main backend's** `prisma` client + `dbDates.js` helpers via a
  `BACKEND_SRC_DIR`-style overridable path:
  ```js
  const backendSrcDirectory = process.env.BACKEND_SRC_DIR
    ? path.resolve(process.env.BACKEND_SRC_DIR)
    : path.resolve(__dirname, "../../../../backend/mme_node_express_backend/src");
  const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
  const { nowInBusinessTimezone, formatDateOnly } = require(
    path.join(backendSrcDirectory, "utils/dbDates.js"),
  );
  ```
  (One extra `../` compared to `Accounts/backend` since this module is nested
  one level deeper, inside `mobile/`.)

- `backend/mme_node_express_backend/src/server.js` requires this module's
  routes via an `ATTENDANCE_BACKEND_DIR`-style overridable path, same pattern
  as `ACCOUNTS_BACKEND_DIR`:
  ```js
  const attendanceBackendDirectory = process.env.ATTENDANCE_BACKEND_DIR
    ? path.resolve(process.env.ATTENDANCE_BACKEND_DIR)
    : path.resolve(__dirname, "../../../mobile/Attendance/backend");
  const { default: attendanceRoutes } = require(
    path.join(attendanceBackendDirectory, "routes/attendance.js"),
  );
  ```
  Mount it exactly like every other employee-protected route:
  ```js
  app.use("/api/attendance", attachBearerToken, requireEmployee, attendanceRoutes);
  ```

### Mobile (frontend) side — no symlink hack needed

Unlike `Accounts/frontend` (a sibling of the web `frontend/` project, needing
the `ensureAccountsNodeModulesLink.js` script so its imports resolve
`node_modules`), `mobile/Attendance/frontend` is **nested inside** `mobile/`,
so Metro already resolves its imports and `node_modules` normally — no extra
linking step required.

Expo Router still needs the actual routable file to physically live under
`mobile/app/(tabs)/`. Keep that file a thin re-export, same idea as
`App.jsx` importing `AccountsPage` from the sibling `Accounts/frontend`:

```jsx
// mobile/app/(tabs)/attendance.jsx
export { default } from "../../Attendance/frontend/pages/AttendanceScreen";
```

Feature services import the mobile app's existing shared API client directly:

```js
// mobile/Attendance/frontend/services/attendanceApi.js
import { apiRequest } from "../../../services/api/client";
```

---

## 2. Build order

### Phase 1 — Database (shared DB, stays in the main backend)

1. Add `Attendance` model to `backend/mme_node_express_backend/prisma/schema.prisma`
   (`employeeId BigInt @db.UnsignedBigInt`, `@@unique([employeeId, attendanceDate])`).
2. Add the inverse `attendances Attendance[]` relation on `Employee`.
3. Create an additive migration file:
   `backend/mme_node_express_backend/database/add_attendance_system_migration.sql`.
4. Apply it, then run `npx prisma generate` in
   `backend/mme_node_express_backend` (mandatory after any schema edit —
   skipping this causes `prisma.attendance` to be `undefined`).
5. Verify the live table via `information_schema.columns` before trusting the
   migration file alone.

### Phase 2 — `mobile/Attendance/backend`

1. `controllers/attendanceController.js` — cross-require `prisma` +
   `dbDates.js` as shown above. Implement:
   - `getToday(req, res, next)`
   - `signIn(req, res, next)`
   - `signOut(req, res, next)`
   - `getHistory(req, res, next)`
   - Employee id always from `req.employee.id` — never `req.body.employeeId`.
   - Validate `latitude`/`longitude`/`accuracy` server-side.
2. `routes/attendance.js` — thin wiring only:
   ```js
   import { Router } from "express";
   import { getToday, signIn, signOut, getHistory } from "../controllers/attendanceController.js";
   const router = Router();
   router.get("/today", getToday);
   router.post("/sign-in", signIn);
   router.post("/sign-out", signOut);
   router.get("/history", getHistory);
   export default router;
   ```
3. Wire into `server.js` per section 1 above (`ATTENDANCE_BACKEND_DIR` +
   `app.use("/api/attendance", attachBearerToken, requireEmployee, attendanceRoutes)`).
4. Manually test all 4 endpoints with a real JWT before touching mobile code.

### Phase 3 — Mobile native setup

1. `npx expo install expo-location` (run inside `mobile/`).
2. Add foreground location permission config to `mobile/app.json`.
3. Rebuild the dev/preview APK (`npx eas-cli build --platform android --profile preview --non-interactive`) — a new native module needs a new binary, Fast Refresh/JS-only reload is not enough.

### Phase 4 — `mobile/Attendance/frontend`

1. `services/attendanceApi.js` — wraps the shared `apiRequest` client:
   `getTodayAttendance()`, `getAttendanceHistory()`, `signIn(location)`, `signOut(location)`.
2. `services/locationService.js` (or keep flat in this folder) — permission
   check/request → location-services check → `getCurrentPositionAsync` →
   return `{ latitude, longitude, accuracy }`, throwing typed errors for each
   failure mode (denied / disabled / unavailable / timeout).
3. Add `["attendance", "today"]` / `["attendance", "history"]` to
   `mobile/constants/queryKeys.js` (existing centralized file — don't create a
   second one).
4. `mobile/hooks/useAttendance.js` (stays in the existing shared `hooks/`
   folder, not inside `Attendance/`, so it's discoverable next to
   `useClients.js` etc.) — React Query hooks/mutations, invalidating both
   keys after a successful sign-in/sign-out.
5. `components/` — e.g. `AttendanceStatusCard.jsx` (renders the 3 states:
   Not Signed In / Working / Completed).
6. `pages/AttendanceScreen.jsx` — composes the above, gates both buttons
   behind the location check (permission **and** a valid fix must both
   succeed before calling the sign-in/sign-out mutation), disables the
   button while the mutation is in flight.

### Phase 5 — Expo Router wiring

1. Add the thin re-export route file `mobile/app/(tabs)/attendance.jsx`
   (shown in section 1).
2. Update `mobile/app/(tabs)/_layout.jsx` to add the new tab
   (`Dashboard | Clients | Attendance`).

### Phase 6 — Testing

Run through the full checklist already defined in
[Attendance_System_V1_Implementation_Guide_UPDATED.md](../../Attendance_System_V1_Implementation_Guide_UPDATED.md)
section 38 on a real Android device: fresh-permission sign-in, denied
permission, GPS disabled, duplicate sign-in/out, and the Asia/Dhaka
midnight-boundary case.

---

## 3. Rules carried over unchanged

1. No location → no Sign In / no Sign Out.
2. Employee id always comes from the JWT (`req.employee.id`), never the
   request body.
3. Timestamps and `attendanceDate` are generated backend-side using the
   existing `nowInBusinessTimezone()` util — never trust a client-sent date/time.
4. One attendance row per employee per day, enforced by a DB unique
   constraint, not just app logic.
5. Foreground location only — no background tracking in v1.
