import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { AlertTriangle, LogOut, Phone, Shield } from "lucide-react";
import BackButton from "../../components/BackButton";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchClientCallsForAdmin } from "../../services/adminActivityService";

function formatDisplayDatetime(value) {
  if (!value) return "Not scheduled yet";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOverdueDatetime(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(" ", "T"));
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function CallCard({ call }) {
  const overdue = Boolean(call.nextCallDatetime) && isOverdueDatetime(call.nextCallDatetime);

  return (
    <div className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mme-pink/40 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
            <Phone size={16} />
          </span>
          <div>
            <p className="font-black text-mme-purple">{formatDisplayDatetime(call.callDatetime)}</p>
            <p className="text-xs text-mme-purple/55">
              Logged by {call.createdByName || "—"}
              {call.assignedByEmployeeName ? ` \u00b7 Assigned by ${call.assignedByEmployeeName}` : ""}
            </p>
          </div>
        </div>
        {overdue && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
            <AlertTriangle size={12} /> Next call missed
          </span>
        )}
      </div>

      <div className="space-y-4 p-6">
        {call.callDiscussion && (
          <div>
            <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-mme-purple/45">Discussion</p>
            <p className="text-sm text-mme-purple/75">{call.callDiscussion}</p>
          </div>
        )}

        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs ${overdue ? "border-red-200" : "border-mme-pink/20"}`}>
          <span className={overdue ? "text-red-600" : "text-mme-purple/55"}>
            Next call: <span className={`font-bold ${overdue ? "text-red-600" : "text-mme-purple"}`}>{formatDisplayDatetime(call.nextCallDatetime)}</span>
            {overdue ? " (Missed)" : ""}
          </span>
          {call.nextCallAssignedEmployeeName && (
            <span className="text-mme-purple/55">Assigned to <span className="font-bold text-mme-purple">{call.nextCallAssignedEmployeeName}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCallDetailsPage() {
  const navigate = useNavigate();
  const { rowKey } = useParams();
  const location = useLocation();
  const backTo = location.state?.from || "/admin/activity";
  const backLabel = location.state?.fromLabel || "Back to activity";
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [data, setData] = useState(null);
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
    if (!admin || !rowKey) return;
    setIsLoading(true);
    fetchClientCallsForAdmin(rowKey)
      .then(setData)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin, rowKey]);

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
          <BackButton to={backTo} title={backLabel} />
        </div>

        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <Phone size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">
            {data?.clientName || "Client"} {"\u2014"} Call History
          </h1>
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
        ) : !data?.calls?.length ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <Phone size={38} className="text-mme-mauve" />
            <p className="mt-4 font-black text-mme-purple">No calls logged for this client yet</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.calls.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
