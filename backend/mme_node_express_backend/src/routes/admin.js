import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { listEmployees, createEmployee, updateEmployeeStatus } from "../controllers/adminController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/employees", listEmployees);
router.post("/employees", createEmployee);
router.patch("/employees/:id", updateEmployeeStatus);

export default router;
