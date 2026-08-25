import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, HandCoins, ReceiptText, Wallet } from "lucide-react";
import mmeLogo from "../../../frontend/make my event office management system/src/assets/mme-logo-cropped.png";
import BackButton from "../../../frontend/make my event office management system/src/components/BackButton";
import EmployeeLayout from "../../../frontend/make my event office management system/src/components/EmployeeLayout";
import { loadCurrentEmployee } from "../../../frontend/make my event office management system/src/services/authStorage";
import { loadAccountsSummary } from "../services/accountsService";
import WalletSummaryCard from "../components/WalletSummaryCard";
import MoneyReceivedForm from "../components/MoneyReceivedForm";
import ExpenseForm from "../components/ExpenseForm";
import HistoryList from "../components/HistoryList";

// Employee-facing Accounts/Wallet page — wallet balance, logging money
// received, submitting locked-in costs (event based or regular), and a
// full read-only history. Lives entirely under Accounts/frontend but is
// wired into the real SPA's router (App.jsx) rather than run separately.
export default function AccountsPage() {
  const [employee] = useState(() => loadCurrentEmployee());
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState(null); // null | "received" | "expense"

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

  function refreshAfterChange(result) {
    setActivePanel(null);
    setSummary((prev) => {
      if (!prev) return prev;
      if (result.entry) {
        return {
          ...prev,
          currentBalance: result.currentBalance,
          moneyReceived: [result.entry, ...prev.moneyReceived],
        };
      }
      if (result.expense) {
        return {
          ...prev,
          currentBalance: result.currentBalance,
          expenses: [result.expense, ...prev.expenses],
        };
      }
      return prev;
    });
  }

  const totalReceived = (summary?.moneyReceived || []).reduce((sum, e) => sum + e.amount, 0);
  const totalSpent = (summary?.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0);

  return (
    <EmployeeLayout>
    <div className="min-h-screen bg-[#f4f4f4]/40">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={mmeLogo} alt="Make My Event" className="h-16 w-auto shrink-0 object-contain sm:h-18" />
            <div className="min-w-0 border-l border-[#d6d6d6]/60 pl-3">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333] sm:text-xs">
                My Accounts
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="max-w-40 truncate text-xs font-black text-black">{employee?.fullName}</p>
            <p className="text-[10px] text-black/50">Wallet & expenses</p>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-350">
          <div className="mb-4 flex items-center justify-between gap-3">
            <BackButton to="/management" title="Back to management" />
            <Link
              to="/management"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black hover:bg-[#f4f4f4]/30 transition"
            >
              Management Sheet
            </Link>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
              <Wallet size={15} /> My Accounts
            </div>
            <h1 className="mt-1.5 text-2xl font-black sm:text-3xl">Wallet & Expenses</h1>
            <p className="mt-1.5 text-sm text-black/60">
              Track money received from your boss and log the costs you spend on events or regular work.
            </p>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-black/50">Loading your wallet…</p>
          ) : error ? (
            <p className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
              <AlertCircle size={16} /> {error}
            </p>
          ) : (
            <div className="space-y-5">
              <WalletSummaryCard
                currentBalance={summary.currentBalance}
                totalReceived={totalReceived}
                totalSpent={totalSpent}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActivePanel(activePanel === "received" ? null : "received")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition ${
                    activePanel === "received" ? "bg-black text-white" : "border border-[#d6d6d6] bg-white text-black hover:bg-[#f4f4f4]/60"
                  }`}
                >
                  <HandCoins size={16} /> Log Money Received
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel(activePanel === "expense" ? null : "expense")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition ${
                    activePanel === "expense" ? "bg-black text-white" : "border border-[#d6d6d6] bg-white text-black hover:bg-[#f4f4f4]/60"
                  }`}
                >
                  <ReceiptText size={16} /> Log a New Cost
                </button>
              </div>

              {activePanel === "received" ? <MoneyReceivedForm onAdded={refreshAfterChange} /> : null}
              {activePanel === "expense" ? (
                <ExpenseForm onSubmitted={refreshAfterChange} onCancel={() => setActivePanel(null)} />
              ) : null}

              <HistoryList moneyReceived={summary.moneyReceived} expenses={summary.expenses} />
            </div>
          )}
        </section>
      </main>
    </div>
    </EmployeeLayout>
  );
}
