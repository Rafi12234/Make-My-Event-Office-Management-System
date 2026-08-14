import { Navigate } from "react-router";
import { loadCurrentEmployee } from "../services/authStorage";

// Wraps every route that is NOT part of the Employee Portal (landing/login
// are already handled by RedirectIfAuthed; this covers the Admin Panel
// routes). While a valid employee session exists, the user must be sent
// back to /management no matter what URL they type/click (/admin/login,
// /admin-dashboard, etc.) — the only way out is an explicit logout from
// the Employee Portal (see handleLogout in ManagementPage).
export default function BlockIfEmployeeSession({ children }) {
  const employee = loadCurrentEmployee();

  if (employee) {
    return <Navigate to="/management" replace />;
  }

  return children;
}
