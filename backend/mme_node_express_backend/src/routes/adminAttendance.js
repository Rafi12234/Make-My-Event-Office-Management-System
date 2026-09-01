import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { listAttendance, getAttendanceDetail } from "../controllers/adminAttendanceController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/attendance", listAttendance);
router.get("/attendance/:attendanceId", getAttendanceDetail);

export default router;
