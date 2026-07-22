import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  User,
  UserRound,
  X,
} from "lucide-react";
import EmployeeIdentityModal from "../components/EmployeeIdentityModal";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
  saveCurrentEmployee,
} from "../services/managementStorage";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  loadCalendarMonth,
  updateCalendarEvent,
} from "../services/calendarStorage";

// ─── Static data ────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_TYPE_OPTIONS = [
  { value: "meeting",  label: "Meeting" },
  { value: "followup", label: "Follow-up" },
  { value: "deadline", label: "Deadline" },
  { value: "task",     label: "Task" },
  { value: "other",    label: "Other" },
];

const PRIORITY_VALUES = ["Low", "Medium", "High", "Urgent"];

// ─── Style helpers ───────────────────────────────────────────────

function eventStyle(type) {
  const map = {
    meeting:  { pill: "bg-violet-100 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
    upcoming: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    followup: { pill: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
    deadline: { pill: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500" },
    task:     { pill: "bg-sky-100 text-sky-700 border-sky-200",             dot: "bg-sky-500" },
    other:    { pill: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400" },
  };
  return map[type] || map.other;
}

function priorityStyle(p) {
  const map = {
    Urgent: "bg-red-100 text-red-700",
    High:   "bg-orange-100 text-orange-700",
    Medium: "bg-blue-100 text-blue-700",
    Low:    "bg-gray-100 text-gray-600",
  };
  return map[p] || map.Medium;
}

function statusStyle(s) {
  if (!s) return "bg-gray-100 text-gray-600";
  if (s === "Completed")                 return "bg-green-100 text-green-700";
  if (s === "Cancelled")                 return "bg-red-100 text-red-600";
  if (s === "In Progress")               return "bg-blue-100 text-blue-700";
  if (s === "New")                       return "bg-purple-100 text-purple-700";
  if (s.includes("Meeting"))            return "bg-violet-100 text-violet-700";
  if (s.includes("Follow"))             return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
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

function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(new Date(y, m - 1, d));
}

function to12h(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ampm}`;
}

// ─── rowData field extractors ────────────────────────────────────

function pickField(rowData, hints) {
  for (const hint of hints) {
    if (rowData[hint]) return rowData[hint];
  }
  for (const [k, v] of Object.entries(rowData || {})) {
    for (const hint of hints) {
      if (k.toLowerCase().includes(hint.toLowerCase()) && v) return String(v);
    }
  }
  return "";
}

const clientName = (r) => {
  for (const key of ["client_name", "clientname", "client name"]) {
    if (r[key]) return String(r[key]);
  }
  for (const [k, v] of Object.entries(r || {})) {
    const lower = k.toLowerCase();
    if (
      (lower.includes("client") || lower === "name") &&
      !lower.includes("phone") &&
      !lower.includes("email") &&
      !lower.includes("company") &&
      v
    ) return String(v);
  }
  return "";
};
const assignedEmp  = (r) => pickField(r, ["assigned_employee", "assigned", "employee"]);
const statusVal    = (r) => pickField(r, ["status"]);
const priorityVal  = (r) => pickField(r, ["priority"]);
const venueVal     = (r) => pickField(r, ["venue", "hall", "location"]);
const shiftVal     = (r) => pickField(r, ["shift"]);

function mainNote(rowData, columnKey) {
  const isNext = columnKey && columnKey.toLowerCase().includes("next");
  return isNext
    ? pickField(rowData, ["next_meeting_discussion", "next_discussion"])
        || pickField(rowData, ["meeting_short_note", "note", "notes"])
    : pickField(rowData, ["meeting_short_note", "note", "notes", "discussion"]);
}

function prevNote(rowData, columnKey) {
  const isNext = columnKey && columnKey.toLowerCase().includes("next");
  if (!isNext) return "";
  return pickField(rowData, ["meeting_short_note", "note", "notes"]);
}

function formatColValue(type, value) {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  if (!s.trim()) return null;
  if (type === "datetime") {
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

// ─── Worksheet event card ─────────────────────────────────────────

function WorksheetEventCard({ event, columns }) {
  const st     = eventStyle(event.eventType);
  const cName  = event.clientName || clientName(event.rowData);
  const status = statusVal(event.rowData);
  const pri    = priorityVal(event.rowData);

  const skipKeys = new Set(["client_name", "client", "status", "priority"]);
  const detailFields = (columns || []).filter(
    (col) =>
      !skipKeys.has(col.key) &&
      event.rowData[col.key] != null &&
      String(event.rowData[col.key]).trim() !== "",
  );

  return (
    <div className={`rounded-2xl border p-4 ${st.pill}`}>
      {/* Header: event type badge + meeting time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
          <span className="text-[10px] font-black uppercase tracking-wider">{event.columnName}</span>
        </div>
        {event.time && (
          <span className="flex items-center gap-1 text-xs font-bold opacity-70">
            <Clock size={11} /> {to12h(event.time)}
          </span>
        )}
      </div>

      {/* Client name */}
      {cName && <p className="mt-2.5 text-sm font-black leading-tight">{cName}</p>}

      {/* Status + Priority badges */}
      {(status || pri) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {status && (
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusStyle(status)}`}>
              {status}
            </span>
          )}
          {pri && (
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${priorityStyle(pri)}`}>
              {pri}
            </span>
          )}
        </div>
      )}

      {/* All other column fields */}
      {detailFields.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-current/15 pt-3">
          {detailFields.map((col) => {
            const formatted = formatColValue(col.type, event.rowData[col.key]);
            if (!formatted) return null;
            const isLong = col.type === "long_text" || formatted.length > 38;
            if (isLong) {
              return (
                <div key={col.key}>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider opacity-55">{col.name}</p>
                  <p className="text-xs leading-5 opacity-80">{formatted}</p>
                </div>
              );
            }
            return (
              <div key={col.key} className="flex items-baseline gap-2">
                <span className="w-28 shrink-0 text-[10px] font-black uppercase tracking-wide opacity-55">{col.name}</span>
                <span className="break-all text-xs opacity-80">{formatted}</span>
              </div>
            );
          }).filter(Boolean)}
        </div>
      )}
    </div>
  );
}

// ─── Manual event card ────────────────────────────────────────────

function ManualEventCard({ event, onEdit, onDelete }) {
  const st = eventStyle(event.eventType);
  return (
    <div className="rounded-2xl border border-mme-pink/50 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
          <span className="truncate text-sm font-black text-mme-purple">{event.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => onEdit(event)} title="Edit" className="rounded-lg p-1.5 text-mme-purple/40 hover:bg-mme-blush/50 hover:text-mme-purple transition">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(event)} title="Delete" className="rounded-lg p-1.5 text-mme-purple/40 hover:bg-red-50 hover:text-red-500 transition">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {event.time && (
          <span className="flex items-center gap-1 text-xs font-bold text-mme-purple/60">
            <Clock size={11} />{to12h(event.time)}
          </span>
        )}
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${st.pill}`}>
          {event.eventType}
        </span>
        {event.priority && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${priorityStyle(event.priority)}`}>
            {event.priority}
          </span>
        )}
        {event.status && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusStyle(event.status)}`}>
            {event.status}
          </span>
        )}
      </div>

      {(event.clientName || event.companyName) && (
        <p className="mt-1.5 text-xs font-semibold text-mme-purple/70">
          {[event.clientName, event.companyName].filter(Boolean).join(" · ")}
        </p>
      )}

      {event.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-mme-purple/60">{event.description}</p>
      )}

      {event.assignedEmployee && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-mme-purple/60">
          <User size={11} />{event.assignedEmployee}
        </p>
      )}
    </div>
  );
}

