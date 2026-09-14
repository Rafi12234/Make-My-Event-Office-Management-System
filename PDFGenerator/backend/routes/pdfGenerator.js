// Thin wiring only — business logic lives in controllers/pdfGeneratorController.js
// (same convention as Accounts/backend/routes/accounts.js).
import { Router } from "express";
import multer from "multer";
import {
  previewDocument,
  createDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  archiveDocument,
} from "../controllers/pdfGeneratorController.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

// memoryStorage (guide §71) — the renderer needs the raw bytes in-process
// anyway (embedded directly into the PDF), and the controller decides
// per-item whether/where to also persist them to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per reference image
    files: 200, // up to 50 items x up to 10 photos each (see MAX_IMAGES_PER_ITEM)
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(new Error("Only JPG, JPEG and PNG reference images are supported."));
    }
    callback(null, true);
  },
});

// Every photo for a given item is sent under that item's SAME
// "image_<clientId>" field name — upload.any() accepts repeated field names
// as separate entries, matched back to each item by `imageKey` in the
// controller, so one item can carry multiple reference photos.
function uploadImagesMiddleware(req, res, next) {
  upload.any()(req, res, (error) => {
    if (error) return res.status(422).json({ message: error.message || "Reference image upload failed." });
    next();
  });
}

const router = Router();

router.post("/preview", uploadImagesMiddleware, previewDocument);
router.post("/documents", uploadImagesMiddleware, createDocument);
router.get("/documents", listDocuments);
router.get("/documents/:id", getDocument);
router.get("/documents/:id/download", downloadDocument);
router.patch("/documents/:id/archive", archiveDocument);

export default router;
