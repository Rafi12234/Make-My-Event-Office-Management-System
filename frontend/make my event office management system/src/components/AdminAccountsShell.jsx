import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import AdminLayout from "./AdminLayout";
import { adminLogout, fetchAdminMe } from "../services/adminService";
import {
  Banknote,
  ClipboardList,
  CalendarRange,
  Gauge,
  History,
  Store,
  UsersRound,
} from "lucide-react";

const SECTION_TABS = [
  { to: "/admin/accounts", label: "Overview", icon: Gauge, end: true },
  { to: "/admin/accounts/employees", label: "Employees", icon: UsersRound },
  { to: "/admin/accounts/money-in", label: "Money In", icon: Banknote },
  { to: "/admin/accounts/expenses", label: "Expenses", icon: ClipboardList },
  { to: "/admin/accounts/events", label: "Events", icon: CalendarRange },
  { to: "/admin/accounts/vendors", label: "Vendors", icon: Store },
  { to: "/admin/accounts/audit", label: "Audit", icon: History },
];

// Wraps every Admin Accounts page: verifies the admin session once,
// renders the shared sidebar layout and the section sub-nav, so each page
// only has to render its own body.
export default function AdminAccountsShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-rose-100 bg-white/80 p-1.5 shadow-sm">
        {SECTION_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                isActive
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow"
                  : "text-slate-600 hover:bg-rose-50 hover:text-rose-600"
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {children}
    </AdminLayout>
  );
}
