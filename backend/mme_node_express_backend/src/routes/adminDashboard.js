import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { getAdminDashboard, getClientDetail } from "../controllers/adminDashboardController.js";
import { getAdminWorkspace, updateAdminWorkspaceCell } from "../controllers/adminWorkspaceController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/dashboard", getAdminDashboard);
router.get("/dashboard/clients/:rowKey", getClientDetail);
router.get("/workspace", getAdminWorkspace);
router.patch("/workspace/rows/:rowKey", updateAdminWorkspaceCell);

export default router;
