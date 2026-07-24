import "dotenv/config";

import express from "express";
import cors from "cors";
import morgan from "morgan";

import { verifyDatabaseConnection } from "./config/db.js";
import employeeRoutes from "./routes/employees.js";
import workspaceRoutes from "./routes/workspace.js";
import calendarRoutes from "./routes/calendar.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";

const app = express();

const port = Number(process.env.PORT || 5000);
const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Make My Event Office Management API",
  });
});

app.get("/api/health", async (req, res, next) => {
  try {
    await verifyDatabaseConnection();

    res.status(200).json({
      success: true,
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/employees", employeeRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/calendar",  calendarRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/admin",     adminRoutes);

/*
 * This must come after every valid route.
 */
app.use(notFoundHandler);

/*
 * This must be the final middleware.
 */
app.use(errorHandler);

async function startServer() {
  try {
    await verifyDatabaseConnection();

    app.listen(port, () => {
      console.log("MySQL database connected successfully.");
      console.log(
        `Make My Event API running at http://localhost:${port}`,
      );
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    process.exitCode = 1;
  }
}

startServer();