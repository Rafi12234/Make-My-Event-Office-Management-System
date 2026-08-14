import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { AlertTriangle, CalendarClock, Phone, Shield, UsersRound, X } from "lucide-react";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";
import { buildEmployeeActivity, formatLateDuration, initials, isOverdueDatetime } from "../../utils/employeeActivity";
import { MissedEntryRow, StatChip } from "../../components/EmployeeActivityWidgets";

export default function AdminEmployeeMissedPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
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

  const employee = useMemo(
    () => employees.find((e) => String(e.id) === String(employeeId)) || null,
    [employees, employeeId],
  );

  // Always all-time (no date filter) — a missed schedule stays missed no
  // matter what date range the employee's main page happens to be showing.
  const missed = useMemo(() => {
    if (!employee) return [];
    const bucket = buildEmployeeActivity([employee], meetings, calls, "", "")[0];
    return bucket.upcoming.filter((entry) => isOverdueDatetime(entry.datetime));
  }, [employee, meetings, calls]);

  const missedMeetings = missed.filter((e) => e.type === "meeting").length;
  const missedCalls = missed.filter((e) => e.type === "call").length;

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-5">
        <BackButton
          to={employee ? `/admin-employee-management/${employee.id}` : "/admin-employee-management"}
          title="Back to employee record"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
        </div>
      ) : !employee ? (
        <div className="rounded-3xl border border-mme-pink/60 bg-white p-10 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <UsersRound size={34} className="mx-auto text-mme-mauve" />
          <p className="mt-4 font-black text-mme-purple">Employee not found</p>
          <p className="mt-1 text-sm text-mme-purple/50">This employee may have been removed.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-mme-pink/60 bg-white p-6 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
              employee.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
            }`}>
              {initials(employee.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-500">
                <AlertTriangle size={13} /> Missing / Late
              </div>
              <h1 className="truncate text-xl font-black text-mme-purple sm:text-2xl">{employee.fullName}</h1>
              <p className="truncate text-sm text-mme-purple/55">{employee.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                employee.role === "Admin" ? "bg-mme-purple/10 text-mme-purple" : "bg-mme-blush text-mme-plum"
              }`}>
                <Shield size={11} />
                {employee.role}
              </span>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <StatChip icon={CalendarClock} label="Missed Meetings" count={missedMeetings} tone="bg-red-50 text-red-600" />
            <StatChip icon={Phone} label="Missed Calls" count={missedCalls} tone="bg-red-50 text-red-600" />
          </div>

          <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className="border-b border-mme-pink/50 px-6 py-4">
              <span className="font-black text-mme-purple">Missing / Late Meetings &amp; Calls ({missed.length})</span>
            </div>
            <div className="p-6">
              {missed.length ? (
                <ul className="space-y-1.5">
                  {missed.map((entry, i) => (
                    <MissedEntryRow
                      key={`${entry.type}-${i}`}
                      entry={entry}
                      lateLabel={formatLateDuration(entry.datetime)}
                      backTo={`/admin-employee-management/${employee.id}/missed`}
                      backLabel={`Back to ${employee.fullName}'s missed list`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-mme-purple/40">No missing or late meetings/calls — nice and on track.</p>
              )}
            </div>
          </div>
        </>
      )}

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-2xl">
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
