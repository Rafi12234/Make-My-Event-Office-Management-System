import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  Gauge,
  LayoutGrid,
  LogOut,
  Phone,
  Shield,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin-dashboard", label: "Dashboard", icon: Gauge },
  { to: "/admin-employee-management", label: "Employee Management", icon: UsersRound },
  { to: "/admin/clients-management", label: "Client Informations & Management", icon: LayoutGrid },
  { to: "/admin/activity", label: "Meeting & Call Oversight", icon: Phone },
  { to: "/admin/attendance", label: "Attendance Management", icon: Clock },
  { to: "/admin/calendar", label: "Company Calendar", icon: CalendarDays },
  // Financial Accounts — separate from Employee Management, which handles
  // login accounts/passwords rather than money.
  { to: "/admin/accounts", label: "Financial Accounts", icon: Wallet },
];

function initials(name) {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function AdminSidebar({ admin, onLogout, isOpen, onClose, collapsed, onToggleCollapse }) {
  // Drives the staggered nav-item entrance animation once, on first mount only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes navItemIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tooltipIn {
          from { opacity: 0; transform: translateX(-6px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(91,55,101,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(91,55,101,0); }
        }
        @keyframes drawerPanelIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .nav-item-enter {
          animation: navItemIn .4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sidebar-tooltip {
          animation: tooltipIn .18s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .logo-glow {
          animation: glowPulse 2.8s ease-in-out infinite;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(91,55,101,0.15);
          border-radius: 999px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(91,55,101,0.28);
        }
      `}</style>

      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-mme-purple/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-mme-pink/50 bg-white shadow-[4px_0_24px_rgba(91,55,101,0.04)] transition-all duration-300 ease-out lg:translate-x-0 ${
          collapsed ? "lg:w-20" : "lg:w-72"
        } ${isOpen ? "translate-x-0 duration-300" : "-translate-x-full duration-300"}`}
        style={isOpen ? { animation: "drawerPanelIn .32s cubic-bezier(0.22,1,0.36,1)" } : undefined}
      >
        {/* Desktop collapse/expand toggle — single icon that rotates 180° instead of swapping icons */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-mme-pink/60 bg-white text-mme-purple shadow-md transition-all duration-300 hover:scale-110 hover:bg-mme-blush/40 lg:flex"
        >
          <ChevronLeft
            size={14}
            className={`transition-transform duration-300 ease-out ${collapsed ? "rotate-180" : "rotate-0"}`}
          />
        </button>

        <div className="flex items-center justify-between gap-3 border-b border-mme-pink/50 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="logo-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20 transition-transform duration-300 hover:scale-105 hover:rotate-3">
              <Shield size={20} />
            </div>
            <div
              className={`min-w-0 overflow-hidden transition-all duration-300 ${
                collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"
              }`}
            >
              <p className="truncate text-base font-black text-mme-purple">Admin Portal</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum">Make My Event</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-mme-purple/50 transition hover:rotate-90 hover:bg-mme-blush/40 hover:text-mme-purple lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }, i) => (
            <div
              key={to}
              className={mounted ? "nav-item-enter" : "opacity-0"}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-2.5 text-sm font-black transition-all duration-200 ${
                    collapsed ? "lg:justify-center lg:px-0" : ""
                  } ${
                    isActive
                      ? "bg-mme-purple text-white shadow-md shadow-mme-purple/25"
                      : "text-mme-purple/70 hover:translate-x-1 hover:bg-mme-blush/40 hover:text-mme-purple"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active-route accent bar, animates in/out with a smooth scale */}
                    <span
                      className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white transition-transform duration-300 ${
                        isActive ? "scale-y-100" : "scale-y-0"
                      }`}
                    />
                    <Icon
                      size={17}
                      className="shrink-0 transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
                    />
                    <span
                      className={`truncate transition-all duration-300 ${
                        collapsed ? "lg:absolute lg:w-0 lg:opacity-0" : "lg:opacity-100"
                      }`}
                    >
                      {label}
                    </span>

                    {/* Tooltip shown only in collapsed desktop mode, on hover */}
                    {collapsed && (
                      <span
                        className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-20 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-mme-purple px-3 py-1.5 text-xs font-bold text-white shadow-lg group-hover:lg:block"
                      >
                        {label}
                        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-mme-purple" />
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="border-t border-mme-pink/50 px-4 py-4">
          <div
            className={`group relative mb-3 flex items-center gap-2.5 rounded-xl border border-mme-pink/60 bg-[#fff9fc] px-3 py-2.5 transition-all duration-200 hover:border-mme-pink hover:shadow-sm ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mme-purple text-[11px] font-black text-white transition-transform duration-200 group-hover:scale-105">
              {initials(admin?.fullName)}
            </span>
            <div
              className={`min-w-0 overflow-hidden transition-all duration-300 ${
                collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"
              }`}
            >
              <p className="truncate text-xs font-black text-mme-purple">{admin?.fullName}</p>
              <p className="truncate text-[10px] font-bold text-mme-plum">{admin?.role || "Administrator"}</p>
            </div>

            {collapsed && (
              <span className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-20 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-mme-purple px-3 py-1.5 text-xs font-bold text-white shadow-lg group-hover:lg:block">
                {admin?.fullName}
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-mme-purple" />
              </span>
            )}
          </div>

          <button
            onClick={onLogout}
            title={collapsed ? "Logout" : undefined}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-3 py-2.5 text-xs font-black text-mme-purple transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-500 hover:shadow-sm"
          >
            <LogOut size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span
              className={`transition-all duration-300 ${collapsed ? "lg:absolute lg:w-0 lg:opacity-0" : "lg:opacity-100"}`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}