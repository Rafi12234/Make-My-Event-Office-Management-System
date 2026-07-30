import { Navigate, Route, Routes } from "react-router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ManagementPage from "./pages/ManagementPage";
import ClientMeetingsPage from "./pages/ClientMeetingsPage";
import ClientCallsPage from "./pages/ClientCallsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";
import AdminPage from "./pages/AdminPage";
import RequireAuth from "./components/RequireAuth";
import RedirectIfAuthed from "./components/RedirectIfAuthed";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />

      <Route path="/management" element={<RequireAuth><ManagementPage /></RequireAuth>} />
      <Route path="/management/meetings/:rowKey" element={<RequireAuth><ClientMeetingsPage /></RequireAuth>} />
      <Route path="/management/calls/:rowKey" element={<RequireAuth><ClientCallsPage /></RequireAuth>} />
      <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
      <Route path="/calendar/day/:date" element={<RequireAuth><CalendarDayPage /></RequireAuth>} />
      <Route path="/admin" element={<AdminPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
