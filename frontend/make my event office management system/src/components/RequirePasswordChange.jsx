import { Navigate } from "react-router";
import { loadCurrentEmployee } from "../services/authStorage";

// Wraps protected page routes (management/calendar) and redirects to the
// dedicated /change-password page whenever the employee is still on the
// admin-provided password — see ChangePasswordPage for the actual form.
export default function RequirePasswordChange({ children }) {
  const employee = loadCurrentEmployee();

  if (employee?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

