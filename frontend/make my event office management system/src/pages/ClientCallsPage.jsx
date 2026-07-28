import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { loadCurrentEmployee } from "../services/managementStorage";
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
  const [callDatetime, setCallDatetime] = useState(toDatetimeLocalValue(call.callDatetime));
  const [callDiscussion, setCallDiscussion] = useState(call.callDiscussion || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const isDirty =
    callDatetime !== toDatetimeLocalValue(call.callDatetime) ||
    callDiscussion !== (call.callDiscussion || "");

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
    <div className="overflow-hidden rounded-[22px] border border-[#d6d6d6]/60 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6d6d6]/50 bg-[#f9f9f9] px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
          <Phone size={15} /> {formatDisplayDatetime(call.callDatetime)}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-black text-white hover:bg-[#222222] disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-xl p-2 text-black/35 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            title="Delete call"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[240px_1fr]">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Call time</label>
          <input
            type="datetime-local"
            value={callDatetime}
            onChange={(event) => setCallDatetime(event.target.value)}
            className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
          />

          {(call.createdByName || call.updatedByName) && (
            <div className="mt-3 space-y-1 text-[11px] text-black/45">
              {call.createdByName && (
                <p className="flex items-center gap-1.5">
                  <UserRound size={12} /> Created by {call.createdByName}
                </p>
              )}
              {call.updatedByName && call.updatedByName !== call.createdByName && (
                <p className="flex items-center gap-1.5">
                  <UserRound size={12} /> Updated by {call.updatedByName}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Call discussion</label>
          <textarea
            rows={4}
            value={callDiscussion}
            onChange={(event) => setCallDiscussion(event.target.value)}
            placeholder="What was discussed in this call?"
            className="w-full resize-none rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm leading-6 text-black outline-none focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
          />
        </div>
      </div>

      {error && <p className="px-5 pb-4 text-xs font-bold text-red-500">{error}</p>}
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
      navigate("/management", { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
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
    <div className="min-h-screen bg-[#ffffff] text-black">
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black font-black text-white shadow-lg shadow-black/20">M</div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-black sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333] sm:text-xs">Client Call Manager</p>
            </div>
          </div>

          <Link
            to="/management"
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white hover:bg-[#222222]"
          >
            <ArrowLeft size={17} /> Back to sheet
          </Link>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
                <Phone size={15} /> Calls for
              </div>
              <h1 className="mt-2 text-2xl font-black text-black sm:text-3xl">
                {clientName || "This client"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                Log every call with this client, note what was discussed, and see which
                employee logged each call.
              </p>
            </div>

            <button
              onClick={handleCreateCall}
              disabled={isCreating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white shadow-md shadow-black/15 hover:bg-[#222222] disabled:opacity-60"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
              Add new call
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid min-h-72 place-items-center">
              <Loader2 size={28} className="animate-spin text-black/40" />
            </div>
          ) : calls.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-[22px] border border-dashed border-[#d6d6d6] p-8 text-center">
              <div>
                <Phone size={32} className="mx-auto text-black/30" />
                <p className="mt-4 font-black text-black">No calls yet</p>
                <p className="mt-2 max-w-sm text-sm text-black/50">
                  Click "Add new call" to log the first call with this client.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {calls.map((call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  rowKey={rowKey}
                  employeeId={employee?.id}
                  onChanged={refresh}
                  onDeleted={refresh}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
