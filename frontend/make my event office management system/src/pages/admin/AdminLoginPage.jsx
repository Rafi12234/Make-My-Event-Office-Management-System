import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Shield, X } from "lucide-react";
import { adminLogin, fetchAdminMe } from "../../services/adminService";

// Standalone admin sign-in page, fully separate from the Employee
// Management dashboard (AdminPage) — /admin-dashboard and
// /admin-employee-management both require an existing session and
// redirect here if one isn't found.
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (me) navigate("/admin-dashboard", { replace: true });
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(form.email.trim(), form.password);
      navigate("/admin-dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) return null;

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
