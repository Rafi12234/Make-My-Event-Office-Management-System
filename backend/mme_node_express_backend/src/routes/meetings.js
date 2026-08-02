import { Router } from "express";
import {
  uploadsRootDirectory,
  meetingImagesDirectory,
  uploadImagesMiddleware,
  listMeetings,
  createMeeting,
  updateMeeting,
  toggleMeetingComplete,
  updateImageTag,
  toggleImageFinal,
  finalizeMeeting,
  deleteMeeting,
  uploadMeetingImages,
  deleteMeetingImage,
  createMeetingItem,
  updateMeetingItem,
  deleteMeetingItem,
  uploadItemImagesMiddleware,
  uploadItemImages,
  deleteItemImage,
} from "../controllers/meetingsController.js";

export { uploadsRootDirectory, meetingImagesDirectory };

const router = Router();

router.get("/:rowKey", listMeetings);
router.post("/:rowKey", createMeeting);
router.put("/:rowKey/:meetingId", updateMeeting);
router.patch("/:rowKey/:meetingId/complete", toggleMeetingComplete);
router.patch("/:rowKey/images/:imageId/tag", updateImageTag);
router.patch("/:rowKey/images/:imageId/final", toggleImageFinal);
router.post("/:rowKey/finalize", finalizeMeeting);
router.delete("/:rowKey/:meetingId", deleteMeeting);
router.post("/:rowKey/:meetingId/items", createMeetingItem);
router.put("/:rowKey/:meetingId/items/:itemId", updateMeetingItem);
router.delete("/:rowKey/:meetingId/items/:itemId", deleteMeetingItem);
router.post(
  "/:rowKey/:meetingId/items/:itemId/images",
  uploadItemImagesMiddleware,
  uploadItemImages,
);
router.delete("/:rowKey/:meetingId/items/:itemId/images/:imageId", deleteItemImage);
router.post("/:rowKey/:meetingId/images", uploadImagesMiddleware, uploadMeetingImages);
router.delete("/:rowKey/:meetingId/images/:imageId", deleteMeetingImage);

export default router;