import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarClock,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/managementStorage";
import {
  createMeeting,
  deleteMeeting,
  deleteMeetingImage,
  loadClientMeetings,
  resolveImageUrl,
  updateMeeting,
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

function MeetingCard({ meeting, rowKey, employeeId, onChanged, onDeleted }) {
  const [meetingDatetime, setMeetingDatetime] = useState(
    toDatetimeLocalValue(meeting.meetingDatetime),
  );
  const [discussionNotes, setDiscussionNotes] = useState(meeting.discussionNotes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isDirty =
    meetingDatetime !== toDatetimeLocalValue(meeting.meetingDatetime) ||
    discussionNotes !== (meeting.discussionNotes || "");

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateMeeting(rowKey, meeting.id, {
        meetingDatetime: meetingDatetime || null,
        discussionNotes: discussionNotes || null,
        employeeId,
      });
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to save meeting.");
    } finally {
      setIsSaving(false);
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

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setIsUploading(true);
    setError("");
    try {
      await uploadMeetingImages(rowKey, meeting.id, files, employeeId);
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

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#d6d6d6]/60 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6d6d6]/50 bg-[#f9f9f9] px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
          <CalendarClock size={15} /> {formatDisplayDatetime(meeting.meetingDatetime)}
        </div>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1.5 rounded-xl p-2 text-black/35 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          title="Delete meeting"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[240px_1fr]">
        <div>
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

        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Meeting discussion</label>
          <textarea
            rows={3}
            value={discussionNotes}
            onChange={(event) => setDiscussionNotes(event.target.value)}
            placeholder="What was discussed in this meeting?"
            className="w-full resize-none rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm leading-6 text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
          />
        </div>
      </div>

      <div className="border-t border-[#d6d6d6]/50 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
            Client-chosen images ({meeting.images.length})
          </p>
          <div className="flex items-center gap-2">
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

        {meeting.images.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d6d6d6] py-6 text-center text-xs font-semibold text-black/40">
            No images uploaded for this meeting yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {meeting.images.map((image) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-[#d6d6d6]/60 bg-[#f4f4f4]">
                <img
                  src={resolveImageUrl(image.url)}
                  alt={image.originalFileName || "Meeting image"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <button
                  onClick={() => handleDeleteImage(image.id)}
                  className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500"
                  title="Delete image"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export default function ClientMeetingsPage() {
  const { rowKey } = useParams();
  const navigate = useNavigate();
  const [employee] = useState(() => loadCurrentEmployee());
  const [clientName, setClientName] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await loadClientMeetings(rowKey);
      setClientName(data.clientName || "");
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err.message || "Failed to load meetings.");
    } finally {
      setIsLoading(false);
    }
  }, [rowKey]);

  useEffect(() => {
    if (!employee) {
      navigate("/management", { replace: true });
      return;
    }
    refresh();
  }, [employee, navigate, refresh]);

  async function handleCreateMeeting() {
    setIsCreating(true);
    setError("");
    try {
      await createMeeting(rowKey, {
        meetingDatetime: null,
        discussionNotes: null,
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
            className="inline-flex items-center gap-2 rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black hover:bg-[#f4f4f4]/30"
          >
            <ArrowLeft size={17} /> Back to sheet
          </Link>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
                <CalendarClock size={15} /> Meetings for
              </div>
              <h1 className="mt-2 text-2xl font-black text-black sm:text-3xl">
                {clientName || "This client"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                Create as many meetings as needed, set each meeting's time and discussion notes,
                and upload the images the client chose during that meeting.
              </p>
            </div>

            <button
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white shadow-md shadow-black/15 hover:bg-[#222222] disabled:opacity-60"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              Add new meeting
            </button>
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
    </div>
  );
}
