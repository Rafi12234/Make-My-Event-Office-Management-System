import { Router } from "express";
import { getToday, signIn, signOut, getHistory } from "../controllers/attendanceController.js";

const router = Router();

router.get("/today", getToday);
router.post("/sign-in", signIn);
router.post("/sign-out", signOut);
router.get("/history", getHistory);

export default router;
