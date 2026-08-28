import { Link } from "react-router";
import mmeLogo from "../../../frontend/make my event office management system/src/assets/mme-logo-cropped.png";
import BackButton from "../../../frontend/make my event office management system/src/components/BackButton";
import EmployeeLayout from "../../../frontend/make my event office management system/src/components/EmployeeLayout";
import AccountsAnimations from "./AccountsAnimations";

// Shared chrome for the standalone Accounts form pages (Money In, Log a
// Cost) so both keep the same header, back affordance and card framing.
export default function AccountsFormShell({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  maxWidthClassName = "max-w-4xl",
}) {
  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-[#F6F6F7]">
        <AccountsAnimations />

        <header className="sticky top-0 z-40 border-b border-black/8 bg-white/80 backdrop-blur-xl">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src={mmeLogo} alt="Make My Event" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
              <div className="min-w-0 border-l border-black/10 pl-3">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-black/70">
                  {eyebrow}
                </p>
                <p className="truncate text-[10px] text-black/55">My Accounts</p>
              </div>
            </div>

            <Link
              to="/accounts"
              className="group hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:bg-[#0B0B0F] hover:text-white sm:inline-flex"
            >
              Cancel
            </Link>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
          <section className={`mx-auto ${maxWidthClassName}`}>
            <div className="mm-fade mb-5">
              <BackButton to="/accounts" title="Back to Wallet" />
            </div>

            <div className="mm-pop relative mb-5 overflow-hidden rounded-[30px] bg-[#0B0B0F] p-6 text-white shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)] ring-1 ring-white/10 sm:p-8">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="mm-drift absolute -left-24 -top-32 h-80 w-80 rounded-full bg-violet-600/50 blur-[100px]" />
                <div
                  className="mm-drift absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-cyan-500/30 blur-[110px]"
                  style={{ animationDelay: "-6s" }}
                />
                <div className="mm-dots absolute inset-0 opacity-30" />
              </div>

              <div className="relative flex items-center gap-4">
                {Icon ? (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Icon size={24} />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
                  <p className="mt-1 text-sm text-white/70">{description}</p>
                </div>
              </div>
            </div>

            <div className="mm-rise overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_2px_24px_-8px_rgba(0,0,0,.14)]">
              {children}
            </div>
          </section>
        </main>
      </div>
    </EmployeeLayout>
  );
}
