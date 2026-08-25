import { useState } from "react";
import { useNavigate } from "react-router";
import { Menu } from "lucide-react";
import EmployeeSidebar from "./EmployeeSidebar";
import ConfirmDialog from "./ConfirmDialog";
import { clearCurrentEmployee, loadCurrentEmployee } from "../services/authStorage";

const SIDEBAR_COLLAPSED_KEY = "mme_employee_sidebar_collapsed";

// Shared shell for employee-facing pages (Management, Accounts): fixed
// sidebar rail on desktop (collapsible to an icon-only rail, remembered
// across pages/reloads via localStorage); on mobile/tablet the sidebar is
// off-canvas and opened via a floating button (each page keeps its own
// existing sticky header untouched).
export default function EmployeeLayout({ children }) {
  const navigate = useNavigate();
  const [employee] = useState(() => loadCurrentEmployee());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  function confirmLogout() {
    setShowLogoutConfirm(false);
    clearCurrentEmployee();
    navigate("/", { replace: true });
  }

  return (
    <div className="lg:flex">
      <EmployeeSidebar
        employee={employee}
        onLogout={() => setShowLogoutConfirm(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <button
        onClick={() => setSidebarOpen(true)}
        title="Open menu"
        className={`group fixed bottom-5 right-5 z-[100] flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-[#301934] to-black text-white shadow-xl shadow-black/30 ring-1 ring-white/10 transition-all duration-300 ease-out hover:scale-105 hover:shadow-2xl hover:shadow-[#301934]/40 active:scale-90 lg:hidden ${
          sidebarOpen ? "scale-90 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <Menu size={20} className="transition-transform duration-300 group-hover:rotate-180" />
      </button>

      <div className={`min-w-0 flex-1 transition-all duration-300 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>{children}</div>

      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to access your workspace."
          confirmLabel="Log out"
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}