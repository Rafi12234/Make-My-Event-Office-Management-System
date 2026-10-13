import { Router } from "express";
import {
  deleteWorkspaceRows,
  getWorkspace,
  getWorkspaceRowSnapshot,
  saveWorkspace,
  saveWorkspaceChanges,
  setWorkspaceRowAlreadyBooked,
} from "../controllers/workspaceController.js";

const router = Router();

router.get("/default", getWorkspace);
router.get("/default/row-snapshot", getWorkspaceRowSnapshot);
router.patch("/default/changes", saveWorkspaceChanges);
router.patch("/default/rows/:rowKey/already-booked", setWorkspaceRowAlreadyBooked);
router.post("/default/rows/bulk-delete", deleteWorkspaceRows);
router.put("/default", saveWorkspace);

export default router;
