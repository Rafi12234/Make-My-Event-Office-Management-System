import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import BackButton from "../components/BackButton";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
} from "../services/authStorage";
import { loadCalendarMonth } from "../services/calendarStorage";
import { loadClientCalls } from "../services/callsStorage";
import { loadClientMeetings } from "../services/meetingsStorage";

// ─── Static data ────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Style helpers ───────────────────────────────────────────────

function isOverdueDatetime(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(" ", "T"));
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function eventStyle(type) {
  const dots = {
    meeting:  "bg-black",
    upcoming: "bg-[#333333]",
    followup: "bg-[#555555]",
    deadline: "bg-[#a9a9a9]",
    task:     "bg-[#666666]",
    other:    "bg-[#a9a9a9]",
  };
  return {
    pill: "bg-[#f4f4f4] text-black border-[#d6d6d6]",
    dot:  dots[type] || dots.other,
  };
}

// ─── Calendar grid builder ───────────────────────────────────────

function pad(n) { return String(n).padStart(2, "0"); }

function buildCalendarDays(year, month) {
  const firstDay       = new Date(year, month - 1, 1);
  const daysInMonth    = new Date(year, month, 0).getDate();
  const prevMonthDays  = new Date(year, month - 1, 0).getDate();

  // Monday-first offset (0 = Mon … 6 = Sun)
  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;

  const days = [];

  for (let i = offset - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    days.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: `${year}-${pad(month)}-${pad(d)}`, day: d, isCurrentMonth: true });
  }

  const fill = 42 - days.length;
  for (let d = 1; d <= fill; d++) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    days.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d, isCurrentMonth: false });
  }

  return days;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function to12h(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ampm}`;
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

// Position the hover card near the client pill that triggered it. Tries
// opening below/above the pill first (like a dropdown); if neither vertical
// direction has decent room but there's more room to a side, it opens
// beside the pill instead — the card is never confined to only ever
// appearing above/below. Height is intentionally left unconstrained (no
// max-height/scrollbar) — callers can request a wider card (`wide: true`)
// so a lot of content spreads into two columns instead of growing very tall.
function computeTooltipStyle(rect, { wide = false } = {}) {
  const margin = 12;
  const width  = wide ? 640 : 340;
  const style  = { width: `${width}px` };

  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const spaceRight = window.innerWidth - rect.right - margin;
  const spaceLeft  = rect.left - margin;

  const bestVertical   = Math.max(spaceBelow, spaceAbove);
  const bestHorizontal = Math.max(spaceRight, spaceLeft);

  if (bestVertical >= 220 || bestVertical >= bestHorizontal) {
    if (spaceBelow >= spaceAbove) style.top = `${rect.bottom + 8}px`;
    else style.bottom = `${window.innerHeight - rect.top + 8}px`;

    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    if (left < margin) left = margin;
    style.left = `${left}px`;
  } else {
    if (spaceRight >= spaceLeft) style.left = `${rect.right + 8}px`;
    else style.left = `${Math.max(margin, rect.left - width - 8)}px`;

    let top = rect.top;
    if (top < margin) top = margin;
    style.top = `${top}px`;
  }

  return style;
}

// ─── Column value formatting ─────────────────────────────────────

function formatColValue(type, value) {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  if (!s.trim()) return null;
  if (type === "datetime" || type === "last_meeting_time" || type === "next_meeting_time") {
    const clean = s.replace("T", " ");
    const [datePart, timePart] = clean.split(" ");
    if (timePart) {
      const [h, m] = timePart.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      return `${datePart} \u00b7 ${h % 12 || 12}:${pad(m)} ${ampm}`;
    }
    return datePart || s;
  }
  if (type === "date") return s.slice(0, 10);
  if (type === "time") return to12h(s.slice(0, 5));
  if (type === "boolean") return value ? "Yes" : "No";
  return s;
}

// ─── Client hover card ─────────────────────────────────────────────
// Shown when hovering a client pill in the month grid — mirrors the
// /calendar/day details (management sheet columns, meeting details,
// call details) but leaves out meeting pictures.

function ClientHoverCard({ clientName, rowData, columns, extras, rect, selectedDate, rowKey, employeeId, navigate, onMouseEnter, onMouseLeave }) {
  const isLoading = extras?.isLoading ?? true;
  // This card lives on each employee's OWN personalised calendar — a call or
  // meeting another employee logged for this same client (or a follow-up
  // scheduled to someone else) must never leak in here, so every section is
  // scoped to only what I created or what's assigned to me, matching the
  // same rule the backend uses to decide what shows up on my calendar at all.
  const myCalls    = (extras?.calls || []).filter((c) => c.createdById === employeeId);
  const myMeetings = (extras?.meetings || []).filter((m) => m.createdById === employeeId);
  const myNextCalls    = (extras?.calls || []).filter((c) => c.nextCallAssignedEmployeeId === employeeId);
  const myNextMeetings = (extras?.meetings || []).filter((m) => m.nextMeetingAssignedEmployeeId === employeeId);
  // Matches on either the call's own date OR its scheduled follow-up date,
  // so hovering the day the next call is due also surfaces that same call.
  const callsOnDate = selectedDate
    ? myCalls.filter(
        (c) => extractIsoDate(c.callDatetime) === selectedDate || extractIsoDate(c.nextCallDatetime) === selectedDate,
      )
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
  // "Last/Next Meeting Time" columns track whichever of a meeting or a call
  // happened/comes next — split into Meeting- and/or Call-labeled rows,
  // shown only for the kinds of events this client actually has this day.
  const hasMeetingEvent = meetingsOnDate.length > 0 || nextMeetingsOnDate.length > 0;
  const hasCallEvent    = callsOnDate.length > 0 || nextCallsOnDate.length > 0;
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

  // A lot of content is easier to scan spread across two columns than
  // stretched into one very tall card — and it means the card never needs
  // an inner scrollbar no matter how much history a client has.
  const wide  = visibleDetailFields.length + meetingsOnDate.length + callsOnDate.length + nextCallsOnDate.length + nextMeetingsOnDate.length > 6;
  const style = computeTooltipStyle(rect, { wide });

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-100 rounded-2xl border border-[#d6d6d6]/60 bg-white p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-black">{clientName || "Unnamed client"}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/management/meetings/${rowKey}`, { state: { from: "/calendar" } })}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#f2662b] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#d9541f] hover:shadow-md hover:shadow-[#f2662b]/30 active:scale-[0.96]"
          >
            <CalendarClock size={14} /> Meeting
          </button>
          <button
            type="button"
            onClick={() => navigate(`/management/calls/${rowKey}`, { state: { from: "/calendar" } })}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#c2410c] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#9a340a] hover:shadow-md hover:shadow-[#c2410c]/30 active:scale-[0.96]"
          >
            <Phone size={14} /> Call
          </button>
        </div>
      </div>

      <div className={wide ? "columns-2 gap-x-6" : ""}>
        {visibleDetailFields.length > 0 && (
          <div className="mt-2 break-inside-avoid-column space-y-1.5 border-b border-[#d6d6d6]/30 pb-3">
            {visibleDetailFields.map((col) => {
              const formatted = formatColValue(col.type, col.value);
              if (!formatted) return null;
              return (
                <div key={col.key} className="flex items-baseline gap-2">
                  <span className="w-28 shrink-0 text-[10px] font-black uppercase tracking-wide text-black/45">{col.name}</span>
                  <span className="wrap-break-word text-xs font-semibold text-black/80">{formatted}</span>
                </div>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <p className="mt-3 text-xs font-bold text-black/40">Loading…</p>
        ) : (
          <>
            {meetingsOnDate.length > 0 && (
              <div className="mt-3 break-inside-avoid-column">
                <p className="break-after-[avoid-column] text-[10px] font-black uppercase tracking-widest text-black/50">Meeting Details</p>
                <div className="mt-1.5 space-y-2">
                  {meetingsOnDate.map((m) => (
                    <div key={m.id} className="break-inside-avoid-column rounded-lg border border-[#d6d6d6]/50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-black">{formatDisplayDatetime(m.meetingDatetime)}</p>
                        {m.isCompleted && (
                          <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                            Completed
                          </span>
                        )}
                      </div>
                      {m.requirements?.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {m.requirements.map((req, i) => (
                            <li key={req.key || i} className="text-[11px] leading-5 text-black/60">
                              <span className="font-bold text-black/75">{req.label}: </span>
                              {req.details}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {callsOnDate.length > 0 && (
              <div className="mt-3 break-inside-avoid-column">
                <p className="break-after-[avoid-column] text-[10px] font-black uppercase tracking-widest text-black/50">Call Details</p>
                <div className="mt-1.5 space-y-2">
                  {callsOnDate.map((c) => (
                    <div key={c.id} className="break-inside-avoid-column rounded-lg border border-[#d6d6d6]/50 p-2.5">
                      <p className="text-xs font-black text-black">{formatDisplayDatetime(c.callDatetime)}</p>
                      {c.callDiscussion && (
                        <p className="mt-1 text-[11px] leading-5 text-black/60">{c.callDiscussion}</p>
                      )}
                      {c.nextCallDatetime && (
                        <p className="mt-1 text-[11px] font-bold text-black/70">
                          Next call: {formatDisplayDatetime(c.nextCallDatetime)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nextCallsOnDate.length > 0 && (
              <div className="mt-3 break-inside-avoid-column">
                <p className="break-after-[avoid-column] text-[10px] font-black uppercase tracking-widest text-black/50">Next Call Scheduled</p>
                <div className="mt-1.5 space-y-2">
                  {nextCallsOnDate.map((c) => {
                    const missed = isOverdueDatetime(c.nextCallDatetime);
                    return (
                      <div key={`next-${c.id}`} className={`break-inside-avoid-column rounded-lg border p-2.5 ${missed ? "border-red-200 bg-red-50" : "border-[#d6d6d6]/50"}`}>
                        <p className={`text-xs font-black ${missed ? "text-red-600" : "text-black"}`}>
                          {formatDisplayDatetime(c.nextCallDatetime)}{missed ? " · Missed" : ""}
                        </p>
                        {c.nextCallAssignedEmployeeName && (
                          <p className="mt-1 text-[11px] font-bold text-black/60">
                            Assigned to {c.nextCallAssignedEmployeeName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {nextMeetingsOnDate.length > 0 && (
              <div className="mt-3 break-inside-avoid-column">
                <p className="break-after-[avoid-column] text-[10px] font-black uppercase tracking-widest text-black/50">Next Meeting Scheduled</p>
                <div className="mt-1.5 space-y-2">
                  {nextMeetingsOnDate.map((m) => {
                    const missed = isOverdueDatetime(m.nextMeetingDatetime);
                    return (
                      <div key={`next-meeting-${m.id}`} className={`break-inside-avoid-column rounded-lg border p-2.5 ${missed ? "border-red-200 bg-red-50" : "border-[#d6d6d6]/50"}`}>
                        <p className={`text-xs font-black ${missed ? "text-red-600" : "text-black"}`}>
                          {formatDisplayDatetime(m.nextMeetingDatetime)}{missed ? " · Missed" : ""}
                        </p>
                        {m.nextMeetingAssignedEmployeeName && (
                          <p className="mt-1 text-[11px] font-bold text-black/60">
                            Assigned to {m.nextMeetingAssignedEmployeeName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {meetingsOnDate.length === 0 && callsOnDate.length === 0 && nextCallsOnDate.length === 0 && nextMeetingsOnDate.length === 0 && (
              <p className="mt-3 text-xs font-bold text-black/40">No meeting or call details for this date.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main calendar page ───────────────────────────────────────────

export default function CalendarPage() {
  const now  = new Date();
  const navigate = useNavigate();
  const [year,             setYear]             = useState(now.getFullYear());
  const [month,            setMonth]            = useState(now.getMonth() + 1);
  const [events,           setEvents]           = useState([]);
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [notice,           setNotice]           = useState(null);
  const [employee,         setEmployee]         = useState(() => loadCurrentEmployee());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const TODAY        = todayISO();

  // Events grouped by date
  const byDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.date) continue;
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date).push(ev);
    }
    return map;
  }, [events]);

  // Client-linked events (worksheet, client_meeting, client_call,
  // client_next_call, client_next_meeting) grouped by date, then by rowKey —
  // so each client shows as a single grid pill saying which of Meeting /
  // Call details are available for that day.
  const clientsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.date || !ev.rowKey || ev.source === "manual") continue;
      if (!map.has(ev.date)) map.set(ev.date, new Map());
      const dayMap = map.get(ev.date);
      if (!dayMap.has(ev.rowKey)) {
        dayMap.set(ev.rowKey, {
          rowKey: ev.rowKey,
          clientName: ev.clientName,
          rowData: ev.rowData || {},
          hasMeetingActivity: false,
          hasCallActivity: false,
          hasNextCallActivity: false,
          hasNextMeetingActivity: false,
          nextCallOverdue: false,
          nextMeetingOverdue: false,
        });
      }
      const client = dayMap.get(ev.rowKey);
      if (!client.clientName && ev.clientName) client.clientName = ev.clientName;
      if (ev.source === "worksheet" || ev.source === "client_meeting") client.hasMeetingActivity = true;
      if (ev.source === "client_call") client.hasCallActivity = true;
      if (ev.source === "client_next_call") {
        client.hasNextCallActivity = true;
        if (isOverdueDatetime(`${ev.date}T${ev.time || "00:00"}`)) client.nextCallOverdue = true;
      }
      if (ev.source === "client_next_meeting") {
        client.hasNextMeetingActivity = true;
        if (isOverdueDatetime(`${ev.date}T${ev.time || "00:00"}`)) client.nextMeetingOverdue = true;
      }
    }
    const result = new Map();
    for (const [date, dayMap] of map) result.set(date, [...dayMap.values()]);
    return result;
  }, [events]);

  // ── Client hover details (Meeting/Call history, fetched on-demand) ──────
  const [clientExtras, setClientExtras] = useState({}); // rowKey -> { isLoading, calls, meetings, error }
  const [hoverInfo,    setHoverInfo]    = useState(null); // { rowKey, clientName, rowData, date, rect }
  const requestedRowKeys = useRef(new Set());

  const ensureClientExtras = useCallback((rowKey) => {
    if (requestedRowKeys.current.has(rowKey)) return;
    requestedRowKeys.current.add(rowKey);
    setClientExtras((prev) => ({ ...prev, [rowKey]: { isLoading: true, calls: [], meetings: [], error: null } }));

    Promise.all([loadClientCalls(rowKey), loadClientMeetings(rowKey)])
      .then(([callsData, meetingsData]) => {
        setClientExtras((prev) => ({
          ...prev,
          [rowKey]: { isLoading: false, calls: callsData.calls || [], meetings: meetingsData.meetings || [], error: null },
        }));
      })
      .catch((err) => {
        requestedRowKeys.current.delete(rowKey);
        setClientExtras((prev) => ({
          ...prev,
          [rowKey]: { isLoading: false, calls: [], meetings: [], error: err.message || "Could not load client details." },
        }));
      });
  }, []);

  const hoverHideTimeout = useRef(null);

  function cancelHoverHide() {
    if (hoverHideTimeout.current) {
      window.clearTimeout(hoverHideTimeout.current);
      hoverHideTimeout.current = null;
    }
  }

  function showClientHoverCard(event, client, date) {
    cancelHoverHide();
    ensureClientExtras(client.rowKey);
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverInfo({
      rowKey:     client.rowKey,
      clientName: client.clientName,
      rowData:    client.rowData,
      date,
      rect:       { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
    });
  }

  // Delayed hide (instead of hiding immediately) — gives the pointer time to
  // travel from the pill onto the hover card itself so the Meeting/Call
  // buttons inside it are actually clickable, not just visible.
  function scheduleHideClientHoverCard() {
    cancelHoverHide();
    hoverHideTimeout.current = window.setTimeout(() => setHoverInfo(null), 150);
  }

  function showNotice(type, message) { setNotice({ type, message }); }

  // ── Load events ────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadCalendarMonth(year, month);
      setEvents(result.events || []);
      setWorksheetColumns(result.worksheetColumns || []);
    } catch (err) {
      showNotice("error", err.message || "Could not load calendar events.");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch from the server whenever the visible month changes, not derived render state
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // ── Month navigation ───────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }

  // ── Employee ───────────────────────────────────────────────────

  // No employee session (e.g. reached via browser back/forward navigation
  // after logging out elsewhere in the SPA) — always send the user to the
  // dedicated /login page rather than showing any inline login UI here.
  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
    }
  }, [employee, navigate]);

  // ── Event CRUD ─────────────────────────────────────────────────

  const totalEvents  = events.length;
  const meetingCount = events.filter((e) => e.source === "worksheet" || e.source === "client_meeting").length;
  const callCount     = events.filter((e) => e.source === "client_call").length;
  const manualCount   = events.filter((e) => e.source === "manual").length;

  function confirmLogout() {
    setShowLogoutConfirm(false);
    clearCurrentEmployee();
    setEmployee(null);
    navigate("/", { replace: true });
  }

  // ── Render ─────────────────────────────────────────────────────
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

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={mmeLogo} alt="Make My Event" className="h-16 w-auto shrink-0 object-contain sm:h-18" />
            <div className="min-w-0 border-l border-[#d6d6d6]/60 pl-3">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333] sm:text-xs">
                My Calendar
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
                <ChevronDown size={15} className="hidden text-[#333333] sm:block" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-350">

          <div className="mb-4">
            <BackButton to="/management" title="Back to management" />
          </div>

          {/* Title + stats */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
                <CalendarDays size={15} /> My calendar
              </div>
              <h1 className="mt-1.5 text-2xl font-black sm:text-3xl">
                {MONTH_NAMES[month - 1]} {year}
              </h1>
              <p className="mt-1.5 text-sm text-black/60">
                {totalEvents === 0
                  ? "No events scheduled by you this month"
                  : `${totalEvents} event${totalEvents !== 1 ? "s" : ""} — ${meetingCount} meeting · ${callCount} call · ${manualCount} scheduled`}
                {employee?.fullName ? ` by ${employee.fullName}` : ""}
              </p>
            </div>
            <Link
              to="/management"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black hover:bg-[#f4f4f4]/30 transition sm:self-auto"
            >
              <ArrowLeft size={16} /> Management Sheet
            </Link>
          </div>

          {/* Calendar card */}
          <div className="overflow-hidden rounded-3xl border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]">

            {/* Month navigation bar */}
            <div className="flex items-center justify-between border-b border-[#d6d6d6]/30 bg-linear-to-r from-black to-[#333333] px-4 py-3.5 text-white sm:px-6">
              <button
                onClick={prevMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="text-center">
                <p className="text-lg font-black sm:text-xl">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
                <button
                  onClick={goToday}
                  className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-[#f4f4f4]/80 hover:text-white transition"
                >
                  Jump to today
                </button>
              </div>

              <button
                onClick={nextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-[#d6d6d6]/30 bg-[#f4f4f4]/25">
              {DAY_LABELS.map((d, i) => (
                <div
                  key={d}
                  className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-[#333333] ${i < 6 ? "border-r border-[#d6d6d6]/20" : ""}`}
                >
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>

            {/* Grid body */}
            {isLoading ? (
              <div className="grid min-h-96 place-items-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#d6d6d6] border-t-black" />
                  <p className="mt-3 text-sm font-bold text-black/50">Loading calendar…</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((info, idx) => {
                  const dayEvs      = byDate.get(info.date) || [];
                  const dayClients  = clientsByDate.get(info.date) || [];
                  const manualEvs   = dayEvs.filter((ev) => ev.source === "manual" || !ev.rowKey);
                  const combined    = [
                    ...dayClients.map((c) => ({ kind: "client", data: c, id: `client_${c.rowKey}` })),
                    ...manualEvs.map((ev) => ({ kind: "manual", data: ev, id: ev.id })),
                  ];
                  const isToday    = info.date === TODAY;
                  const visible    = combined.slice(0, 3);
                  const extra      = Math.max(0, combined.length - 3);
                  const isLastCol  = (idx + 1) % 7 === 0;

                  return (
                    <button
                      key={info.date}
                      onClick={() => navigate(`/calendar/day/${info.date}`)}
                      className={[
                        "group relative min-h-20 p-1.5 text-left transition sm:min-h-27.5 sm:p-2.5",
                        "border-b border-[#d6d6d6]/25",
                        isLastCol ? "" : "border-r border-[#d6d6d6]/25",
                        info.isCurrentMonth ? "bg-white hover:bg-[#f4f4f4]/15" : "bg-[#fdf8fc] hover:bg-[#f4f4f4]/10",
                        "",
                      ].join(" ")}
                    >
                      {/* Day number */}
                      <div className="flex justify-end">
                        <span
                          className={[
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                            isToday ? "bg-black text-white shadow-sm" : "",
                            !isToday && info.isCurrentMonth ? "text-black" : "",
                            !isToday && !info.isCurrentMonth ? "text-black/25" : "",
                          ].join(" ")}
                        >
                          {info.day}
                        </span>
                      </div>

                      {/* Event pills */}
                      <div className="mt-1 space-y-0.5">
                        {visible.map((item) => {
                          if (item.kind === "client") {
                            const c = item.data;
                            // A next-call/next-meeting schedule left unfulfilled (no new
                            // call/meeting logged that day) surfaces as a distinct "Missed"
                            // pill, not a silent "Upcoming" one that never changes once the
                            // time has passed.
                            const missedCall = c.nextCallOverdue && !c.hasMeetingActivity && !c.hasCallActivity;
                            const missedMeeting = c.nextMeetingOverdue && !c.hasMeetingActivity && !c.hasCallActivity;
                            const isMissedOnly = missedCall || missedMeeting;
                            const label = c.hasMeetingActivity && (c.hasCallActivity || c.hasNextCallActivity || c.hasNextMeetingActivity)
                              ? "Meeting & Call"
                              : c.hasMeetingActivity
                              ? "Meeting"
                              : c.hasCallActivity
                              ? "Call"
                              : missedCall && missedMeeting
                              ? "Missed Follow-ups"
                              : missedCall
                              ? "Missed Call"
                              : missedMeeting
                              ? "Missed Meeting"
                              : c.hasNextCallActivity && c.hasNextMeetingActivity
                              ? "Upcoming Call & Meeting"
                              : c.hasNextMeetingActivity
                              ? "Upcoming Meeting"
                              : "Upcoming Call";
                            return (
                              <div
                                key={item.id}
                                className={`hidden rounded-md border px-1.5 py-1 sm:block ${isMissedOnly ? "border-red-200 bg-red-50" : "border-[#d6d6d6] bg-[#f4f4f4]"}`}
                                onMouseEnter={(event) => { event.stopPropagation(); showClientHoverCard(event, c, info.date); }}
                                onMouseLeave={scheduleHideClientHoverCard}
                              >
                                <div className="flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isMissedOnly ? "bg-red-500" : "bg-black"}`} />
                                  <span className="truncate text-[11px] font-bold leading-none">{c.clientName || "Client"}</span>
                                </div>
                                <p className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide ${isMissedOnly ? "text-red-600" : "text-black/60"}`}>
                                  {label}
                                </p>
                              </div>
                            );
                          }

                          const ev = item.data;
                          const st = eventStyle(ev.eventType);
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${st.pill}`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                              <span className="hidden truncate text-[11px] font-bold leading-none sm:block">{ev.title}</span>
                            </div>
                          );
                        })}

                        {/* Mobile: just dots */}
                        {combined.length > 0 && (
                          <div className="flex gap-0.5 sm:hidden">
                            {combined.slice(0, 4).map((item) => (
                              <span
                                key={item.id}
                                className={`h-1.5 w-1.5 rounded-full ${item.kind === "client" ? "bg-black" : eventStyle(item.data.eventType).dot}`}
                              />
                            ))}
                          </div>
                        )}

                        {extra > 0 && (
                          <p className="hidden px-1.5 text-[9px] font-black text-[#333333]/60 sm:block">
                            +{extra} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 border-t border-[#d6d6d6]/40 bg-[#ffffff] px-5 py-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#333333]/50">Legend:</span>
              {[
                { type: "meeting",  label: "Current Meeting" },
                { type: "upcoming", label: "Next Meeting" },
                { type: "followup", label: "Follow-up" },
                { type: "deadline", label: "Deadline" },
                { type: "task",     label: "Task" },
              ].map(({ type, label }) => (
                <span key={type} className="flex items-center gap-1.5 text-[10px] font-bold text-black/60">
                  <span className={`h-2 w-2 rounded-full ${eventStyle(type).dot}`} />
                  {label}
                </span>
              ))}
              <span className="ml-auto text-[10px] text-black/40">Click any date to open the day view</span>
            </div>
          </div>
        </section>
      </main>

      {/* Client hover card (Meeting/Call details preview) */}
      {hoverInfo && (
        <ClientHoverCard
          clientName={hoverInfo.clientName}
          rowData={hoverInfo.rowData}
          columns={worksheetColumns}
          extras={clientExtras[hoverInfo.rowKey]}
          selectedDate={hoverInfo.date}
          rect={hoverInfo.rect}
          rowKey={hoverInfo.rowKey}
          employeeId={employee?.id}
          navigate={navigate}
          onMouseEnter={cancelHoverHide}
          onMouseLeave={scheduleHideClientHoverCard}
        />
      )}

      {/* Toast notice */}
      {notice && (
        <div
          className={`fixed bottom-5 right-5 z-120 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[#d6d6d6] bg-white text-black"
          }`}
        >
          {notice.type === "error"
            ? <AlertCircle className="mt-0.5 shrink-0" size={17} />
            : <Check className="mt-0.5 shrink-0 text-[#333333]" size={17} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-1 opacity-50 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
