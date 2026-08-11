import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import BackButton from "../components/BackButton";
import AdminLayout from "../components/AdminLayout";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  adminLogout,
  createEmployee,
  fetchAdminMe,
  fetchAllEmployees,
  resetEmployeePassword,
  toggleEmployeeActive,
} from "../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../services/adminActivityService";

// ─── Create Employee Form ────────────────────────────────────────────────────
function CreateEmployeeForm({ onCreated }) {
  const [form, setForm] = useState({ fullName: "", email: "", role: "Employee", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const employee = await createEmployee(form);
      onCreated(employee);
      setForm({ fullName: "", email: "", role: "Employee", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <X size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Full Name *
          </label>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Employee full name"
            className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Email *
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="employee@example.com"
            className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Role *
          </label>
          <div className="relative">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
            >
              <option value="Employee">Employee</option>
              <option value="Admin">Admin</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/50" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 pr-10 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/15 transition hover:bg-[#4b2c55] disabled:opacity-60"
        >
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <UserPlus size={16} />}
          {loading ? "Creating…" : "Create Employee"}
        </button>
      </div>
    </form>
  );
}

// ─── Reset Password Modal ────────────────────────────────────────────────────
function ResetPasswordModal({ employee, onClose, onReset }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetEmployeePassword(employee.id, password);
      onReset(employee);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_30px_100px_rgba(91,55,101,0.25)]">
        <div className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
            <RotateCcw size={19} />
          </div>
          <h2 className="mt-4 text-lg font-black text-mme-purple">Reset Password</h2>
          <p className="mt-1 text-sm text-mme-purple/55">
            Set a new password for <span className="font-bold text-mme-purple">{employee.fullName}</span>. They'll be required to change it on next login.
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
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 pr-10 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
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
                {loading ? "Saving…" : "Set Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function initials(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
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

function passesDateFilter(dateOnly, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!dateOnly) return false;
  if (dateFrom && dateOnly < dateFrom) return false;
  if (dateTo && dateOnly > dateTo) return false;
  return true;
}

// Groups every meeting/call into per-employee "previous" (completed, matched
// by who logged it) and "upcoming" (matched by who the next-schedule is
// assigned to) buckets. Each date is checked against the same date range
// independently, so a past range naturally surfaces only previous entries,
// a future range only upcoming ones, and a range spanning today surfaces
// both — with no need to special-case "is this range past or future".
function buildEmployeeActivity(employees, meetings, calls, dateFrom, dateTo) {
  const byName = new Map(employees.map((emp) => [emp.fullName, { employee: emp, previous: [], upcoming: [] }]));

  for (const meeting of meetings) {
    if (meeting.hasCompletedDetails && meeting.createdByName && byName.has(meeting.createdByName)) {
      const dateOnly = meeting.meetingDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(meeting.createdByName).previous.push({
          type: "meeting", rowKey: meeting.rowKey, clientName: meeting.clientName, datetime: meeting.meetingDatetime,
        });
      }
    }
    const nextName = meeting.nextMeeting?.assignedEmployeeName;
    if (nextName && byName.has(nextName)) {
      const dateOnly = meeting.nextMeeting.nextMeetingDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(nextName).upcoming.push({
          type: "meeting", rowKey: meeting.rowKey, clientName: meeting.clientName, datetime: meeting.nextMeeting.nextMeetingDatetime,
        });
      }
    }
  }

  for (const call of calls) {
    if (call.hasCompletedDetails && call.createdByName && byName.has(call.createdByName)) {
      const dateOnly = call.callDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(call.createdByName).previous.push({
          type: "call", rowKey: call.rowKey, clientName: call.clientName, datetime: call.callDatetime,
        });
      }
    }
    const nextName = call.nextCall?.assignedEmployeeName;
    if (nextName && byName.has(nextName)) {
      const dateOnly = call.nextCall.nextCallDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(nextName).upcoming.push({
          type: "call", rowKey: call.rowKey, clientName: call.clientName, datetime: call.nextCall.nextCallDatetime,
        });
      }
    }
  }

  for (const bucket of byName.values()) {
    bucket.previous.sort((a, b) => (b.datetime || "").localeCompare(a.datetime || ""));
    bucket.upcoming.sort((a, b) => (a.datetime || "").localeCompare(b.datetime || ""));
  }

  return [...byName.values()];
}

// ─── Employee Activity Card ──────────────────────────────────────────────────
function StatChip({ icon: Icon, label, count, tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>
      <Icon size={11} /> {count} {label}
    </span>
  );
}

