import { Router } from "express";
import {
  getCalendarMonth,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controllers/calendarController.js";

const router = Router();

router.get("/", getCalendarMonth);
router.post("/events", createCalendarEvent);
router.put("/events/:id", updateCalendarEvent);
router.delete("/events/:id", deleteCalendarEvent);

export default router;
