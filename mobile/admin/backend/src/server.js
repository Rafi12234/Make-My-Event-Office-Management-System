import express from "express";
import cors from "cors";

import { prisma } from "./utils/accountsShared.js";
import { requireAdmin } from "./middleware/adminAuth.js";
import accountsRoutes from "./routes/accounts.js";
import moneyReceiptRoutes from "./routes/moneyReceipts.js";

const app = express();
const port = Number(process.env.MOBILE_ADMIN_PORT || 5001);

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/api/health", async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      success: true,
      service: "mme-mobile-admin-financial",
      database: "connected",
    });
  } catch (error) {
    return next(error);
  }
});

app.use(
  "/api/admin/accounts",
  requireAdmin,
  accountsRoutes,
);

app.use(
  "/api/admin/money-receipts",
  requireAdmin,
  moneyReceiptRoutes,
);

app.use("/api", (req, res) => {
  return res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("[mobile-admin-financial]", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.status || 500).json({
    message:
      error.message ||
      "Unexpected mobile Admin financial server error.",
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Mobile Admin Financial API running at http://0.0.0.0:${port}`,
  );
});
