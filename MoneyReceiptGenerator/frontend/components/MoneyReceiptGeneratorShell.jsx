import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import AdminLayout from "../../../frontend/make my event office management system/src/components/AdminLayout";
import { adminLogout, fetchAdminMe } from "../../../frontend/make my event office management system/src/services/adminService";
import { Receipt, History } from "lucide-react";

const SECTION_TABS = [
  { to: "/admin/money-receipts", label: "Generate Receipt", icon: Receipt },
  { to: "/admin/money-receipts/history", label: "Receipt History", icon: History },
];

// Wraps every Money Receipt Generator page: verifies the admin session once
// (redirects to /admin/login if not a valid admin — an employee session is
// already blocked earlier by BlockIfEmployeeSession in App.jsx, but the
// admin session itself still needs its own server round-trip check here,
// same pattern as AdminAccountsShell.jsx), renders the shared sidebar
// layout and this module's own sub-nav.
export default function MoneyReceiptGeneratorShell({ title, subtitle, actions, children }) {
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

      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-mme-pink/60 bg-white/80 p-1.5 shadow-sm backdrop-blur">
        {SECTION_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `group flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all duration-200 ${
                isActive
                  ? "bg-mme-purple text-white shadow-lg shadow-mme-purple/25"
                  : "text-mme-purple/70 hover:bg-mme-blush/40 hover:text-mme-purple"
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
