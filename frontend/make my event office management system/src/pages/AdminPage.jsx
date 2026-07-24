import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Plus,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  adminLogin,
  createEmployee,
  fetchAllEmployees,
  toggleEmployeeActive,
} from "../services/adminService";

const SESSION_KEY = "mme_admin_session";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Login Form ──────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const admin = await adminLogin(form.email.trim(), form.password);
      onLogin(admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fff9fc] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-mme-purple shadow-lg shadow-mme-purple/25">
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-mme-purple">Admin Portal</h1>
          <p className="mt-1 text-sm text-mme-purple/55">Make My Event — Office Management</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-mme-pink/60 bg-white p-8 shadow-[0_20px_60px_rgba(91,55,101,0.09)]">
          <h2 className="mb-6 text-lg font-black text-mme-purple">Sign in as Admin</h2>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <X size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-3 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Enter admin password"
                  className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-3 pr-12 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-mme-purple py-3 text-sm font-black text-white shadow-md shadow-mme-purple/20 transition hover:bg-[#4b2c55] disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-mme-purple/40">
          <Link to="/" className="hover:text-mme-purple">← Back to app</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Create Employee Form ────────────────────────────────────────────────────
function CreateEmployeeForm({ adminId, onCreated }) {
  const [form, setForm] = useState({ fullName: "", email: "", role: "Employee", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const employee = await createEmployee(adminId, form);
      onCreated(employee);
      setForm({ fullName: "", email: "", role: "Employee", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <X size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Full Name *
          </label>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Employee full name"
            className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Email *
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="employee@example.com"
            className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Role *
          </label>
          <div className="relative">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
            >
              <option value="Employee">Employee</option>
              <option value="Admin">Admin</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/50" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 pr-10 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/15 transition hover:bg-[#4b2c55] disabled:opacity-60"
        >
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <UserPlus size={16} />}
          {loading ? "Creating…" : "Create Employee"}
        </button>
      </div>
    </form>
  );
}

// ─── Employee Table ──────────────────────────────────────────────────────────
function EmployeeTable({ employees, adminId, onToggle }) {
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState(null);

  async function handleToggle(emp) {
    setError(null);
    setTogglingId(emp.id);
    try {
      await toggleEmployeeActive(adminId, emp.id, !emp.isActive);
      onToggle(emp.id, !emp.isActive);
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  if (!employees.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <UsersRound size={38} className="text-mme-mauve" />
        <p className="mt-4 font-black text-mme-purple">No employees yet</p>
        <p className="mt-1 text-sm text-mme-purple/50">Use the form above to add the first employee.</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <X size={15} /> {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {["#", "Name", "Email", "Role", "Status", "Created By", "Joined", "Action"].map((h) => (
                <th key={h} className="border-b border-mme-pink/60 bg-mme-purple px-4 py-3 text-xs font-black text-white first:rounded-tl-xl last:rounded-tr-xl">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, index) => (
              <tr key={emp.id} className="group">
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 text-xs font-black text-mme-purple/40 group-hover:bg-[#fffbfd]">
                  {index + 1}
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 font-bold text-mme-purple group-hover:bg-[#fffbfd]">
                  {emp.fullName}
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 text-mme-purple/70 group-hover:bg-[#fffbfd]">
                  {emp.email}
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 group-hover:bg-[#fffbfd]">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                    emp.role === "Admin"
                      ? "bg-mme-purple/10 text-mme-purple"
                      : "bg-mme-blush text-mme-plum"
                  }`}>
                    {emp.role === "Admin" ? <Shield size={11} /> : <UsersRound size={11} />}
                    {emp.role}
                  </span>
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 group-hover:bg-[#fffbfd]">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                    emp.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-500"
                  }`}>
                    {emp.isActive ? <UserCheck size={11} /> : <UserMinus size={11} />}
                    {emp.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 text-mme-purple/55 group-hover:bg-[#fffbfd]">
                  {emp.createdByName || <span className="text-mme-purple/30 italic">—</span>}
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 text-xs text-mme-purple/50 group-hover:bg-[#fffbfd]">
                  {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="border-b border-mme-pink/40 bg-white px-4 py-3 group-hover:bg-[#fffbfd]">
                  {emp.id === adminId ? (
                    <span className="text-xs font-bold text-mme-purple/30 italic">You</span>
                  ) : (
                    <button
                      onClick={() => handleToggle(emp)}
                      disabled={togglingId === emp.id}
                      title={emp.isActive ? "Deactivate" : "Activate"}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition disabled:opacity-50 ${
                        emp.isActive
                          ? "border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                          : "border border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {togglingId === emp.id
                        ? "…"
                        : emp.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [admin, setAdmin] = useState(() => loadSession());
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    fetchAllEmployees(admin.id)
      .then(setEmployees)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  function handleLogin(adminData) {
    saveSession(adminData);
    setAdmin(adminData);
  }

  function handleLogout() {
    clearSession();
    setAdmin(null);
    setEmployees([]);
  }

  function handleCreated(newEmployee) {
    setEmployees((prev) => [newEmployee, ...prev]);
    setShowCreateForm(false);
    setNotice({ type: "success", message: `Employee "${newEmployee.fullName}" created successfully.` });
  }

  function handleToggle(employeeId, isActive) {
    setEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, isActive } : e)),
    );
    setNotice({
      type: "success",
      message: `Employee ${isActive ? "activated" : "deactivated"} successfully.`,
    });
  }

  if (!admin) return <LoginView onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#fff9fc]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-mme-pink/50 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden rounded-xl p-2 text-mme-purple/60 hover:bg-mme-blush/40 sm:block" title="Back to app">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-base font-black text-mme-purple sm:text-lg">Admin Portal</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">
                Make My Event
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-mme-pink/60 bg-[#fff9fc] px-3 py-2 text-xs font-bold text-mme-purple/65 sm:flex">
              <Shield size={13} className="text-mme-plum" />
              {admin.fullName}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-3 py-2 text-xs font-black text-mme-purple transition hover:bg-red-50 hover:border-red-200 hover:text-red-500"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {/* Page Title */}
        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <KeyRound size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Employee Management</h1>
          <p className="mt-1.5 text-sm text-mme-purple/55">
            Create and manage employee accounts. Employees cannot register themselves.
          </p>
        </div>

        {/* Create Employee Card */}
        <div className="mb-6 rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                <UserPlus size={17} />
              </div>
              <span className="font-black text-mme-purple">Add New Employee</span>
            </div>
            <div className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
              showCreateForm
                ? "border-mme-purple bg-mme-purple text-white"
                : "border-mme-purple/20 text-mme-purple hover:bg-mme-blush/30"
            }`}>
              {showCreateForm ? "Cancel" : <span className="flex items-center gap-1"><Plus size={13} /> Add Employee</span>}
            </div>
          </button>

          {showCreateForm && (
            <div className="border-t border-mme-pink/50 px-6 py-5">
              <CreateEmployeeForm adminId={admin.id} onCreated={handleCreated} />
            </div>
          )}
        </div>

        {/* Employee List Card */}
        <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <div className="flex items-center justify-between border-b border-mme-pink/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mme-blush text-mme-purple">
                <UsersRound size={17} />
              </div>
              <span className="font-black text-mme-purple">All Employees</span>
            </div>
            <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
              {employees.length} total
            </span>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
              </div>
            ) : (
              <EmployeeTable
                employees={employees}
                adminId={admin.id}
                onToggle={handleToggle}
              />
            )}
          </div>
        </div>
      </main>

      {/* Toast Notice */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-mme-pink bg-white text-mme-purple"
        }`}>
          {notice.type === "error"
            ? <X className="mt-0.5 shrink-0" size={17} />
            : <Check className="mt-0.5 shrink-0 text-mme-plum" size={17} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