function RoutineEntryRow({ entry }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mme-pink/40 bg-[#fff9fc] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={14} className="shrink-0 text-mme-purple/50" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mme-purple">{entry.clientName || "Unnamed client"}</p>
          <p className="text-xs text-mme-purple/55">
            {formatDisplay(entry.datetime) || "No date set"} {"\u00b7"} {entry.type === "meeting" ? "Meeting" : "Call"}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate(`/admin/activity/${entry.type === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
      >
        <Info size={11} /> Details
      </button>
    </li>
  );
}

function EmployeeActivityCard({ bucket }) {
  const [expanded, setExpanded] = useState(false);
  const { employee, previous, upcoming } = bucket;
  const completedMeetings = previous.filter((e) => e.type === "meeting").length;
  const completedCalls = previous.filter((e) => e.type === "call").length;
  const upcomingMeetings = upcoming.filter((e) => e.type === "meeting").length;
  const upcomingCalls = upcoming.filter((e) => e.type === "call").length;
  const total = previous.length + upcoming.length;

  return (
    <div className="rounded-2xl border border-mme-pink/50 bg-white transition hover:border-mme-pink hover:shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
          employee.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
        }`}>
          {initials(employee.fullName)}
        </div>

        <div className="min-w-0 basis-48">
          <p className="truncate font-black text-mme-purple">{employee.fullName}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-black ${employee.isActive ? "text-green-600" : "text-red-400"}`}>
              {employee.isActive ? "Active" : "Inactive"}
            </span>
            <span className="text-[10px] font-bold text-mme-purple/35">{"\u00b7"} {employee.role}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <StatChip icon={CalendarClock} label="Meetings Done" count={completedMeetings} tone="bg-mme-blush text-mme-plum" />
          <StatChip icon={Phone} label="Calls Done" count={completedCalls} tone="bg-mme-blush text-mme-plum" />
          <StatChip icon={CalendarClock} label="Upcoming Meetings" count={upcomingMeetings} tone="bg-mme-purple/10 text-mme-purple" />
          <StatChip icon={Phone} label="Upcoming Calls" count={upcomingCalls} tone="bg-mme-purple/10 text-mme-purple" />
        </div>

        <ChevronDown size={16} className={`ml-auto shrink-0 text-mme-purple/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-mme-pink/30 px-4 py-3.5">
          {total === 0 ? (
            <p className="text-xs italic text-mme-purple/40">No meetings or calls found for {employee.fullName} in this range.</p>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                  Previous {"\u2014"} Completed ({previous.length})
                </p>
                {previous.length ? (
                  <ul className="space-y-1.5">
                    {previous.map((entry, i) => <RoutineEntryRow key={`p-${i}`} entry={entry} />)}
                  </ul>
                ) : (
                  <p className="text-xs italic text-mme-purple/35">No completed meetings/calls in range.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                  Upcoming ({upcoming.length})
                </p>
                {upcoming.length ? (
                  <ul className="space-y-1.5">
                    {upcoming.map((entry, i) => <RoutineEntryRow key={`u-${i}`} entry={entry} />)}
                  </ul>
                ) : (
                  <p className="text-xs italic text-mme-purple/35">No upcoming meetings/calls in range.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manage Employee Accounts (secondary feature: add + reset password) ─────
function EmployeeAccountsPanel({ employees, adminId, onCreated, onToggle }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [query, setQuery] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetNotice, setResetNotice] = useState(null);

  async function handleToggle(emp) {
    setError(null);
    setTogglingId(emp.id);
    try {
      await toggleEmployeeActive(emp.id, !emp.isActive);
      onToggle(emp.id, !emp.isActive);
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? employees.filter((e) => e.fullName?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q))
    : employees;

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-mme-pink/50 bg-[#fff9fc]">
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5"
        >
          <span className="flex items-center gap-2 text-sm font-black text-mme-purple">
            <UserPlus size={15} /> Add New Employee
          </span>
          <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition ${
            showCreateForm ? "border-mme-purple bg-mme-purple text-white" : "border-mme-purple/20 text-mme-purple"
          }`}>
            {showCreateForm ? "Cancel" : <span className="flex items-center gap-1"><Plus size={12} /> Add</span>}
          </span>
        </button>
        {showCreateForm && (
          <div className="border-t border-mme-pink/40 px-5 py-4">
            <CreateEmployeeForm
              onCreated={(emp) => {
                onCreated(emp);
                setShowCreateForm(false);
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <X size={15} /> {error}
        </div>
      )}

      {resetNotice && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          <Check size={15} /> {resetNotice}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mme-purple/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-2.5 pl-10 pr-9 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/35 hover:text-mme-purple">
            <X size={14} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-mme-purple/40">No employees match "{query}".</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((emp) => (
            <div key={emp.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
              <div className="flex min-w-0 flex-1 items-center gap-3 basis-56">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                  emp.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
                }`}>
                  {initials(emp.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black text-mme-purple">{emp.fullName}</p>
                  <p className="truncate text-xs text-mme-purple/55">{emp.email}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                  emp.role === "Admin" ? "bg-mme-purple/10 text-mme-purple" : "bg-mme-blush text-mme-plum"
                }`}>
                  {emp.role === "Admin" ? <Shield size={11} /> : <UsersRound size={11} />}
                  {emp.role}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                  emp.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                }`}>
                  {emp.isActive ? <UserCheck size={11} /> : <UserMinus size={11} />}
                  {emp.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setResetTarget(emp)}
                  title="Reset Password"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
                >
                  <RotateCcw size={12} /> Reset Password
                </button>
                {emp.id === adminId ? (
                  <span className="text-xs font-bold text-mme-purple/30 italic">You</span>
                ) : (
                  <button
                    onClick={() => handleToggle(emp)}
                    disabled={togglingId === emp.id}
                    title={emp.isActive ? "Deactivate" : "Activate"}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition disabled:opacity-50 ${
                      emp.isActive
                        ? "border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                        : "border border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                    }`}
                  >
                    {togglingId === emp.id ? "…" : emp.isActive ? "Deactivate" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resetTarget && (
        <ResetPasswordModal
          employee={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={(emp) => {
            setResetTarget(null);
            setResetNotice(`Password reset for "${emp.fullName}".`);
          }}
        />
      )}
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showAccounts, setShowAccounts] = useState(false);

  const [nameQuery, setNameQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    Promise.all([fetchAllEmployees(), fetchAllMeetings(), fetchAllCalls()])
      .then(([employeesData, meetingsData, callsData]) => {
        setEmployees(employeesData);
        setMeetings(meetingsData);
        setCalls(callsData);
      })
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  function handleCreated(newEmployee) {
    setEmployees((prev) => [newEmployee, ...prev]);
    setNotice({ type: "success", message: `Employee "${newEmployee.fullName}" created successfully.` });
  }

  function handleToggle(employeeId, isActive) {
    setEmployees((prev) => prev.map((e) => (e.id === employeeId ? { ...e, isActive } : e)));
    setNotice({
      type: "success",
      message: `Employee ${isActive ? "activated" : "deactivated"} successfully.`,
    });
  }

  const activity = useMemo(
    () => buildEmployeeActivity(employees, meetings, calls, dateFrom, dateTo),
    [employees, meetings, calls, dateFrom, dateTo],
  );

  const filteredActivity = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const list = q ? activity.filter((b) => b.employee.fullName?.toLowerCase().includes(q)) : activity;
    return [...list].sort((a, b) => {
      const totalA = a.previous.length + a.upcoming.length;
      const totalB = b.previous.length + b.upcoming.length;
      return totalB - totalA || a.employee.fullName.localeCompare(b.employee.fullName);
    });
  }, [activity, nameQuery]);

  const activeFilterCount = (nameQuery ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  function clearFilters() {
    setNameQuery("");
    setDateFrom("");
    setDateTo("");
  }

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        <div className="mb-5">
          <BackButton to="/" title="Back to app" />
        </div>

        {/* Page Title */}
        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <UsersRound size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Employee Management</h1>
          <p className="mt-1.5 text-sm text-mme-purple/55">
            See every employee's completed and upcoming meetings/calls, filter by name and date range, and manage accounts.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                Employee Name
              </label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mme-purple/35" />
                <input
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Search by employee name…"
                  className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-2.5 pl-9 pr-9 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
                {nameQuery && (
                  <button onClick={() => setNameQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/35 hover:text-mme-purple">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3.5 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3.5 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>

          {(dateFrom || dateTo) && (
            <p className="mt-3 text-xs font-bold text-mme-purple/50">
              Within this range: past dates show each employee's completed meetings/calls, future dates show their upcoming ones {"\u2014"} a range spanning today shows both.
            </p>
          )}
        </div>

        {/* Employee Activity Overview */}
        <div className="mb-6 rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                <CalendarClock size={17} />
              </div>
              <span className="font-black text-mme-purple">Employee Activity Overview</span>
            </div>
            <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
              {filteredActivity.length} of {employees.length} employees
            </span>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
              </div>
            ) : filteredActivity.length === 0 ? (
              <p className="py-10 text-center text-sm font-bold text-mme-purple/40">No employees match these filters.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredActivity.map((bucket) => (
                  <EmployeeActivityCard key={bucket.employee.id} bucket={bucket} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manage Employee Accounts — secondary feature, collapsed by default */}
        <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <button onClick={() => setShowAccounts((v) => !v)} className="flex w-full items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                <Settings2 size={17} />
              </div>
              <div className="text-left">
                <span className="block font-black text-mme-purple">Manage Employee Accounts</span>
                <span className="block text-xs font-bold text-mme-purple/45">Add a new employee or reset a password</span>
              </div>
            </div>
            <ChevronDown size={16} className={`shrink-0 text-mme-purple/50 transition-transform ${showAccounts ? "rotate-180" : ""}`} />
          </button>

          {showAccounts && (
            <div className="border-t border-mme-pink/50 px-6 py-5">
              <EmployeeAccountsPanel
                employees={employees}
                adminId={admin.id}
                onCreated={handleCreated}
                onToggle={handleToggle}
              />
            </div>
          )}
        </div>

      {/* Toast Notice */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-mme-pink bg-white text-mme-purple"
        }`}>
          {notice.type === "error"
            ? <X className="mt-0.5 shrink-0" size={17} />
            : <Check className="mt-0.5 shrink-0 text-mme-plum" size={17} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
