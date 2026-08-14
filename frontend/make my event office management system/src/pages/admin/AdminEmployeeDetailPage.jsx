import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Filter,
  Mail,
  Phone,
  Shield,
  UsersRound,
  X,
} from "lucide-react";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";
import { buildEmployeeActivity, formatLateDuration, initials, isOverdueDatetime } from "../../utils/employeeActivity";
import { MissedEntryRow, RoutineEntryRow, StatChip } from "../../components/EmployeeActivityWidgets";

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

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [toDateInputValue(monday), toDateInputValue(sunday)];
}

const TYPE_OPTIONS = [
  { key: "all", label: "All Activity", icon: null },
  { key: "meeting", label: "Meetings", icon: CalendarClock },
  { key: "call", label: "Calls", icon: Phone },
];

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

  // Always all-time — used for header quick-stats + the missed counter, so an
  // admin gets the real picture regardless of whatever date filter is active.
  const allTimeBucket = useMemo(() => {
    if (!employee) return null;
    return buildEmployeeActivity([employee], meetings, calls, "", "")[0];
  }, [employee, meetings, calls]);

  const missedCount = useMemo(() => {
    if (!allTimeBucket) return 0;
    return allTimeBucket.upcoming.filter((entry) => isOverdueDatetime(entry.datetime)).length;
  }, [allTimeBucket]);

  function clearDateFilters() {
    setDateFrom("");
    setDateTo("");
  }

  function applyRelativeDay(dayOffset) {
    const value = relativeDateValue(dayOffset);
    setDateFrom(value);
    setDateTo(value);
  }

  function applyThisWeek() {
    const [from, to] = currentWeekRange();
    setDateFrom(from);
    setDateTo(to);
  }

  const todayValue = relativeDateValue(0);
  const yesterdayValue = relativeDateValue(-1);
  const tomorrowValue = relativeDateValue(1);
  const [weekStart, weekEnd] = currentWeekRange();

  const isAllTimeActive = !dateFrom && !dateTo;
  const isTodayActive = dateFrom === todayValue && dateTo === todayValue;
  const isYesterdayActive = dateFrom === yesterdayValue && dateTo === yesterdayValue;
  const isTomorrowActive = dateFrom === tomorrowValue && dateTo === tomorrowValue;
  const isThisWeekActive = dateFrom === weekStart && dateTo === weekEnd;

  const filteredPrevious = useMemo(() => {
    if (!bucket) return [];
    return typeFilter === "all" ? bucket.previous : bucket.previous.filter((e) => e.type === typeFilter);
  }, [bucket, typeFilter]);

  const filteredUpcoming = useMemo(() => {
    if (!bucket) return [];
    return typeFilter === "all" ? bucket.upcoming : bucket.upcoming.filter((e) => e.type === typeFilter);
  }, [bucket, typeFilter]);

  // "Assigned" = every meeting/call scheduled to fall within the selected
  // range, split further into what's already Completed vs. still-pending
  // "upcoming" scheduled items whose time has already passed = Missed.
  const rangeMeetingsAssigned = useMemo(() => filteredUpcoming.filter((e) => e.type === "meeting").length, [filteredUpcoming]);
  const rangeCallsAssigned = useMemo(() => filteredUpcoming.filter((e) => e.type === "call").length, [filteredUpcoming]);
  const rangeMeetingsDone = useMemo(() => filteredPrevious.filter((e) => e.type === "meeting").length, [filteredPrevious]);
  const rangeCallsDone = useMemo(() => filteredPrevious.filter((e) => e.type === "call").length, [filteredPrevious]);
  const rangeMeetingsMissed = useMemo(
    () => filteredUpcoming.filter((e) => e.type === "meeting" && isOverdueDatetime(e.datetime)).length,
    [filteredUpcoming],
  );
  const rangeCallsMissed = useMemo(
    () => filteredUpcoming.filter((e) => e.type === "call" && isOverdueDatetime(e.datetime)).length,
    [filteredUpcoming],
  );
  const rangeTotalAssigned = rangeMeetingsAssigned + rangeCallsAssigned;
  const rangeTotalDone = rangeMeetingsDone + rangeCallsDone;
  const rangeTotalMissed = rangeMeetingsMissed + rangeCallsMissed;

  // "Upcoming" must only ever mean genuinely-future items — an assigned item
  // whose scheduled time has already passed (relative to now, not the
  // selected range) is Missed instead, regardless of which range is picked.
  const filteredUpcomingMissed = useMemo(
    () => filteredUpcoming.filter((e) => isOverdueDatetime(e.datetime)),
    [filteredUpcoming],
  );
  const filteredUpcomingFuture = useMemo(
    () => filteredUpcoming.filter((e) => !isOverdueDatetime(e.datetime)),
    [filteredUpcoming],
  );

  const rangeLabel = isAllTimeActive
    ? "All Time"
    : isTodayActive
      ? "Today"
      : isYesterdayActive
        ? "Yesterday"
        : isTomorrowActive
          ? "Tomorrow"
          : isThisWeekActive
            ? "This Week"
            : dateFrom && dateTo
              ? dateFrom === dateTo
                ? dateFrom
                : `${dateFrom} → ${dateTo}`
              : dateFrom
                ? `From ${dateFrom}`
                : dateTo
                  ? `Until ${dateTo}`
                  : "All Time";

  const activeTypeIndex = TYPE_OPTIONS.findIndex((o) => o.key === typeFilter);
  const listKey = `${dateFrom}|${dateTo}|${typeFilter}`;

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseSoft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          50% { box-shadow: 0 0 0 9px rgba(239,68,68,0); }
        }
        .animate-fadeInUp { animation: fadeInUp .45s cubic-bezier(0.22,1,0.36,1) both; }
        .animate-fadeIn { animation: fadeIn .35s ease both; }
        .animate-pulseSoft { animation: pulseSoft 2s ease-in-out infinite; }
      `}</style>

      <div className="mb-5">
        <BackButton to="/admin-employee-management" title="Back to Employee Management" />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-mme-pink border-t-mme-purple" />
          <p className="text-sm font-bold text-mme-purple/50">Loading employee activity…</p>
        </div>
      ) : !employee ? (
        <div className="animate-fadeInUp rounded-3xl border border-mme-pink/60 bg-white p-10 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <UsersRound size={34} className="mx-auto text-mme-mauve" />
          <p className="mt-4 font-black text-mme-purple">Employee not found</p>
          <p className="mt-1 text-sm text-mme-purple/50">This employee may have been removed.</p>
        </div>
      ) : (
        <>
          {/* Employee identity header */}
          <div className="animate-fadeInUp mb-5 rounded-3xl border border-mme-pink/60 bg-gradient-to-br from-white to-mme-blush/25 p-6 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className="flex flex-wrap items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-md ring-4 ring-white transition-transform duration-300 hover:scale-105 ${
                  employee.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
                }`}
              >
                {initials(employee.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-black text-mme-purple sm:text-2xl">{employee.fullName}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-mme-purple/55">
                  <Mail size={13} /> {employee.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-transform hover:scale-105 ${
                    employee.role === "Admin" ? "bg-mme-purple/10 text-mme-purple" : "bg-mme-blush text-mme-plum"
                  }`}
                >
                  {employee.role === "Admin" ? <Shield size={12} /> : <UsersRound size={12} />}
                  {employee.role}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-transform hover:scale-105 ${
                    employee.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${employee.isActive ? "bg-green-500" : "bg-red-500"}`} />
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* At-a-glance, all-time numbers — no filters, no clicks needed */}
            {allTimeBucket && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-mme-pink/40 pt-4">
                <StatChip
                  icon={CalendarClock}
                  label="Meetings Done (All Time)"
                  count={allTimeBucket.previous.filter((e) => e.type === "meeting").length}
                  tone="bg-mme-blush text-mme-plum"
                />
                <StatChip
                  icon={Phone}
                  label="Calls Done (All Time)"
                  count={allTimeBucket.previous.filter((e) => e.type === "call").length}
                  tone="bg-mme-blush text-mme-plum"
                />
                <StatChip
                  icon={CalendarClock}
                  label="Upcoming (All Time)"
                  count={allTimeBucket.upcoming.length}
                  tone="bg-mme-purple/10 text-mme-purple"
                />
                <StatChip
                  icon={AlertTriangle}
                  label="Missed"
                  count={missedCount}
                  tone={missedCount > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}
                />
              </div>
            )}
          </div>

          {/* Missed / all-clear banner — the single most important thing on this page */}
          {missedCount > 0 ? (
            <button
              onClick={() => navigate(`/admin-employee-management/${employee.id}/missed`)}
              className="group animate-fadeInUp mb-6 w-full rounded-3xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="animate-pulseSoft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white">
                    <AlertTriangle size={22} />
                  </span>
                  <div>
                    <p className="text-base font-black text-red-700 sm:text-lg">
                      {missedCount} missed {missedCount === 1 ? "item needs" : "items need"} attention
                    </p>
                    <p className="text-xs font-bold text-red-500/70 sm:text-sm">
                      Meetings or calls that passed their scheduled time without being fulfilled.
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition-all duration-300 group-hover:gap-2.5 group-hover:bg-red-700">
                  Review Now <ChevronRight size={14} />
                </span>
              </div>
            </button>
          ) : (
            <div className="animate-fadeInUp mb-6 flex items-center gap-4 rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <p className="font-black text-green-700">All caught up!</p>
                <p className="text-xs font-bold text-green-600/70">No missed meetings or calls for this employee.</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="animate-fadeInUp mb-6 rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={15} className="text-mme-plum" />
              <span className="text-xs font-black uppercase tracking-[0.16em] text-mme-plum">Filter Activity</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "All Time", active: isAllTimeActive, onClick: clearDateFilters },
                { label: "Today", active: isTodayActive, onClick: () => applyRelativeDay(0) },
                { label: "Yesterday", active: isYesterdayActive, onClick: () => applyRelativeDay(-1) },
                { label: "Tomorrow", active: isTomorrowActive, onClick: () => applyRelativeDay(1) },
                { label: "This Week", active: isThisWeekActive, onClick: applyThisWeek },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={preset.onClick}
                  className={`rounded-xl border px-4 py-2 text-xs font-black transition-all duration-200 ${
                    preset.active
                      ? "border-mme-purple bg-mme-purple text-white shadow-sm"
                      : "border-mme-pink/70 bg-white text-mme-purple hover:-translate-y-0.5 hover:bg-mme-blush/40"
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDateFilters}
                  className="animate-fadeIn inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-500 transition hover:bg-red-100"
                >
                  <X size={13} /> Clear Dates
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-mme-pink/40 pt-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                  Custom From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3.5 py-2.5 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                  Custom To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3.5 py-2.5 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
              </div>

              <div className="ml-auto">
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-mme-purple/45">
                  Type
                </label>
                <div className="relative inline-flex rounded-xl border border-mme-pink/70 bg-[#fff9fc] p-1">
                  <div
                    className="absolute inset-y-1 rounded-lg bg-mme-purple shadow transition-all duration-300 ease-out"
                    style={{
                      width: `calc(${100 / TYPE_OPTIONS.length}% - 4px)`,
                      left: `calc(${activeTypeIndex * (100 / TYPE_OPTIONS.length)}% + 2px)`,
                    }}
                  />
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setTypeFilter(opt.key)}
                      className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black transition-colors duration-300 ${
                        typeFilter === opt.key ? "text-white" : "text-mme-purple hover:text-mme-plum"
                      }`}
                    >
                      {opt.icon ? <opt.icon size={13} /> : null} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(dateFrom || dateTo) && (
              <p className="animate-fadeIn mt-4 rounded-xl bg-mme-blush/40 px-3.5 py-2.5 text-xs font-bold text-mme-purple/60">
                Within this range: past dates show completed meetings/calls, future dates show upcoming ones — a
                range spanning today shows both.
              </p>
            )}
          </div>

          {/* Assigned vs. Completed vs. Missed — instantly visible for whatever date/range is selected */}
          <div className="animate-fadeInUp mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-mme-purple/40">
                Showing:
              </span>
              <span className="rounded-full bg-mme-purple/10 px-3 py-1 text-xs font-black text-mme-purple">
                {rangeLabel}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-mme-purple/45">Assigned</p>
                <p className="mt-1 text-3xl font-black text-mme-purple">{rangeTotalAssigned}</p>
                <p className="mt-1 text-xs font-bold text-mme-purple/55">
                  {rangeMeetingsAssigned} meetings · {rangeCallsAssigned} calls
                </p>
              </div>

              <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-green-700/80">Completed</p>
                <p className="mt-1 text-3xl font-black text-green-700">{rangeTotalDone}</p>
                <p className="mt-1 text-xs font-bold text-green-600/80">
                  {rangeMeetingsDone} meetings · {rangeCallsDone} calls
                </p>
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm ${
                  rangeTotalMissed > 0 ? "border-red-200 bg-red-50" : "border-mme-pink/60 bg-white"
                }`}
              >
                <p
                  className={`text-[11px] font-black uppercase tracking-[0.14em] ${
                    rangeTotalMissed > 0 ? "text-red-600/80" : "text-mme-purple/45"
                  }`}
                >
                  Missed
                </p>
                <p className={`mt-1 text-3xl font-black ${rangeTotalMissed > 0 ? "text-red-600" : "text-mme-purple"}`}>
                  {rangeTotalMissed}
                </p>
                <p className={`mt-1 text-xs font-bold ${rangeTotalMissed > 0 ? "text-red-500/80" : "text-mme-purple/55"}`}>
                  {rangeMeetingsMissed} meetings · {rangeCallsMissed} calls
                </p>
              </div>
            </div>
          </div>

          {/* Completed / Missed / Upcoming routine — "Upcoming" only ever holds genuinely-future items */}
          <div key={listKey} className="animate-fadeIn grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
                <span className="font-black text-mme-purple">Completed</span>
                <span className="rounded-full bg-mme-blush px-2.5 py-1 text-xs font-black text-mme-plum">
                  {filteredPrevious.length}
                </span>
              </div>
              <div className="p-6">
                {filteredPrevious.length ? (
                  <ul className="space-y-1.5">
                    {filteredPrevious.map((entry, i) => (
                      <RoutineEntryRow
                        key={`p-${i}`}
                        entry={entry}
                        index={i}
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
              <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
                <span className="font-black text-red-600">Missed</span>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-600">
                  {filteredUpcomingMissed.length}
                </span>
              </div>
              <div className="p-6">
                {filteredUpcomingMissed.length ? (
                  <ul className="space-y-1.5">
                    {filteredUpcomingMissed.map((entry, i) => (
                      <MissedEntryRow
                        key={`m-${i}`}
                        entry={entry}
                        lateLabel={formatLateDuration(entry.datetime)}
                        index={i}
                        backTo={`/admin-employee-management/${employee.id}`}
                        backLabel={`Back to ${employee.fullName}'s record`}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-mme-purple/40">No missed meetings/calls in this range.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
                <span className="font-black text-mme-purple">Upcoming</span>
                <span className="rounded-full bg-mme-purple/10 px-2.5 py-1 text-xs font-black text-mme-purple">
                  {filteredUpcomingFuture.length}
                </span>
              </div>
              <div className="p-6">
                {filteredUpcomingFuture.length ? (
                  <ul className="space-y-1.5">
                    {filteredUpcomingFuture.map((entry, i) => (
                      <RoutineEntryRow
                        key={`u-${i}`}
                        entry={entry}
                        index={i}
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
        <div
          className={`animate-fadeInUp fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-mme-pink bg-white text-mme-purple"
          }`}
        >
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 transition hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}