import { NavLink } from "react-router";
import { CalendarDays, Gauge, LogOut, Phone, Shield, UsersRound, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin-dashboard", label: "Dashboard", icon: Gauge },
  { to: "/admin-employee-management", label: "Employee Management", icon: UsersRound },
  { to: "/admin/activity", label: "Meeting & Call Oversight", icon: Phone },
  { to: "/admin/calendar", label: "Company Calendar", icon: CalendarDays },
];

export default function AdminSidebar({ admin, onLogout, isOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-mme-purple/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-mme-pink/50 bg-white transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-mme-pink/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-mme-purple">Admin Portal</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum">Make My Event</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-mme-purple/50 transition hover:bg-mme-blush/40 hover:text-mme-purple lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-black transition-all duration-200 ${
                  isActive
                    ? "bg-mme-purple text-white shadow-md shadow-mme-purple/25"
                    : "text-mme-purple/70 hover:translate-x-1 hover:bg-mme-blush/40 hover:text-mme-purple"
                }`
              }
            >
              <Icon size={17} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-mme-pink/50 px-4 py-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-mme-pink/60 bg-[#fff9fc] px-3 py-2.5 text-xs font-bold text-mme-purple/70">
            <Shield size={13} className="shrink-0 text-mme-plum" />
            <span className="truncate">{admin?.fullName}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-3 py-2.5 text-xs font-black text-mme-purple transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
