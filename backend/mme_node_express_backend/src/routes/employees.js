import { Router } from "express";
import { requireEmployee } from "../middleware/employeeAuth.js";
import {
  listEmployeeDirectory,
  identifyEmployee,
  getCurrentEmployee,
  logoutEmployee,
  changePassword,
  getTodaySummary,
} from "../controllers/employeesController.js";

const router = Router();

router.get("/", listEmployeeDirectory);
router.post("/identify", identifyEmployee);
router.get("/me", requireEmployee, getCurrentEmployee);
router.get("/me/today-summary", requireEmployee, getTodaySummary);
router.post("/logout", logoutEmployee);
router.post("/change-password", requireEmployee, changePassword);

export default router;
