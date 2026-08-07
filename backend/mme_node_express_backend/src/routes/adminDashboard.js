import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { getAdminDashboard, getClientDetail } from "../controllers/adminDashboardController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/dashboard", getAdminDashboard);
router.get("/dashboard/clients/:rowKey", getClientDetail);

export default router;
