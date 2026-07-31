import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import mmeLogo from "../assets/mme_logo.jpg";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
} from "../services/managementStorage";
import { loadCalendarMonth } from "../services/calendarStorage";
import { loadClientCalls } from "../services/callsStorage";
import { loadClientMeetings, resolveImageUrl } from "../services/meetingsStorage";

// ─── Helpers ──────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, "0"); }

function to12h(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(new Date(y, mo - 1, d));
}

function shiftDate(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatColValue(type, value) {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  if (!s.trim()) return null;
  if (type === "datetime") {
    const [datePart, timePart] = s.replace("T", " ").split(" ");
    if (timePart) {
      const [h, m] = timePart.split(":").map(Number);
      return `${datePart} · ${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
    }
    return datePart || s;
  }
  if (type === "date") return s.slice(0, 10);
  if (type === "time") return to12h(s.slice(0, 5));
  if (type === "boolean") return value ? "Yes" : "No";
  return s;
}

// ─── Client day card ─────────────────────────────────────────────
// Shows everything known about one client for this day: every
// Management Sheet column (same values ManagementPage shows), plus
// their full meeting history (ClientMeetingsPage) and call history
// (ClientCallsPage), fetched the same way those pages fetch them.

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ─── Image lightbox ──────────────────────────────────────────────
// Full-screen viewer with prev/next + keyboard navigation, matching
// the ClientMeetingsPage gallery experience.

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
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 p-4"
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

// ─── Meeting image gallery ────────────────────────────────────────
// One independent gallery per meeting: clicking a thumbnail opens the
// lightbox scoped to that meeting's own images only.

function MeetingImageGallery({ images }) {
  const [viewerIndex, setViewerIndex] = useState(null);

  if (!images?.length) return null;

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, imageIndex) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setViewerIndex(imageIndex)}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[#d6d6d6]/60 bg-[#f4f4f4]"
            title="View full image"
          >
            <img
              src={resolveImageUrl(img.url)}
              alt={img.originalFileName || "Meeting image"}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {viewerIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}

function ClientDayCard({ group, columns, extras, navigate }) {
  const { rowKey, clientName, rowData } = group;

  const skipNames = new Set(["Client Name"]);
  const detailFields = (columns || []).filter(
    (col) =>
      !skipNames.has(col.name) &&
      col.type !== "meeting_manager" &&
      rowData[col.key] != null &&
      String(rowData[col.key]).trim() !== "",
  );

  const isLoading = extras?.isLoading ?? true;
  const calls     = extras?.calls || [];
  const meetings  = extras?.meetings || [];
  const error     = extras?.error || "";

  return (
    <div className="overflow-hidden rounded-3xl border border-[#d6d6d6]/60 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6d6d6]/40 bg-[#f9f9f9] px-6 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#333333]">Client</p>
          <p className="text-xl font-black leading-tight text-black">{clientName || "Unnamed client"}</p>
        </div>
      </div>

      {/* Full management sheet columns */}
      {detailFields.length > 0 && (
        <div className="grid gap-4 border-b border-[#d6d6d6]/30 px-6 py-5 sm:grid-cols-2">
          {detailFields.map((col) => {
            const formatted = formatColValue(col.type, rowData[col.key]);
            if (!formatted) return null;
            const isLong = formatted.length > 50;
            return (
              <div key={col.key} className={isLong ? "sm:col-span-2" : ""}>
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-black/40">{col.name}</p>
                <p className={`font-semibold text-black/85 ${isLong ? "text-sm leading-6" : "text-sm"}`}>{formatted}</p>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="border-b border-[#d6d6d6]/30 bg-red-50 px-6 py-3 text-xs font-bold text-red-500">{error}</div>
      )}

      {/* Meeting + Call details */}
      <div className="grid sm:grid-cols-2">
        {/* Meetings */}
        <div className="border-b border-[#d6d6d6]/30 px-6 py-5 sm:border-r sm:border-b-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-black">
              <CalendarClock size={16} /> Meeting Details
            </h3>
            <button
              onClick={() => navigate(`/management/meetings/${rowKey}`)}
              className="text-sm font-black text-[#333333] transition hover:text-black"
            >
              Manage Meetings details →
            </button>
          </div>
          {isLoading ? (
            <p className="text-sm font-bold text-black/40">Loading…</p>
          ) : meetings.length === 0 ? (
            <p className="text-sm font-bold text-black/40">No meetings logged yet.</p>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="rounded-xl border border-[#d6d6d6]/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-black text-black">{formatDisplayDatetime(m.meetingDatetime)}</p>
                    {m.isCompleted && (
                      <span className="rounded-md bg-black px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white">
                        Completed
                      </span>
                    )}
                  </div>
                  {m.requirements?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {m.requirements.map((req, i) => (
                        <li key={req.key || i} className="text-sm leading-6 text-black/65">
                          <span className="font-bold text-black/80">{req.label}: </span>
                          {req.details}
                        </li>
                      ))}
                    </ul>
                  )}
                  <MeetingImageGallery images={m.images} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calls */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-black">
              <Phone size={16} /> Call Details
            </h3>
            <button
              onClick={() => navigate(`/management/calls/${rowKey}`)}
              className="text-sm font-black text-[#333333] transition hover:text-black"
            >
              Manage Call details →
            </button>
          </div>
          {isLoading ? (
            <p className="text-sm font-bold text-black/40">Loading…</p>
          ) : calls.length === 0 ? (
            <p className="text-sm font-bold text-black/40">No calls logged yet.</p>
          ) : (
            <div className="space-y-3">
              {calls.map((c) => (
                <div key={c.id} className="rounded-xl border border-[#d6d6d6]/50 p-4">
                  <p className="text-base font-black text-black">{formatDisplayDatetime(c.callDatetime)}</p>
                  {c.callDiscussion && (
                    <p className="mt-2 text-sm leading-6 text-black/65">{c.callDiscussion}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CalendarDayPage ───────────────────────────────────────────────

export default function CalendarDayPage() {
  const { date }  = useParams();          // "YYYY-MM-DD"
  const navigate  = useNavigate();

  const [yearN, monthN] = (date || "").split("-").map(Number);

  const [events,           setEvents]           = useState([]);
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [employee,         setEmployee]         = useState(() => loadCurrentEmployee());
  const [notice,           setNotice]           = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const dayEvents = events.filter((ev) => ev.date === date);
  const TODAY     = todayISO();
  const isToday   = date === TODAY;

  // Group every client-linked event (worksheet, client_meeting, client_call)
  // by rowKey so each client shows up as a single card with full details,
  // no matter how many events they have on this day.
  const clientGroups = useMemo(() => {
    const map = new Map();
    for (const ev of dayEvents) {
      if (!ev.rowKey || ev.source === "manual") continue;
      if (!map.has(ev.rowKey)) {
        map.set(ev.rowKey, {
          rowKey: ev.rowKey,
          clientName: ev.clientName,
          rowData: ev.rowData || {},
          sources: new Set(),
        });
      }
      const group = map.get(ev.rowKey);
      group.sources.add(ev.source);
      if (!group.clientName && ev.clientName) group.clientName = ev.clientName;
    }
    return [...map.values()];
  }, [dayEvents]);

  const clientRowKeysKey = clientGroups.map((g) => g.rowKey).join(",");

  // ── Client calls / meetings ─────────────────────────────────────
  const [clientExtras, setClientExtras] = useState({}); // rowKey -> { isLoading, calls, meetings, error }

  useEffect(() => {
    if (!clientRowKeysKey) return;
    const rowKeys = clientRowKeysKey.split(",");
    let cancelled = false;

    for (const rowKey of rowKeys) {
      setClientExtras((prev) => ({
        ...prev,
        [rowKey]: { ...(prev[rowKey] || {}), isLoading: true, error: null },
      }));

      Promise.all([loadClientCalls(rowKey), loadClientMeetings(rowKey)])
        .then(([callsData, meetingsData]) => {
          if (cancelled) return;
          setClientExtras((prev) => ({
            ...prev,
            [rowKey]: {
              isLoading: false,
              calls: callsData.calls || [],
              meetings: meetingsData.meetings || [],
              error: null,
            },
          }));
        })
        .catch((err) => {
          if (cancelled) return;
          setClientExtras((prev) => ({
            ...prev,
            [rowKey]: { isLoading: false, calls: [], meetings: [], error: err.message || "Could not load client details." },
          }));
        });
    }

    return () => { cancelled = true; };
  }, [clientRowKeysKey]);

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    if (!yearN || !monthN) return;
    setIsLoading(true);
    try {
      const result = await loadCalendarMonth(yearN, monthN);
      setEvents(result.events || []);
      setWorksheetColumns(result.worksheetColumns || []);
    } catch (err) {
      showMsg("error", err.message || "Could not load events.");
    } finally {
      setIsLoading(false);
    }
  }, [yearN, monthN]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  function showMsg(type, message) { setNotice({ type, message }); }

  // ── Employee ────────────────────────────────────────────────────

  // No employee session (e.g. reached via browser back/forward navigation
  // after logging out elsewhere in the SPA) — always send the user to the
  // dedicated /login page rather than showing any inline login UI here.
  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
    }
  }, [employee, navigate]);

  function confirmLogout() {
    setShowLogoutConfirm(false);
    clearCurrentEmployee();
    setEmployee(null);
    navigate("/", { replace: true });
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#ffffff] text-black">
      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll be signed out of the workspace and will need to log in again to continue."
          confirmLabel="Logout"
          cancelLabel="Cancel"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate("/calendar")}
              className="rounded-xl p-2 text-black/60 transition hover:bg-[#f4f4f4]/40"
              title="Back to calendar"
            >
              <ArrowLeft size={20} />
            </button>
            <img src={mmeLogo} alt="Make My Event" className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-lg shadow-black/20" />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-black sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333] sm:text-xs">
                Day View
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {employee ? (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-2 rounded-2xl border border-[#d6d6d6]/70 bg-white px-3 py-2.5 text-left transition hover:bg-[#f4f4f4]/30 sm:px-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f4f4] text-black">
                  <UserRound size={16} />
                </div>
                <div className="hidden sm:block">
                  <p className="max-w-36 truncate text-xs font-black text-black">{employee.fullName}</p>
                  <p className="text-[10px] text-black/50">Switch employee</p>
                </div>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">

        {/* Date hero + prev / next navigation */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/calendar/day/${shiftDate(date, -1)}`)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6d6d6]/70 bg-white transition hover:bg-[#f4f4f4]/30"
              title="Previous day"
            >
              <ChevronLeft size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#333333]">
                <CalendarDays size={13} />
                {isToday ? "Today" : "Day view"}
              </div>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">{formatDisplayDate(date)}</h1>
              <p className="mt-1 text-sm text-black/55">
                {isLoading
                  ? "Loading…"
                  : dayEvents.length === 0
                  ? "No events on this day"
                  : `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""} — ${clientGroups.length} client${clientGroups.length !== 1 ? "s" : ""}`}
              </p>
            </div>

            <button
              onClick={() => navigate(`/calendar/day/${shiftDate(date, 1)}`)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6d6d6]/70 bg-white transition hover:bg-[#f4f4f4]/30"
              title="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#f4f4f4]/30 sm:self-auto"
          >
            <CalendarDays size={16} /> Month View
          </Link>
        </div>

        {isLoading ? (
          <div className="flex min-h-80 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d6d6d6] border-t-black" />
              <p className="mt-4 font-black text-black/50">Loading events…</p>
            </div>
          </div>
        ) : (
          <div>

            {/* ── Client details ───────────────────────────────── */}
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f4f4f4] text-[10px] font-black text-black">S</span>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-black">
                  Client Details
                </h2>
                {clientGroups.length > 0 && (
                  <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-black text-black">
                    {clientGroups.length}
                  </span>
                )}
              </div>

              {clientGroups.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-[#d6d6d6]/60 bg-white/60 p-8 text-center">
                  <CalendarDays className="text-[#a9a9a9]/40" size={38} />
                  <p className="mt-3 font-black text-black/45">No client events on this day</p>
                  <p className="mt-1.5 max-w-xs text-sm text-black/30">
                    Meetings and calls scheduled for a client on this date will appear here automatically.
                  </p>
                  <Link to="/management" className="mt-4 text-sm font-black text-[#333333] transition hover:text-black">
                    Open Management Sheet →
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  {clientGroups.map((group) => (
                    <ClientDayCard
                      key={group.rowKey}
                      group={group}
                      columns={worksheetColumns}
                      extras={clientExtras[group.rowKey]}
                      navigate={navigate}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* ── Toast ──────────────────────────────────────────────── */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[#d6d6d6] bg-white text-black"
        }`}>
          {notice.type === "error"
            ? <X className="mt-0.5 shrink-0" size={18} />
            : <Check className="mt-0.5 shrink-0 text-[#333333]" size={18} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-2 opacity-50 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
