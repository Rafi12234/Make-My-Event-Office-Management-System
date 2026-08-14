import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Phone,
  UserRound,
  X,
  Sparkles,
  Clock,
  MapPin,
  ArrowRight,
} from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import BackButton from "../components/BackButton";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
} from "../services/authStorage";
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
  if (type === "datetime" || type === "last_meeting_time" || type === "next_meeting_time") {
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

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function extractIsoDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const exact = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (exact) return exact[1];
  const date = new Date(text.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isOverdueDatetime(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(" ", "T"));
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

// ─── Image lightbox ──────────────────────────────────────────────

function ImageLightbox({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
  }, []);

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
      className={`fixed inset-0 z-70 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "bg-black/95 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:scale-110 hover:ring-white/40"
        title="Close"
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); }}
          className="absolute left-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:scale-110"
          title="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={resolveImageUrl(image.url)}
        alt={image.originalFileName || "Meeting image"}
        className={`max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10 transition-all duration-500 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); }}
          className="absolute right-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:scale-110"
          title="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md ring-1 ring-white/20">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Meeting image gallery ────────────────────────────────────────

function MeetingImageGallery({ images }) {
  const [viewerIndex, setViewerIndex] = useState(null);

  if (!images?.length) return null;

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, imageIndex) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setViewerIndex(imageIndex)}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-black/8 bg-zinc-100 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover:ring-2 hover:ring-black/20"
            title="View full image"
          >
            <img
              src={resolveImageUrl(img.url)}
              alt={img.originalFileName || "Meeting image"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-110 group-hover:brightness-90"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/20">
              <div className="scale-0 rounded-xl bg-white/90 p-1.5 transition-all duration-200 group-hover:scale-100">
                <Sparkles size={14} className="text-black" />
              </div>
            </div>
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

// ─── Animated counter badge ───────────────────────────────────────

function CountBadge({ count, color = "black" }) {
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-black tabular-nums transition-all duration-300 ${
        color === "black" ? "bg-black text-white" : "bg-zinc-100 text-black"
      }`}
    >
      {count}
    </span>
  );
}

// ─── ClientDayCard ────────────────────────────────────────────────

function ClientDayCard({ group, columns, extras, navigate, selectedDate, employeeId, index }) {
  const { rowKey, clientName, rowData } = group;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const isLoading = extras?.isLoading ?? true;
  const error = extras?.error || "";

  const myCalls = (extras?.calls || []).filter((c) => c.createdById === employeeId);
  const myMeetings = (extras?.meetings || []).filter((m) => m.createdById === employeeId);
  const myNextCalls = (extras?.calls || []).filter((c) => c.nextCallAssignedEmployeeId === employeeId);
  const myNextMeetings = (extras?.meetings || []).filter((m) => m.nextMeetingAssignedEmployeeId === employeeId);

  const callsOnDate = selectedDate
    ? myCalls.filter((c) => extractIsoDate(c.callDatetime) === selectedDate || extractIsoDate(c.nextCallDatetime) === selectedDate)
    : myCalls;
  const meetingsOnDate = selectedDate
    ? myMeetings.filter((m) => extractIsoDate(m.meetingDatetime) === selectedDate)
    : myMeetings;
  const nextCallsOnDate = selectedDate
    ? myNextCalls.filter((c) => c.nextCallDatetime && extractIsoDate(c.nextCallDatetime) === selectedDate)
    : myNextCalls.filter((c) => c.nextCallDatetime);
  const nextMeetingsOnDate = selectedDate
    ? myNextMeetings.filter((m) => m.nextMeetingDatetime && extractIsoDate(m.nextMeetingDatetime) === selectedDate)
    : myNextMeetings.filter((m) => m.nextMeetingDatetime);

  const skipNames = new Set(["Client Name"]);
  const hasMeetingEvent = meetingsOnDate.length > 0 || nextMeetingsOnDate.length > 0;
  const hasCallEvent = callsOnDate.length > 0 || nextCallsOnDate.length > 0;

  const detailFields = [];
  for (const col of columns || []) {
    if (skipNames.has(col.name) || col.type === "meeting_manager") continue;
    if (col.type === "last_meeting_time" || col.type === "next_meeting_time") {
      if (hasMeetingEvent) detailFields.push({ ...col, key: `${col.key}__meeting`, value: rowData[`${col.key}__meeting`] });
      if (hasCallEvent) detailFields.push({ ...col, key: `${col.key}__call`, name: col.name.replace("Meeting", "Call"), value: rowData[`${col.key}__call`] });
      continue;
    }
    detailFields.push({ ...col, value: rowData[col.key] });
  }
  const visibleDetailFields = detailFields.filter((col) => col.value != null && String(col.value).trim() !== "");

  const totalEvents = meetingsOnDate.length + callsOnDate.length + nextMeetingsOnDate.length + nextCallsOnDate.length;

  return (
    <div
      className={`group overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-md transition-all duration-500 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 ${
        isMounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {/* Gradient top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-400" />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-gradient-to-br from-zinc-50 to-white px-6 py-5">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, black 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }} />

        <div className="relative flex items-center gap-4">
          {/* Avatar circle */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-600 shadow-lg shadow-black/20 ring-4 ring-white">
            <span className="text-lg font-black text-white">
              {(clientName || "?")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Client</p>
            <p className="text-xl font-black leading-tight text-black">{clientName || "Unnamed client"}</p>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          {totalEvents > 0 && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-black px-3.5 py-1.5 shadow-lg shadow-black/25">
              <Sparkles size={11} className="text-white/70" />
              <span className="text-xs font-black text-white">{totalEvents} event{totalEvents !== 1 ? "s" : ""}</span>
            </div>
          )}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all duration-200 hover:bg-zinc-50 hover:text-black hover:border-zinc-300"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              size={16}
              className={`transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      <div className={`transition-all duration-500 ease-in-out ${isExpanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>

        {/* Management sheet columns */}
        {visibleDetailFields.length > 0 && (
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-5">
            <p className="mb-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Client Details</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleDetailFields.map((col, i) => {
                const formatted = formatColValue(col.type, col.value);
                if (!formatted) return null;
                const isLong = formatted.length > 50;
                return (
                  <div
                    key={col.key}
                    className={`rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md ${isLong ? "sm:col-span-2 lg:col-span-3" : ""}`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{col.name}</p>
                    <p className={`font-bold text-black/85 ${isLong ? "text-sm leading-6" : "text-sm"}`}>{formatted}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-6 py-3.5">
            <AlertTriangle size={15} className="shrink-0 text-red-500" />
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* Meeting + Call columns */}
        <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">

          {/* ── Meetings ── */}
          <div className="px-6 py-6">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-600 shadow-md shadow-black/20">
                  <CalendarClock size={14} className="text-white" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-black">Meetings</h3>
                {meetingsOnDate.length > 0 && <CountBadge count={meetingsOnDate.length} />}
              </div>
              <button
                onClick={() => navigate(`/management/meetings/${rowKey}`)}
                className="group/btn flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-1.5 text-xs font-black text-white shadow-sm transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-600 active:bg-zinc-700 hover:shadow-md"
              >
                Manage
                <ArrowRight size={12} className="transition-transform duration-200 group-hover/btn:translate-x-0.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                <p className="text-sm font-bold text-zinc-400">Loading meetings…</p>
              </div>
            ) : meetingsOnDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-8 text-center">
                <CalendarClock size={28} className="text-zinc-300" />
                <p className="mt-2 text-sm font-bold text-zinc-400">No meetings today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingsOnDate.map((m, mi) => (
                  <div
                    key={m.id}
                    className="group/card overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md"
                    style={{ animationDelay: `${mi * 60}ms` }}
                  >
                    <div className="h-0.5 w-full bg-gradient-to-r from-zinc-700 to-zinc-400" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="shrink-0 text-zinc-400" />
                          <p className="text-sm font-black text-black">{formatDisplayDatetime(m.meetingDatetime)}</p>
                        </div>
                        {m.isCompleted && (
                          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                            <Check size={10} />
                            Done
                          </span>
                        )}
                      </div>
                      {m.requirements?.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {m.requirements.map((req, i) => (
                            <li key={req.key || i} className="flex gap-2 text-sm leading-6 text-zinc-600">
                              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                              <span><span className="font-bold text-zinc-800">{req.label}: </span>{req.details}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <MeetingImageGallery images={m.images} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {nextMeetingsOnDate.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-zinc-200" />
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <CalendarClock size={11} />
                    Upcoming
                  </span>
                  <div className="flex-1 border-t border-dashed border-zinc-200" />
                </div>
                <div className="space-y-2">
                  {nextMeetingsOnDate.map((m) => {
                    const missed = isOverdueDatetime(m.nextMeetingDatetime);
                    return (
                      <div
                        key={`next-meeting-${m.id}`}
                        className={`overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                          missed
                            ? "border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 shadow-sm shadow-red-100"
                            : "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-50/50 shadow-sm shadow-amber-100"
                        }`}
                      >
                        <p className={`flex items-center gap-2 text-sm font-black ${missed ? "text-red-700" : "text-amber-700"}`}>
                          {missed
                            ? <AlertTriangle size={14} className="shrink-0" />
                            : <CalendarClock size={14} className="shrink-0" />}
                          {formatDisplayDatetime(m.nextMeetingDatetime)}
                          {missed && <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] text-red-600">Missed</span>}
                        </p>
                        {m.nextMeetingAssignedEmployeeName && (
                          <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-bold ${missed ? "text-red-500" : "text-amber-600"}`}>
                            <UserRound size={11} />
                            {m.nextMeetingAssignedEmployeeName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Calls ── */}
          <div className="px-6 py-6">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-400 shadow-md shadow-black/15">
                  <Phone size={14} className="text-white" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-black">Calls</h3>
                {callsOnDate.length > 0 && <CountBadge count={callsOnDate.length} color="gray" />}
              </div>
              <button
                onClick={() => navigate(`/management/calls/${rowKey}`)}
                className="group/btn flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-1.5 text-xs font-black text-white shadow-sm transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-600 active:bg-zinc-700 hover:shadow-md"
              >
                Manage
                <ArrowRight size={12} className="transition-transform duration-200 group-hover/btn:translate-x-0.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                <p className="text-sm font-bold text-zinc-400">Loading calls…</p>
              </div>
            ) : callsOnDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-8 text-center">
                <Phone size={28} className="text-zinc-300" />
                <p className="mt-2 text-sm font-bold text-zinc-400">No calls today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {callsOnDate.map((c, ci) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md"
                    style={{ animationDelay: `${ci * 60}ms` }}
                  >
                    <div className="h-0.5 w-full bg-gradient-to-r from-zinc-500 to-zinc-300" />
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="shrink-0 text-zinc-400" />
                        <p className="text-sm font-black text-black">{formatDisplayDatetime(c.callDatetime)}</p>
                      </div>
                      {c.callDiscussion && (
                        <p className="mt-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-100">
                          {c.callDiscussion}
                        </p>
                      )}
                      {c.nextCallDatetime && (
                        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                          <CalendarClock size={12} className="shrink-0 text-zinc-400" />
                          <p className="text-xs font-bold text-zinc-600">
                            Next: {formatDisplayDatetime(c.nextCallDatetime)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {nextCallsOnDate.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-zinc-200" />
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <CalendarClock size={11} />
                    Upcoming
                  </span>
                  <div className="flex-1 border-t border-dashed border-zinc-200" />
                </div>
                <div className="space-y-2">
                  {nextCallsOnDate.map((c) => {
                    const missed = isOverdueDatetime(c.nextCallDatetime);
                    return (
                      <div
                        key={`next-${c.id}`}
                        className={`overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                          missed
                            ? "border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 shadow-sm shadow-red-100"
                            : "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-sm shadow-blue-100"
                        }`}
                      >
                        <p className={`flex items-center gap-2 text-sm font-black ${missed ? "text-red-700" : "text-blue-700"}`}>
                          {missed
                            ? <AlertTriangle size={14} className="shrink-0" />
                            : <Phone size={14} className="shrink-0" />}
                          {formatDisplayDatetime(c.nextCallDatetime)}
                          {missed && <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] text-red-600">Missed</span>}
                        </p>
                        {c.nextCallAssignedEmployeeName && (
                          <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-bold ${missed ? "text-red-500" : "text-blue-600"}`}>
                            <UserRound size={11} />
                            {c.nextCallAssignedEmployeeName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CalendarDayPage ───────────────────────────────────────────────

export default function CalendarDayPage() {
  const { date } = useParams();
  const navigate = useNavigate();

  const [yearN, monthN] = (date || "").split("-").map(Number);

  const [events, setEvents] = useState([]);
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState(() => loadCurrentEmployee());
  const [notice, setNotice] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPageVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dayEvents = events.filter((ev) => ev.date === date);
  const TODAY = todayISO();
  const isToday = date === TODAY;

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

  const [clientExtras, setClientExtras] = useState({});

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

  useEffect(() => {
    if (!employee) navigate("/login", { replace: true });
  }, [employee, navigate]);

  function confirmLogout() {
    setShowLogoutConfirm(false);
    clearCurrentEmployee();
    setEmployee(null);
    navigate("/", { replace: true });
  }

  // Parse date parts for the hero display
  const dateObj = date ? new Date(`${date}T00:00:00`) : null;
  const dayOfWeek = dateObj?.toLocaleDateString("en-US", { weekday: "long" }) || "";
  const dayNum = dateObj?.getDate() || "";
  const monthYear = dateObj?.toLocaleDateString("en-US", { month: "long", year: "numeric" }) || "";

  return (
    <div className={`min-h-screen bg-[#f8f8f8] text-black transition-opacity duration-700 ${pageVisible ? "opacity-100" : "opacity-0"}`}>
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
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 shadow-sm shadow-black/5 backdrop-blur-2xl">
        <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <img src={mmeLogo} alt="Make My Event" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
            </div>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Day View</p>
              <p className="truncate text-sm font-black text-black">{isToday ? "Today" : formatDisplayDate(date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {employee && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="group flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md sm:px-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-600 shadow-md shadow-black/20 transition-transform duration-200 group-hover:scale-105">
                  <UserRound size={15} className="text-white" />
                </div>
                <div className="hidden sm:block">
                  <p className="max-w-36 truncate text-xs font-black text-black">{employee.fullName}</p>
                  <p className="text-[10px] font-medium text-zinc-400">Switch employee</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="mb-6">
          <BackButton onClick={() => navigate("/calendar")} title="Back to calendar" />
        </div>

        {/* ── Date hero ──────────────────────────────────────── */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-md shadow-black/5 sm:p-8">
          {/* Decorative bg element */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-zinc-100 opacity-60" />
          <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-zinc-50 opacity-80" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Date display + nav */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/calendar/day/${shiftDate(date, -1)}`)}
                className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white hover:shadow-lg hover:shadow-black/15"
                title="Previous day"
              >
                <ChevronLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              </button>

              <div className="flex items-center gap-4">
                {/* Big day number */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 shadow-xl shadow-black/25">
                  <span className="text-2xl font-black text-white">{dayNum}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                      {isToday ? "✦ Today" : dayOfWeek}
                    </span>
                    {isToday && (
                      <span className="rounded-lg bg-black px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                        Today
                      </span>
                    )}
                  </div>
                  <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">{dayOfWeek}</h1>
                  <p className="text-sm font-medium text-zinc-500">{monthYear}</p>
                </div>
              </div>

              <button
                onClick={() => navigate(`/calendar/day/${shiftDate(date, 1)}`)}
                className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white hover:shadow-lg hover:shadow-black/15"
                title="Next day"
              >
                <ChevronRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Right side: stats + month view btn */}
            <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
              <Link
                to="/calendar"
                className="group flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-black shadow-sm transition-all duration-200 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white hover:shadow-lg hover:shadow-black/15"
              >
                <CalendarDays size={15} className="transition-transform duration-200 group-hover:scale-110" />
                Month View
              </Link>

              {!isLoading && (
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-zinc-50 px-3 py-1.5 ring-1 ring-zinc-200">
                    <p className="text-xs font-black text-zinc-600">
                      {dayEvents.length === 0
                        ? "No events"
                        : `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""} · ${clientGroups.length} client${clientGroups.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Loading spinner ──────────────────────────────────── */}
        {isLoading ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-6 rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
            <div className="relative">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-zinc-100 border-t-zinc-900" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CalendarDays size={20} className="text-zinc-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-black text-zinc-800">Loading events</p>
              <p className="mt-1 text-sm font-medium text-zinc-400">Fetching your schedule…</p>
            </div>
          </div>
        ) : (
          <div>

            {/* ── Section header ───────────────────────────────── */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 shadow-lg shadow-black/20">
                <UserRound size={14} className="text-white" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-[0.15em] text-black">Client Details</h2>
              {clientGroups.length > 0 && (
                <CountBadge count={clientGroups.length} />
              )}
              <div className="flex-1 border-t border-dashed border-zinc-200" />
            </div>

            {/* ── Empty state ──────────────────────────────────── */}
            {clientGroups.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                  <CalendarDays size={32} className="text-zinc-300" />
                </div>
                <div>
                  <p className="text-lg font-black text-zinc-700">No client events today</p>
                  <p className="mt-1.5 max-w-xs text-sm font-medium text-zinc-400">
                    Meetings and calls scheduled for a client on this date will appear here automatically.
                  </p>
                </div>
                <Link
                  to="/management"
                  className="group mt-1 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-black text-black shadow-sm transition-all duration-200 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white hover:shadow-lg hover:shadow-black/15"
                >
                  Open Management Sheet
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {clientGroups.map((group, i) => (
                  <ClientDayCard
                    key={group.rowKey}
                    group={group}
                    columns={worksheetColumns}
                    extras={clientExtras[group.rowKey]}
                    navigate={navigate}
                    selectedDate={date}
                    employeeId={employee?.id}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Toast notification ─────────────────────────────────── */}
      {notice && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 overflow-hidden rounded-2xl border px-5 py-4 shadow-2xl shadow-black/15 backdrop-blur-md transition-all duration-500 animate-in slide-in-from-bottom-4 ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-zinc-200 bg-white text-black"
          }`}
        >
          {/* Colored left bar */}
          <div className={`absolute left-0 top-0 h-full w-1 ${notice.type === "error" ? "bg-red-400" : "bg-zinc-800"}`} />
          <div className={`ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            notice.type === "error" ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-700"
          }`}>
            {notice.type === "error" ? <X size={15} /> : <Check size={15} />}
          </div>
          <p className="flex-1 text-sm font-bold leading-6">{notice.message}</p>
          <button
            onClick={() => setNotice(null)}
            className="mt-0.5 shrink-0 rounded-lg p-1 opacity-40 transition-all hover:opacity-100 hover:bg-black/5"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}