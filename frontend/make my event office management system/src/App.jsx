import { Navigate, Route, Routes } from "react-router";
import LandingPage from "./pages/LandingPage";
import ManagementPage from "./pages/ManagementPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/management" element={<ManagementPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/calendar/day/:date" element={<CalendarDayPage />} />

      {/* Login and registration files are kept, but their routes are disabled for now. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
