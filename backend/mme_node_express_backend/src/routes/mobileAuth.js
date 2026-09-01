import { Router } from "express";
import { mobileLogin } from "../controllers/mobileAuthController.js";

const router = Router();

router.post("/login", mobileLogin);

export default router;
