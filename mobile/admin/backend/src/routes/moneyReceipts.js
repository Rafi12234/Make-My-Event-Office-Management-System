import { Router } from "express";
import {
  previewMoneyReceipt,
  createMoneyReceipt,
  listMoneyReceipts,
  listConfirmedClients,
  getMoneyReceipt,
  downloadMoneyReceipt,
  archiveMoneyReceipt,
} from "../controllers/moneyReceiptsController.js";

const router = Router();

router.post("/preview", previewMoneyReceipt);
router.get("/confirmed-clients", listConfirmedClients);
router.post("/", createMoneyReceipt);
router.get("/", listMoneyReceipts);
router.get("/:id/download", downloadMoneyReceipt);
router.patch("/:id/archive", archiveMoneyReceipt);
router.get("/:id", getMoneyReceipt);

export default router;
