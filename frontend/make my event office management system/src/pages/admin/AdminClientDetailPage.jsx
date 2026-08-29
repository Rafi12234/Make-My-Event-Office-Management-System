import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  CalendarCheck2,
  CheckCircle2,
  PhoneCall,
  Sparkles,
  X,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchAdminClientDetail } from "../../services/adminDashboardService";

// "YYYY-MM-DD HH:MM:SS" (backend shape) → readable local string.
function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = dbDatetime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Meeting History Item ─────────────────────────────────────────────────
function MeetingItem({ meeting, index }) {
  return (
    <div
      className="animate-[fadeIn_0.4s_ease-out_both] rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm"
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-black text-mme-purple">{formatDisplay(meeting.meetingDatetime) || "Not scheduled yet"}</p>
        </div>
        <span className="text-xs font-bold text-mme-purple/50">Logged by {meeting.createdByName || "—"}</span>
      </div>
      {meeting.discussionNotes && (
        <p className="mt-2 text-sm text-mme-purple/70">{meeting.discussionNotes}</p>
      )}
      {meeting.nextMeeting && (
        <p className="mt-2 text-xs font-bold text-mme-plum">
          Next meeting: {formatDisplay(meeting.nextMeeting.nextMeetingDatetime)} — {meeting.nextMeeting.assignedEmployeeName || "Unassigned"}
        </p>
      )}
    </div>
  );
}

// ─── Call History Item ────────────────────────────────────────────────────
function CallItem({ call, index }) {
  return (
    <div
      className="animate-[fadeIn_0.4s_ease-out_both] rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm"
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-mme-purple">{formatDisplay(call.callDatetime) || "Not scheduled yet"}</p>
        <span className="text-xs font-bold text-mme-purple/50">Logged by {call.createdByName || "—"}</span>
      </div>
      {call.callDiscussion && (
        <p className="mt-2 text-sm text-mme-purple/70">{call.callDiscussion}</p>
      )}
      {call.nextCall && (
        <p className="mt-2 text-xs font-bold text-mme-plum">
          Next call: {formatDisplay(call.nextCall.nextCallDatetime)} — {call.nextCall.assignedEmployeeName || "Unassigned"}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AdminClientDetailPage() {
  const navigate = useNavigate();
  const { rowKey } = useParams();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    fetchAdminClientDetail(rowKey)
      .then(setClient)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin, rowKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  if (checkingSession || !admin) return null;

  const clientName = client?.columns.find((c) => c.name === "Client Name")?.value || "Client";

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        <div className="mb-5">
          <BackButton to="/admin-dashboard" title="Back to Admin Dashboard" />
        </div>

        {isLoading && !client ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
          </div>
        ) : client ? (
          <>
            <div className="mb-7 animate-[fadeIn_0.5s_ease-out]">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
                <Sparkles size={14} /> Client Profile
              </div>
              <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">{clientName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                  <CalendarCheck2 size={13} /> {client.totals.meetingsCount} meetings
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                  <PhoneCall size={13} /> {client.totals.callsCount} calls
                </span>
                {client.finalization && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                    <CheckCircle2 size={13} /> Finalized {formatDisplay(client.finalization.finalizedAt)} by {client.finalization.finalizedByName || "—"}
                  </span>
                )}
              </div>
            </div>

            {/* Client Information */}
            <section className="mb-8 rounded-3xl border border-mme-pink/60 bg-white p-6 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <h2 className="mb-4 font-black text-mme-purple">Client Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {client.columns.map((col) => (
                  <div key={col.name} className="rounded-xl bg-[#fff9fc] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-mme-purple/45">{col.name}</p>
                    <p className="mt-1 truncate text-sm font-bold text-mme-purple" title={String(col.value ?? "")}>
                      {col.value === "" || col.value == null ? "—" : String(col.value)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Meeting History */}
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                    <CalendarCheck2 size={17} />
                  </div>
                  <h2 className="font-black text-mme-purple">Meeting History</h2>
                  <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                    {client.meetings.length}
                  </span>
                </div>
                {client.meetings.length ? (
                  <div className="space-y-3">
                    {client.meetings.map((meeting, index) => (
                      <MeetingItem key={meeting.id} meeting={meeting} index={index} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-mme-pink/60 bg-white px-6 py-8 text-center text-sm font-bold text-mme-purple/50">
                    No meetings logged yet.
                  </p>
                )}
              </section>

              {/* Call History */}
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                    <PhoneCall size={17} />
                  </div>
                  <h2 className="font-black text-mme-purple">Call History</h2>
                  <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                    {client.calls.length}
                  </span>
                </div>
                {client.calls.length ? (
                  <div className="space-y-3">
                    {client.calls.map((call, index) => (
                      <CallItem key={call.id} call={call} index={index} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-mme-pink/60 bg-white px-6 py-8 text-center text-sm font-bold text-mme-purple/50">
                    No calls logged yet.
                  </p>
                )}
              </section>
            </div>
          </>
        ) : null}

      {/* Toast Notice */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-mme-pink bg-white text-mme-purple"
        }`}>
          <X className="mt-0.5 shrink-0" size={17} />
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </AdminLayout>
  );
}
