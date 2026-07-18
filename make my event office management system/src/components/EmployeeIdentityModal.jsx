import { useState } from "react";
import { Mail, UserRound, UsersRound } from "lucide-react";

export default function EmployeeIdentityModal({ onSubmit }) {
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Employee name is required.";
    if (!form.email.trim()) nextErrors.email = "Employee email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSubmit({
      id: crypto.randomUUID(),
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-mme-purple/70 px-5 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/40 bg-white shadow-[0_30px_100px_rgba(35,16,45,0.35)]">
        <div className="bg-gradient-to-br from-mme-purple to-mme-plum px-7 py-8 text-white sm:px-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-mme-blush">
            <UsersRound size={27} />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-mme-pink">
            No login required
          </p>
          <h1 className="mt-2 text-3xl font-black">Identify yourself</h1>
          <p className="mt-3 max-w-md leading-7 text-white/70">
            Enter only your name and email. This identifies who creates or updates office information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7 sm:p-9">
          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple" htmlFor="employee-name">
              Employee name
            </label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum" size={18} />
              <input
                id="employee-name"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-2xl border border-mme-pink bg-white py-3.5 pl-12 pr-4 outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
                placeholder="Enter your full name"
                autoFocus
              />
            </div>
            {errors.fullName && <p className="mt-1.5 text-xs font-bold text-red-500">{errors.fullName}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple" htmlFor="employee-email">
              Employee email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum" size={18} />
              <input
                id="employee-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-mme-pink bg-white py-3.5 pl-12 pr-4 outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
                placeholder="name@company.com"
              />
            </div>
            {errors.email && <p className="mt-1.5 text-xs font-bold text-red-500">{errors.email}</p>}
          </div>

          <button className="w-full rounded-2xl bg-mme-purple px-6 py-4 text-sm font-black text-white shadow-xl shadow-mme-purple/20 transition hover:-translate-y-0.5 hover:bg-[#4b2c55]">
            Continue to management
          </button>

          <p className="text-center text-xs leading-5 text-mme-purple/50">
            Frontend demo data is saved in this browser until the backend API is connected.
          </p>
        </form>
      </div>
    </div>
  );
}
