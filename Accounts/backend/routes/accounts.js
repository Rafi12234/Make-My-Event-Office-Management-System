import { Router } from "express";
import {
  uploadsRootDirectory,
  receiptsDirectory,
  uploadReceiptsMiddleware,
  getSummary,
  listBookedEvents,
  createMoneyReceived,
  createExpense,
  listVendors,
  getVendorProfile,
  getVendorOutstandingItems,
  payVendor,
} from "../controllers/accountsController.js";

export { uploadsRootDirectory, receiptsDirectory };

const router = Router();

router.get("/summary", getSummary);
router.get("/booked-events", listBookedEvents);
router.get("/vendors", listVendors);
router.get("/vendors/:id", getVendorProfile);
router.get("/vendors/:id/outstanding", getVendorOutstandingItems);
router.post("/vendors/:id/pay", payVendor);
router.post("/money-received", createMoneyReceived);
router.post("/expenses", uploadReceiptsMiddleware, createExpense);

export default router;
