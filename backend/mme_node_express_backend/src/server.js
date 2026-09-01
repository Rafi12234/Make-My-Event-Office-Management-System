import "dotenv/config";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { prisma, verifyDatabaseConnection } from "./config/prisma.js";
import employeeRoutes from "./routes/employees.js";
import workspaceRoutes from "./routes/workspace.js";
import calendarRoutes from "./routes/calendar.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import adminActivityRoutes from "./routes/adminActivity.js";
import adminCalendarRoutes from "./routes/adminCalendar.js";
import adminDashboardRoutes from "./routes/adminDashboard.js";
import adminAttendanceRoutes from "./routes/adminAttendance.js";
import meetingRoutes, { uploadsRootDirectory } from "./routes/meetings.js";
import callRoutes from "./routes/calls.js";
import mobileAuthRoutes from "./routes/mobileAuth.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";
import { requireEmployee, isValidSession } from "./middleware/employeeAuth.js";
import { requireAdmin } from "./middleware/adminAuth.js";
import { attachBearerToken } from "./middleware/attachBearerToken.js";

const app = express();

const port = Number(process.env.PORT || 5000);

const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

/*
|--------------------------------------------------------------------------
| Resolve folder paths
|--------------------------------------------------------------------------
|
| server.js is inside:
| mme-office-app/src/server.js
|
| React production files will be inside:
| mme-office-app/public/
|
*/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendBuildDirectory = path.resolve(
  __dirname,
  "../public",
);

const frontendIndexFile = path.join(
  frontendBuildDirectory,
  "index.html",
);

/*
|--------------------------------------------------------------------------
| Resolve the Accounts module
|--------------------------------------------------------------------------
|
| Accounts/backend lives in a separate top-level folder, NOT inside this
| project, so a fixed relative import breaks once deployed (production's
| directory layout doesn't mirror this repo's nesting). ACCOUNTS_BACKEND_DIR
| lets deployment point at wherever those files actually land on disk;
| local dev falls back to the real repo-relative path.
|
| Loaded via require() (not a dynamic import()) so no top-level await is
| introduced here - LiteSpeed/Passenger's lsnode.js loads this whole app
| with a synchronous require(), which hard-crashes (ERR_REQUIRE_ASYNC_MODULE)
| if the ESM graph contains top-level await anywhere.
*/

const require = createRequire(import.meta.url);

const accountsBackendDirectory = process.env.ACCOUNTS_BACKEND_DIR
  ? path.resolve(process.env.ACCOUNTS_BACKEND_DIR)
  : path.resolve(__dirname, "../../../Accounts/backend");

const {
  default: accountsRoutes,
  uploadsRootDirectory: accountsUploadsRootDirectory,
} = require(path.join(accountsBackendDirectory, "routes/accounts.js"));

const { default: adminAccountsRoutes } = require(
  path.join(accountsBackendDirectory, "routes/adminAccounts.js"),
);

/*
|--------------------------------------------------------------------------
| Resolve the Attendance module
|--------------------------------------------------------------------------
|
| Same idea as the Accounts module above, but nested one level deeper
| (mobile/Attendance/backend instead of a repo-root sibling) since this
| module is dedicated to the mobile app. ATTENDANCE_BACKEND_DIR overrides
| the resolved path for deployment, same as ACCOUNTS_BACKEND_DIR.
*/

const attendanceBackendDirectory = process.env.ATTENDANCE_BACKEND_DIR
  ? path.resolve(process.env.ATTENDANCE_BACKEND_DIR)
  : path.resolve(__dirname, "../../../mobile/Attendance/backend");

const { default: attendanceRoutes } = require(
  path.join(attendanceBackendDirectory, "routes/attendance.js"),
);

/*
|--------------------------------------------------------------------------
| Global middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);

app.use(cookieParser());

app.use(
  express.json({
    limit: "25mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use(morgan("dev"));

/*
|--------------------------------------------------------------------------
| Uploaded meeting images
|--------------------------------------------------------------------------
|
| Served from a dedicated backend-owned "uploads" directory, separate
| from the frontend build's "public/assets" folder. This directory is
| never touched by the CI/CD deploy step, so uploaded images persist
| across deploys (unlike public/assets, which is wiped/rebuilt every
| deploy from the Vite build output).
|
*/

app.use(
  "/uploads",
  express.static(uploadsRootDirectory, {
    maxAge: "7d",
  }),
);

// Accounts module's cash-receipt uploads — a separate backend-owned folder
// (lives under Accounts/backend/uploads, not this project's own uploads/),
// see Accounts/backend/controllers/accountsController.js.
app.use(
  "/accounts-uploads",
  express.static(accountsUploadsRootDirectory, {
    maxAge: "7d",
  }),
);

