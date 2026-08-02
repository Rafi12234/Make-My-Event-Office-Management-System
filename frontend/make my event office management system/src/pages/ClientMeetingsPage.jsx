import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
  Sparkles,
  Trash2,
  UserRound,
  X,
  Plus,
  Calendar,
  ZoomIn,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/managementStorage";
import { CLIENT_REQUIREMENT_OPTIONS } from "../data/defaultSheet";
import {
  createMeeting,
  createMeetingItem,
  deleteMeeting,
  deleteMeetingItem,
  deleteMeetingItemImage,
  finalizeClient,
  loadClientMeetings,
  resolveImageUrl,
  toggleImageFinalSelection,
  toggleMeetingComplete,
  updateMeeting,
  updateMeetingItem,
  uploadMeetingItemImages,
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

function ImageLightbox({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight")
        setIndex((i) => (i + 1) % images.length);
      if (event.key === "ArrowLeft")
        setIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  const image = images[index];
  if (!image) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "fadeIn 0.2s ease" }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>

      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-110"
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
          className="absolute left-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:scale-110"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={resolveImageUrl(image.url)}
        alt={image.originalFileName || "Meeting image"}
        className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.25s ease" }}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
          className="absolute right-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:scale-110"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 backdrop-blur-sm">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={`rounded-full transition-all duration-200 ${
                i === index
                  ? "h-2 w-6 bg-white"
                  : "h-2 w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function MeetingCard({ meeting, rowKey, employeeId, onChanged, onDeleted }) {
  const [meetingDatetime, setMeetingDatetime] = useState(
    toDatetimeLocalValue(meeting.meetingDatetime)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [draftItemKey, setDraftItemKey] = useState("");
  const [draftCustomLabel, setDraftCustomLabel] = useState("");
  const [error, setError] = useState("");
  const [dirtyItemIds, setDirtyItemIds] = useState(() => new Set());
  const [isSavingItems, setIsSavingItems] = useState(false);
  const itemRowRefs = useRef({});

  const handleItemDirtyChange = useCallback((itemId, isItemDirty) => {
    setDirtyItemIds((prev) => {
      const next = new Set(prev);
      if (isItemDirty) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const hasDirtyItems = dirtyItemIds.size > 0;

  async function handleSaveAll() {
    setIsSavingItems(true);
    setError("");
    try {
      const idsToSave = Array.from(dirtyItemIds);
      const results = await Promise.allSettled(
        idsToSave.map((id) => itemRowRefs.current[id]?.save())
      );
      if (results.some((r) => r.status === "rejected")) {
        setError("Some items failed to save. Please check the highlighted rows.");
      }
      onChanged();
    } finally {
      setIsSavingItems(false);
    }
  }

  const isDirty =
    meetingDatetime !== toDatetimeLocalValue(meeting.meetingDatetime);

  const availableItemOptions = CLIENT_REQUIREMENT_OPTIONS.filter(
    (option) =>
      option.key === "other" || !meeting.items.some((item) => item.itemKey === option.key)
  );

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateMeeting(rowKey, meeting.id, {
        meetingDatetime: meetingDatetime || null,
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
    if (
      !window.confirm(
        "Delete this meeting and all its images? This cannot be undone."
      )
    )
      return;
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

  async function handleAddItem(itemKey, customLabel = "") {
    if (!itemKey) return;
    setIsCreatingItem(true);
    setError("");
    try {
      await createMeetingItem(rowKey, meeting.id, {
        itemKey,
        customLabel,
        description: "",
        quantity: 1,
        employeeId,
      });
      setIsAddingItem(false);
      setDraftItemKey("");
      setDraftCustomLabel("");
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to add item.");
    } finally {
      setIsCreatingItem(false);
    }
  }

  function handleStartAddItem() {
    setDraftItemKey("");
    setDraftCustomLabel("");
    setIsAddingItem(true);
  }

  function handleCancelAddItem() {
    setIsAddingItem(false);
    setDraftItemKey("");
    setDraftCustomLabel("");
  }

  function handleDraftItemKeyChange(value) {
    setDraftItemKey(value);
    setDraftCustomLabel("");
    if (value && value !== "other") {
      handleAddItem(value);
    }
  }

  function handleConfirmOtherItem() {
    const trimmed = draftCustomLabel.trim();
    if (!trimmed) return;
    handleAddItem("other", trimmed);
  }

  return (
    <div
      className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5"
      style={{ animation: "slideUp 0.35s ease both" }}
    >
      <div
        className={`relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors duration-200 ${
          meeting.isCompleted
            ? "bg-linear-to-r from-emerald-50 to-green-50/50"
            : "bg-linear-to-r from-slate-50 to-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              meeting.isCompleted
                ? "bg-emerald-500 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            <Calendar size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Scheduled
            </p>
            <p className="text-sm font-black text-slate-900">
              {formatDisplayDatetime(meeting.meetingDatetime)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleComplete}
            disabled={isCompleting}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 disabled:opacity-60 ${
              meeting.isCompleted
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600"
                : "bg-white text-slate-700 shadow-sm shadow-slate-200 hover:bg-slate-900 hover:text-white border border-slate-200"
            }`}
          >
            {isCompleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : meeting.isCompleted ? (
              <CheckCircle2 size={14} />
            ) : (
              <Circle size={14} />
            )}
            {meeting.isCompleted ? "Completed" : "Mark Complete"}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>

      {meeting.isCompleted && (
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-6 py-2.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">
            Completed by{" "}
            <span className="font-black">
              {meeting.completedByName || "an employee"}
            </span>
            {meeting.completedAt
              ? ` · ${formatDisplayDatetime(meeting.completedAt)}`
              : ""}
          </p>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
          <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Meeting Time
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="datetime-local"
              value={meetingDatetime}
              onChange={(e) => setMeetingDatetime(e.target.value)}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />

            {isDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
                style={{ animation: "slideUp 0.2s ease" }}
                title="Confirm this meeting time"
              >
                {isSaving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                OK
              </button>
            )}
          </div>

          {(meeting.createdByName || meeting.updatedByName) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-3.5">
              {meeting.createdByName && (
                <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <UserRound size={12} className="text-slate-400" />
                  Created by{" "}
                  <span className="font-black text-slate-700">
                    {meeting.createdByName}
                  </span>
                </p>
              )}
              {meeting.updatedByName &&
                meeting.updatedByName !== meeting.createdByName && (
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <UserRound size={12} className="text-slate-400" />
                    Updated by{" "}
                    <span className="font-black text-slate-700">
                      {meeting.updatedByName}
                    </span>
                  </p>
                )}
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Items
              </span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-black text-white">
                {meeting.items.length}
              </span>
            </div>

            <div className="relative flex items-center gap-2">
              <button
                onClick={handleSaveAll}
                disabled={!hasDirtyItems || isSavingItems}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSavingItems ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Save
              </button>
              <button
                onClick={isAddingItem ? handleCancelAddItem : handleStartAddItem}
                disabled={isCreatingItem || (!isAddingItem && availableItemOptions.length === 0)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {isCreatingItem ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isAddingItem ? (
                  <X size={13} />
                ) : (
                  <Plus size={13} />
                )}
                {isAddingItem ? "Cancel" : "Add Item"}
              </button>
            </div>
          </div>

          {meeting.items.length === 0 && !isAddingItem ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
              <ClipboardList size={28} className="mb-3 text-slate-300" />
              <p className="text-sm font-black text-slate-400">No items yet</p>
              <p className="mt-1 text-xs font-medium text-slate-300">
                Click "Add Item" to get started
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="min-w-40 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      <th className="min-w-60 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Description
                      </th>
                      <th className="min-w-25 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Qty
                      </th>
                      <th className="min-w-60 border-b border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Images
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isAddingItem && (
                      <tr className="border-b border-slate-100 bg-slate-50/60 align-top">
                        <td className="border-r border-slate-100 px-3 py-2.5">
                          <select
                            autoFocus
                            value={draftItemKey}
                            onChange={(e) => handleDraftItemKeyChange(e.target.value)}
                            disabled={isCreatingItem}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all duration-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                          >
                            <option value="">Choose an item...</option>
                            {availableItemOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {draftItemKey === "other" && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <input
                                autoFocus
                                type="text"
                                value={draftCustomLabel}
                                onChange={(e) => setDraftCustomLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleConfirmOtherItem();
                                }}
                                placeholder="Enter item name"
                                disabled={isCreatingItem}
                                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                              />
                              <button
                                onClick={handleConfirmOtherItem}
                                disabled={isCreatingItem || !draftCustomLabel.trim()}
                                title="Add this item"
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-40"
                              >
                                {isCreatingItem ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={13} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 text-[11px] font-medium italic text-slate-300"
                        >
                          {draftItemKey === "other"
                            ? "Enter a name above, then confirm to add this item."
                            : "Select an item type to continue…"}
                        </td>
                      </tr>
                    )}
                    {meeting.items.map((item) => (
                      <MeetingItemRow
                        key={item.id}
                        ref={(el) => {
                          if (el) itemRowRefs.current[item.id] = el;
                          else delete itemRowRefs.current[item.id];
                        }}
                        rowKey={rowKey}
                        meetingId={meeting.id}
                        item={item}
                        employeeId={employeeId}
                        onChanged={onChanged}
                        onDirtyChange={handleItemDirtyChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MeetingItemRow = forwardRef(function MeetingItemRow(
  { rowKey, meetingId, item, employeeId, onChanged, onDirtyChange },
  ref
) {
  const [description, setDescription] = useState(item.description || "");
  const [quantity, setQuantity] = useState(item.quantity ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [orderedImageIds, setOrderedImageIds] = useState(() =>
    item.images.map((image) => image.id)
  );
  const [prevImageIds, setPrevImageIds] = useState(() =>
    item.images.map((image) => image.id)
  );
  const [dragIndex, setDragIndex] = useState(null);

  const currentImageIds = item.images.map((image) => image.id);
  if (
    currentImageIds.length !== prevImageIds.length ||
    currentImageIds.some((id, i) => id !== prevImageIds[i])
  ) {
    const stillPresent = orderedImageIds.filter((id) =>
      currentImageIds.includes(id)
    );
    const newlyAdded = currentImageIds.filter(
      (id) => !orderedImageIds.includes(id)
    );
    setOrderedImageIds([...stillPresent, ...newlyAdded]);
    setPrevImageIds(currentImageIds);
  }

  const orderedImages = orderedImageIds
    .map((id) => item.images.find((image) => image.id === id))
    .filter(Boolean);

  const option = CLIENT_REQUIREMENT_OPTIONS.find(
    (c) => c.key === item.itemKey
  );
  const displayLabel =
    item.itemKey === "other" ? item.customLabel || "Other" : option?.label || item.itemKey;
  const isDirty =
    description !== (item.description || "") ||
    Number(quantity) !== (item.quantity ?? 1);

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateMeetingItem(rowKey, meetingId, item.id, {
        description,
        quantity,
        employeeId,
      });
    } catch (err) {
      setError(err.message || "Failed to save item.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
    isDirty,
  }));

  useEffect(() => {
    onDirtyChange?.(item.id, isDirty);
    return () => {
      onDirtyChange?.(item.id, false);
    };
  }, [isDirty, item.id, onDirtyChange]);

  function handleImageDragStart(index) {
    setDragIndex(index);
  }
  function handleImageDragOver(event) {
    event.preventDefault();
  }
  function handleImageDrop(dropIndex) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    setOrderedImageIds((prev) => {
      const next = [...prev];
      const [movedId] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, movedId);
      return next;
    });
    setDragIndex(null);
  }

  async function handleDeleteItem() {
    if (
      !window.confirm(
        `Remove "${displayLabel}" and its images? This cannot be undone.`
      )
    )
      return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteMeetingItem(rowKey, meetingId, item.id);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to remove item.");
      setIsDeleting(false);
    }
  }

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setIsUploading(true);
    setError("");
    try {
      await uploadMeetingItemImages(
        rowKey,
        meetingId,
        item.id,
        files,
        employeeId
      );
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to upload images.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    try {
      await deleteMeetingItemImage(rowKey, meetingId, item.id, imageId);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to delete image.");
    }
  }

  return (
    <tr className="border-b border-slate-100 align-top transition-colors duration-150 hover:bg-slate-50/50 last:border-b-0">
      <td className="border-r border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-black text-slate-900 leading-tight">
            {displayLabel}
          </span>
          <button
            onClick={handleDeleteItem}
            disabled={isDeleting}
            title="Delete this item"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-all duration-150 hover:bg-red-500 hover:text-white disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        </div>
      </td>

      <td className="border-r border-slate-100 px-3 py-2">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this item..."
          className="w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-xs leading-5 text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
      </td>

      <td className="border-r border-slate-100 px-3 py-2">
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
        {isSaving && (
          <Loader2 size={11} className="mt-1 animate-spin text-slate-300" />
        )}
        {error && <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>}
      </td>

      <td className="px-3 py-2.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <ImagePlus size={11} />
          )}
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />

        {orderedImages.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-300">
            No images yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {orderedImages.map((image, imageIndex) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleImageDragStart(imageIndex)}
                onDragOver={handleImageDragOver}
                onDrop={() => handleImageDrop(imageIndex)}
                onDragEnd={() => setDragIndex(null)}
                title="Drag to reorder priority — left-most is 1st priority"
                className={`group relative aspect-square w-full max-w-18 cursor-grab overflow-hidden rounded-xl border bg-slate-100 transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:scale-105 active:cursor-grabbing ${
                  dragIndex === imageIndex
                    ? "opacity-40 border-slate-400"
                    : "border-slate-200"
                }`}
                onClick={() => setViewerIndex(imageIndex)}
              >
                <span className="absolute left-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-md bg-black/60 text-[9px] font-black text-white">
                  {imageIndex + 1}
                </span>
                <img
                  src={resolveImageUrl(image.url)}
                  alt={image.originalFileName || "Item image"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
                  <ZoomIn
                    size={14}
                    className="text-white opacity-0 transition-all duration-200 group-hover:opacity-100"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImage(image.id);
                  }}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-lg bg-black/70 text-white opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {viewerIndex !== null && (
          <ImageLightbox
            images={orderedImages}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        )}
      </td>
    </tr>
  );
});

function FinalizeItemRow({
  rowKey,
  meetingId,
  item,
  employeeId,
  onSaved,
  onViewImage,
}) {
  const [description, setDescription] = useState(item.description || "");
  const [quantity, setQuantity] = useState(item.quantity ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const option = CLIENT_REQUIREMENT_OPTIONS.find(
    (c) => c.key === item.itemKey
  );
  const displayLabel =
    item.itemKey === "other" ? item.customLabel || "Other" : option?.label || item.itemKey;

  const isDirty =
    description !== (item.description || "") ||
    Number(quantity) !== (item.quantity ?? 1);

  async function handleSave() {
    if (!isDirty) return;
    setIsSaving(true);
    setError("");
    try {
      await updateMeetingItem(rowKey, meetingId, item.id, {
        description,
        quantity,
        employeeId,
      });
      await onSaved();
    } catch (err) {
      setError(err.message || "Failed to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{displayLabel}</p>
        {isSaving && <Loader2 size={13} className="animate-spin text-slate-300" />}
      </div>

      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={handleSave}
        placeholder="Describe this item..."
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white"
      />

      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Qty
        </label>
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={handleSave}
          className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white"
        />
      </div>

      {error && <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>}

      {item.images.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {item.images.map((image, imageIndex) => (
            <div
              key={image.id}
              className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition-all duration-200 hover:border-slate-300 hover:scale-105"
              onClick={() => onViewImage(item.images, imageIndex)}
            >
              <img
                src={resolveImageUrl(image.url)}
                alt={image.originalFileName || "Item image"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinalizeReview({
  rowKey,
  employeeId,
  meetings,
  finalization,
  onClose,
  onFinalized,
}) {
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
    } catch (err) {
      setError(err.message || "Failed to finalize client.");
    } finally {
      setIsSaving(false);
    }
  }

  const totalSelected = meetings.reduce(
    (acc, m) => acc + m.images.filter((img) => img.isFinalSelected).length,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8"
      style={{ animation: "fadeIn 0.2s ease" }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/30"
        style={{ animation: "slideUp 0.3s ease" }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Review
              </p>
              <p className="text-base font-black text-slate-900">
                Finalize Client Selections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalSelected > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-xs font-black text-emerald-700">
                  {totalSelected} selected
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-7 py-6">
          {finalization && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <BadgeCheck size={18} className="shrink-0 text-emerald-500" />
              <p className="text-xs font-semibold text-emerald-700">
                Finalized by{" "}
                <span className="font-black">
                  {finalization.finalizedByName || "an employee"}
                </span>
                {finalization.finalizedAt
                  ? ` on ${formatDisplayDatetime(finalization.finalizedAt)}`
                  : ""}
                &nbsp;— you can still make changes and confirm again.
              </p>
            </div>
          )}

          {meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar size={36} className="mb-4 text-slate-200" />
              <p className="font-black text-slate-400">No meetings to review</p>
            </div>
          ) : (
            <div className="space-y-8">
              {meetings.map((meeting, index) => (
                <div key={meeting.id}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Meeting {index + 1}
                      </p>
                      <p className="text-xs font-bold text-slate-600">
                        {formatDisplayDatetime(meeting.meetingDatetime)}
                      </p>
                    </div>
                  </div>

                  {meeting.images.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-6 text-center">
                      <p className="text-xs font-semibold text-slate-300">
                        No images from this meeting
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                      {meeting.images.map((image, imageIndex) => (
                        <div
                          key={image.id}
                          onClick={() =>
                            setViewer({ images: meeting.images, index: imageIndex })
                          }
                          className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                            image.isFinalSelected
                              ? "border-emerald-400 shadow-md shadow-emerald-100"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <img
                            src={resolveImageUrl(image.url)}
                            alt={image.originalFileName || "Meeting image"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {image.isFinalSelected && (
                            <div className="absolute inset-0 bg-emerald-500/10" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFinal(image.id);
                            }}
                            disabled={togglingId === image.id}
                            className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-60 ${
                              image.isFinalSelected
                                ? "bg-emerald-500 text-white shadow-md"
                                : "bg-black/50 text-white opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                            }`}
                          >
                            {togglingId === image.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
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
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <ClipboardList size={15} className="text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Final Items — Meeting {meetings.length}
                </p>
              </div>
              <div className="space-y-3 p-5">
                {lastMeeting.items?.length ? (
                  lastMeeting.items.map((item) => (
                    <FinalizeItemRow
                      key={item.id}
                      rowKey={rowKey}
                      meetingId={lastMeeting.id}
                      item={item}
                      employeeId={employeeId}
                      onSaved={onFinalized}
                      onViewImage={(images, index) =>
                        setViewer({ images, index })
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs font-semibold text-slate-300">
                    No items recorded yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-7 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <BadgeCheck size={15} />
            )}
            Confirm & Finalize
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
    <div className="min-h-screen bg-[#f8f9fb] text-black">
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/40 backdrop-blur-xl">
        <div className="flex min-h-17 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-black text-white shadow-lg shadow-slate-900/20">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-900 sm:text-lg">
                Make My Event
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Client Meeting Manager
              </p>
            </div>
          </div>

          <Link
            to="/management"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to sheet
          </Link>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-none">
          <div
            className="mb-8 overflow-hidden rounded-3xl bg-white p-7 shadow-sm shadow-slate-200/60 border border-slate-200/80"
            style={{ animation: "scaleIn 0.3s ease" }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarClock size={14} className="text-slate-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Client Meetings
                  </p>
                </div>
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">
                  {clientName || "This client"}
                </h1>
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                  Schedule meetings, track client requirements, and upload the
                  images the client chose during each session.
                </p>

                {finalization && (
                  <div
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5"
                    style={{ animation: "slideUp 0.2s ease" }}
                  >
                    <BadgeCheck size={15} className="shrink-0 text-emerald-500" />
                    <p className="text-xs font-bold text-emerald-700">
                      Finalized by{" "}
                      <span className="font-black">
                        {finalization.finalizedByName || "an employee"}
                      </span>
                      {finalization.finalizedAt
                        ? ` · ${formatDisplayDatetime(finalization.finalizedAt)}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-3">
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-4 text-center border border-slate-100">
                  <span className="text-3xl font-black text-slate-900">
                    {meetings.length}
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Meetings
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 px-5 py-4 text-center border border-emerald-100">
                  <span className="text-3xl font-black text-emerald-600">
                    {meetings.filter((m) => m.isCompleted).length}
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Done
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              <button
                onClick={() => setShowFinalize(true)}
                disabled={meetings.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} className="text-amber-500" />
                {finalization ? "Review & Re-confirm" : "Complete & Finalize"}
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add New Meeting
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
              style={{ animation: "slideUp 0.2s ease" }}
            >
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl bg-white border border-slate-200">
              <Loader2
                size={28}
                className="animate-spin text-slate-300"
              />
              <p className="text-sm font-semibold text-slate-300">
                Loading meetings...
              </p>
            </div>
          ) : meetings.length === 0 ? (
            <div
              className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center"
              style={{ animation: "scaleIn 0.3s ease" }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50">
                <CalendarClock size={28} className="text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-400">
                  No meetings yet
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-slate-300">
                  Click "Add New Meeting" to schedule the first meeting with
                  this client.
                </p>
              </div>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Add New Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {meetings.map((meeting, index) => (
                <div
                  key={meeting.id}
                  style={{ animation: `slideUp 0.3s ease ${index * 0.06}s both` }}
                >
                  <MeetingCard
                    meeting={meeting}
                    rowKey={rowKey}
                    employeeId={employee?.id}
                    onChanged={refresh}
                    onDeleted={refresh}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
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
