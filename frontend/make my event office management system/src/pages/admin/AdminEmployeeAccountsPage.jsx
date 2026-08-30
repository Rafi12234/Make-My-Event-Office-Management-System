import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  adminLogout,
  createEmployee,
  fetchAdminMe,
  fetchAllEmployees,
  resetEmployeePassword,
  toggleEmployeeActive,
} from "../../services/adminService";
import { initials } from "../../utils/employeeActivity";

// ─── Create Employee Form ────────────────────────────────────────────────────
function CreateEmployeeForm({ onCreated }) {
  const [form, setForm] = useState({ fullName: "", email: "", role: "Employee", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const employee = await createEmployee(form);
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

// ─── Reset Password Modal ────────────────────────────────────────────────────
function ResetPasswordModal({ employee, onClose, onReset }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetEmployeePassword(employee.id, password);
      onReset(employee);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_30px_100px_rgba(91,55,101,0.25)]">
        <div className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
            <RotateCcw size={19} />
          </div>
          <h2 className="mt-4 text-lg font-black text-mme-purple">Reset Password</h2>
          <p className="mt-1 text-sm text-mme-purple/55">
            Set a new password for <span className="font-bold text-mme-purple">{employee.fullName}</span>. They'll be required to change it on next login.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                <X size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 pr-10 text-sm text-mme-purple outline-none placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-mme-pink/70 bg-white px-5 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#4b2c55] disabled:opacity-60"
              >
                {loading ? "Saving…" : "Set Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminEmployeeAccountsPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [query, setQuery] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    fetchAllEmployees({ includeAdmins: true })
      .then(setEmployees)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  function handleCreated(newEmployee) {
    setEmployees((prev) => [newEmployee, ...prev]);
    setShowCreateForm(false);
    setNotice({ type: "success", message: `Employee "${newEmployee.fullName}" created successfully.` });
  }

  async function handleToggle(emp) {
    setTogglingId(emp.id);
    try {
      await toggleEmployeeActive(emp.id, !emp.isActive);
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, isActive: !emp.isActive } : e)));
      setNotice({ type: "success", message: `Employee ${!emp.isActive ? "activated" : "deactivated"} successfully.` });
    } catch (err) {
      setNotice({ type: "error", message: err.message });
    } finally {
      setTogglingId(null);
    }
  }

  if (checkingSession || !admin) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? employees.filter((e) => e.fullName?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q))
    : employees;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-5">
        <BackButton to="/admin-employee-management" title="Back to Employee Management" />
      </div>

      <div className="mb-7">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
          <Settings2 size={14} /> Admin Control
        </div>
        <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Manage Employee Accounts</h1>
        <p className="mt-1.5 text-sm text-mme-purple/55">
          Add a new employee, reset a password, or activate/deactivate an account.
        </p>
      </div>

      <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
        <div className="border-b border-mme-pink/50 p-6">
          <div className="rounded-2xl border border-mme-pink/50 bg-[#fff9fc]">
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3.5"
            >
              <span className="flex items-center gap-2 text-sm font-black text-mme-purple">
                <UserPlus size={15} /> Add New Employee
              </span>
              <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition ${
                showCreateForm ? "border-mme-purple bg-mme-purple text-white" : "border-mme-purple/20 text-mme-purple"
              }`}>
                {showCreateForm ? "Cancel" : <span className="flex items-center gap-1"><Plus size={12} /> Add</span>}
              </span>
            </button>
            {showCreateForm && (
              <div className="border-t border-mme-pink/40 px-5 py-4">
                <CreateEmployeeForm onCreated={handleCreated} />
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mme-purple/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-2.5 pl-10 pr-9 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/30 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/35 hover:text-mme-purple">
                <X size={14} />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-mme-purple/40">
              {query ? `No employees match "${query}".` : "No employees yet."}
            </p>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((emp) => (
                <div key={emp.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-3 basis-56">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                      emp.role === "Admin" ? "bg-mme-purple text-white" : "bg-mme-blush text-mme-purple"
                    }`}>
                      {initials(emp.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-mme-purple">{emp.fullName}</p>
                      <p className="truncate text-xs text-mme-purple/55">{emp.email}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                      emp.role === "Admin" ? "bg-mme-purple/10 text-mme-purple" : "bg-mme-blush text-mme-plum"
                    }`}>
                      {emp.role === "Admin" ? <Shield size={11} /> : <UsersRound size={11} />}
                      {emp.role}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                      emp.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                    }`}>
                      {emp.isActive ? <UserCheck size={11} /> : <UserMinus size={11} />}
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setResetTarget(emp)}
                      title="Reset Password"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
                    >
                      <RotateCcw size={12} /> Reset Password
                    </button>
                    {emp.id === admin.id ? (
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
                        {togglingId === emp.id ? "…" : emp.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {resetTarget && (
        <ResetPasswordModal
          employee={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={(emp) => {
            setResetTarget(null);
            setNotice({ type: "success", message: `Password reset for "${emp.fullName}".` });
          }}
        />
      )}

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
    </AdminLayout>
  );
}
