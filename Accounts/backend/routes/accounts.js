import { Router } from "express";
import {
  uploadsRootDirectory,
  receiptsDirectory,
  uploadReceiptsMiddleware,
  getSummary,
  listBookedEvents,
  createMoneyReceived,
  createExpense,
} from "../controllers/accountsController.js";

export { uploadsRootDirectory, receiptsDirectory };

const router = Router();

router.get("/summary", getSummary);
router.get("/booked-events", listBookedEvents);
router.post("/money-received", createMoneyReceived);
router.post("/expenses", uploadReceiptsMiddleware, createExpense);

export default router;
