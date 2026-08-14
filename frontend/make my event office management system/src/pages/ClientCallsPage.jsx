import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import BackButton from "../components/BackButton";
import DateTimePicker from "../components/DateTimePicker";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pencil,
  Phone,
  Save,
  Trash2,
  UserRound,
  UserCog,
  Plus,
  X,
  MessageSquare,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/authStorage";
import { loadEmployeeDirectory } from "../services/managementStorage";
import {
  createCall,
  deleteCall,
  loadClientCalls,
  updateCall,
} from "../services/callsStorage";

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const normalized = String(value).replace(" ", "T");
  return normalized.slice(0, 16);
}

// "YYYY-MM-DDTHH:MM" for right now — used both as the <input min> so the
// picker can't go earlier, and to re-check on save (typed values bypass min).
// Uses the full minute, not just the date, so a past time on today's date
// (e.g. picking 5:00 PM after it's already 9:00 PM) is blocked too.
function nowMinValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function isPastDatetimeValue(value) {
  if (!value) return false;
  return value.slice(0, 16) < nowMinValue();
}

// "YYYY-MM-DDT00:00" for today — the next call's date can't be earlier than
// today, but any time of day on/after that date is allowed.
function todayMinValue() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00`;
}

// Only compares the date part — the next call's time of day is unrestricted.
function isNextCallDateTooEarly(value) {
  if (!value) return false;
  return value.slice(0, 10) < todayMinValue().slice(0, 10);
}

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// The next call's assignee dropdown defaults to whoever is already assigned,
// falling back to the logged-in employee — mirrors the same default both on
// initial render and when checking dirty state, so opening a card with no
// prior assignment doesn't itself count as an unsaved change.
function defaultNextCallAssigneeId(call, employeeId) {
  return call.nextCallAssignedEmployeeId
    ? String(call.nextCallAssignedEmployeeId)
    : String(employeeId || "");
}

function CallCard({ call, rowKey, employeeId, employeeDirectory, onChanged, onDeleted }) {
  // A call only "counts" once it has a discussion note on record — until
  // then the card stays fully unlocked (no Edit gate) so the employee can
  // freely fill it in and hit Save for the first time.
  const hasContent = Boolean(call.callDiscussion && call.callDiscussion.trim());
  const [isEditing, setIsEditing] = useState(!hasContent);
  const [callDiscussion, setCallDiscussion] = useState(
    call.callDiscussion || ""
  );
  const [nextCallDatetime, setNextCallDatetime] = useState(
    toDatetimeLocalValue(call.nextCallDatetime)
  );
  const [nextCallAssignedEmployeeId, setNextCallAssignedEmployeeId] = useState(
    defaultNextCallAssigneeId(call, employeeId)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const isNextCallAssigneeDirty = nextCallAssignedEmployeeId !== defaultNextCallAssigneeId(call, employeeId);
  // Nothing auto-saves anymore — every field (discussion, next-call time,
  // next-call assignee) only takes effect once the unified Save button is
  // clicked, so the dirty flag tracks all three.
  const isDirty =
    callDiscussion !== (call.callDiscussion || "") ||
    nextCallDatetime !== toDatetimeLocalValue(call.nextCallDatetime) ||
    isNextCallAssigneeDirty;

  // Based on the persisted schedule (not the unsaved edit) — flags a next
  // call whose scheduled moment has already come and gone.
  const isNextCallOverdue = Boolean(call.nextCallDatetime) &&
    isPastDatetimeValue(toDatetimeLocalValue(call.nextCallDatetime));

  // Locked (read-only) once the call has real content and isn't currently
  // being edited — the employee must click "Edit" to change anything.
  const fieldsLocked = hasContent && !isEditing;

  function handleNextCallDatetimeChange(newValue) {
    setNextCallDatetime(newValue);
    setError("");
    if (newValue && isNextCallDateTooEarly(newValue)) {
      setError("Next meeting call date cannot be before today. Any time of day is fine.");
    }
  }

  async function handleSave() {
    setError("");
    if (!callDiscussion.trim()) {
      setError("Add a discussion note before saving.");
      return;
    }
    if (nextCallDatetime && isNextCallDateTooEarly(nextCallDatetime)) {
      setError("Next meeting call date cannot be before today. Any time of day is fine.");
      return;
    }
    setIsSaving(true);
    try {
      await updateCall(rowKey, call.id, {
        callDiscussion: callDiscussion || null,
        nextCallDatetime: nextCallDatetime || null,
        nextCallAssignedEmployeeId: nextCallDatetime ? (nextCallAssignedEmployeeId || null) : null,
        employeeId,
      });
      setIsEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to save call.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit() {
    setError("");
    setIsEditing(true);
  }

  function handleCancel() {
    setError("");
    setCallDiscussion(call.callDiscussion || "");
    setNextCallDatetime(toDatetimeLocalValue(call.nextCallDatetime));
    setNextCallAssignedEmployeeId(defaultNextCallAssigneeId(call, employeeId));
    setIsEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this call? This cannot be undone.")) return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteCall(rowKey, call.id);
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete call.");
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5"
      style={{ animation: "slideUp 0.35s ease both" }}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Phone size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Call Time
            </p>
            <p className="text-sm font-black text-slate-900">
              {formatDisplayDatetime(call.callDatetime)}
            </p>
          </div>
          {isNextCallOverdue && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-600">
              <AlertTriangle size={12} />
              Missed Follow-up
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasContent && !isEditing && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ animation: "slideUp 0.2s ease" }}
              >
                {isSaving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Save
              </button>
              {hasContent && (
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  <X size={13} />
                  Cancel
                </button>
              )}
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            title="Delete call"
          >
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        {/* Left — Time & Meta */}
        <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
          <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-600">
            Call Time
          </label>
          <div
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            title="Set automatically when the call was created — not editable"
          >
            <CalendarClock size={14} className="shrink-0 text-slate-400" />
            {formatDisplayDatetime(call.callDatetime)}
          </div>

          {(call.createdByName || call.updatedByName || call.assignedByEmployeeName) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-3.5">
              {call.assignedByEmployeeName && (
                <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <UserCog size={12} className="text-slate-400" />
                  Assigned by{" "}
                  <span className="font-black text-slate-700">
                    {call.assignedByEmployeeName}
                  </span>
                </p>
              )}
              {call.createdByName && (
                <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <UserRound size={12} className="text-slate-400" />
                  Created by{" "}
                  <span className="font-black text-slate-700">
                    {call.createdByName}
                  </span>
                </p>
              )}
              {call.updatedByName &&
                call.updatedByName !== call.createdByName && (
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <UserRound size={12} className="text-slate-400" />
                    Updated by{" "}
                    <span className="font-black text-slate-700">
                      {call.updatedByName}
                    </span>
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Right — Discussion */}
        <div className="p-6">
          <label className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <MessageSquare size={12} />
            Call Discussion
          </label>
          <textarea
            rows={5}
            value={callDiscussion}
            onChange={(e) => setCallDiscussion(e.target.value)}
            readOnly={fieldsLocked}
            placeholder="What was discussed in this call?"
            className={`w-full resize-none rounded-2xl border border-slate-200 px-4 py-3.5 text-sm leading-relaxed text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 ${
              fieldsLocked
                ? "cursor-default bg-slate-50"
                : "bg-white hover:border-slate-300 hover:bg-slate-50 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            }`}
          />

          {callDiscussion && (
            <p className="mt-2 text-right text-[10px] font-semibold text-slate-300">
              {callDiscussion.length} characters
            </p>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <label className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <CalendarClock size={12} />
              Next Meeting Call Date &amp; Time
            </label>
            <div className="flex max-w-xs items-stretch gap-2">
              <DateTimePicker
                value={nextCallDatetime}
                onChange={handleNextCallDatetimeChange}
                min={todayMinValue()}
                minDateOnly
                subtle
                disabled={fieldsLocked}
                placeholder="Select next call date & time"
                className="w-full"
              />
            </div>

            <label className="mb-2 mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <UserCog size={12} />
              Assign Employee for Next Call
            </label>
            <select
              value={nextCallAssignedEmployeeId}
              onChange={(e) => setNextCallAssignedEmployeeId(e.target.value)}
              disabled={fieldsLocked}
              className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">Unassigned</option>
              {employeeDirectory.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.fullName}
                </option>
              ))}
            </select>

            {isNextCallOverdue && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-red-500">
                <AlertTriangle size={12} />
                This scheduled call date has passed — the follow-up may have been missed.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function ClientCallsPage() {
  const { rowKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from || "/management";
  const [employee] = useState(() => loadCurrentEmployee());
  const [clientName, setClientName] = useState("");
  const [calls, setCalls] = useState([]);
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  // Tracks call ids created during this visit that haven't yet been given a
  // discussion note — if the employee navigates away without saving one,
  // these get quietly deleted so an empty card never counts as a real call.
  const pendingEmptyCallIdsRef = useRef(new Set());
  const callsRef = useRef([]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await loadClientCalls(rowKey);
      setClientName(data.clientName || "");
      setCalls(data.calls || []);
    } catch (err) {
      setError(err.message || "Failed to load calls.");
    } finally {
      setIsLoading(false);
    }
  }, [rowKey]);

  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);

  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    loadEmployeeDirectory()
      .then((list) => setEmployeeDirectory(list || []))
      .catch(() => setEmployeeDirectory([]));

    return () => window.clearTimeout(timer);
  }, [employee, navigate, refresh]);

  // Cleans up any still-empty call created during this visit when leaving
  // this client (navigating away or unmounting) — satisfies "goes back or
  // to another page ... will not be stored as any call".
  useEffect(() => {
    pendingEmptyCallIdsRef.current = new Set();
    return () => {
      const ids = Array.from(pendingEmptyCallIdsRef.current);
      for (const id of ids) {
        const current = callsRef.current.find((c) => c.id === id);
        if (current && !current.callDiscussion?.trim()) {
          deleteCall(rowKey, id).catch(() => {});
        }
      }
    };
  }, [rowKey]);

  const hasEmptyCall = calls.some((c) => !c.callDiscussion?.trim());

  async function handleCreateCall() {
    setIsCreating(true);
    setError("");
    try {
      // The server stamps the call time itself (current moment) — no
      // datetime is sent from here.
      const created = await createCall(rowKey, {
        callDiscussion: null,
        employeeId: employee?.id,
      });
      pendingEmptyCallIdsRef.current.add(created.id);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create call.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-black">
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/40 backdrop-blur-xl">
        <div className="flex min-h-17 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={mmeLogo}
              alt="Make My Event"
              className="h-14 w-auto shrink-0 object-contain sm:h-16"
            />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
                Client Call Manager
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4">
            <BackButton to={backTo} title="Back to sheet" />
          </div>

          {/* Page Hero */}
          <div
            className="mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm shadow-slate-200/60"
            style={{ animation: "scaleIn 0.3s ease" }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Client Calls
                  </p>
                </div>
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">
                  {clientName || "This client"}
                </h1>
              </div>

              {/* Stats */}
              <div className="flex shrink-0 gap-3">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-center">
                  <span className="text-3xl font-black text-slate-900">
                    {calls.length}
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Total Calls
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              <button
                onClick={handleCreateCall}
                disabled={isCreating || hasEmptyCall}
                title={hasEmptyCall ? "Finish and save the existing new call first" : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add New Call
              </button>
              {hasEmptyCall && (
                <p className="text-xs font-semibold text-slate-400">
                  Add a discussion note and save the new call before starting another.
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
              style={{ animation: "slideUp 0.2s ease" }}
            >
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
              <Loader2 size={28} className="animate-spin text-slate-300" />
              <p className="text-sm font-semibold text-slate-300">
                Loading calls...
              </p>
            </div>
          ) : calls.length === 0 ? (
            <div
              className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center"
              style={{ animation: "scaleIn 0.3s ease" }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50">
                <Phone size={28} className="text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-400">
                  No calls yet
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-slate-300">
                  Click "Add New Call" to log the first call with this client.
                </p>
              </div>
              <button
                onClick={handleCreateCall}
                disabled={isCreating || hasEmptyCall}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Add New Call
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {calls.map((call, index) => (
                <div
                  key={call.id}
                  style={{
                    animation: `slideUp 0.3s ease ${index * 0.06}s both`,
                  }}
                >
                  <CallCard
                    call={call}
                    rowKey={rowKey}
                    employeeId={employee?.id}
                    employeeDirectory={employeeDirectory}
                    onChanged={refresh}
                    onDeleted={refresh}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}