// ─── Add / Edit event form ────────────────────────────────────────

const BLANK_FORM = { title: "", eventDate: "", eventTime: "", eventType: "meeting", clientName: "", companyName: "", priority: "Medium", description: "" };

function EventForm({ initialDate, initialData, onSubmit, onClose, isEdit }) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          title:       initialData.title || "",
          eventDate:   initialData.date  || initialDate || "",
          eventTime:   initialData.time  || "",
          eventType:   initialData.eventType || "meeting",
          clientName:  initialData.clientName  || "",
          companyName: initialData.companyName || "",
          priority:    initialData.priority || "Medium",
          description: initialData.description || "",
        }
      : { ...BLANK_FORM, eventDate: initialDate || "" },
  );
  const [errors,      setErrors]      = useState({});
  const [submitting,  setSubmitting]  = useState(false);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((e) => ({ ...e, [field]: null }));
  }

  async function submit(ev) {
    ev.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (!form.eventDate)    errs.eventDate = "Date is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }

  const input  = "w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20 transition";
  const label  = "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-mme-purple/60";

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className={label}>Title *</label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Client follow-up call" className={input} />
        {errors.title && <p className="mt-1 text-xs font-bold text-red-500">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Date *</label>
          <input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={input} />
          {errors.eventDate && <p className="mt-1 text-xs font-bold text-red-500">{errors.eventDate}</p>}
        </div>
        <div>
          <label className={label}>Time</label>
          <input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Type</label>
          <select value={form.eventType} onChange={(e) => set("eventType", e.target.value)} className={input}>
            {EVENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Priority</label>
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={input}>
            {PRIORITY_VALUES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Client Name</label>
          <input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client" className={input} />
        </div>
        <div>
          <label className={label}>Company</label>
          <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Company" className={input} />
        </div>
      </div>

      <div>
        <label className={label}>Notes / Agenda</label>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details, agenda, or reminders…" className={`${input} resize-none leading-5`} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="rounded-xl border border-mme-pink/70 px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30 transition">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/20 hover:bg-[#4b2c55] disabled:opacity-60 transition">
          {submitting
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <Check size={15} />}
          {isEdit ? "Update Event" : "Add Event"}
        </button>
      </div>
    </form>
  );
}

// ─── Day detail modal ─────────────────────────────────────────────

function DayModal({ date, events, onClose, onAdd, onEdit, onDelete, employee, onNeedEmployee, worksheetColumns }) {
  const [showForm,     setShowForm]     = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const wsEvents = events.filter((e) => e.source === "worksheet");
  const mnEvents = events.filter((e) => e.source === "manual");

  function startAdd() {
    if (!employee) { onNeedEmployee(); return; }
    setEditingEvent(null);
    setShowForm(true);
  }

  function startEdit(ev) {
    setEditingEvent(ev);
    setShowForm(true);
  }

  async function handleSubmit(formData) {
    if (editingEvent) {
      await onEdit(editingEvent.dbId, formData);
    } else {
      await onAdd(formData);
    }
    setShowForm(false);
    setEditingEvent(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-mme-purple/45 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-mme-pink/40 bg-white shadow-[0_40px_120px_rgba(91,55,101,0.25)]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-linear-to-r from-mme-purple to-mme-plum px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <CalendarDays size={19} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-mme-blush">Selected date</p>
              <p className="text-sm font-black leading-tight">{formatDisplayDate(date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!showForm && (
              <button onClick={startAdd} className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-black hover:bg-white/25 transition">
                <Plus size={14} /> Add Event
              </button>
            )}
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/15 transition">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {showForm ? (
            <>
              <p className="mb-4 text-sm font-black text-mme-purple">
                {editingEvent ? "Edit Scheduled Event" : "New Event"}
              </p>
              <EventForm
                initialDate={date}
                initialData={editingEvent}
                onSubmit={handleSubmit}
                onClose={() => { setShowForm(false); setEditingEvent(null); }}
                isEdit={!!editingEvent}
              />
            </>
          ) : (
            <>
              {/* Worksheet events */}
              {wsEvents.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-mme-plum">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mme-blush text-[9px] font-black text-mme-purple">S</span>
                    From Management Sheet
                  </h3>
                  <div className="space-y-3">
                    {wsEvents.map((ev) => <WorksheetEventCard key={ev.id} event={ev} columns={worksheetColumns} />)}
                  </div>
                </section>
              )}

              {/* Manual events */}
              {mnEvents.length > 0 && (
                <section className={wsEvents.length > 0 ? "mt-5" : ""}>
                  <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-mme-plum">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mme-blush text-[9px] font-black text-mme-purple">M</span>
                    Scheduled Events
                  </h3>
                  <div className="space-y-3">
                    {mnEvents.map((ev) => (
                      <ManualEventCard
                        key={ev.id}
                        event={ev}
                        onEdit={startEdit}
                        onDelete={(e) => onDelete(e.dbId)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {wsEvents.length === 0 && mnEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-mme-blush text-mme-purple">
                    <CalendarDays size={28} />
                  </div>
                  <p className="mt-4 font-black text-mme-purple">No events on this day</p>
                  <p className="mt-1.5 max-w-xs text-sm text-mme-purple/50">
                    Click <strong>Add Event</strong> to schedule a meeting, follow-up, or task. Events from the management sheet appear automatically.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
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

  const selectedEvents = useMemo(
    () => [],
    [],
  );

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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  function showNotice(type, message) { setNotice({ type, message }); }

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

  // ── Event CRUD ─────────────────────────────────────────────────

  const totalEvents = events.length;
  const wsCount     = events.filter((e) => e.source === "worksheet").length;
  const manualCount = events.filter((e) => e.source === "manual").length;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fff9fc] text-mme-purple">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-mme-pink/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/management" className="hidden rounded-xl p-2 text-mme-purple/60 hover:bg-mme-blush/40 sm:block" title="Back to management">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-mme-purple sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">
                Office Calendar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {employee ? (
              <button
                onClick={() => { clearCurrentEmployee(); setEmployee(null); }}
                className="flex items-center gap-2 rounded-2xl border border-mme-pink/70 bg-white px-3 py-2.5 text-left transition hover:bg-mme-blush/30 sm:px-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                  <UserRound size={16} />
                </div>
                <div className="hidden sm:block">
                  <p className="max-w-36 truncate text-xs font-black text-mme-purple">{employee.fullName}</p>
                  <p className="text-[10px] text-mme-purple/50">Switch employee</p>
                </div>
                <ChevronDown size={15} className="hidden text-mme-plum sm:block" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-350">

          {/* Title + stats */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
                <CalendarDays size={15} /> Shared calendar
              </div>
              <h1 className="mt-1.5 text-2xl font-black sm:text-3xl">
                {MONTH_NAMES[month - 1]} {year}
              </h1>
              <p className="mt-1.5 text-sm text-mme-purple/60">
                {totalEvents === 0
                  ? "No events this month"
                  : `${totalEvents} event${totalEvents !== 1 ? "s" : ""} — ${wsCount} from management sheet · ${manualCount} scheduled`}
              </p>
            </div>
            <Link
              to="/management"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30 transition sm:self-auto"
            >
              <ArrowLeft size={16} /> Management Sheet
            </Link>
          </div>

          {/* Calendar card */}
          <div className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_20px_60px_rgba(91,55,101,0.09)]">

            {/* Month navigation bar */}
            <div className="flex items-center justify-between border-b border-mme-pink/30 bg-linear-to-r from-mme-purple to-mme-plum px-4 py-3.5 text-white sm:px-6">
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
                  className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-mme-blush/80 hover:text-white transition"
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
            <div className="grid grid-cols-7 border-b border-mme-pink/30 bg-mme-blush/25">
              {DAY_LABELS.map((d, i) => (
                <div
                  key={d}
                  className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-mme-plum ${i < 6 ? "border-r border-mme-pink/20" : ""}`}
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
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
                  <p className="mt-3 text-sm font-bold text-mme-purple/50">Loading calendar…</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((info, idx) => {
                  const dayEvs     = byDate.get(info.date) || [];
                  const isToday    = info.date === TODAY;
                  const visible    = dayEvs.slice(0, 3);
                  const extra      = Math.max(0, dayEvs.length - 3);
                  const isLastCol  = (idx + 1) % 7 === 0;

                  return (
                    <button
                      key={info.date}
                      onClick={() => navigate(`/calendar/day/${info.date}`)}
                      className={[
                        "group relative min-h-20 p-1.5 text-left transition sm:min-h-27.5 sm:p-2.5",
                        "border-b border-mme-pink/25",
                        isLastCol ? "" : "border-r border-mme-pink/25",
                        info.isCurrentMonth ? "bg-white hover:bg-mme-blush/15" : "bg-[#fdf8fc] hover:bg-mme-blush/10",
                        "",
                      ].join(" ")}
                    >
                      {/* Day number */}
                      <div className="flex justify-end">
                        <span
                          className={[
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                            isToday ? "bg-mme-purple text-white shadow-sm" : "",
                            !isToday && info.isCurrentMonth ? "text-mme-purple" : "",
                            !isToday && !info.isCurrentMonth ? "text-mme-purple/25" : "",
                          ].join(" ")}
                        >
                          {info.day}
                        </span>
                      </div>

                      {/* Event pills */}
                      <div className="mt-1 space-y-0.5">
                        {visible.map((ev) => {
                          const st = eventStyle(ev.eventType);
                          if (ev.source === "worksheet") {
                            const cname = ev.clientName || ev.columnName;
                            const venue = venueVal(ev.rowData);
                            const shift = shiftVal(ev.rowData);
                            return (
                              <div
                                key={ev.id}
                                className={`hidden rounded-md border px-1.5 py-1 sm:block ${st.pill}`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                                  <span className="truncate text-[11px] font-bold leading-none">{cname}</span>
                                </div>
                                {(venue || shift) && (
                                  <p className="mt-0.5 truncate text-[10px] opacity-65">
                                    {[venue, shift].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={ev.id}
                              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${st.pill}`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                              <span className="hidden truncate text-[11px] font-bold leading-none sm:block">{ev.title}</span>
                            </div>
                          );
                        })}

                        {/* Mobile: just dots */}
                        {dayEvs.length > 0 && (
                          <div className="flex gap-0.5 sm:hidden">
                            {dayEvs.slice(0, 4).map((ev) => (
                              <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${eventStyle(ev.eventType).dot}`} />
                            ))}
                          </div>
                        )}

                        {extra > 0 && (
                          <p className="hidden px-1.5 text-[9px] font-black text-mme-plum/60 sm:block">
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
            <div className="flex flex-wrap items-center gap-3 border-t border-mme-pink/40 bg-[#fff9fc] px-5 py-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-mme-plum/50">Legend:</span>
              {[
                { type: "meeting",  label: "Current Meeting" },
                { type: "upcoming", label: "Next Meeting" },
                { type: "followup", label: "Follow-up" },
                { type: "deadline", label: "Deadline" },
                { type: "task",     label: "Task" },
              ].map(({ type, label }) => (
                <span key={type} className="flex items-center gap-1.5 text-[10px] font-bold text-mme-purple/60">
                  <span className={`h-2 w-2 rounded-full ${eventStyle(type).dot}`} />
                  {label}
                </span>
              ))}
              <span className="ml-auto text-[10px] text-mme-purple/40">Click any date to open the day view</span>
            </div>
          </div>
        </section>
      </main>

      {/* Toast notice */}
      {notice && (
        <div
          className={`fixed bottom-5 right-5 z-120 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-mme-pink bg-white text-mme-purple"
          }`}
        >
          {notice.type === "error"
            ? <AlertCircle className="mt-0.5 shrink-0" size={17} />
            : <Check className="mt-0.5 shrink-0 text-mme-plum" size={17} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-1 opacity-50 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
