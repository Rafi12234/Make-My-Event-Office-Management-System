import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Phone,
  Users,
  X,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAdminCalendarMonth } from "../../services/adminCalendarService";
import { updateNextCallSchedule, updateNextMeetingSchedule } from "../../services/adminActivityService";

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

// "YYYY-MM-DD HH:MM:SS" (backend shape) ΓåÆ "YYYY-MM-DDTHH:MM" (datetime-local input shape).
function toDatetimeLocalValue(dbDatetime) {
  if (!dbDatetime) return "";
  return dbDatetime.replace(" ", "T").slice(0, 16);
}

// Every event card (meeting, call, or their next-schedule marker) maps back
// to one editable next-meeting/next-call record ΓÇö this resolves which one,
// regardless of which card the admin clicked.
function getEditContext(ev) {
  if (ev.source === "meeting") {
    return { kind: "meeting", id: ev.meetingId, datetime: ev.nextMeetingDatetime, assignedEmployeeId: ev.nextMeetingAssignedEmployeeId };
  }
  if (ev.source === "next_meeting") {
    return { kind: "meeting", id: ev.meetingId, datetime: `${ev.date} ${ev.time || "00:00"}:00`, assignedEmployeeId: ev.assignedEmployeeIdRaw };
  }
  if (ev.source === "call") {
    return { kind: "call", id: ev.callId, datetime: ev.nextCallDatetime, assignedEmployeeId: ev.nextCallAssignedEmployeeId };
  }
  if (ev.source === "next_call") {
    return { kind: "call", id: ev.callId, datetime: `${ev.date} ${ev.time || "00:00"}:00`, assignedEmployeeId: ev.assignedEmployeeIdRaw };
  }
  return null;
}

