import { Router } from "express";
import { requireEmployee } from "../middleware/employeeAuth.js";
import {
  listEmployeeDirectory,
  identifyEmployee,
  getCurrentEmployee,
  logoutEmployee,
  changePassword,
} from "../controllers/employeesController.js";

const router = Router();

router.get("/", listEmployeeDirectory);
router.post("/identify", identifyEmployee);
router.get("/me", requireEmployee, getCurrentEmployee);
router.post("/logout", logoutEmployee);
router.post("/change-password", requireEmployee, changePassword);

export default router;
