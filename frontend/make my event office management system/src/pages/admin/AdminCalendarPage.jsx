import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchAdminCalendarMonth } from "../../services/adminCalendarService";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_LABELS = {
  meeting: "Meeting",
  call: "Call",
  next_meeting: "Next Meeting",
  next_call: "Next Call",
};

function pad(n) { return String(n).padStart(2, "0"); }

function buildCalendarDays(year, month) {
  const firstDay      = new Date(year, month - 1, 1);
  const daysInMonth   = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

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
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = dbDatetime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Same column-value formatting as CalendarPage.jsx, so the admin hover card
// shows worksheet detail fields (venue, shift, phone, floor, etc.) exactly
// the way the employee calendar's hover card does.
function formatColValue(type, value) {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  if (!s.trim()) return null;
  if (type === "datetime" || type === "last_meeting_time" || type === "next_meeting_time") {
    const clean = s.replace("T", " ");
    const [datePart, timePart] = clean.split(" ");
    if (timePart) {
      const [h, m] = timePart.split(":").map(Number);
      return `${datePart} \u00b7 ${to12h(`${pad(h)}:${pad(m)}`)}`;
    }
    return datePart || s;
  }
  if (type === "date") return s.slice(0, 10);
  if (type === "time") return to12h(s.slice(0, 5));
  if (type === "boolean") return value ? "Yes" : "No";
  return s;
}

// Same positioning strategy as CalendarPage.jsx's ClientHoverCard, so the
// admin calendar's hover behavior matches the existing employee calendar —
// including the "wide" mode (spreads into two columns instead of growing
// tall) so the card never needs an inner scrollbar.
function computeTooltipStyle(rect, { wide = false } = {}) {
  const margin = 12;
  const width  = wide ? 640 : 360;
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

// Every meeting/call time shown in the hover card is paired with its date —
// never a bare time — matching how the "Last/Next Meeting Time" detail
// fields already render via formatColValue.
function formatEventDateTime(date, time) {
  if (!date) return time ? to12h(time) : "";
  const d = new Date(`${date}T${time || "00:00"}:00`);
  if (Number.isNaN(d.getTime())) return date;
  const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return time ? `${datePart} \u00b7 ${to12h(time)}` : datePart;
}

// ─── Hover card: one employee's activity for one day ────────────────────────
// Grouped per-client (like CalendarPage.jsx's ClientHoverCard): worksheet
// detail fields shown once per client, then each event (meeting/call/next)
// underneath with its own notes/requirements/next-schedule. Uses the same
// "wide" two-column spread as ClientHoverCard instead of an inner scrollbar.
function EmployeeDayHoverCard({ employeeName, employeeColor, dayEvents, rowData, worksheetColumns, rect, onMouseEnter, onMouseLeave }) {
  const byClient = new Map();
  for (const ev of dayEvents) {
    const key = ev.rowKey || ev.id;
    if (!byClient.has(key)) byClient.set(key, { clientName: ev.clientName, rowKey: ev.rowKey, events: [] });
    byClient.get(key).events.push(ev);
  }
  const clients = [...byClient.values()];

  const totalDetailFields = clients.reduce((sum, client) => {
    const clientRowData = rowData?.[client.rowKey] || {};
    return sum + (worksheetColumns || []).filter(
      (col) => col.name !== "Client Name" && col.type !== "meeting_manager" && clientRowData[col.key] != null && String(clientRowData[col.key]).trim() !== "",
    ).length;
  }, 0);
  const wide = totalDetailFields + dayEvents.length > 6;
  const style = computeTooltipStyle(rect, { wide });

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-100 rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: employeeColor }} />
        <p className="text-sm font-black text-mme-purple">{employeeName || "Unassigned"}</p>
      </div>

      <div className={wide ? "mt-3 columns-2 gap-x-6" : "mt-3 space-y-3"}>
        {clients.map((client) => {
          const clientRowData = rowData?.[client.rowKey] || {};
          const detailFields = (worksheetColumns || []).filter(
            (col) =>
              col.name !== "Client Name" &&
              col.type !== "meeting_manager" &&
              clientRowData[col.key] != null &&
              String(clientRowData[col.key]).trim() !== "",
          );

          return (
            <div key={client.rowKey || client.clientName} className="break-inside-avoid-column border-b border-mme-pink/30 pb-3 last:border-0 last:pb-0">
              <p className="text-xs font-black text-mme-purple">{client.clientName || "Unnamed client"}</p>

              {detailFields.length > 0 && (
                <div className="mt-1.5 space-y-1 border-b border-mme-pink/20 pb-2">
                  {detailFields.map((col) => (
                    <div key={col.key} className="flex items-baseline gap-2">
                      <span className="w-24 shrink-0 text-[10px] font-black uppercase tracking-wide text-mme-purple/45">{col.name}</span>
                      <span className="wrap-break-word text-xs font-semibold text-mme-purple/80">{formatColValue(col.type, clientRowData[col.key])}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 space-y-1.5">
                {client.events.map((ev) => (
                  <div key={ev.id} className={`break-inside-avoid-column rounded-lg border p-2.5 ${ev.missed ? "border-red-200 bg-red-50" : "border-mme-pink/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-mme-purple">
                        {EVENT_LABELS[ev.source] || ev.source}{ev.date ? ` \u00b7 ${formatEventDateTime(ev.date, ev.time)}` : ""}
                      </span>
                      {(ev.missed || ev.isCompleted) && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${ev.missed ? "bg-red-500 text-white" : "bg-mme-purple text-white"}`}>
                          {ev.missed ? "Missed" : "Completed"}
                        </span>
                      )}
                    </div>

                    {ev.source === "meeting" && ev.requirements?.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {ev.requirements.map((req, i) => (
                          <li key={req.key || i} className="text-[11px] leading-5 text-mme-purple/65">
                            <span className="font-bold text-mme-purple/80">{req.label}: </span>{req.details}
                          </li>
                        ))}
                      </ul>
                    )}

                    {ev.notes && <p className="mt-1.5 text-[11px] leading-5 text-mme-purple/70">{ev.notes}</p>}

                    {ev.source === "meeting" && ev.nextMeetingDatetime && (
                      <p className="mt-1.5 text-[11px] font-bold text-mme-purple/70">Next meeting: {formatDisplay(ev.nextMeetingDatetime)}</p>
                    )}
                    {ev.source === "call" && ev.nextCallDatetime && (
                      <p className="mt-1.5 text-[11px] font-bold text-mme-purple/70">Next call: {formatDisplay(ev.nextCallDatetime)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminCalendarPage() {
  const now = new Date();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rowData, setRowData] = useState({});
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null); // { date, employeeId, rect }
  const hoverHideTimeout = useRef(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  const fetchMonth = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminCalendarMonth(year, month);
      setEvents(data.events || []);
      setEmployees(data.employees || []);
      setRowData(data.rowData || {});
      setWorksheetColumns(data.worksheetColumns || []);
    } catch (err) {
      setNotice({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (!admin) return;
    fetchMonth();
  }, [admin, fetchMonth]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const TODAY = todayISO();

  // date → employeeKey → { employeeId, employeeName, employeeColor, events: [] }
  const byDateEmployee = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.date) continue;
      if (!map.has(ev.date)) map.set(ev.date, new Map());
      const dayMap = map.get(ev.date);
      const key = ev.employeeId ?? "unassigned";
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          employeeId: ev.employeeId,
          employeeName: ev.employeeName || "Unassigned",
          employeeColor: ev.employeeColor || "#9ca3af",
          events: [],
        });
      }
      dayMap.get(key).events.push(ev);
    }
    return map;
  }, [events]);

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

  function cancelHoverHide() {
    if (hoverHideTimeout.current) {
      window.clearTimeout(hoverHideTimeout.current);
      hoverHideTimeout.current = null;
    }
  }
  function scheduleHideHoverCard() {
    cancelHoverHide();
    hoverHideTimeout.current = window.setTimeout(() => setHoverInfo(null), 150);
  }
  function showHoverCard(event, date, employeeKey) {
    cancelHoverHide();
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverInfo({
      date, employeeKey,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
    });
  }

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const hoverGroup = hoverInfo ? byDateEmployee.get(hoverInfo.date)?.get(hoverInfo.employeeKey) : null;

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        <div className="mb-5">
          <BackButton to="/admin-dashboard" title="Back to Admin Dashboard" />
        </div>

        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarDays size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Company-Wide Calendar</h1>
        </div>

        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {notice.message}
          </div>
        )}

        {/* Legend — above the calendar, per-employee color key */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-mme-pink/60 bg-white px-5 py-3.5 shadow-[0_8px_30px_rgba(91,55,101,0.05)]">
          <span className="text-[10px] font-black uppercase tracking-widest text-mme-purple/50">Employee Legend:</span>
          {employees.length === 0 ? (
            <span className="text-xs text-mme-purple/40">No active employees</span>
          ) : (
            employees.map((emp) => (
              <span key={emp.id} className="flex items-center gap-1.5 text-xs font-bold text-mme-purple/75">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: emp.color }} />
                {emp.fullName}
              </span>
            ))
          )}
        </div>

        {/* Calendar card */}
        <div className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_20px_60px_rgba(91,55,101,0.1)]">
          <div className="flex items-center justify-between border-b border-mme-pink/40 bg-mme-purple px-4 py-3.5 text-white sm:px-6">
            <button onClick={prevMonth} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-lg font-black sm:text-xl">{MONTH_NAMES[month - 1]} {year}</p>
              <button onClick={goToday} className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-white/75 hover:text-white transition">
                Jump to today
              </button>
            </div>
            <button onClick={nextMonth} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-mme-pink/30 bg-mme-blush/20">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-mme-plum ${i < 6 ? "border-r border-mme-pink/20" : ""}`}>
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid min-h-96 place-items-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
                <p className="mt-3 text-sm font-bold text-mme-purple/50">Loading calendar…</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((info, idx) => {
                const dayMap  = byDateEmployee.get(info.date);
                const groups  = dayMap ? [...dayMap.entries()] : [];
                const isToday = info.date === TODAY;
                const visible = groups.slice(0, 3);
                const extra   = Math.max(0, groups.length - 3);
                const isLastCol = (idx + 1) % 7 === 0;

                return (
                  <button
                    key={info.date}
                    onClick={() => navigate(`/admin/calendar/day/${info.date}`)}
                    className={[
                      "group relative min-h-20 p-1.5 text-left transition sm:min-h-27.5 sm:p-2.5",
                      "border-b border-mme-pink/25",
                      isLastCol ? "" : "border-r border-mme-pink/25",
                      info.isCurrentMonth ? "bg-white hover:bg-mme-blush/10" : "bg-[#fdf8fc] hover:bg-mme-blush/5",
                    ].join(" ")}
                  >
                    <div className="flex justify-end">
                      <span className={[
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                        isToday ? "bg-mme-purple text-white shadow-sm" : "",
                        !isToday && info.isCurrentMonth ? "text-mme-purple" : "",
                        !isToday && !info.isCurrentMonth ? "text-mme-purple/25" : "",
                      ].join(" ")}>
                        {info.day}
                      </span>
                    </div>

                    <div className="mt-1 space-y-0.5">
                      {visible.map(([key, group]) => (
                        <div
                          key={key}
                          className="hidden rounded-md border px-1.5 py-1 sm:block"
                          style={{ borderColor: `${group.employeeColor}55`, backgroundColor: `${group.employeeColor}15` }}
                          onMouseEnter={(event) => { event.stopPropagation(); showHoverCard(event, info.date, key); }}
                          onMouseLeave={scheduleHideHoverCard}
                        >
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: group.employeeColor }} />
                            <span className="truncate text-[11px] font-bold leading-none text-mme-purple">{group.employeeName}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-mme-purple/55">
                            {group.events.length} item{group.events.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ))}

                      {groups.length > 0 && (
                        <div className="flex gap-0.5 sm:hidden">
                          {groups.slice(0, 4).map(([key, group]) => (
                            <span key={key} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.employeeColor }} />
                          ))}
                        </div>
                      )}

                      {extra > 0 && (
                        <p className="hidden px-1.5 text-[9px] font-black text-mme-purple/40 sm:block">+{extra} more</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-mme-pink/30 bg-white px-5 py-3">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-mme-purple/60">
              <CalendarDays size={12} /> Meetings
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-mme-purple/60">
              <Phone size={12} /> Calls
            </span>
            <span className="ml-auto text-[10px] text-mme-purple/40">Click any date to open the day view</span>
          </div>
        </div>

      {hoverInfo && hoverGroup && (
        <EmployeeDayHoverCard
          employeeName={hoverGroup.employeeName}
          employeeColor={hoverGroup.employeeColor}
          dayEvents={hoverGroup.events}
          rowData={rowData}
          worksheetColumns={worksheetColumns}
          rect={hoverInfo.rect}
          onMouseEnter={cancelHoverHide}
          onMouseLeave={scheduleHideHoverCard}
        />
      )}
    </AdminLayout>
  );
}
