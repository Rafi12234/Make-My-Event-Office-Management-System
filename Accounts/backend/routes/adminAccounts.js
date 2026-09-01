import { Router } from "express";
import {
  getOverview,
  listEmployeeWallets,
  getEmployeeAccountProfile,
  listMoneyIn,
  createMoneyInForEmployee,
  updateMoneyIn,
  voidMoneyIn,
  listExpenses,
  getExpense,
  updateExpense,
  previewExpenseUpdate,
  voidExpense,
  listEventCostOverview,
  getReconciliation,
  listAuditLogs,
  getActivityFeed,
  getRangeSummary,
} from "../controllers/adminAccountsController.js";
import {
  listVendors,
  createVendor,
  updateVendor,
  setVendorStatus,
  getVendorProfile,
  getVendorOutstandingItems,
  createDirectVendorCost,
  createDirectVendorPayment,
} from "../controllers/adminVendorsController.js";

// Mounted at /api/admin/accounts behind requireAdmin (see server.js) —
// deliberately separate from the employee /api/accounts routes so an
// employee session can never reach any of these endpoints.
const router = Router();

router.get("/overview", getOverview);
router.get("/activity", getActivityFeed);
router.get("/reconciliation", getReconciliation);
router.get("/summary", getRangeSummary);
router.get("/audit", listAuditLogs);
router.get("/events", listEventCostOverview);

router.get("/employees", listEmployeeWallets);
router.get("/employees/:id", getEmployeeAccountProfile);

router.get("/money-in", listMoneyIn);
router.post("/money-in", createMoneyInForEmployee);
router.patch("/money-in/:id", updateMoneyIn);
router.post("/money-in/:id/void", voidMoneyIn);

router.get("/expenses", listExpenses);
router.get("/expenses/:id", getExpense);
router.patch("/expenses/:id", updateExpense);
router.post("/expenses/:id/preview", previewExpenseUpdate);
router.post("/expenses/:id/void", voidExpense);

router.get("/vendors", listVendors);
router.post("/vendors", createVendor);
router.get("/vendors/:id", getVendorProfile);
router.get("/vendors/:id/outstanding", getVendorOutstandingItems);
router.patch("/vendors/:id", updateVendor);
router.patch("/vendors/:id/status", setVendorStatus);
router.post("/vendors/:id/cost", createDirectVendorCost);
router.post("/vendors/:id/pay", createDirectVendorPayment);

export default router;
