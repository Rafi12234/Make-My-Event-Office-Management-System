import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AlertCircle, ArrowRight, CheckCircle2, Store } from "lucide-react";
import mmeLogo from "../../../frontend/make my event office management system/src/assets/mme-logo-cropped.png";
import BackButton from "../../../frontend/make my event office management system/src/components/BackButton";
import EmployeeLayout from "../../../frontend/make my event office management system/src/components/EmployeeLayout";
import { loadCurrentEmployee } from "../../../frontend/make my event office management system/src/services/authStorage";
import { loadAccountsSummary } from "../services/accountsService";
import AccountsAnimations from "../components/AccountsAnimations";
import WalletSummaryCard from "../components/WalletSummaryCard";
import QuickActionsPanel from "../components/QuickActionsPanel";
import VendorWatchPanel from "../components/VendorWatchPanel";
import HistoryList from "../components/HistoryList";

// Employee-facing Accounts/Wallet page — wallet balance, quick actions,
// and a full read-only history. Logging money received / a new cost each
// live on their own route. Lives entirely under Accounts/frontend but is
// wired into the real SPA's router (App.jsx) rather than run separately.
export default function AccountsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [employee] = useState(() => loadCurrentEmployee());
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let isMounted = true;
    loadAccountsSummary()
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Could not load your wallet.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Form pages hand their confirmation back through router state; clear it
  // so a refresh does not replay the same toast.
  useEffect(() => {
    if (!location.state?.toast) return;
    setToast(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalReceived = (summary?.moneyReceived || []).reduce((sum, e) => sum + e.amount, 0);
  const totalSpent = (summary?.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0);

  // Outstanding grouped per vendor for the right rail — netted per vendor
  // ("to_pay" items owed minus "paid" items settled, e.g. a Pay Vendor
  // settlement), not a raw sum of every "to_pay" item ever logged, so a
  // vendor already settled back to zero drops off instead of still
  // showing its old debt.
  const vendorOutstanding = useMemo(() => {
    const byVendor = new Map();
    for (const payment of summary?.vendorPayments || []) {
      const name = payment.vendorName || "Vendor";
      const delta = payment.paymentStatus === "paid" ? payment.totalAmount : -payment.totalAmount;
      byVendor.set(name, (byVendor.get(name) || 0) + delta);
    }
    return [...byVendor.entries()]
      .map(([name, net]) => ({ name, amount: net < 0 ? -net : 0 }))
      .filter((vendor) => vendor.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [summary]);

  const totalPending = vendorOutstanding.reduce((sum, vendor) => sum + vendor.amount, 0);

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-[#F6F6F7]">
        <AccountsAnimations />

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-black/8 bg-white/80 backdrop-blur-xl">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src={mmeLogo} alt="Make My Event" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
              <div className="min-w-0 border-l border-black/10 pl-3">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-black/70">
                  My Accounts
                </p>
                <p className="truncate text-[10px] text-black/55">Wallet &amp; expenses</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/accounts/vendors"
                className="group hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:bg-[#0B0B0F] hover:text-white sm:inline-flex"
              >
                <Store size={14} /> Vendors
              </Link>
              <div className="flex items-center gap-2.5 rounded-xl border border-black/8 bg-white px-2.5 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0B0B0F] text-[11px] font-black text-white">
                  {(employee?.fullName || "E").trim().charAt(0).toUpperCase()}
                </div>
                <p className="hidden max-w-32 truncate text-xs font-black text-black/75 sm:block">
                  {employee?.fullName}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
          <section className="mx-auto max-w-[1700px]">
            <div className="mm-fade mb-5 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <BackButton to="/management" title="Back to management" />
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-black sm:text-3xl">
                    Wallet &amp; Expenses
                  </h1>
                  <p className="mt-0.5 text-sm text-black/45">
                    Track what you receive, what you spend, and what you still owe.
                  </p>
                </div>
              </div>

              <Link
                to="/management"
                className="group inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-black text-black/65 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:bg-[#0B0B0F] hover:text-white"
              >
                Management Sheet
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-12">
                  <div className="mm-skeleton h-80 rounded-[30px] xl:col-span-8" />
                  <div className="mm-skeleton hidden h-80 rounded-[24px] xl:col-span-4 xl:block" />
                </div>
                <div className="grid gap-5 xl:grid-cols-12">
                  <div className="mm-skeleton h-96 rounded-[24px] xl:col-span-8" />
                  <div className="mm-skeleton hidden h-96 rounded-[24px] xl:col-span-4 xl:block" />
                </div>
              </div>
            ) : error ? (
              <div className="mm-pop rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-12 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                  <AlertCircle size={24} />
                </span>
                <p className="mt-3.5 text-sm font-black text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-600 active:scale-95"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Bento row: hero fills the width, actions sit beside it. */}
                <div className="grid gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <WalletSummaryCard
                      currentBalance={summary.currentBalance}
                      totalReceived={totalReceived}
                      totalSpent={totalSpent}
                      totalPending={totalPending}
                    />
                  </div>
                  <div className="xl:col-span-4">
                    <QuickActionsPanel />
                  </div>
                </div>

                <div className="grid items-start gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <HistoryList
                      moneyReceived={summary.moneyReceived}
                      expenses={summary.expenses}
                      vendorPayments={summary.vendorPayments}
                    />
                  </div>
                  <aside className="mm-rise xl:col-span-4 xl:sticky xl:top-24" style={{ animationDelay: "0.2s" }}>
                    <VendorWatchPanel vendorOutstanding={vendorOutstanding} totalPending={totalPending} />
                  </aside>
                </div>
              </div>
            )}
          </section>
        </main>

        {toast ? (
          <div
            className="fixed bottom-6 left-1/2 z-[130] flex items-center gap-2.5 rounded-2xl bg-[#0B0B0F] px-5 py-3.5 text-sm font-black text-white shadow-2xl shadow-black/40 ring-1 ring-white/10"
            style={{ animation: "mm-toast .45s cubic-bezier(.22,1,.36,1) both" }}
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            {toast}
          </div>
        ) : null}
      </div>
    </EmployeeLayout>
  );
}
