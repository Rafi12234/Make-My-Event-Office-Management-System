import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
  listAllMeetings,
  listAllCalls,
  updateNextMeetingSchedule,
  updateNextCallSchedule,
  getClientMeetingsForAdmin,
  getClientCallsForAdmin,
} from "../controllers/adminActivityController.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

router.get("/meetings", listAllMeetings);
router.get("/calls", listAllCalls);
router.patch("/meetings/:meetingId/next", updateNextMeetingSchedule);
router.patch("/calls/:callId/next", updateNextCallSchedule);
router.get("/clients/:rowKey/meetings", getClientMeetingsForAdmin);
router.get("/clients/:rowKey/calls", getClientCallsForAdmin);

export default router;
