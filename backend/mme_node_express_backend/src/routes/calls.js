import { Router } from "express";
import { listCalls, createCall, updateCall, deleteCall } from "../controllers/callsController.js";

const router = Router();

router.get("/:rowKey", listCalls);
router.post("/:rowKey", createCall);
router.put("/:rowKey/:callId", updateCall);
router.delete("/:rowKey/:callId", deleteCall);

export default router;
