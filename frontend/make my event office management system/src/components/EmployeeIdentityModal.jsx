import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";

export default function EmployeeIdentityModal({ onSubmit }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ email: form.email.trim().toLowerCase(), password: form.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-mme-purple/70 px-5 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/40 bg-white shadow-[0_30px_100px_rgba(35,16,45,0.35)]">
        <div className="bg-gradient-to-br from-mme-purple to-mme-plum px-7 py-8 text-white sm:px-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-mme-blush">
            <KeyRound size={27} />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-mme-pink">
            Employee Login
          </p>
          <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
          <p className="mt-3 max-w-md leading-7 text-white/70">
            Sign in with the credentials provided by your admin to access the workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7 sm:p-9">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <span className="mt-0.5 shrink-0">✕</span>
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple" htmlFor="emp-email">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum" size={18} />
              <input
                id="emp-email"
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-2xl border border-mme-pink bg-white py-3.5 pl-12 pr-4 outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple" htmlFor="emp-password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum" size={18} />
              <input
                id="emp-password"
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-2xl border border-mme-pink bg-white py-3.5 pl-12 pr-12 outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-mme-purple px-6 py-4 text-sm font-black text-white shadow-xl shadow-mme-purple/20 transition hover:-translate-y-0.5 hover:bg-[#4b2c55] disabled:opacity-60 disabled:translate-y-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : "Sign in to workspace"}
          </button>

          <p className="text-center text-xs leading-5 text-mme-purple/50">
            Don&apos;t have credentials? Contact your admin.
          </p>
        </form>
      </div>
    </div>
  );
}
