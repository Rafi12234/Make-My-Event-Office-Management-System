import { Router } from "express";
import { getWorkspace, saveWorkspace } from "../controllers/workspaceController.js";

const router = Router();

router.get("/default", getWorkspace);
router.put("/default", saveWorkspace);

export default router;

