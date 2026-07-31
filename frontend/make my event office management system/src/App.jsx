import { Navigate, Route, Routes } from "react-router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ManagementPage from "./pages/ManagementPage";
import ClientMeetingsPage from "./pages/ClientMeetingsPage";
import ClientCallsPage from "./pages/ClientCallsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";
import AdminPage from "./pages/AdminPage";
import RedirectIfAuthed from "./components/RedirectIfAuthed";

// Access control for /management* and /calendar* is enforced server-side
// now (see server.js's page-fallback guard + the requireEmployee API
// middleware) — an unauthenticated request for these paths never reaches
// this router at all, it gets redirected to /login before the SPA loads.
function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />

      <Route path="/management" element={<ManagementPage />} />
      <Route path="/management/meetings/:rowKey" element={<ClientMeetingsPage />} />
      <Route path="/management/calls/:rowKey" element={<ClientCallsPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/calendar/day/:date" element={<CalendarDayPage />} />
      <Route path="/admin" element={<AdminPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
