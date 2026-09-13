// Thin wiring only — business logic lives in controllers/moneyReceiptController.js.
// Mounted at /api/admin/money-receipts behind requireAdmin (see server.js) —
// an employee session can never reach any of these endpoints.
import { Router } from "express";
import {
  previewMoneyReceipt,
  createMoneyReceipt,
  listMoneyReceipts,
  getMoneyReceipt,
  downloadMoneyReceipt,
  archiveMoneyReceipt,
} from "../controllers/moneyReceiptController.js";

const router = Router();

router.post("/preview", previewMoneyReceipt);
router.post("/", createMoneyReceipt);
router.get("/", listMoneyReceipts);
router.get("/:id", getMoneyReceipt);
router.get("/:id/download", downloadMoneyReceipt);
router.patch("/:id/archive", archiveMoneyReceipt);

export default router;