/*
|--------------------------------------------------------------------------
| Health-check route
|--------------------------------------------------------------------------
*/

app.get("/api/health", async (req, res, next) => {
  try {
    await verifyDatabaseConnection();

    return res.status(200).json({
      success: true,
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    return next(error);
  }
});

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
*/

app.use("/api/employees", attachBearerToken, employeeRoutes);
app.use("/api/mobile/auth", mobileAuthRoutes);
app.use("/api/workspace", attachBearerToken, requireEmployee, workspaceRoutes);
app.use("/api/calendar", attachBearerToken, requireEmployee, calendarRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminActivityRoutes);
app.use("/api/admin", adminCalendarRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/meetings", requireEmployee, meetingRoutes);
app.use("/api/calls", requireEmployee, callRoutes);
app.use("/api/accounts", requireEmployee, accountsRoutes);
app.use("/api/admin/accounts", requireAdmin, adminAccountsRoutes);
app.use("/api/admin", adminAttendanceRoutes);
app.use("/api/meetings", attachBearerToken, requireEmployee, meetingRoutes);
app.use("/api/calls", attachBearerToken, requireEmployee, callRoutes);
app.use("/api/accounts", attachBearerToken, requireEmployee, accountsRoutes);
app.use("/api/attendance", attachBearerToken, requireEmployee, attendanceRoutes);

/*
|--------------------------------------------------------------------------
| API 404 handler
|--------------------------------------------------------------------------
|
| This must be placed after all valid API routes and before the React
| frontend fallback.
|
| It ensures an invalid /api URL returns JSON instead of index.html.
|
*/

app.use("/api", notFoundHandler);

/*
|--------------------------------------------------------------------------
| Serve React production frontend
|--------------------------------------------------------------------------
*/

if (existsSync(frontendIndexFile)) {
  /*
   * Serve JavaScript, CSS, images, SVG and other static files.
   *
   * Vite fingerprints every file inside /assets with a content hash
   * (e.g. index-B19tPwLQ.js), so it is safe to cache those long-term.
   * index.html itself is NOT hashed, so it must never be cached —
   * otherwise browsers/CDNs keep serving an old build forever even
   * after a successful deploy.
   */
  app.use(
    express.static(frontendBuildDirectory, {
      index: false,
      setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate",
          );
        } else {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );

  /*
   * Server-side route guard for the SPA.
   *
   * These page paths require a logged-in employee. Since the app is a SPA
   * served via the wildcard fallback below, this is the point where a
   * direct/refreshed request for a protected URL gets redirected to
   * /login BEFORE any HTML/JS is sent — the browser never sees the
   * protected page at all when unauthenticated.
   */
  const PROTECTED_PAGE_PREFIXES = ["/management", "/calendar"];

  app.get("/{*splat}", (req, res, next) => {
    const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
    );

    if (isProtectedPage && !isValidSession(req)) {
      return res.redirect(302, "/login");
    }

    next();
  });

  /*
   * React Router fallback.
   *
   * This allows routes such as:
   * /management
   * /calendar
   * /calendar/day/2026-07-24
   * /admin
   *
   * to load correctly when opened or refreshed directly.
   *
   * Express 5 requires a named wildcard.
   */
  app.get("/{*splat}", (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
    return res.sendFile(frontendIndexFile);
  });
} else {
  /*
   * Temporary root response before the React build is uploaded.
   */
  app.get("/", (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Make My Event Office Management API",
      frontend:
        "React production build has not been uploaded yet.",
    });
  });

  /*
   * Handle non-API routes while frontend is unavailable.
   */
  app.use(notFoundHandler);
}

/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
|
| This must always be the final middleware.
|
*/

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

function startServer() {
  const httpServer = app.listen(port, () => {
    console.log(
      `Make My Event application running on port ${port}`,
    );
  });

  // Checked in the background so a DB outage doesn't prevent the
  // frontend/static files from being served at all.
  verifyDatabaseConnection()
    .then(() => {
      console.log("MySQL database connected successfully.");
    })
    .catch((error) => {
      console.error("Could not connect to MySQL:", error.message);
    });

  return httpServer;
}

const httpServer = startServer();

/*
|--------------------------------------------------------------------------
| Graceful shutdown
|--------------------------------------------------------------------------
|
| Passenger sends SIGTERM on every restart/deploy. Without releasing the
| Prisma pool's MySQL connections here first, each restart leaves them
| open on the DB side until wait_timeout expires, eventually exhausting
| the account's max_user_connections cap (the cause of a past incident).
|
*/

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down gracefully...`);
  httpServer.close();

  try {
    await prisma.$disconnect();
    console.log("Prisma disconnected.");
  } catch (error) {
    console.error("Error disconnecting Prisma:", error.message);
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});