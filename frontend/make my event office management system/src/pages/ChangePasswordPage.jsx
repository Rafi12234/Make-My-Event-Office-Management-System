import { Navigate, useNavigate } from "react-router";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { changeEmployeePassword, loadCurrentEmployee } from "../services/authStorage";

// Dedicated route for the mandatory first-login password change. Reached
// via redirect from RequirePasswordChange (or directly from LoginPage)
// whenever mustChangePassword is still true for the logged-in employee.
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const employee = loadCurrentEmployee();

  if (!employee) {
    return <Navigate to="/login" replace />;
  }
  if (!employee.mustChangePassword) {
    return <Navigate to="/management" replace />;
  }

  async function handleChangePassword(credentials) {
    await changeEmployeePassword(credentials);
    navigate("/management", { replace: true });
  }

  return (
    <div className="min-h-screen bg-black">
      <ChangePasswordModal onSuccess={handleChangePassword} />
    </div>
  );
}
