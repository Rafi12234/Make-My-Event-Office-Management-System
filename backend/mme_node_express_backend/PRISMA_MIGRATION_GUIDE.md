# Prisma Migration — What Changed & Why (Simple Guide)

## 1. The Problem (Before)

Earlier, the whole backend talked to MySQL using **raw SQL written by hand** inside the route files, using the `mysql2` package. Example of the old style:

```js
const [rows] = await connection.execute(
  `SELECT id, full_name, email FROM employees WHERE is_active = TRUE`
);
```

Problems with this:
- SQL strings scattered everywhere in the code — easy to make typos, hard to maintain.
- No safety net — if a column name changed in the database, nothing would warn you until the app crashed at runtime.
- Manual connection/transaction handling (`pool.getConnection()`, `beginTransaction()`, `commit()`, `rollback()`, `connection.release()`) in every route.

## 2. The Solution (Now)

We introduced **Prisma**, a tool that lets you talk to the database using plain JavaScript function calls instead of raw SQL strings. Example of the new style:

```js
const employees = await prisma.employee.findMany({
  where: { isActive: true },
});
```

Prisma reads a single file — `prisma/schema.prisma` — which describes every table and column, and generates a type-safe JavaScript client from it. No more raw SQL text in the route files.

## 3. What Files Changed

| File | What happened |
|---|---|
| `src/config/db.js` | **Deleted.** This was the old `mysql2` connection pool setup. |
| `src/config/prisma.js` | **New.** Sets up the single shared Prisma Client used by the whole app. |
| `prisma/schema.prisma` | **New.** Describes every database table/column as a Prisma "model". |
| `src/utils/dbDates.js` | **New.** Small helper functions to safely convert dates/times back and forth (explained below). |
| `src/routes/employees.js`, `auth.js`, `admin.js`, `middleware/adminAuth.js` | Rewritten to use `prisma.employee...` instead of raw SQL. |
| `src/routes/calls.js`, `meetings.js` | Rewritten to use `prisma.clientCall...` / `prisma.clientMeeting...`. |
| `src/routes/calendar.js` | Rewritten to use `prisma.calendarEvent...` and friends. |
| `src/routes/workspace.js` | Rewritten — this was the biggest one, since it manages the dynamic spreadsheet (the "Management" sheet with custom columns/rows). |
| `src/server.js` | Now imports the DB-connection-check from `config/prisma.js` instead of the old `config/db.js`. |
| `package.json` | Removed the `mysql2` package (no longer needed), kept `@prisma/client`, `prisma`, and `@prisma/adapter-mariadb`. |

## 4. Why Prisma Needed a Little Extra Setup (Prisma 7 specifics)

Prisma version 7 (the version installed here) doesn't connect to MySQL directly anymore — it requires a small "adapter" package. That's why you'll see this in `config/prisma.js`:

```js
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

export const prisma = new PrismaClient({ adapter });
```

Think of the adapter as "the wire that plugs Prisma into MySQL." Without it, Prisma 7 refuses to connect.

## 5. Two Small Bugs We Found & Fixed While Migrating

Since all IDs and dates were flowing through a completely different code path now, two subtle bugs needed fixing so "everything still works exactly like before":

### Bug #1 — Big numbers (IDs) couldn't be sent as JSON
All the `id` columns in the database are `BIGINT`. Prisma reads these as JavaScript's special `BigInt` type, but normal `JSON.stringify()` (used by `res.json()`) doesn't know how to convert a `BigInt` to JSON — it crashes.

**Fix:** Added one line in `config/prisma.js` that teaches JavaScript how to convert `BigInt` → normal number automatically:
```js
BigInt.prototype.toJSON = function () {
  return Number(this);
};
```

### Bug #2 — Times were shifting by 6 hours ⏰ (the important one)
- The old `mysql2` setup returned dates/times as plain text (e.g. `"2027-01-15 10:00:00"`), no timezone attached.
- Prisma instead returns a real JavaScript `Date` object.
- When our code converted a date/time **typed by the user on the frontend** back into a `Date` object for saving (e.g. `new Date("2027-01-15 10:00")`), JavaScript quietly assumed it was in the **server's local timezone** (this machine is set to `Asia/Dhaka`, UTC+6) — and shifted it by 6 hours before saving!

Example of what was going wrong:
```
User types:      2027-01-15 10:00
Got saved as:    2027-01-15 04:00   ❌ (6 hours off)
```

**Fix:** Created `src/utils/dbDates.js` with small helper functions (`parseDateOnly`, `parseTimeOnly`, `parseDateTimeLocal`) that always treat the typed value as an exact, fixed clock time (no timezone guessing), and matching "format" functions (`formatDateOnly`, `formatTimeOnly`, `formatDateTime`) that convert dates back to plain text exactly like before when sending data to the frontend. This was applied everywhere a date/time is read from or written to the database (worksheet cells, meetings, calls, calendar events).

After the fix, verified live:
```
User types:      2027-01-15 10:00
Saved & returned: 2027-01-15 10:00   ✅ exact match
```

## 6. What Stayed Exactly the Same (No Behavior Change)

- All API routes/URLs (`/api/employees`, `/api/workspace/default`, etc.) — unchanged.
- All request/response JSON shapes — unchanged (frontend needs zero changes).
- All business rules (e.g. "Not Available" cells, soft-archiving rows, cascading deletes when a client row is removed, auto-computed "Last/Next Meeting Time" columns) — all preserved, just written using Prisma instead of raw SQL.

## 7. How To Verify It's Working

1. Start the backend: `npm run dev` (inside `backend/mme_node_express_backend`).
2. Visit `http://localhost:5000/api/health` — should say `"database": "connected"`.
3. Everything else (login, worksheet, calendar, meetings, calls) works exactly as before — just powered by Prisma under the hood now.
