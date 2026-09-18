import { Router } from "express";
import multer from "multer";
import {
  archiveDocument,
  createDocumentItem,
  deleteDocumentItem,
  deleteDocumentItemImage,
  downloadDocument,
  ensureMeetingDraft,
  generateDocument,
  getDocument,
  importExcelRows,
  listDocuments,
  previewDocument,
  resetDraftFromMeeting,
  serveDocumentImage,
  updateDocument,
  uploadDocumentItemImage,
} from "../controllers/pdfGeneratorController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!new Set(["image/jpeg", "image/png"]).has(file.mimetype)) {
      return callback(new Error("Only JPG, JPEG and PNG images are supported in generated PDFs."));
    }
    callback(null, true);
  },
});

function uploadSingleImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (error) return res.status(422).json({ message: error.message || "Image upload failed." });
    next();
  });
}

const router = Router();

router.post("/meeting/:rowKey/:meetingId/draft", ensureMeetingDraft);
router.get("/documents", listDocuments);
router.get("/documents/:id", getDocument);
router.put("/documents/:id", updateDocument);
router.post("/documents/:id/reset-from-meeting", resetDraftFromMeeting);
router.post("/documents/:id/import-excel", importExcelRows);
router.post("/documents/:id/items", createDocumentItem);
router.delete("/documents/:id/items/:itemId", deleteDocumentItem);
router.post("/documents/:id/items/:itemId/images", uploadSingleImage, uploadDocumentItemImage);
router.delete("/documents/:id/items/:itemId/images/:imageId", deleteDocumentItemImage);
router.get("/documents/:id/images/:imageId/file", serveDocumentImage);
router.post("/documents/:id/preview", previewDocument);
router.post("/documents/:id/generate", generateDocument);
router.get("/documents/:id/download", downloadDocument);
router.patch("/documents/:id/archive", archiveDocument);

export default router;
