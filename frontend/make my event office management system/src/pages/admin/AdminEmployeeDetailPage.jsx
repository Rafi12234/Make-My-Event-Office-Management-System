import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { AlertTriangle, CalendarClock, Phone, Shield, UsersRound, X } from "lucide-react";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";
import { buildEmployeeActivity, initials, isOverdueDatetime } from "../../utils/employeeActivity";
import { RoutineEntryRow, StatChip } from "../../components/EmployeeActivityWidgets";

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function relativeDateValue(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return toDateInputValue(d);
}


export default function AdminEmployeeDetailPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

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

  const bucket = useMemo(() => {
    if (!employee) return null;
    return buildEmployeeActivity([employee], meetings, calls, dateFrom, dateTo)[0];
  }, [employee, meetings, calls, dateFrom, dateTo]);

  // Always all-time (ignores the date filter above) — missed schedules stay
  // relevant no matter what range is currently shown.
  const missedCount = useMemo(() => {
    if (!employee) return 0;
    const allTimeBucket = buildEmployeeActivity([employee], meetings, calls, "", "")[0];
    return allTimeBucket.upcoming.filter((entry) => isOverdueDatetime(entry.datetime)).length;
  }, [employee, meetings, calls]);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
  }

  function applyRelativeDay(dayOffset) {
    const value = relativeDateValue(dayOffset);
    setDateFrom(value);
    setDateTo(value);
  }

  const yesterdayValue = relativeDateValue(-1);
  const tomorrowValue = relativeDateValue(1);
  const isYesterdayActive = dateFrom === yesterdayValue && dateTo === yesterdayValue;
  const isTomorrowActive = dateFrom === tomorrowValue && dateTo === tomorrowValue;

  const filteredPrevious = useMemo(() => {
    if (!bucket) return [];
    return typeFilter === "all" ? bucket.previous : bucket.previous.filter((e) => e.type === typeFilter);
  }, [bucket, typeFilter]);

  const filteredUpcoming = useMemo(() => {
    if (!bucket) return [];
    return typeFilter === "all" ? bucket.upcoming : bucket.upcoming.filter((e) => e.type === typeFilter);
  }, [bucket, typeFilter]);

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-5">
        <BackButton to="/admin-employee-management" title="Back to Employee Management" />
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
          {/* Employee identity header */}
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-mme-pink/60 bg-white p-6 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
              employee.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
            }`}>
              {initials(employee.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-black text-mme-purple sm:text-2xl">{employee.fullName}</h1>
              <p className="truncate text-sm text-mme-purple/55">{employee.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                employee.role === "Admin" ? "bg-mme-purple/10 text-mme-purple" : "bg-mme-blush text-mme-plum"
              }`}>
                {employee.role === "Admin" ? <Shield size={11} /> : <UsersRound size={11} />}
                {employee.role}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                employee.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
              }`}>
                {employee.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Missing / Late Meetings & Calls — dedicated page */}
          <button
            onClick={() => navigate(`/admin-employee-management/${employee.id}/missed`)}
            className="mb-6 flex w-full items-center justify-between rounded-3xl border border-mme-pink/60 bg-white px-6 py-4 shadow-[0_8px_30px_rgba(91,55,101,0.07)] transition hover:border-mme-pink hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <AlertTriangle size={17} />
              </div>
              <div className="text-left">
                <span className="block font-black text-mme-purple">Missing / Late Meetings &amp; Calls</span>
                <span className="block text-xs font-bold text-mme-purple/45">Schedules that passed without being fulfilled</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {missedCount > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-600">{missedCount}</span>
              )}
              <span className="text-xs font-black text-mme-purple/50">Open {"\u203a"}</span>
            </div>
          </button>

          {/* Date range filter for this employee's routine */}
          <div className="mb-6 rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className="flex flex-wrap items-end gap-4">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => applyRelativeDay(-1)}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                    isYesterdayActive
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40"
                  }`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => applyRelativeDay(1)}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                    isTomorrowActive
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40"
                  }`}
                >
                  Tomorrow
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                    typeFilter === "all"
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter("meeting")}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                    typeFilter === "meeting"
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40"
                  }`}
                >
                  <CalendarClock size={13} /> Meeting
                </button>
                <button
                  onClick={() => setTypeFilter("call")}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                    typeFilter === "call"
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:bg-mme-blush/40"
                  }`}
                >
                  <Phone size={13} /> Call
                </button>
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
                >
                  <X size={13} /> Clear
                </button>
              )}
            </div>
            {(dateFrom || dateTo) && (
              <p className="mt-3 text-xs font-bold text-mme-purple/50">
                Within this range: past dates show completed meetings/calls, future dates show upcoming ones {"\u2014"} a range spanning today shows both.
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <StatChip
              icon={CalendarClock}
              label="Meetings Done"
              count={bucket.previous.filter((e) => e.type === "meeting").length}
              tone="bg-mme-blush text-mme-plum"
            />
            <StatChip
              icon={Phone}
              label="Calls Done"
              count={bucket.previous.filter((e) => e.type === "call").length}
              tone="bg-mme-blush text-mme-plum"
            />
            <StatChip
              icon={CalendarClock}
              label="Upcoming Meetings"
              count={bucket.upcoming.filter((e) => e.type === "meeting").length}
              tone="bg-mme-purple/10 text-mme-purple"
            />
            <StatChip
              icon={Phone}
              label="Upcoming Calls"
              count={bucket.upcoming.filter((e) => e.type === "call").length}
              tone="bg-mme-purple/10 text-mme-purple"
            />
          </div>

          {/* Previous + Upcoming routine */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <div className="border-b border-mme-pink/50 px-6 py-4">
                <span className="font-black text-mme-purple">Previous {"\u2014"} Completed ({filteredPrevious.length})</span>
              </div>
              <div className="p-6">
                {filteredPrevious.length ? (
                  <ul className="space-y-1.5">
                    {filteredPrevious.map((entry, i) => (
                      <RoutineEntryRow
                        key={`p-${i}`}
                        entry={entry}
                        backTo={`/admin-employee-management/${employee.id}`}
                        backLabel={`Back to ${employee.fullName}'s record`}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-mme-purple/40">No completed meetings/calls in this range.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <div className="border-b border-mme-pink/50 px-6 py-4">
                <span className="font-black text-mme-purple">Upcoming ({filteredUpcoming.length})</span>
              </div>
              <div className="p-6">
                {filteredUpcoming.length ? (
                  <ul className="space-y-1.5">
                    {filteredUpcoming.map((entry, i) => (
                      <RoutineEntryRow
                        key={`u-${i}`}
                        entry={entry}
                        backTo={`/admin-employee-management/${employee.id}`}
                        backLabel={`Back to ${employee.fullName}'s record`}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-mme-purple/40">No upcoming meetings/calls in this range.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {notice && (
        <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-mme-pink bg-white text-mme-purple"
        }`}>
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
