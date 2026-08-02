import { useNavigate } from "react-router";
import EmployeeIdentityModal from "../components/EmployeeIdentityModal";
import { saveCurrentEmployee } from "../services/authStorage";

// Dedicated login route. Renders the exact same EmployeeIdentityModal used
// previously inline on ManagementPage, so the look/behaviour of the login
// form itself is unchanged — only its location moved to its own page/route.
export default function LoginPage() {
  const navigate = useNavigate();

  async function handleLogin(credentials) {
    await saveCurrentEmployee(credentials);
    navigate("/management", { replace: true });
  }

  return (
    <div className="min-h-screen bg-black">
      <EmployeeIdentityModal onSubmit={handleLogin} />
    </div>
  );
}
