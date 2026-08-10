import { useState } from "react";
import { Menu, Shield } from "lucide-react";
import AdminSidebar from "./AdminSidebar";

const SIDEBAR_COLLAPSED_KEY = "mme_admin_sidebar_collapsed";

// Shared shell for every authenticated admin page: fixed sidebar on desktop
// (collapsible to an icon-only rail, remembered across pages/reloads via
// localStorage), slide-in drawer (with overlay) on mobile/tablet.
export default function AdminLayout({ admin, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#fff9fc] lg:flex">
      <AdminSidebar
        admin={admin}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <div className={`min-w-0 flex-1 transition-[padding-left] duration-300 ease-out ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-mme-pink/50 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mme-pink/70 bg-white text-mme-purple transition hover:bg-mme-blush/40"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-mme-purple" />
            <p className="text-sm font-black text-mme-purple">Admin Portal</p>
          </div>
        </div>

        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>

  );
}
