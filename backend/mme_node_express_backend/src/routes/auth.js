import { Router } from "express";
import { adminLogin } from "../controllers/authController.js";

const router = Router();

router.post("/admin-login", adminLogin);

export default router;
