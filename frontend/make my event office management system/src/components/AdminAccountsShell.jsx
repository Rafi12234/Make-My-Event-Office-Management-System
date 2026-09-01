import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
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
  const location = useLocation();
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
      <div className="acc-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <nav
        className="acc-fade-up mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-rose-100 bg-white/80 p-1.5 shadow-sm backdrop-blur"
        style={{ animationDelay: "60ms" }}
      >
        {SECTION_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `acc-press group relative flex items-center gap-2 overflow-hidden rounded-xl px-3.5 py-2 text-sm font-bold ${
                isActive
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-600 hover:bg-rose-50 hover:text-rose-600"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  className={`transition-transform duration-300 ${
                    isActive ? "scale-110" : "group-hover:scale-110 group-hover:-rotate-6"
                  }`}
                />
                {label}
                {/* Grows out from the centre on hover for inactive tabs. */}
                <span
                  className={`absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-rose-400 transition-all duration-300 ${
                    isActive ? "" : "group-hover:w-5"
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Keyed on pathname so the body re-animates on every navigation. */}
      <div
        key={location.pathname}
        className="acc-section acc-fade-up"
        style={{ animationDelay: "110ms" }}
      >
        {children}
      </div>
    </AdminLayout>
  );
}
