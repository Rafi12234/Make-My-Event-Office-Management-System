import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarClock,
  Info,
  LogOut,
  Phone,
  Shield,
  UsersRound,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";

function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = dbDatetime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Activity Row ────────────────────────────────────────────────────────────
function ActivityRow({ kind, entry }) {
  const navigate = useNavigate();
  const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
  const loggedDatetime = kind === "meeting" ? entry.meetingDatetime : entry.callDatetime;
  const nextDatetime = next ? (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime) : null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate font-black text-mme-purple">{entry.clientName || "Unnamed client"}</p>
        <p className="mt-0.5 text-xs text-mme-purple/55">
          Logged {formatDisplay(loggedDatetime) || "—"} by{" "}
          <span className="font-bold text-mme-purple/75">{entry.createdByName || "—"}</span>
        </p>
      </div>

      <div className="shrink-0 basis-52 text-xs">
        <p className="font-black uppercase tracking-wide text-mme-purple/40">Next {kind}</p>
        <p className={`mt-0.5 font-bold ${nextDatetime ? "text-mme-purple" : "italic text-mme-purple/35"}`}>
          {nextDatetime ? formatDisplay(nextDatetime) : `No upcoming ${kind}`}
        </p>
      </div>

      <div className="shrink-0 basis-44 text-xs">
        <p className="font-black uppercase tracking-wide text-mme-purple/40">Assigned To</p>
        <p className={`mt-0.5 font-bold ${next?.assignedEmployeeName ? "text-mme-purple" : "italic text-mme-purple/35"}`}>
          {next?.assignedEmployeeName || "Unassigned"}
        </p>
      </div>

      <button
        onClick={() => navigate(`/admin/activity/${kind === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`)}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
      >
        <Info size={12} /> Details
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminActivityPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("meetings");
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!admin) return;
    setIsLoading(true);
    Promise.all([fetchAllMeetings(), fetchAllCalls()])
      .then(([meetingsData, callsData]) => {
        setMeetings(meetingsData);
        setCalls(callsData);
      })
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin", { replace: true });
  }

  const list = tab === "meetings" ? meetings : calls;

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
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">
                Make My Event
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-mme-pink/60 bg-[#fff9fc] px-3 py-2 text-xs font-bold text-mme-purple/65 sm:flex">
              <Shield size={13} className="text-mme-plum" />
              {admin.fullName}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-3 py-2 text-xs font-black text-mme-purple transition hover:bg-red-50 hover:border-red-200 hover:text-red-500"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-350 px-4 py-8 sm:px-6">
        <div className="mb-5">
          <BackButton to="/admin" title="Back to Admin Portal" />
        </div>

        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarClock size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Meeting &amp; Call Oversight</h1>
          <p className="mt-1.5 text-sm text-mme-purple/55">
            Every client meeting and call across all employees. Open Details for the full history, or edit the next scheduled date/time from the Company Calendar's day view.
          </p>
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

        <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab("meetings")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
                  tab === "meetings" ? "bg-mme-purple text-white" : "text-mme-purple/60 hover:bg-mme-blush/40"
                }`}
              >
                <CalendarClock size={13} /> Meetings ({meetings.length})
              </button>
              <button
                onClick={() => setTab("calls")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
                  tab === "calls" ? "bg-mme-purple text-white" : "text-mme-purple/60 hover:bg-mme-blush/40"
                }`}
              >
                <Phone size={13} /> Calls ({calls.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
              </div>
            ) : !list.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UsersRound size={38} className="text-mme-mauve" />
                <p className="mt-4 font-black text-mme-purple">No {tab} logged yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {list.map((entry) => (
                  <ActivityRow
                    key={entry.id}
                    kind={tab === "meetings" ? "meeting" : "call"}
                    entry={entry}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
