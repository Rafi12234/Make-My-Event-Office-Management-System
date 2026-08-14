import "dotenv/config";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import net from "node:net";

import { verifyDatabaseConnection } from "./config/prisma.js";
import employeeRoutes from "./routes/employees.js";
import workspaceRoutes from "./routes/workspace.js";
import calendarRoutes from "./routes/calendar.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import adminActivityRoutes from "./routes/adminActivity.js";
import adminCalendarRoutes from "./routes/adminCalendar.js";
import adminDashboardRoutes from "./routes/adminDashboard.js";
import meetingRoutes, { uploadsRootDirectory } from "./routes/meetings.js";
import callRoutes from "./routes/calls.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";
import { requireEmployee, isValidSession } from "./middleware/employeeAuth.js";

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
| TEMPORARY: raw TCP diagnostic (bypasses Prisma entirely)
|--------------------------------------------------------------------------
|
| Remove this route once the MySQL connectivity issue is resolved.
|
*/

app.get("/api/debug/tcp-check", (req, res) => {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const startedAt = Date.now();
  const socket = net.createConnection({ host, port });
  let settled = false;

  const finish = (result) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    res.status(200).json({
      host,
      port,
      elapsedMs: Date.now() - startedAt,
      ...result,
    });
  };

  socket.setTimeout(5000);

  socket.once("connect", () => {
    socket.once("data", (chunk) => {
      finish({
        tcpConnected: true,
        receivedMysqlGreeting: true,
        firstBytesHex: chunk.subarray(0, 16).toString("hex"),
      });
    });

    // TCP connected but MySQL never sent its handshake greeting.
    setTimeout(() => {
      finish({ tcpConnected: true, receivedMysqlGreeting: false });
    }, 4000);
  });

  socket.once("timeout", () => {
    finish({ tcpConnected: false, error: "timeout" });
  });

  socket.once("error", (err) => {
    finish({ tcpConnected: false, error: err.code || err.message });
  });
});

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
*/

app.use("/api/employees", employeeRoutes);
app.use("/api/workspace", requireEmployee, workspaceRoutes);
app.use("/api/calendar", requireEmployee, calendarRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminActivityRoutes);
app.use("/api/admin", adminCalendarRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/meetings", requireEmployee, meetingRoutes);
app.use("/api/calls", requireEmployee, callRoutes);

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
  app.listen(port, () => {
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
}

startServer();