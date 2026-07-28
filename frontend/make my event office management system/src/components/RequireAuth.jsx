import { Navigate, useLocation } from "react-router";
import { loadCurrentEmployee } from "../services/managementStorage";

// Route guard: blocks access to anything wrapped in this component unless an
// employee is currently logged in (see services/managementStorage.js). Used
// to make sure no page besides the landing page and the login page can be
// reached without signing in first.
export default function RequireAuth({ children }) {
  const location = useLocation();
  const employee = loadCurrentEmployee();

  if (!employee) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
