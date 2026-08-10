import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ManagementPage from "./pages/ManagementPage";
import ClientMeetingsPage from "./pages/ClientMeetingsPage";
import ClientCallsPage from "./pages/ClientCallsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";
import AdminPage from "./pages/AdminPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminClientDetailPage from "./pages/AdminClientDetailPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import AdminMeetingDetailsPage from "./pages/admin/AdminMeetingDetailsPage";
import AdminCallDetailsPage from "./pages/admin/AdminCallDetailsPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminCalendarDayPage from "./pages/admin/AdminCalendarDayPage";
import AdminClientsManagementPage from "./pages/admin/AdminClientsManagementPage";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequirePasswordChange from "./components/RequirePasswordChange";

// history.scrollRestoration is set to "manual" in main.jsx, so nothing
// scrolls automatically anymore — reset to the top on every route change
// except /management, which restores its own remembered scroll position
// (see ManagementPage) instead of always jumping to the top.
function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/management") return;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

// Access control for /management* and /calendar* is enforced server-side
// now (see server.js's page-fallback guard + the requireEmployee API
// middleware) — an unauthenticated request for these paths never reaches
// this router at all, it gets redirected to /login before the SPA loads.
function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
        <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route path="/management" element={<RequirePasswordChange><ManagementPage /></RequirePasswordChange>} />
        <Route path="/management/meetings/:rowKey" element={<RequirePasswordChange><ClientMeetingsPage /></RequirePasswordChange>} />
        <Route path="/management/calls/:rowKey" element={<RequirePasswordChange><ClientCallsPage /></RequirePasswordChange>} />
        <Route path="/calendar" element={<RequirePasswordChange><CalendarPage /></RequirePasswordChange>} />
        <Route path="/calendar/day/:date" element={<RequirePasswordChange><CalendarDayPage /></RequirePasswordChange>} />
        <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin-dashboard/clients/:rowKey" element={<AdminClientDetailPage />} />
        <Route path="/admin-employee-management" element={<AdminPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/activity" element={<AdminActivityPage />} />
        <Route path="/admin/activity/meetings/:rowKey" element={<AdminMeetingDetailsPage />} />
        <Route path="/admin/activity/calls/:rowKey" element={<AdminCallDetailsPage />} />
        <Route path="/admin/calendar" element={<AdminCalendarPage />} />
        <Route path="/admin/calendar/day/:date" element={<AdminCalendarDayPage />} />
        <Route path="/admin/clients-management" element={<AdminClientsManagementPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;

