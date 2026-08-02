import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import BackButton from "../components/BackButton";
import {
  CheckCircle2,
  Loader2,
  Phone,
  Save,
  Trash2,
  UserRound,
  Plus,
  MessageSquare,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/authStorage";
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

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CallCard({ call, rowKey, employeeId, onChanged, onDeleted }) {
  const [callDatetime, setCallDatetime] = useState(
    toDatetimeLocalValue(call.callDatetime)
  );
  const [callDiscussion, setCallDiscussion] = useState(
    call.callDiscussion || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const isDatetimeDirty = callDatetime !== toDatetimeLocalValue(call.callDatetime);
  const isDirty = isDatetimeDirty || callDiscussion !== (call.callDiscussion || "");

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateCall(rowKey, call.id, {
        callDatetime: callDatetime || null,
        callDiscussion: callDiscussion || null,
        employeeId,
      });
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to save call.");
    } finally {
      setIsSaving(false);
    }
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
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
              style={{ animation: "slideUp 0.2s ease" }}
            >
              {isSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              Save Changes
            </button>
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
          <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Call Time
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="datetime-local"
              value={callDatetime}
              onChange={(e) => setCallDatetime(e.target.value)}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />

            {isDatetimeDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
                style={{ animation: "slideUp 0.2s ease" }}
                title="Confirm this call time"
              >
                {isSaving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                OK
              </button>
            )}
          </div>

          {(call.createdByName || call.updatedByName) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-3.5">
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
          <label className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <MessageSquare size={12} />
            Call Discussion
          </label>
          <textarea
            rows={5}
            value={callDiscussion}
            onChange={(e) => setCallDiscussion(e.target.value)}
            placeholder="What was discussed in this call?"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
          />

          {callDiscussion && (
            <p className="mt-2 text-right text-[10px] font-semibold text-slate-300">
              {callDiscussion.length} characters
            </p>
          )}
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
  const [employee] = useState(() => loadCurrentEmployee());
  const [clientName, setClientName] = useState("");
  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

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
    if (!employee) {
      navigate("/login", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [employee, navigate, refresh]);

  async function handleCreateCall() {
    setIsCreating(true);
    setError("");
    try {
      await createCall(rowKey, {
        callDatetime: null,
        callDiscussion: null,
        employeeId: employee?.id,
      });
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
            <BackButton to="/management" title="Back to sheet" />
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
                <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-500">
                  Log every call with this client, note what was discussed, and
                  track which employee recorded each call.
                </p>
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
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add New Call
              </button>
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
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
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