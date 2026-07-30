import { Navigate } from "react-router";
import { loadCurrentEmployee } from "../services/managementStorage";

// Reverse of RequireAuth: keeps an already-logged-in employee away from the
// public landing/login pages so the only way back to them is to log out
// first (see handleLogout in ManagementPage / CalendarPage / CalendarDayPage).
export default function RedirectIfAuthed({ children }) {
  const employee = loadCurrentEmployee();

  if (employee) {
    return <Navigate to="/management" replace />;
  }

  return children;
}
