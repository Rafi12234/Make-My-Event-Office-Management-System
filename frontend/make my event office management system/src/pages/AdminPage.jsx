import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import BackButton from "../components/BackButton";
import AdminLayout from "../components/AdminLayout";
import {
  CalendarClock,
  Eye,
  Phone,
  Search,
  Settings2,
  UsersRound,
  X,
} from "lucide-react";
import { fetchAdminMe, adminLogout, fetchAllEmployees } from "../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../services/adminActivityService";
import { buildEmployeeActivity, initials } from "../utils/employeeActivity";
import { StatChip } from "../components/EmployeeActivityWidgets";

// ─── Employee Activity Row ───────────────────────────────────────────────────
// A flat, non-expanding row: stats at a glance, "eye" button opens the full
// per-employee record on its own dedicated page instead of an inline dropdown.
function EmployeeActivityRow({ bucket }) {
  const navigate = useNavigate();
  const { employee, previous, upcoming } = bucket;
  const completedMeetings = previous.filter((e) => e.type === "meeting").length;
  const completedCalls = previous.filter((e) => e.type === "call").length;
  const upcomingMeetings = upcoming.filter((e) => e.type === "meeting").length;
  const upcomingCalls = upcoming.filter((e) => e.type === "call").length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
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

      <button
        onClick={() => navigate(`/admin-employee-management/${employee.id}`)}
        title="View full employee record"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-purple hover:text-white"
      >
        <Eye size={13} /> View
      </button>
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

  const [nameQuery, setNameQuery] = useState("");

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

  // No date filter here — each employee's own record page has its own date range filter.
  const activity = useMemo(
    () => buildEmployeeActivity(employees, meetings, calls, "", ""),
    [employees, meetings, calls],
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

  const activeFilterCount = nameQuery ? 1 : 0;

  function clearFilters() {
    setNameQuery("");
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
            See every employee's completed and upcoming meetings/calls, filter by name, and manage accounts.
          </p>
        </div>

        {/* Manage Employee Accounts — link to its own dedicated page */}
        <button
          onClick={() => navigate("/admin-employee-management/accounts")}
          className="mb-6 flex w-full items-center justify-between rounded-3xl border border-mme-pink/60 bg-white px-6 py-4 shadow-[0_8px_30px_rgba(91,55,101,0.07)] transition hover:border-mme-pink hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
              <Settings2 size={17} />
            </div>
            <div className="text-left">
              <span className="block font-black text-mme-purple">Manage Employee Accounts</span>
              <span className="block text-xs font-bold text-mme-purple/45">Add a new employee or reset a password</span>
            </div>
          </div>
          <span className="text-xs font-black text-mme-purple/50">Open {"\u203a"}</span>
        </button>

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

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>
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
                  <EmployeeActivityRow key={bucket.employee.id} bucket={bucket} />
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Toast Notice */}
      {notice && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-2xl">
          <X className="mt-0.5 shrink-0" size={17} />
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
