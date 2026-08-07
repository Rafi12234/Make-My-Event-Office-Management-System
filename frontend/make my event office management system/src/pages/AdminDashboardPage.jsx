import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Gauge,
  LayoutGrid,
  PhoneCall,
  PhoneIncoming,
  Sparkles,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import { adminLogout, fetchAdminMe } from "../services/adminService";
import { fetchAdminDashboard } from "../services/adminDashboardService";

const CLIENTS_PREVIEW_COUNT = 10;

// Deterministic fallback palette so an employee without a saved colorHex
// still gets a distinct-looking avatar (mirrors the backend's calendar
// color assignment convention).
const AVATAR_PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#d97706",
  "#db2777", "#0e7490", "#4d7c0f", "#334155", "#c2410c",
];

function initialsFor(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// ─── Summary Stat Card ───────────────────────────────────────────────────
function StatCard({ icon, label, value, index }) {
  return (
    <div
      className="animate-[slideUp_0.5s_ease-out_both] rounded-3xl border border-mme-pink/60 bg-white p-5 shadow-[0_8px_30px_rgba(91,55,101,0.07)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(91,55,101,0.14)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black text-mme-purple sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-mme-purple/50">{label}</p>
    </div>
  );
}

// ─── Employee Row ─────────────────────────────────────────────────────────
function EmployeeRow({ employee, index }) {
  const avatarColor = employee.colorHex || AVATAR_PALETTE[index % AVATAR_PALETTE.length];

  return (
    <tr
      className="animate-[fadeIn_0.4s_ease-out_both] border-b border-mme-pink/40 last:border-b-0 hover:bg-[#fff9fc]"
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-white shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {initialsFor(employee.fullName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-black text-mme-purple">{employee.fullName}</p>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${employee.isActive ? "bg-emerald-500" : "bg-mme-purple/25"}`}
                title={employee.isActive ? "Active" : "Inactive"}
              />
            </div>
            <p className="truncate text-xs font-bold text-mme-purple/50">{employee.email}</p>
          </div>
          <span
            className={`ml-1 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
              employee.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
            }`}
          >
            {employee.role || "Employee"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 font-black text-mme-purple">
          <CalendarCheck2 size={13} className="text-mme-plum" /> {employee.meetingsDone}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 font-black text-mme-purple">
          <PhoneCall size={13} className="text-mme-plum" /> {employee.callsDone}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 font-black text-mme-purple">
          <CalendarClock size={13} className="text-mme-plum" /> {employee.upcomingMeetings}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 font-black text-mme-purple">
          <PhoneIncoming size={13} className="text-mme-plum" /> {employee.upcomingCalls}
        </span>
      </td>
    </tr>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────
function ClientRow({ client, rank, index }) {
  return (
    <tr
      className="animate-[fadeIn_0.4s_ease-out_both] border-b border-mme-pink/40 last:border-b-0 hover:bg-[#fff9fc]"
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <td className="px-4 py-3">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-mme-blush px-1.5 text-[11px] font-black text-mme-purple">
          {rank}
        </span>
      </td>
      <td className="px-4 py-3 font-black text-mme-purple">{client.clientName}</td>
      <td className="px-4 py-3 text-sm font-bold text-mme-purple/70">{client.venue || "—"}</td>
      <td className="px-4 py-3 text-sm font-bold text-mme-purple/70">{client.phone || "—"}</td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/admin-dashboard/clients/${client.rowKey}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-purple hover:text-white"
        >
          Show Details <ArrowUpRight size={13} />
        </Link>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);
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
    fetchAdminDashboard()
      .then(setDashboard)
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
    navigate("/admin/login", { replace: true });
  }

  const visibleClients = useMemo(() => {
    if (!dashboard) return [];
    return showAllClients ? dashboard.clients : dashboard.clients.slice(0, CLIENTS_PREVIEW_COUNT);
  }, [dashboard, showAllClients]);

  if (checkingSession || !admin) return null;

  const totals = dashboard?.totals;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        {/* Page Title */}
        <div className="mb-7 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <Gauge size={14} /> System Overview
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1.5 text-sm text-mme-purple/55">
            A live snapshot of every employee's activity and your most engaged clients.
          </p>
        </div>

        {isLoading && !dashboard ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
          </div>
        ) : dashboard ? (
          <>
            {/* Summary Stats */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <StatCard index={0} icon={<Users size={17} />} label="Employees" value={totals.employees} />
              <StatCard index={1} icon={<UsersRound size={17} />} label="Active" value={totals.activeEmployees} />
              <StatCard index={2} icon={<CalendarCheck2 size={17} />} label="Meetings Done" value={totals.meetingsDone} />
              <StatCard index={3} icon={<PhoneCall size={17} />} label="Calls Done" value={totals.callsDone} />
              <StatCard index={4} icon={<CalendarClock size={17} />} label="Upcoming Meetings" value={totals.upcomingMeetings} />
              <StatCard index={5} icon={<PhoneIncoming size={17} />} label="Upcoming Calls" value={totals.upcomingCalls} />
              <StatCard index={6} icon={<LayoutGrid size={17} />} label="Total Clients" value={totals.clients} />
            </div>

            {/* Employees Section */}
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                  <UsersRound size={17} />
                </div>
                <h2 className="font-black text-mme-purple">All Employees</h2>
                <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                  {dashboard.employees.length} total
                </span>
              </div>

              {dashboard.employees.length ? (
                <div className="overflow-x-auto rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-mme-pink/50 bg-[#fff9fc] text-left text-[11px] font-black uppercase tracking-[0.1em] text-mme-plum">
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 text-center">Meetings Done</th>
                        <th className="px-4 py-3 text-center">Calls Done</th>
                        <th className="px-4 py-3 text-center">Upcoming Meetings</th>
                        <th className="px-4 py-3 text-center">Upcoming Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.employees.map((employee, index) => (
                        <EmployeeRow key={employee.id} employee={employee} index={index} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-mme-pink/60 bg-white px-6 py-10 text-center text-sm font-bold text-mme-purple/50">
                  No employees found.
                </p>
              )}
            </section>

            {/* Clients Section */}
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                  <Sparkles size={17} />
                </div>
                <h2 className="font-black text-mme-purple">
                  {showAllClients ? "All Clients" : "Top Clients"}
                </h2>
                <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
                  {showAllClients ? dashboard.clients.length : Math.min(CLIENTS_PREVIEW_COUNT, dashboard.clients.length)} of {dashboard.clients.length}
                </span>
              </div>

              {dashboard.clients.length ? (
                <>
                  <div className="overflow-x-auto rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-mme-pink/50 bg-[#fff9fc] text-left text-[11px] font-black uppercase tracking-[0.1em] text-mme-plum">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Client Name</th>
                          <th className="px-4 py-3">Venue</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleClients.map((client, index) => (
                          <ClientRow key={client.rowKey} client={client} rank={index + 1} index={index} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {dashboard.clients.length > CLIENTS_PREVIEW_COUNT && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setShowAllClients((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-mme-pink/70 bg-white px-5 py-2.5 text-sm font-black text-mme-purple shadow-[0_8px_30px_rgba(91,55,101,0.07)] transition hover:bg-mme-blush/40"
                      >
                        {showAllClients ? (
                          <>
                            <ChevronUp size={16} /> Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} /> See More ({dashboard.clients.length - CLIENTS_PREVIEW_COUNT} more)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-2xl border border-dashed border-mme-pink/60 bg-white px-6 py-10 text-center text-sm font-bold text-mme-purple/50">
                  No clients found yet.
                </p>
              )}
            </section>
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
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </AdminLayout>
  );
}
