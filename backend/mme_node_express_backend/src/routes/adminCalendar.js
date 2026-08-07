import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { getAdminCalendarMonth } from "../controllers/adminCalendarController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/calendar", getAdminCalendarMonth);

export default router;