// ΓöÇΓöÇΓöÇ Edit Next Schedule Modal (moved here from AdminActivityPage) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function EditScheduleModal({ label, initialDatetime, initialAssignedEmployeeId, employees, onClose, onSave }) {
  const [datetime, setDatetime] = useState(toDatetimeLocalValue(initialDatetime));
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(
    initialAssignedEmployeeId != null ? String(initialAssignedEmployeeId) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({
        datetime,
        assignedEmployeeId: assignedEmployeeId ? Number(assignedEmployeeId) : null,
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_30px_100px_rgba(91,55,101,0.25)]">
        <div className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
            <Pencil size={18} />
          </div>
          <h2 className="mt-4 text-lg font-black text-mme-purple">Edit {label}</h2>
          <p className="mt-1 text-sm text-mme-purple/55">
            Update the scheduled date/time and who is responsible for it.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                <X size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                {label} Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              />
              <p className="mt-1 text-xs text-mme-purple/40">Leave empty to clear the schedule.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                Assigned Employee
              </label>
              <div className="relative">
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/50" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-mme-pink/70 bg-white px-5 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#4b2c55] disabled:opacity-60"
              >
                {loading ? "SavingΓÇª" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// One card per activity — shared by the "Due Today" and "Completed Today"
// sections so both read identically, just with different badges (Missed /
// Done Xm early-late) driven entirely by the event's own fields.
function EventCard({ ev, rowData, worksheetColumns, onEdit }) {
  const clientRowData = rowData?.[ev.rowKey] || {};
  const isCallEvent = ev.source === "call" || ev.source === "next_call";
  // "Last/Next Meeting Time" columns actually track whichever of a
  // meeting or a call happened/comes next — show the label and value
  // that match this specific event instead of the ambiguous merged one.
  const detailFields = (worksheetColumns || [])
    .filter((col) => col.name !== "Client Name" && col.type !== "meeting_manager")
    .map((col) => {
      if (col.type === "last_meeting_time" || col.type === "next_meeting_time") {
        const suffix = isCallEvent ? "__call" : "__meeting";
        const value = clientRowData[`${col.key}${suffix}`];
        const name = isCallEvent ? col.name.replace("Meeting", "Call") : col.name;
        return { ...col, name, value };
      }
      return { ...col, value: clientRowData[col.key] };
    })
    .filter((col) => col.value != null && String(col.value).trim() !== "");

  const tagStyles = {
    early: "bg-emerald-100 text-emerald-700",
    on_time: "bg-blue-100 text-blue-700",
    late: "bg-amber-100 text-amber-700",
  };

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 ${ev.missed ? "border-red-200 bg-red-50" : "border-mme-pink/40 bg-[#fff9fc]"}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-mme-purple">
        {isCallEvent ? <Phone size={14} /> : <CalendarDays size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-black text-mme-purple">{ev.clientName || "Unnamed client"}</p>
          {ev.employeeName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-mme-purple/70 ring-1 ring-mme-pink/30">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ev.employeeColor || "#9ca3af" }} />
              {ev.employeeName}
            </span>
          )}
          {ev.completionTag && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tagStyles[ev.completionTag.status] || tagStyles.on_time}`}>
              {ev.completionTag.label}
            </span>
          )}
          {ev.missed && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">Missed</span>
          )}
        </div>
        <p className="text-xs font-bold text-mme-purple/55">
          {EVENT_LABELS[ev.source] || ev.source}{ev.time ? ` \u00b7 ${to12h(ev.time)}` : ""}
        </p>

        {detailFields.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-mme-pink/20 pt-2">
            {detailFields.map((col) => (
              <div key={col.key} className="flex items-baseline gap-2">
                <span className="w-24 shrink-0 text-[10px] font-black uppercase tracking-wide text-mme-purple/45">{col.name}</span>
                <span className="text-xs font-semibold text-mme-purple/80">{formatColValue(col.type, col.value)}</span>
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

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {ev.source === "meeting" && (
            <p className="text-xs font-bold text-mme-purple/70">
              Next meeting: {formatDisplay(ev.nextMeetingDatetime) || "Not scheduled yet"}
              {ev.nextMeetingAssignedEmployeeName ? ` \u00b7 Assigned to ${ev.nextMeetingAssignedEmployeeName}` : ""}
              {ev.nextMeetingMissed ? " \u00b7 " : ""}
              {ev.nextMeetingMissed && <span className="font-black text-red-600">Missed</span>}
            </p>
          )}
          {ev.source === "call" && (
            <p className="text-xs font-bold text-mme-purple/70">
              Next call: {formatDisplay(ev.nextCallDatetime) || "Not scheduled yet"}
              {ev.nextCallAssignedEmployeeName ? ` \u00b7 Assigned to ${ev.nextCallAssignedEmployeeName}` : ""}
              {ev.nextCallMissed ? " \u00b7 " : ""}
              {ev.nextCallMissed && <span className="font-black text-red-600">Missed</span>}
            </p>
          )}
          <button
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
          >
            <Pencil size={11} /> Edit Next {isCallEvent ? "Call" : "Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCalendarDayPage() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [events, setEvents] = useState([]);
  const [rowData, setRowData] = useState({});
  const [worksheetColumns, setWorksheetColumns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // event being edited

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  const fetchMonth = useCallback(() => {
    if (!date) return Promise.resolve();
    const [year, month] = date.split("-").map(Number);
    setIsLoading(true);
    return fetchAdminCalendarMonth(year, month)
      .then((data) => {
        setEvents(data.events || []);
        setRowData(data.rowData || {});
        setWorksheetColumns(data.worksheetColumns || []);
      })
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [date]);

  useEffect(() => {
    if (!admin) return;
    fetchMonth();
    fetchAllEmployees()
      .then((data) => setEmployees(data.filter((e) => e.isActive)))
      .catch(() => {});
  }, [admin, fetchMonth]);

  const dayEvents = useMemo(() => events.filter((ev) => ev.date === date), [events, date]);

  // Every employee who has at least one activity today, for the filter
  // dropdown — built from the day's own events (not the full active-staff
  // list) so the dropdown never offers someone with nothing to show.
  const employeesToday = useMemo(() => {
    const map = new Map();
    for (const ev of dayEvents) {
      if (ev.employeeId == null) continue;
      if (!map.has(ev.employeeId)) map.set(ev.employeeId, { id: ev.employeeId, name: ev.employeeName, color: ev.employeeColor });
    }
    return [...map.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [dayEvents]);

  const [employeeFilter, setEmployeeFilter] = useState("");

  // Reset the filter if the selected employee has nothing on a newly
  // navigated-to day, instead of silently showing an empty page.
  useEffect(() => {
    if (employeeFilter && !employeesToday.some((e) => String(e.id) === employeeFilter)) {
      setEmployeeFilter("");
    }
  }, [employeeFilter, employeesToday]);

  const filteredEvents = useMemo(
    () => (employeeFilter ? dayEvents.filter((ev) => String(ev.employeeId) === employeeFilter) : dayEvents),
    [dayEvents, employeeFilter],
  );

  // "Done" = a meeting/call that actually happened; "Due" = a scheduled
  // next-meeting/next-call still pending. A fulfilled follow-up is deleted
  // server-side the moment the real meeting/call is logged (see
  // callsController/meetingsController), so a Done item never lingers here
  // as a second, separate Due item too — completionTag (see backend) shows
  // how it compares to the original due time instead.
  const doneEvents = useMemo(
    () => [...filteredEvents.filter((ev) => ev.done)].sort((a, b) => (b.time || "").localeCompare(a.time || "")),
    [filteredEvents],
  );
  const dueEvents = useMemo(
    () => [...filteredEvents.filter((ev) => !ev.done)].sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [filteredEvents],
  );
  const missedEvents = useMemo(() => dueEvents.filter((ev) => ev.missed), [dueEvents]);
  const upcomingEvents = useMemo(() => dueEvents.filter((ev) => !ev.missed), [dueEvents]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  async function handleSave({ datetime, assignedEmployeeId }) {
    const { kind, id } = editing;
    if (kind === "meeting") {
      await updateNextMeetingSchedule(id, { nextMeetingDatetime: datetime, assignedEmployeeId });
    } else {
      await updateNextCallSchedule(id, { nextCallDatetime: datetime, assignedEmployeeId });
    }
    setEditing(null);
    setNotice({ type: "success", message: `Next ${kind} updated successfully.` });
    await fetchMonth();
  }

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        <div className="mb-5">
          <BackButton to="/admin/calendar" title="Back to calendar" />
        </div>

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
              <CalendarDays size={14} /> Admin Control
            </div>
            <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">{formatDisplayDate(date)}</h1>
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
          <div className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-green-200 bg-green-50 text-green-700"
          }`}>
            {notice.message}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <CalendarDays size={38} className="text-mme-mauve" />
            <p className="mt-4 font-black text-mme-purple">Nothing scheduled for this day</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-mme-pink/60 bg-white px-5 py-3.5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <Users size={15} className="shrink-0 text-mme-purple/50" />
              <span className="text-xs font-black uppercase tracking-wide text-mme-purple/50">Employee</span>
              <div className="relative">
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-1.5 pl-3 pr-8 text-xs font-black text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                >
                  <option value="">All employees ({dayEvents.length})</option>
                  {employeesToday.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mme-purple/40" />
              </div>
              {employeeFilter && (
                <span className="ml-auto text-xs font-bold text-mme-purple/50">
                  {filteredEvents.length} activit{filteredEvents.length !== 1 ? "ies" : "y"} today
                </span>
              )}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
                <CalendarDays size={38} className="text-mme-mauve" />
                <p className="mt-4 font-black text-mme-purple">No activities for this employee today</p>
              </div>
            ) : (
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wide text-mme-purple/70">Due Today</h2>
                    <span className="rounded-full bg-mme-blush px-2.5 py-0.5 text-xs font-black text-mme-purple">{dueEvents.length}</span>
                    {missedEvents.length > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-600">{missedEvents.length} missed</span>
                    )}
                  </div>
                  {dueEvents.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-mme-pink/40 bg-white px-5 py-6 text-center text-sm font-bold text-mme-purple/50">
                      Nothing due today.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {dueEvents.map((ev) => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          rowData={rowData}
                          worksheetColumns={worksheetColumns}
                          onEdit={() => setEditing(getEditContext(ev))}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wide text-mme-purple/70">Completed Today</h2>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-700">{doneEvents.length}</span>
                  </div>
                  {doneEvents.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-mme-pink/40 bg-white px-5 py-6 text-center text-sm font-bold text-mme-purple/50">
                      Nothing completed yet today.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {doneEvents.map((ev) => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          rowData={rowData}
                          worksheetColumns={worksheetColumns}
                          onEdit={() => setEditing(getEditContext(ev))}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

      {editing && (
        <EditScheduleModal
          label={editing.kind === "meeting" ? "Next Meeting" : "Next Call"}
          initialDatetime={editing.datetime}
          initialAssignedEmployeeId={editing.assignedEmployeeId}
          employees={employees}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
