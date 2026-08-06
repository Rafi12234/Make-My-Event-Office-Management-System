import { Navigate, Route, Routes } from "react-router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ManagementPage from "./pages/ManagementPage";
import ClientMeetingsPage from "./pages/ClientMeetingsPage";
import ClientCallsPage from "./pages/ClientCallsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";
import AdminPage from "./pages/AdminPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminCalendarDayPage from "./pages/admin/AdminCalendarDayPage";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequirePasswordChange from "./components/RequirePasswordChange";

// Access control for /management* and /calendar* is enforced server-side
// now (see server.js's page-fallback guard + the requireEmployee API
// middleware) — an unauthenticated request for these paths never reaches
// this router at all, it gets redirected to /login before the SPA loads.
function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route path="/management" element={<RequirePasswordChange><ManagementPage /></RequirePasswordChange>} />
      <Route path="/management/meetings/:rowKey" element={<RequirePasswordChange><ClientMeetingsPage /></RequirePasswordChange>} />
      <Route path="/management/calls/:rowKey" element={<RequirePasswordChange><ClientCallsPage /></RequirePasswordChange>} />
      <Route path="/calendar" element={<RequirePasswordChange><CalendarPage /></RequirePasswordChange>} />
      <Route path="/calendar/day/:date" element={<RequirePasswordChange><CalendarDayPage /></RequirePasswordChange>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/activity" element={<AdminActivityPage />} />
      <Route path="/admin/calendar" element={<AdminCalendarPage />} />
      <Route path="/admin/calendar/day/:date" element={<AdminCalendarDayPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

