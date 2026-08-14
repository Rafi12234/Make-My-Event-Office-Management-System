import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  X,
  ZoomIn,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchClientMeetingsForAdmin, resolveImageUrl } from "../../services/adminActivityService";

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Full-screen gallery viewer with prev/next + keyboard navigation, matching
// ClientMeetingsPage.jsx's ImageLightbox exactly (read-only here — no
// upload/delete/final-select controls, just browsing).
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

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 hover:scale-110"
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); }}
          className="absolute left-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25 hover:scale-110"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={resolveImageUrl(image.url)}
        alt={image.originalFileName || "Meeting image"}
        className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); }}
          className="absolute right-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25 hover:scale-110"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 backdrop-blur-sm">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`rounded-full transition ${i === index ? "h-2 w-6 bg-white" : "h-2 w-2 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

function MeetingCard({ meeting, onViewImage }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mme-pink/40 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
            <CalendarClock size={16} />
          </span>
          <div>
            <p className="font-black text-mme-purple">{formatDisplayDatetime(meeting.meetingDatetime)}</p>
            <p className="text-xs text-mme-purple/55">
              Logged by {meeting.createdByName || "—"}
              {meeting.assignedByEmployeeName ? ` \u00b7 Assigned by ${meeting.assignedByEmployeeName}` : ""}
            </p>
          </div>
        </div>
        {meeting.isCompleted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
            <CheckCircle2 size={12} /> Completed{meeting.completedByName ? ` by ${meeting.completedByName}` : ""}
          </span>
        )}
      </div>

      <div className="space-y-4 p-6">
        {meeting.requirements?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-mme-purple/45">Requirements</p>
            <ul className="space-y-1.5">
              {meeting.requirements.map((req, i) => (
                <li key={req.key || i} className="text-sm text-mme-purple/75">
                  <span className="font-bold text-mme-purple">{req.label}: </span>{req.details}
                </li>
              ))}
            </ul>
          </div>
        )}

        {meeting.items?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-mme-purple/45">Items</p>
            <ul className="space-y-1.5">
              {meeting.items.map((item) => (
                <li key={item.id} className="text-sm text-mme-purple/75">
                  <span className="font-bold text-mme-purple">{item.customLabel || item.itemKey}</span>
                  {item.quantity ? ` \u00d7 ${item.quantity}` : ""}
                  {item.description ? ` \u2014 ${item.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {meeting.images?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-mme-purple/45">Images</p>
            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8">
              {meeting.images.map((img, imageIndex) => (
                <div
                  key={img.id}
                  onClick={() => onViewImage(meeting.images, imageIndex)}
                  className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border-2 transition hover:scale-105 hover:shadow-lg ${
                    img.isFinalSelected ? "border-mme-purple shadow-md shadow-mme-purple/20" : "border-mme-pink/50 hover:border-mme-pink"
                  }`}
                >
                  <img
                    src={resolveImageUrl(img.url)}
                    alt={img.tagName || img.originalFileName || "Meeting image"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                    <ZoomIn size={16} className="text-white opacity-0 transition group-hover:opacity-100" />
                  </div>
                  {img.isFinalSelected && (
                    <span className="absolute bottom-1 right-1 rounded-md bg-mme-purple px-1.5 py-0.5 text-[8px] font-black text-white">FINAL</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-mme-pink/20 pt-3 text-xs text-mme-purple/55">
          <span>Next meeting: <span className="font-bold text-mme-purple">{formatDisplayDatetime(meeting.nextMeetingDatetime)}</span></span>
          {meeting.nextMeetingAssignedEmployeeName && (
            <span>Assigned to <span className="font-bold text-mme-purple">{meeting.nextMeetingAssignedEmployeeName}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminMeetingDetailsPage() {
  const navigate = useNavigate();
  const { rowKey } = useParams();
  const location = useLocation();
  const backTo = location.state?.from || "/admin/activity";
  const backLabel = location.state?.fromLabel || "Back to activity";
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [viewer, setViewer] = useState(null); // { images, index } | null

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!admin || !rowKey) return;
    setIsLoading(true);
    fetchClientMeetingsForAdmin(rowKey)
      .then(setData)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin, rowKey]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin", { replace: true });
  }

  if (checkingSession || !admin) return null;

  return (
    <div className="min-h-screen bg-[#fff9fc]">
      <header className="sticky top-0 z-40 border-b border-mme-pink/50 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-350 items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-base font-black text-mme-purple sm:text-lg">Admin Portal</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">Make My Event</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-3 py-2 text-xs font-black text-mme-purple transition hover:bg-red-50 hover:border-red-200 hover:text-red-500"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-350 px-4 py-8 sm:px-6">
        <div className="mb-5">
          <BackButton to={backTo} title={backLabel} />
        </div>

        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarClock size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">
            {data?.clientName || "Client"} {"\u2014"} Meeting History
          </h1>
          {data?.finalization && (
            <p className="mt-1.5 text-sm font-bold text-mme-purple/60">
              Finalized {formatDisplayDatetime(data.finalization.finalizedAt)} by {data.finalization.finalizedByName || "—"}
            </p>
          )}
        </div>

        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {notice.message}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
          </div>
        ) : !data?.meetings?.length ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <CalendarClock size={38} className="text-mme-mauve" />
            <p className="mt-4 font-black text-mme-purple">No meetings logged for this client yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {data.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onViewImage={(images, index) => setViewer({ images, index })}
              />
            ))}
          </div>
        )}
      </main>

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
