import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/managementStorage";
import { CLIENT_REQUIREMENT_OPTIONS } from "../data/defaultSheet";
import {
  createMeeting,
  deleteMeeting,
  deleteMeetingImage,
  finalizeClient,
  loadClientMeetings,
  resolveImageUrl,
  toggleImageFinalSelection,
  toggleMeetingComplete,
  updateMeeting,
  updateMeetingImageTag,
  uploadMeetingImages,
} from "../services/meetingsStorage";

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const normalized = String(value).replace(" ", "T");
  return normalized.slice(0, 16);
}

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function requirementsToSelections(requirements) {
  const map = {};
  for (const item of requirements || []) {
    if (item?.key) map[item.key] = item.details || "";
  }
  return map;
}

function selectionsToRequirements(selections) {
  return Object.entries(selections).map(([key, details]) => {
    const option = CLIENT_REQUIREMENT_OPTIONS.find((item) => item.key === key);
    return { key, label: option?.label || key, details };
  });
}

function ImageLightbox({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  const image = images[index];
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20"
        title="Close"
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20"
          title="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={resolveImageUrl(image.url)}
        alt={image.originalFileName || "Meeting image"}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />

      {image.tagName && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
          {image.tagName}
        </p>
      )}

      {images.length > 1 && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20"
          title="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

function MeetingCard({ meeting, rowKey, employeeId, onChanged, onDeleted }) {
  const [meetingDatetime, setMeetingDatetime] = useState(
    toDatetimeLocalValue(meeting.meetingDatetime),
  );
  const [selections, setSelections] = useState(() =>
    requirementsToSelections(meeting.requirements),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [error, setError] = useState("");
  const [pendingUpload, setPendingUpload] = useState(null);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const fileInputRef = useRef(null);

  const pendingFiles = pendingUpload?.files ?? null;

  useEffect(() => {
    if (!pendingFiles) return undefined;
    const urls = pendingFiles.map((file) => URL.createObjectURL(file));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing React state with blob URLs created for an external system (the File objects), not derivable from render
    setPendingPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingFiles]);

  const isDirty =
    meetingDatetime !== toDatetimeLocalValue(meeting.meetingDatetime) ||
    JSON.stringify(selections) !==
      JSON.stringify(requirementsToSelections(meeting.requirements));

  // Requirements are rendered as a column/row table: each selected
  // requirement becomes its own column, with a single row of cells below
  // holding that requirement's details.
  const selectedRequirementOptions = CLIENT_REQUIREMENT_OPTIONS.filter((option) =>
    Object.prototype.hasOwnProperty.call(selections, option.key),
  );

  function toggleRequirement(key) {
    setSelections((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, key)) {
        delete next[key];
      } else {
        next[key] = "";
      }
      return next;
    });
  }

  function updateRequirementDetails(key, details) {
    setSelections((prev) => ({ ...prev, [key]: details }));
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateMeeting(rowKey, meeting.id, {
        meetingDatetime: meetingDatetime || null,
        requirements: selectionsToRequirements(selections),
        employeeId,
      });
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to save meeting.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleComplete() {
    setIsCompleting(true);
    setError("");
    try {
      await toggleMeetingComplete(rowKey, meeting.id, employeeId);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to update meeting status.");
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this meeting and all its images? This cannot be undone.")) return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteMeeting(rowKey, meeting.id);
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete meeting.");
      setIsDeleting(false);
    }
  }

  function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    // Stage the files first so the employee can name each one before it's
    // actually uploaded, instead of uploading immediately.
    setError("");
    setPendingUpload({ files, tags: files.map(() => "") });
  }

  function updatePendingTag(index, value) {
    setPendingUpload((prev) => {
      if (!prev) return prev;
      const tags = [...prev.tags];
      tags[index] = value;
      return { ...prev, tags };
    });
  }

  function cancelPendingUpload() {
    setPendingUpload(null);
  }

  async function confirmPendingUpload() {
    if (!pendingUpload) return;
    setIsUploading(true);
    setError("");
    try {
      await uploadMeetingImages(
        rowKey,
        meeting.id,
        pendingUpload.files,
        employeeId,
        pendingUpload.tags,
      );
      setPendingUpload(null);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to upload images.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    try {
      await deleteMeetingImage(rowKey, meeting.id, imageId);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to delete image.");
    }
  }

  async function handleTagBlur(image, value) {
    const trimmed = value.trim();
    if (trimmed === (image.tagName || "")) return;
    try {
      await updateMeetingImageTag(rowKey, image.id, trimmed);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to save image tag.");
    }
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#d6d6d6]/60 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6d6d6]/50 bg-[#f9f9f9] px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
          <CalendarClock size={15} /> {formatDisplayDatetime(meeting.meetingDatetime)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleComplete}
            disabled={isCompleting}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition disabled:opacity-60 ${
              meeting.isCompleted
                ? "bg-green-600 text-white hover:bg-green-700"
                : "border border-black/20 bg-white text-black hover:bg-[#f4f4f4]/30"
            }`}
            title="Mark this meeting as done"
          >
            {isCompleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : meeting.isCompleted ? (
              <CheckCircle2 size={14} />
            ) : (
              <Circle size={14} />
            )}
            {meeting.isCompleted ? "Marked as done" : "Mark as done"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-xl p-2 text-black/35 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            title="Delete meeting"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {meeting.isCompleted && (
        <div className="border-b border-[#d6d6d6]/40 bg-green-50 px-5 py-2 text-[11px] font-bold text-green-700">
          Completed by {meeting.completedByName || "an employee"}
          {meeting.completedAt ? ` on ${formatDisplayDatetime(meeting.completedAt)}` : ""}
        </div>
      )}

      <div className="grid gap-4 p-5 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-bold text-black/60">Meeting time</label>
          <input
            type="datetime-local"
            value={meetingDatetime}
            onChange={(event) => setMeetingDatetime(event.target.value)}
            className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
          />

          {(meeting.createdByName || meeting.updatedByName) && (
            <div className="mt-3 space-y-1 text-[11px] text-black/45">
              {meeting.createdByName && (
                <p className="flex items-center gap-1.5">
                  <UserRound size={12} /> Created by {meeting.createdByName}
                </p>
              )}
              {meeting.updatedByName && meeting.updatedByName !== meeting.createdByName && (
                <p className="flex items-center gap-1.5">
                  <UserRound size={12} /> Updated by {meeting.updatedByName}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-black/60">
              <ClipboardList size={14} /> Client Requirements
            </label>
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-black text-white hover:bg-[#222222] disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            )}
          </div>

          {selectedRequirementOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d6d6d6] py-4 text-center text-xs font-semibold text-black/40">
              No requirements added yet. Use the dropdown below to add one.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[#d6d6d6]/60">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#f9f9f9]">
                  {selectedRequirementOptions.map((option) => (
                    <th
                      key={option.key}
                      className="min-w-[170px] border-b border-r border-[#d6d6d6]/50 px-3 py-2 text-left align-middle font-black text-black last:border-r-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{option.label}</span>
                        <button
                          onClick={() => toggleRequirement(option.key)}
                          className="shrink-0 rounded p-0.5 text-black/35 transition hover:bg-red-50 hover:text-red-500"
                          title="Remove this requirement"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="min-w-[190px] border-b border-[#d6d6d6]/50 px-3 py-2 align-middle">
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) toggleRequirement(event.target.value);
                      }}
                      className="w-full rounded-lg border border-[#d6d6d6] bg-white px-2 py-1.5 text-xs font-semibold text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                    >
                      <option value="">+ Add requirement...</option>
                      {CLIENT_REQUIREMENT_OPTIONS.filter(
                        (option) => !Object.prototype.hasOwnProperty.call(selections, option.key),
                      ).map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {selectedRequirementOptions.map((option) => (
                    <td
                      key={option.key}
                      className="border-r border-[#d6d6d6]/40 px-3 py-2 align-top last:border-r-0"
                    >
                      <textarea
                        rows={3}
                        value={selections[option.key] || ""}
                        onChange={(event) =>
                          updateRequirementDetails(option.key, event.target.value)
                        }
                        placeholder={
                          option.key === "other"
                            ? "Describe the exceptional requirement..."
                            : `Notes for ${option.label}...`
                        }
                        className="w-full resize-none rounded-lg border border-transparent bg-transparent px-1 py-1 leading-5 text-black outline-none focus:border-[#333333] focus:bg-[#f4f4f4]/30 focus:ring-2 focus:ring-[#d6d6d6]/30"
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border-t border-[#d6d6d6]/50 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
            Client-chosen images ({meeting.images.length})
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/20 bg-white px-3.5 py-2 text-xs font-black text-black hover:bg-[#f4f4f4]/30 disabled:opacity-60"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              Upload images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
          </div>
        </div>

        {pendingUpload && (
          <div className="mb-4 rounded-xl border border-[#d6d6d6]/70 bg-[#f9f9f9] p-3">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-black/50">
              Name each image before uploading (optional)
            </p>
            <div className="space-y-2">
              {pendingUpload.files.map((file, fileIndex) => (
                <div key={`${file.name}-${fileIndex}`} className="flex items-center gap-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#d6d6d6]/60 bg-white">
                    {pendingPreviews[fileIndex] && (
                      <img
                        src={pendingPreviews[fileIndex]}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="w-1/3 truncate text-xs font-semibold text-black/70" title={file.name}>
                    {file.name}
                  </span>
                  <input
                    type="text"
                    value={pendingUpload.tags[fileIndex]}
                    onChange={(event) => updatePendingTag(fileIndex, event.target.value)}
                    placeholder="Tag name (e.g. Stage, Entry Gate)..."
                    className="flex-1 rounded-lg border border-[#d6d6d6] px-2.5 py-1.5 text-xs text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={cancelPendingUpload}
                disabled={isUploading}
                className="rounded-xl border border-black/20 bg-white px-3.5 py-2 text-xs font-black text-black hover:bg-[#f4f4f4]/30 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingUpload}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-black text-white hover:bg-[#222222] disabled:opacity-60"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                Upload {pendingUpload.files.length} image{pendingUpload.files.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {meeting.images.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d6d6d6] py-6 text-center text-xs font-semibold text-black/40">
            No images uploaded for this meeting yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {meeting.images.map((image, imageIndex) => (
              <div key={image.id} className="space-y-1">
                <div
                  className="group relative aspect-square w-full max-w-30 cursor-pointer overflow-hidden rounded-xl border border-[#d6d6d6]/60 bg-[#f4f4f4]"
                  onClick={() => setViewerIndex(imageIndex)}
                >
                  <img
                    src={resolveImageUrl(image.url)}
                    alt={image.originalFileName || "Meeting image"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteImage(image.id);
                    }}
                    className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500"
                    title="Delete image"
                  >
                    <X size={13} />
                  </button>
                </div>
                <input
                  type="text"
                  defaultValue={image.tagName || ""}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => handleTagBlur(image, event.target.value)}
                  placeholder="Add tag..."
                  className="w-full max-w-30 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[11px] font-semibold text-black outline-none focus:border-[#d6d6d6] focus:bg-white"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
      </div>

      {viewerIndex !== null && (
        <ImageLightbox
          images={meeting.images}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

function FinalizeReview({ rowKey, employeeId, meetings, finalization, onClose, onFinalized }) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [viewer, setViewer] = useState(null);

  const lastMeeting = meetings[meetings.length - 1];

  async function handleToggleFinal(imageId) {
    setTogglingId(imageId);
    setError("");
    try {
      await toggleImageFinalSelection(rowKey, imageId);
      await onFinalized();
    } catch (err) {
      setError(err.message || "Failed to update image selection.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirm() {
    setIsSaving(true);
    setError("");
    try {
      await finalizeClient(rowKey, employeeId);
      await onFinalized();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to finalize client.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8">
      <div className="w-full max-w-4xl rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#d6d6d6]/60 px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#333333]">
            <Sparkles size={16} /> Finalize Client Selections
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-black/40 hover:bg-[#f4f4f4]/60 hover:text-black"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {finalization && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-bold text-green-700">
              <BadgeCheck size={16} />
              Finalized by {finalization.finalizedByName || "an employee"}
              {finalization.finalizedAt
                ? ` on ${formatDisplayDatetime(finalization.finalizedAt)}`
                : ""}
              &nbsp;— you can still make changes and confirm again.
            </div>
          )}

          {meetings.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-black/40">
              No meetings to review yet.
            </p>
          ) : (
            <div className="space-y-6">
              {meetings.map((meeting, index) => (
                <div key={meeting.id}>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-black/50">
                    Meeting {index + 1} — {formatDisplayDatetime(meeting.meetingDatetime)}
                  </p>
                  {meeting.images.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d6d6d6] py-4 text-center text-xs font-semibold text-black/40">
                      No images from this meeting.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                      {meeting.images.map((image, imageIndex) => (
                        <div
                          key={image.id}
                          onClick={() => setViewer({ images: meeting.images, index: imageIndex })}
                          className={`group relative aspect-square w-full max-w-30 cursor-pointer overflow-hidden rounded-xl border-2 transition ${
                            image.isFinalSelected ? "border-green-500" : "border-[#d6d6d6]/60"
                          }`}
                          title="Click to view full screen"
                        >
                          <img
                            src={resolveImageUrl(image.url)}
                            alt={image.originalFileName || "Meeting image"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleFinal(image.id);
                            }}
                            disabled={togglingId === image.id}
                            className={`absolute right-1.5 top-1.5 rounded-full p-1 transition disabled:opacity-60 ${
                              image.isFinalSelected
                                ? "bg-green-500 text-white"
                                : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                            }`}
                            title={
                              image.isFinalSelected
                                ? "Selected as final — click to remove"
                                : "Click to mark as final"
                            }
                          >
                            {togglingId === image.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {lastMeeting && (
            <div className="mt-6 rounded-xl border border-[#d6d6d6]/60 bg-[#f9f9f9] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
                <ClipboardList size={14} /> Latest Requirements (Meeting {meetings.length})
              </p>
              {lastMeeting.requirements?.length ? (
                <ul className="space-y-1.5 text-xs text-black/70">
                  {lastMeeting.requirements.map((item) => (
                    <li key={item.key}>
                      <span className="font-bold text-black">{item.label}:</span>{" "}
                      {item.details || <span className="text-black/40">No details provided</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-semibold text-black/40">No requirements recorded yet.</p>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-xs font-bold text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#d6d6d6]/60 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-black/20 bg-white px-4 py-2.5 text-sm font-black text-black hover:bg-[#f4f4f4]/30"
          >
            Close
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white hover:bg-[#222222] disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            Confirm
          </button>
        </div>
      </div>

      {viewer && (
        <ImageLightbox
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

export default function ClientMeetingsPage() {
  const { rowKey } = useParams();
  const navigate = useNavigate();
  const [employee] = useState(() => loadCurrentEmployee());
  const [clientName, setClientName] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [finalization, setFinalization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await loadClientMeetings(rowKey);
      setClientName(data.clientName || "");
      setMeetings(data.meetings || []);
      setFinalization(data.finalization || null);
    } catch (err) {
      setError(err.message || "Failed to load meetings.");
    } finally {
      setIsLoading(false);
    }
  }, [rowKey]);

  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [employee, navigate, refresh]);

  async function handleCreateMeeting() {
    setIsCreating(true);
    setError("");
    try {
      await createMeeting(rowKey, {
        meetingDatetime: null,
        employeeId: employee?.id,
      });
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create meeting.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#ffffff] text-black">
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black font-black text-white shadow-lg shadow-black/20">M</div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-black sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333] sm:text-xs">Client Meeting Manager</p>
            </div>
          </div>

          <Link
            to="/management"
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white hover:bg-[#222222]"
          >
            <ArrowLeft size={17} /> Back to sheet
          </Link>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-5 lg:px-7">
        <section className="mx-auto w-full max-w-none">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
                <CalendarClock size={15} /> Meetings for
              </div>
              <h1 className="mt-2 text-2xl font-black text-black sm:text-3xl">
                {clientName || "This client"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                Create as many meetings as needed, set each meeting's time and client requirements,
                and upload the images the client chose during that meeting.
              </p>
              {finalization && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700">
                  <BadgeCheck size={13} />
                  Finalized by {finalization.finalizedByName || "an employee"}
                  {finalization.finalizedAt
                    ? ` on ${formatDisplayDatetime(finalization.finalizedAt)}`
                    : ""}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowFinalize(true)}
                disabled={meetings.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/20 bg-white px-4 py-2.5 text-sm font-black text-black shadow-sm hover:bg-[#f4f4f4]/30 disabled:opacity-50"
              >
                <Sparkles size={16} />
                {finalization ? "Review & re-confirm" : "Complete"}
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white shadow-md shadow-black/15 hover:bg-[#222222] disabled:opacity-60"
              >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
                Add new meeting
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid min-h-72 place-items-center">
              <Loader2 size={28} className="animate-spin text-black/40" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-[22px] border border-dashed border-[#d6d6d6] p-8 text-center">
              <div>
                <CalendarClock size={32} className="mx-auto text-black/30" />
                <p className="mt-4 font-black text-black">No meetings yet</p>
                <p className="mt-2 max-w-sm text-sm text-black/50">
                  Click "Add new meeting" to schedule the first meeting with this client.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  rowKey={rowKey}
                  employeeId={employee?.id}
                  onChanged={refresh}
                  onDeleted={refresh}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showFinalize && (
        <FinalizeReview
          rowKey={rowKey}
          employeeId={employee?.id}
          meetings={meetings}
          finalization={finalization}
          onClose={() => setShowFinalize(false)}
          onFinalized={refresh}
        />
      )}
    </div>
  );
}
