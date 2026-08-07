import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Phone,
  Shield,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchAdminCalendarMonth } from "../../services/adminCalendarService";

const EVENT_LABELS = {
  meeting: "Meeting",
  call: "Call",
  next_meeting: "Next Meeting",
  next_call: "Next Call",
};

function pad(n) { return String(n).padStart(2, "0"); }

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

// Same column-value formatting as CalendarPage.jsx's hover card.
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

function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(y, mo - 1, d));
}

function shiftDate(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AdminCalendarDayPage() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [events, setEvents] = useState([]);
  const [rowData, setRowData] = useState({});
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!admin || !date) return;
    const [year, month] = date.split("-").map(Number);
    setIsLoading(true);
    fetchAdminCalendarMonth(year, month)
      .then((data) => {
        setEvents(data.events || []);
        setRowData(data.rowData || {});
        setWorksheetColumns(data.worksheetColumns || []);
      })
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin, date]);

  const dayEvents = useMemo(() => events.filter((ev) => ev.date === date), [events, date]);

  // Group by employee so each section reads as "this person's day", matching
  // the calendar's person-wise color coding.
  const byEmployee = useMemo(() => {
    const map = new Map();
    for (const ev of dayEvents) {
      const key = ev.employeeId ?? "unassigned";
      if (!map.has(key)) {
        map.set(key, { employeeName: ev.employeeName || "Unassigned", employeeColor: ev.employeeColor || "#9ca3af", events: [] });
      }
      map.get(key).events.push(ev);
    }
    return [...map.values()];
  }, [dayEvents]);

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
          <BackButton to="/admin/calendar" title="Back to calendar" />
        </div>

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
              <CalendarDays size={14} /> Admin Control
            </div>
            <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">{formatDisplayDate(date)}</h1>
            <p className="mt-1.5 text-sm text-mme-purple/55">
              {dayEvents.length === 0 ? "No meetings or calls this day" : `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""} across ${byEmployee.length} employee${byEmployee.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/admin/calendar/day/${shiftDate(date, -1)}`)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => navigate(`/admin/calendar/day/${shiftDate(date, 1)}`)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40 transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
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
        ) : byEmployee.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <CalendarDays size={38} className="text-mme-mauve" />
            <p className="mt-4 font-black text-mme-purple">Nothing scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-5">
            {byEmployee.map((group) => (
              <div key={group.employeeName} className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
                <div className="flex items-center gap-2.5 border-b border-mme-pink/40 px-6 py-4" style={{ backgroundColor: `${group.employeeColor}15` }}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.employeeColor }} />
                  <span className="font-black text-mme-purple">{group.employeeName}</span>
                  <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-black text-mme-purple/70">
                    {group.events.length} item{group.events.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2.5 p-5">
                  {group.events.map((ev) => {
                    const clientRowData = rowData?.[ev.rowKey] || {};
                    const detailFields = (worksheetColumns || []).filter(
                      (col) =>
                        col.name !== "Client Name" &&
                        col.type !== "meeting_manager" &&
                        clientRowData[col.key] != null &&
                        String(clientRowData[col.key]).trim() !== "",
                    );

                    return (
                      <div key={ev.id} className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 ${ev.missed ? "border-red-200 bg-red-50" : "border-mme-pink/40 bg-[#fff9fc]"}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-mme-purple">
                          {ev.source === "call" || ev.source === "next_call" ? <Phone size={14} /> : <CalendarDays size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-mme-purple">{ev.clientName || "Unnamed client"}</p>
                          <p className="text-xs font-bold text-mme-purple/55">
                            {EVENT_LABELS[ev.source] || ev.source}{ev.time ? ` · ${to12h(ev.time)}` : ""}
                            {ev.isCompleted ? " · Completed" : ""}
                            {ev.missed ? " · Missed" : ""}
                          </p>

                          {detailFields.length > 0 && (
                            <div className="mt-2 space-y-1 border-t border-mme-pink/20 pt-2">
                              {detailFields.map((col) => (
                                <div key={col.key} className="flex items-baseline gap-2">
                                  <span className="w-24 shrink-0 text-[10px] font-black uppercase tracking-wide text-mme-purple/45">{col.name}</span>
                                  <span className="text-xs font-semibold text-mme-purple/80">{formatColValue(col.type, clientRowData[col.key])}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {ev.source === "meeting" && ev.requirements?.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {ev.requirements.map((req, i) => (
                                <li key={req.key || i} className="text-xs leading-5 text-mme-purple/65">
                                  <span className="font-bold text-mme-purple/80">{req.label}: </span>{req.details}
                                </li>
                              ))}
                            </ul>
                          )}

                          {ev.notes && <p className="mt-2 text-xs text-mme-purple/60">{ev.notes}</p>}

                          {ev.source === "meeting" && ev.nextMeetingDatetime && (
                            <p className="mt-2 text-xs font-bold text-mme-purple/70">Next meeting: {formatDisplay(ev.nextMeetingDatetime)}</p>
                          )}
                          {ev.source === "call" && ev.nextCallDatetime && (
                            <p className="mt-2 text-xs font-bold text-mme-purple/70">Next call: {formatDisplay(ev.nextCallDatetime)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
