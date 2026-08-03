import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";

// Mandatory, non-dismissible modal shown when an employee is still on the
// admin-provided password (employee.mustChangePassword === true). There is
// no close/skip control by design — the parent gate only stops rendering
// this once onSuccess reports the password has actually been changed.
export default function ChangePasswordModal({ onSuccess }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      await onSuccess({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 px-5 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/40 bg-white shadow-[0_30px_100px_rgba(35,16,45,0.35)]">
        <div className="bg-gradient-to-br from-black to-[#333333] px-7 py-8 text-white sm:px-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-[#f4f4f4]">
            <KeyRound size={27} />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#d6d6d6]">
            Action Required
          </p>
          <h1 className="mt-2 text-3xl font-black">Change your password</h1>
          <p className="mt-3 max-w-md leading-7 text-white/70">
            You&apos;re signing in with a password set by your admin. Set your own
            password to continue.
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
            <label className="mb-2 block text-sm font-black text-black" htmlFor="cp-current">
              Current (admin-provided) password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#333333]" size={18} />
              <input
                id="cp-current"
                type={showPasswords ? "text" : "password"}
                required
                autoFocus
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="w-full rounded-2xl border border-[#d6d6d6] bg-white py-3.5 pl-12 pr-4 outline-none transition focus:border-black focus:ring-4 focus:ring-[#d6d6d6]/40"
                placeholder="Enter your current password"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-black" htmlFor="cp-new">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#333333]" size={18} />
              <input
                id="cp-new"
                type={showPasswords ? "text" : "password"}
                required
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                className="w-full rounded-2xl border border-[#d6d6d6] bg-white py-3.5 pl-12 pr-12 outline-none transition focus:border-black focus:ring-4 focus:ring-[#d6d6d6]/40"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
              >
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-black" htmlFor="cp-confirm">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#333333]" size={18} />
              <input
                id="cp-confirm"
                type={showPasswords ? "text" : "password"}
                required
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full rounded-2xl border border-[#d6d6d6] bg-white py-3.5 pl-12 pr-4 outline-none transition focus:border-black focus:ring-4 focus:ring-[#d6d6d6]/40"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-black px-6 py-4 text-sm font-black text-white shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#222222] disabled:opacity-60 disabled:translate-y-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Updating…
              </span>
            ) : "Update password & continue"}
          </button>

          <p className="text-center text-xs leading-5 text-black/50">
            This step is required before you can use the workspace.
          </p>
        </form>
      </div>
    </div>
  );
}
