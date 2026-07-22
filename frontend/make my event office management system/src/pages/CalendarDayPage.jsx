import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
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

// ─── Static options ───────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: "meeting",  label: "Meeting" },
  { value: "followup", label: "Follow-up" },
  { value: "deadline", label: "Deadline" },
  { value: "task",     label: "Task" },
  { value: "other",    label: "Other" },
];
const PRIORITY_VALUES = ["Low", "Medium", "High", "Urgent"];

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

// ─── Style helpers ─────────────────────────────────────────────────

function eventStyle(type) {
  const map = {
    meeting:  { pill: "bg-violet-100 text-violet-700 border-violet-200",    dot: "bg-violet-500",  header: "bg-violet-50",  ring: "ring-violet-200" },
    upcoming: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", header: "bg-emerald-50", ring: "ring-emerald-200" },
    followup: { pill: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500",   header: "bg-amber-50",   ring: "ring-amber-200" },
    deadline: { pill: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",     header: "bg-red-50",     ring: "ring-red-200" },
    task:     { pill: "bg-sky-100 text-sky-700 border-sky-200",             dot: "bg-sky-500",     header: "bg-sky-50",     ring: "ring-sky-200" },
    other:    { pill: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400",   header: "bg-slate-50",   ring: "ring-slate-200" },
  };
  return map[type] || map.other;
}

function priorityStyle(p) {
  const map = { Urgent: "bg-red-100 text-red-700", High: "bg-orange-100 text-orange-700", Medium: "bg-blue-100 text-blue-700", Low: "bg-gray-100 text-gray-600" };
  return map[p] || map.Medium;
}

function statusStyle(s) {
  if (!s) return "bg-gray-100 text-gray-600";
  if (s === "Completed")       return "bg-green-100 text-green-700";
  if (s === "Cancelled")       return "bg-red-100 text-red-600";
  if (s === "In Progress")     return "bg-blue-100 text-blue-700";
  if (s === "New")             return "bg-purple-100 text-purple-700";
  if (s.includes("Meeting"))   return "bg-violet-100 text-violet-700";
  if (s.includes("Follow"))    return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

// ─── Worksheet event detail card ────────────────────────────────────

function WorksheetEventDetailCard({ event, columns }) {
  const st      = eventStyle(event.eventType);
  const cName   = event.clientName || pickField(event.rowData, ["client_name"]);
  const status  = pickField(event.rowData, ["status"]);
  const pri     = pickField(event.rowData, ["priority"]);

  const skipNames = new Set(["Client Name", "Status", "Priority"]);
  const detailFields = (columns || []).filter(
    (col) =>
      !skipNames.has(col.name) &&
      event.rowData[col.key] != null &&
      String(event.rowData[col.key]).trim() !== "",
  );

  return (
    <div className={`overflow-hidden rounded-3xl border shadow-sm ${st.pill}`}>
      {/* Coloured header */}
      <div className={`flex items-center justify-between gap-3 border-b border-current/15 px-6 py-4 ${st.header}`}>
        <div className="flex items-center gap-2.5">
          <span className={`h-3 w-3 shrink-0 rounded-full ${st.dot}`} />
          <span className="text-xs font-black uppercase tracking-widest">{event.columnName}</span>
        </div>
        {event.time && (
          <span className="flex items-center gap-1.5 text-sm font-bold opacity-75">
            <Clock size={14} /> {to12h(event.time)}
          </span>
        )}
      </div>

      <div className="px-6 py-6">
        {/* Client name */}
        {cName && <p className="text-2xl font-black leading-tight">{cName}</p>}

        {/* Status + Priority */}
        {(status || pri) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {status && <span className={`rounded-xl px-3 py-1 text-xs font-black uppercase tracking-wide ${statusStyle(status)}`}>{status}</span>}
            {pri    && <span className={`rounded-xl px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityStyle(pri)}`}>{pri}</span>}
          </div>
        )}

        {/* Detail fields */}
        {detailFields.length > 0 && (
          <div className="mt-5 grid gap-4 border-t border-current/10 pt-5 sm:grid-cols-2">
            {detailFields.map((col) => {
              const formatted = formatColValue(col.type, event.rowData[col.key]);
              if (!formatted) return null;
              const isLong = col.type === "long_text" || formatted.length > 50;
              return (
                <div key={col.key} className={isLong ? "sm:col-span-2" : ""}>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-50">{col.name}</p>
                  <p className={`font-semibold opacity-90 ${isLong ? "text-sm leading-6" : "text-sm"}`}>{formatted}</p>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Manual event detail card ────────────────────────────────────────

function ManualEventDetailCard({ event, onEdit, onDelete }) {
  const st = eventStyle(event.eventType);
  return (
    <div className="overflow-hidden rounded-2xl border border-mme-pink/50 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${st.dot}`} />
          <div className="min-w-0">
            <p className="font-black text-mme-purple">{event.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {event.time && (
                <span className="flex items-center gap-1 text-xs font-bold text-mme-purple/60">
                  <Clock size={11} /> {to12h(event.time)}
                </span>
              )}
              <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${st.pill}`}>
                {event.eventType}
              </span>
              {event.priority && (
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${priorityStyle(event.priority)}`}>
                  {event.priority}
                </span>
              )}
              {event.status && (
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusStyle(event.status)}`}>
                  {event.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => onEdit(event)} title="Edit" className="rounded-xl p-2 text-mme-purple/40 transition hover:bg-mme-blush/50 hover:text-mme-purple">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(event.dbId)} title="Delete" className="rounded-xl p-2 text-mme-purple/40 transition hover:bg-red-50 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(event.clientName || event.companyName || event.description || event.assignedEmployee) && (
        <div className="space-y-2 border-t border-mme-pink/30 px-5 py-4">
          {(event.clientName || event.companyName) && (
            <p className="text-sm font-semibold text-mme-purple/70">
              {[event.clientName, event.companyName].filter(Boolean).join(" · ")}
            </p>
          )}
          {event.description && (
            <p className="text-sm leading-6 text-mme-purple/60">{event.description}</p>
          )}
          {event.assignedEmployee && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mme-purple/60">
              <User size={13} /> {event.assignedEmployee}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Event form ────────────────────────────────────────────────────

const BLANK_FORM = {
  title: "", eventDate: "", eventTime: "", eventType: "meeting",
  clientName: "", companyName: "", priority: "Medium", description: "",
};

function EventForm({ initialDate, initialData, onSubmit, onClose, isEdit }) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          title:       initialData.title       || "",
          eventDate:   initialData.date        || initialDate || "",
          eventTime:   initialData.time        || "",
          eventType:   initialData.eventType   || "meeting",
          clientName:  initialData.clientName  || "",
          companyName: initialData.companyName || "",
          priority:    initialData.priority    || "Medium",
          description: initialData.description || "",
        }
      : { ...BLANK_FORM, eventDate: initialDate || "" },
  );
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

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
    try { await onSubmit(form); }
    finally { setSubmitting(false); }
  }

  const inp = "w-full rounded-xl border border-mme-pink/70 bg-white px-3 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20 transition";
  const lbl = "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-mme-purple/60";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={lbl}>Title *</label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Client follow-up call" className={inp} />
        {errors.title && <p className="mt-1 text-xs font-bold text-red-500">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Date *</label>
          <input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={inp} />
          {errors.eventDate && <p className="mt-1 text-xs font-bold text-red-500">{errors.eventDate}</p>}
        </div>
        <div>
          <label className={lbl}>Time</label>
          <input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Type</label>
          <select value={form.eventType} onChange={(e) => set("eventType", e.target.value)} className={inp}>
            {EVENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Priority</label>
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inp}>
            {PRIORITY_VALUES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Client Name</label>
          <input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client" className={inp} />
        </div>
        <div>
          <label className={lbl}>Company</label>
          <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Company" className={inp} />
        </div>
      </div>

      <div>
        <label className={lbl}>Notes / Agenda</label>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details, agenda, or reminders…" className={`${inp} resize-none leading-5`} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="rounded-xl border border-mme-pink/70 px-4 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/20 transition hover:bg-[#4b2c55] disabled:opacity-60">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Check size={15} />}
          {isEdit ? "Update Event" : "Add Event"}
        </button>
      </div>
    </form>
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
  const [showIdentity,     setShowIdentity]     = useState(false);
  const [notice,           setNotice]           = useState(null);
  const [showAddForm,      setShowAddForm]      = useState(false);
  const [editingEvent,     setEditingEvent]     = useState(null);

  const dayEvents = events.filter((ev) => ev.date === date);
  const wsEvents  = dayEvents.filter((ev) => ev.source === "worksheet");
  const mnEvents  = dayEvents.filter((ev) => ev.source === "manual");
  const TODAY     = todayISO();
  const isToday   = date === TODAY;

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
  async function handleIdentify(next) {
    try {
      const saved = await saveCurrentEmployee(next);
      setEmployee(saved);
      setShowIdentity(false);
    } catch (err) {
      showMsg("error", err.message || "Could not save employee.");
    }
  }

  // ── Event CRUD ──────────────────────────────────────────────────
  async function handleAdd(formData) {
    try {
      await createCalendarEvent({ ...formData, employeeId: employee?.id });
      await fetchEvents();
      setShowAddForm(false);
      showMsg("success", "Event added.");
    } catch (err) {
      showMsg("error", err.message || "Could not add event.");
      throw err;
    }
  }

  async function handleEdit(id, formData) {
    try {
      await updateCalendarEvent(id, { ...formData, employeeId: employee?.id });
      await fetchEvents();
      setEditingEvent(null);
      showMsg("success", "Event updated.");
    } catch (err) {
      showMsg("error", err.message || "Could not update event.");
      throw err;
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    try {
      await deleteCalendarEvent(id);
      await fetchEvents();
      showMsg("success", "Event deleted.");
    } catch (err) {
      showMsg("error", err.message || "Could not delete event.");
    }
  }

  function startEdit(ev) {
    setShowAddForm(false);
    setEditingEvent(ev);
  }

  function startAdd() {
    if (!employee) { setShowIdentity(true); return; }
    setEditingEvent(null);
    setShowAddForm(true);
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fff9fc] text-mme-purple">
      {showIdentity && <EmployeeIdentityModal onSubmit={handleIdentify} />}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-mme-pink/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate("/calendar")}
              className="rounded-xl p-2 text-mme-purple/60 transition hover:bg-mme-blush/40"
              title="Back to calendar"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-mme-purple sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">
                Day View
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
              </button>
            ) : (
              <button
                onClick={() => setShowIdentity(true)}
                className="flex items-center gap-2 rounded-2xl border border-mme-pink/70 bg-white px-4 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30"
              >
                <UserRound size={16} /> Identify
              </button>
            )}
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-mme-pink/70 bg-white transition hover:bg-mme-blush/30"
              title="Previous day"
            >
              <ChevronLeft size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-mme-plum">
                <CalendarDays size={13} />
                {isToday ? "Today" : "Day view"}
              </div>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">{formatDisplayDate(date)}</h1>
              <p className="mt-1 text-sm text-mme-purple/55">
                {isLoading
                  ? "Loading…"
                  : dayEvents.length === 0
                  ? "No events on this day"
                  : `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""} — ${wsEvents.length} from management sheet · ${mnEvents.length} scheduled`}
              </p>
            </div>

            <button
              onClick={() => navigate(`/calendar/day/${shiftDate(date, 1)}`)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-mme-pink/70 bg-white transition hover:bg-mme-blush/30"
              title="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30 sm:self-auto"
          >
            <CalendarDays size={16} /> Month View
          </Link>
        </div>

        {isLoading ? (
          <div className="flex min-h-80 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
              <p className="mt-4 font-black text-mme-purple/50">Loading events…</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-7 lg:grid-cols-3">

            {/* ── Left: Management sheet events (2/3) ─────────── */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-mme-blush text-[10px] font-black text-mme-purple">S</span>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-mme-purple">
                  From Management Sheet
                </h2>
                {wsEvents.length > 0 && (
                  <span className="rounded-full bg-mme-purple/10 px-2.5 py-0.5 text-xs font-black text-mme-purple">
                    {wsEvents.length}
                  </span>
                )}
              </div>

              {wsEvents.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-mme-pink/60 bg-white/60 p-8 text-center">
                  <CalendarDays className="text-mme-mauve/40" size={38} />
                  <p className="mt-3 font-black text-mme-purple/45">No management sheet events</p>
                  <p className="mt-1.5 max-w-xs text-sm text-mme-purple/30">
                    Meetings scheduled on this date in the management sheet will appear here automatically.
                  </p>
                  <Link to="/management" className="mt-4 text-sm font-black text-mme-plum transition hover:text-mme-purple">
                    Open Management Sheet →
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  {wsEvents.map((ev) => (
                    <WorksheetEventDetailCard key={ev.id} event={ev} columns={worksheetColumns} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Scheduled events (1/3) ───────────────── */}
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-mme-blush text-[10px] font-black text-mme-purple">M</span>
                  <h2 className="text-sm font-black uppercase tracking-[0.15em] text-mme-purple">Scheduled</h2>
                  {mnEvents.length > 0 && (
                    <span className="rounded-full bg-mme-purple/10 px-2.5 py-0.5 text-xs font-black text-mme-purple">
                      {mnEvents.length}
                    </span>
                  )}
                </div>
                {!showAddForm && !editingEvent && (
                  <button
                    onClick={startAdd}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-mme-purple px-3.5 py-2 text-xs font-black text-white shadow-sm shadow-mme-purple/20 transition hover:bg-[#4b2c55]"
                  >
                    <Plus size={14} /> Add Event
                  </button>
                )}
              </div>

              {/* Add / Edit form */}
              {(showAddForm || editingEvent) && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-mme-pink/60 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-black text-mme-purple">
                      {editingEvent ? "Edit Event" : "New Event"}
                    </p>
                    <button
                      onClick={() => { setShowAddForm(false); setEditingEvent(null); }}
                      className="rounded-lg p-1.5 text-mme-purple/40 transition hover:bg-mme-blush/40 hover:text-mme-purple"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <EventForm
                    initialDate={date}
                    initialData={editingEvent}
                    onSubmit={editingEvent ? (data) => handleEdit(editingEvent.dbId, data) : handleAdd}
                    onClose={() => { setShowAddForm(false); setEditingEvent(null); }}
                    isEdit={!!editingEvent}
                  />
                </div>
              )}

              {/* List */}
              {mnEvents.length === 0 && !showAddForm && !editingEvent ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-mme-pink/60 bg-white/60 p-6 text-center">
                  <p className="font-black text-mme-purple/45 text-sm">No scheduled events</p>
                  <button onClick={startAdd} className="mt-2 text-sm font-black text-mme-plum transition hover:text-mme-purple">
                    + Schedule first event
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {mnEvents.map((ev) => (
                    <ManualEventDetailCard
                      key={ev.id}
                      event={ev}
                      onEdit={startEdit}
                      onDelete={handleDelete}
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
          notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-mme-pink bg-white text-mme-purple"
        }`}>
          {notice.type === "error"
            ? <X className="mt-0.5 shrink-0" size={18} />
            : <Check className="mt-0.5 shrink-0 text-mme-plum" size={18} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-2 opacity-50 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
