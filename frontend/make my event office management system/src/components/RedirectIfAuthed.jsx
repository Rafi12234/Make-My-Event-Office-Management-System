import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { loadCurrentEmployee } from "../services/authStorage";
import { fetchAdminMe } from "../services/adminService";

// Reverse of RequireAuth: keeps an already-logged-in employee/admin away from
// the public landing/login pages so the only way back to them is to log out
// first (see handleLogout in ManagementPage / CalendarPage / CalendarDayPage /
// AdminDashboardPage). This also catches the browser's back button — even if
// it lands here, an active admin session bounces straight back to the
// dashboard instead of showing the landing page.
export default function RedirectIfAuthed({ children }) {
  const employee = loadCurrentEmployee();
  const [checkingAdmin, setCheckingAdmin] = useState(!employee);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (employee) return;
    fetchAdminMe()
      .then((me) => setIsAdmin(Boolean(me)))
      .finally(() => setCheckingAdmin(false));
  }, [employee]);

  if (employee) {
    return <Navigate to="/management" replace />;
  }

  if (checkingAdmin) return null;

  if (isAdmin) {
    return <Navigate to="/admin-dashboard" replace />;
  }

  return children;
}
