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

const TAG_STYLES = {
  early: "bg-emerald-100 text-emerald-700",
  on_time: "bg-blue-100 text-blue-700",
  late: "bg-amber-100 text-amber-700",
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


// Compact hover preview: only the latest five activities for one employee/day.
// The old hover showed every client detail + every worksheet field, which could
// become taller/wider than the viewport on busy days.
function computeTooltipStyle(rect) {
  const margin = 12;
  const gap = 8;
  const width = Math.min(780, Math.max(320, window.innerWidth - margin * 2));
  const estimatedHeight = Math.min(360, window.innerHeight - margin * 2);

  let left = rect.left;
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin;
  }
  if (left < margin) left = margin;

  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  let top;
  if (spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove) {
    top = rect.bottom + gap;
  } else {
    top = Math.max(margin, rect.top - estimatedHeight - gap);
  }

  if (top + estimatedHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - estimatedHeight - margin);
  }

  return {
    width: `${width}px`,
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `calc(100vh - ${margin * 2}px)`,
  };
}

function latestFiveEvents(dayEvents) {
  return [...(dayEvents || [])]
    .sort((a, b) => {
      const aKey = `${a.date || ""} ${a.time || ""}`;
      const bKey = `${b.date || ""} ${b.time || ""}`;
      return bKey.localeCompare(aKey);
    })
    .slice(0, 5);
}

function statusBadge(ev) {
  if (ev.missed) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
        Missed
      </span>
    );
  }

  if (ev.completionTag) {
    return (
      <span
        title={
          ev.completionTag.expectedLabel
            ? `Originally due ${formatDisplay(ev.completionTag.expectedLabel)}`
            : undefined
        }
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
          TAG_STYLES[ev.completionTag.status] || TAG_STYLES.on_time
        }`}
      >
        {ev.completionTag.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
        ev.done
          ? "bg-emerald-100 text-emerald-700"
          : "bg-mme-blush text-mme-purple"
      }`}
    >
      {ev.done ? "Completed" : "Due"}
    </span>
  );
}

function compactUpdateText(ev) {
  if (ev.notes && String(ev.notes).trim()) {
    return String(ev.notes).trim();
  }

  if (ev.source === "meeting" && ev.requirements?.length) {
    return ev.requirements
      .slice(0, 2)
      .map((req) => `${req.label}: ${req.details}`)
      .join(" · ");
  }

  if (ev.source === "next_meeting") return "Scheduled next meeting";
  if (ev.source === "next_call") return "Scheduled next call";

  return "—";
}

function followUpText(ev) {
  if (ev.source === "meeting" && ev.nextMeetingDatetime) {
    return {
      label: formatDisplay(ev.nextMeetingDatetime),
      tag: ev.nextMeetingTag,
    };
  }

  if (ev.source === "call" && ev.nextCallDatetime) {
    return {
      label: formatDisplay(ev.nextCallDatetime),
      tag: ev.nextCallTag,
    };
  }

  return null;
}

// One employee's activity for one day.
// Only the latest five activities are rendered, in a compact table.
function EmployeeDayHoverCard({
  employeeName,
  employeeColor,
  dayEvents,
  rect,
  onMouseEnter,
  onMouseLeave,
}) {
  const latestEvents = latestFiveEvents(dayEvents);
  const missedCount = (dayEvents || []).filter((ev) => ev.missed).length;
  const style = computeTooltipStyle(rect);

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-100 overflow-auto rounded-2xl border border-mme-pink/60 bg-white shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mme-pink/35 bg-[#fff8fb] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: employeeColor }}
          />
          <p className="truncate text-sm font-black text-mme-purple">
            {employeeName || "Unassigned"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-mme-blush px-2 py-0.5 text-[10px] font-black text-mme-purple">
            Latest {latestEvents.length} of {dayEvents.length}
          </span>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              missedCount > 0
                ? "bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {missedCount} missed
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>

          <thead className="bg-white">
            <tr className="border-b border-mme-pink/35">
              <th className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                Time
              </th>
              <th className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                Client
              </th>
              <th className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                Activity
              </th>
              <th className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                Status
              </th>
              <th className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                Latest Update / Follow-up
              </th>
            </tr>
          </thead>

          <tbody>
            {latestEvents.map((ev) => {
              const followUp = followUpText(ev);
              const updateText = compactUpdateText(ev);

              return (
                <tr
                  key={ev.id}
                  className={`border-b border-mme-pink/20 align-top last:border-b-0 ${
                    ev.missed ? "bg-red-50/70" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2.5 text-[11px] font-black text-mme-purple/70">
                    {ev.time ? to12h(ev.time) : "—"}
                  </td>

                  <td className="px-3 py-2.5">
                    <p
                      title={ev.clientName || ""}
                      className="truncate text-[11px] font-black text-mme-purple"
                    >
                      {ev.clientName || "Unnamed client"}
                    </p>
                  </td>

                  <td className="px-3 py-2.5 text-[11px] font-bold text-mme-purple/75">
                    {EVENT_LABELS[ev.source] || ev.source}
                  </td>

                  <td className="px-3 py-2.5">
                    {statusBadge(ev)}
                  </td>

                  <td className="px-3 py-2.5">
                    <p
                      title={updateText !== "—" ? updateText : undefined}
                      className="line-clamp-2 text-[11px] font-semibold leading-4 text-mme-purple/65"
                    >
                      {updateText}
                    </p>

                    {followUp && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-mme-purple/50">
                          Next: {followUp.label}
                        </span>

                        {followUp.tag && (
                          <span
                            title={
                              followUp.tag.expectedLabel
                                ? `Originally due ${formatDisplay(
                                    followUp.tag.expectedLabel,
                                  )}`
                                : undefined
                            }
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                              TAG_STYLES[followUp.tag.status] ||
                              TAG_STYLES.on_time
                            }`}
                          >
                            {followUp.tag.label}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dayEvents.length > 5 && (
        <div className="border-t border-mme-pink/30 bg-[#fffafd] px-4 py-2 text-right text-[10px] font-bold text-mme-purple/45">
          Showing only the latest 5 updates. Click the date for the full day view.
        </div>
      )}
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
                      {visible.map(([key, group]) => {
                        const missedCount = group.events.filter((ev) => ev.missed).length;

                        return (
                          <div
                            key={key}
                            className="hidden rounded-md border px-1.5 py-1 sm:block"
                            style={{
                              borderColor: `${group.employeeColor}55`,
                              backgroundColor: `${group.employeeColor}15`,
                            }}
                            onMouseEnter={(event) => {
                              event.stopPropagation();
                              showHoverCard(event, info.date, key);
                            }}
                            onMouseLeave={scheduleHideHoverCard}
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: group.employeeColor }}
                              />
                              <span className="truncate text-[11px] font-bold leading-none text-mme-purple">
                                {group.employeeName}
                              </span>
                            </div>

                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                              <span className="text-mme-purple/55">
                                {group.events.length} item{group.events.length !== 1 ? "s" : ""}
                              </span>

                              <span
                                className={
                                  missedCount > 0
                                    ? "font-black text-red-600"
                                    : "text-mme-purple/35"
                                }
                              >
                                · {missedCount} missed
                              </span>
                            </div>
                          </div>
                        );
                      })}

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
          rect={hoverInfo.rect}
          onMouseEnter={cancelHoverHide}
          onMouseLeave={scheduleHideHoverCard}
        />
      )}
    </AdminLayout>
  );
}
