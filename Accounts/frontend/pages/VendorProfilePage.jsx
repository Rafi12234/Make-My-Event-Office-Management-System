import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AlertCircle, CalendarDays, Clock3, HandCoins, ReceiptText, Store, UserRound } from "lucide-react";
import mmeLogo from "../../../frontend/make my event office management system/src/assets/mme-logo-cropped.png";
import BackButton from "../../../frontend/make my event office management system/src/components/BackButton";
import EmployeeLayout from "../../../frontend/make my event office management system/src/components/EmployeeLayout";
import AccountsAnimations from "../components/AccountsAnimations";
import { loadVendorProfile, loadVendorOutstandingItems, payVendor, formatDisplayDate, formatTaka } from "../services/accountsService";

// Single vendor's profile: shared running balance + full transaction
// history across every employee (the ledger is company-wide, not scoped
// to whoever is viewing it).
export default function VendorProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [settlesItemId, setSettlesItemId] = useState("");
  const [outstandingBills, setOutstandingBills] = useState([]);
  const [payError, setPayError] = useState("");
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");
    loadVendorProfile(id)
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Could not load this vendor.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetched only once the Pay form actually opens — no point loading it
  // for every profile visit when most never click "Record a Payment".
  useEffect(() => {
    if (!showPayForm) return undefined;
    let isMounted = true;
    loadVendorOutstandingItems(id)
      .then((bills) => {
        if (isMounted) setOutstandingBills(bills);
      })
      .catch(() => {
        if (isMounted) setOutstandingBills([]);
      });
    return () => {
      isMounted = false;
    };
  }, [id, showPayForm]);

  const transactions = data?.transactions || [];
  const balance = data?.vendor.currentBalance || 0;
  const owes = balance < 0;
  const advanced = balance > 0;
  const paidTotal = transactions
    .filter((tx) => tx.paymentStatus === "paid")
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
  const pendingTotal = transactions
    .filter((tx) => tx.paymentStatus === "to_pay")
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
  const visible =
    statusFilter === "all" ? transactions : transactions.filter((tx) => tx.paymentStatus === statusFilter);

  async function handlePaySubmit(e) {
    e.preventDefault();
    const numericAmount = Number(payAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPayError("Enter a valid amount greater than 0.");
      return;
    }
    setIsPaySubmitting(true);
    setPayError("");
    try {
      await payVendor(id, {
        amount: numericAmount,
        paidOn: payDate,
        note: payNote.trim(),
        settlesItemId: settlesItemId || null,
      });
      const refreshed = await loadVendorProfile(id);
      setData(refreshed);
      setPayAmount("");
      setPayNote("");
      setSettlesItemId("");
      setShowPayForm(false);
    } catch (err) {
      setPayError(err.message || "Could not record this payment.");
    } finally {
      setIsPaySubmitting(false);
    }
  }

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
                  Vendor Profile
                </p>
                <p className="truncate text-[10px] text-black/55">Shared company ledger</p>
              </div>
            </div>
            <Link
              to="/accounts/vendors"
              className="group inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:bg-[#0B0B0F] hover:text-white"
            >
              <Store size={14} /> All Vendors
            </Link>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
          <section className="mx-auto max-w-[1700px]">
            <div className="mm-fade mb-5">
              <BackButton to="/accounts/vendors" title="Back to Vendors" />
            </div>

            {isLoading ? (
              <div className="space-y-5">
                <div className="mm-skeleton h-64 rounded-[30px]" />
                <div className="mm-skeleton h-96 rounded-[24px]" />
              </div>
            ) : error ? (
              <div className="mm-pop rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-12 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                  <AlertCircle size={24} />
                </span>
                <p className="mt-3.5 text-sm font-black text-rose-600">{error}</p>
              </div>
            ) : (
              <div className="grid items-start gap-5 xl:grid-cols-12">
                <div className="xl:col-span-5">
                  <div className="mm-pop relative overflow-hidden rounded-[30px] bg-[#0B0B0F] shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)] ring-1 ring-white/10 xl:sticky xl:top-24">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div
                        className={`mm-drift absolute -left-24 -top-32 h-96 w-96 rounded-full blur-[110px] ${
                          owes ? "bg-amber-500/45" : advanced ? "bg-emerald-500/40" : "bg-violet-600/45"
                        }`}
                      />
                      <div
                        className="mm-drift absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-cyan-500/30 blur-[110px]"
                        style={{ animationDelay: "-6s" }}
                      />
                      <div className="mm-dots absolute inset-0 opacity-30" />
                    </div>

                    <div className="relative p-6 text-white sm:p-8">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                          <Store size={24} />
                        </div>
                        <div className="min-w-0">
                          <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
                            {data.vendor.name}
                          </h1>
                          {data.vendor.category ? (
                            <span className="mt-1.5 inline-block rounded-lg bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                              {data.vendor.category}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-7">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">
                          {owes ? "You Owe This Vendor" : advanced ? "Advanced / Overpaid" : "Fully Settled"}
                        </p>
                        <p
                          className={`mt-1.5 text-5xl font-black tracking-tighter ${
                            owes ? "text-rose-400" : advanced ? "text-emerald-300" : "text-white/60"
                          }`}
                        >
                          {owes ? "−" : advanced ? "+" : ""}
                          {formatTaka(Math.abs(balance))}
                        </p>
                      </div>

                      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                        {[
                          { label: "Entries", value: transactions.length, tone: "text-white", isCount: true },
                          { label: "Paid", value: paidTotal, tone: "text-emerald-400", sign: "+" },
                          { label: "To Pay", value: pendingTotal, tone: "text-rose-400", sign: "−" },
                        ].map((stat, index) => (
                          <div
                            key={stat.label}
                            className="mm-rise flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 transition-all duration-400 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.09]"
                            style={{ animationDelay: `${index * 70 + 120}ms` }}
                          >
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                              {stat.label}
                            </p>
                            <p className={`mt-1.5 text-lg font-black ${stat.tone}`}>
                              {stat.isCount ? stat.value : `${stat.sign || ""}${formatTaka(stat.value)}`}
                            </p>
                          </div>
                        ))}
                      </div>

                      {owes ? (
                        <div className="mm-rise mt-5" style={{ animationDelay: "0.3s" }}>
                          {showPayForm ? (
                            <form
                              onSubmit={handlePaySubmit}
                              className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                            >
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                                    Amount paid
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-white/40"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                                    Paid on
                                  </label>
                                  <input
                                    type="date"
                                    value={payDate}
                                    onChange={(e) => setPayDate(e.target.value)}
                                    className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-white/40"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                                    Which bill is this settling? (optional)
                                  </label>
                                  <select
                                    value={settlesItemId}
                                    onChange={(e) => setSettlesItemId(e.target.value)}
                                    className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-white/40"
                                  >
                                    <option value="" className="text-black">
                                      Not settling anything — this is a new/unrelated payment
                                    </option>
                                    {outstandingBills.map((bill) => (
                                      <option key={bill.id} value={bill.id} className="text-black">
                                        {bill.purpose} — {formatTaka(bill.stillOwed)} still owed
                                        {bill.eventClientName ? ` (${bill.eventClientName})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="mt-1.5 text-[10px] leading-relaxed text-white/45">
                                    Leave this as "Not settling anything" for an instant/unrelated buy —
                                    picking a bill here is the only thing that reduces its still-owed amount.
                                  </p>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                                    Note (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={payNote}
                                    onChange={(e) => setPayNote(e.target.value)}
                                    placeholder={`e.g. Paid ${data.vendor.name} in cash`}
                                    className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-white/40"
                                  />
                                </div>
                              </div>

                              {payError ? (
                                <p className="mt-3 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300">
                                  <AlertCircle size={13} /> {payError}
                                </p>
                              ) : null}

                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="submit"
                                  disabled={isPaySubmitting}
                                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <HandCoins size={14} />
                                  {isPaySubmitting ? "Recording\u2026" : "Confirm Payment"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowPayForm(false);
                                    setSettlesItemId("");
                                    setPayError("");
                                  }}
                                  className="rounded-xl px-4 py-2.5 text-xs font-black text-white/60 transition-colors duration-200 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowPayForm(true)}
                              className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 text-xs font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/50 hover:bg-emerald-500/10"
                            >
                              <HandCoins size={15} className="text-emerald-400" />
                              Record a Payment to This Vendor
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-7">
                  <div className="overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_2px_24px_-8px_rgba(0,0,0,.14)]">
                    <div className="flex flex-col gap-3 border-b border-black/6 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B0B0F] text-white">
                          <ReceiptText size={14} />
                        </span>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/75">
                            Transaction History
                          </p>
                          <p className="text-[10px] text-black/55">Across every employee</p>
                        </div>
                      </div>
                      <div className="-mb-px flex gap-1">
                        {[
                          { key: "all", label: "All" },
                          { key: "to_pay", label: "To Pay" },
                          { key: "paid", label: "Paid" },
                        ].map((tab) => {
                          const isActive = statusFilter === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setStatusFilter(tab.key)}
                              className={`relative px-3.5 py-3 text-xs font-black transition-colors duration-300 ${
                                isActive ? "text-black" : "text-black/55 hover:text-black/70"
                              }`}
                            >
                              {tab.label}
                              <span
                                className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0B0B0F] transition-all duration-400 ${
                                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mm-scroll max-h-[calc(100vh-18rem)] min-h-70 overflow-y-auto p-4 sm:p-5">
                      {visible.length === 0 ? (
                        <div className="mm-pop flex flex-col items-center rounded-2xl border border-dashed border-black/12 bg-[#fafafa] px-4 py-16 text-center">
                          <span className="mm-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black/40 shadow-sm">
                            <ReceiptText size={22} />
                          </span>
                          <p className="mt-3.5 text-sm font-black text-black/55">
                            {transactions.length === 0
                              ? "No transactions with this vendor yet."
                              : "Nothing in this filter."}
                          </p>
                          <p className="mt-1 max-w-xs text-xs text-black/55">
                            {transactions.length === 0
                              ? "Pick this vendor while logging a cost to start the ledger."
                              : "Switch to another tab to see more."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {visible.map((tx, index) => {
                            const isPending = tx.paymentStatus === "to_pay";
                            return (
                              <div
                                key={tx.id}
                                className={`mm-slide group rounded-2xl border bg-white p-4 transition-all duration-400 hover:-translate-y-0.5 ${
                                  isPending
                                    ? "border-amber-200 hover:border-amber-400 hover:shadow-[0_12px_28px_-14px_rgba(245,158,11,.6)]"
                                    : "border-black/8 hover:border-emerald-300 hover:shadow-[0_12px_28px_-14px_rgba(16,185,129,.5)]"
                                }`}
                                style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <div
                                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-400 group-hover:scale-110 group-hover:rotate-3 ${
                                        isPending
                                          ? "bg-amber-50 text-amber-600"
                                          : "bg-emerald-50 text-emerald-600"
                                      }`}
                                    >
                                      {isPending ? <Clock3 size={17} /> : <ReceiptText size={17} />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-black">{tx.purpose}</p>
                                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-black/55">
                                        <span className="inline-flex items-center gap-1">
                                          <UserRound size={10} /> {tx.employeeName}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          <CalendarDays size={10} /> {formatDisplayDate(tx.costDate)}
                                        </span>
                                        <span className="rounded bg-black/5 px-1.5 py-0.5 font-black text-black/45">
                                          {tx.costType === "event" ? tx.eventClientName || "Event" : "Regular"}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                                    <span
                                      className={`text-sm font-black ${isPending ? "text-rose-600" : "text-emerald-600"}`}
                                    >
                                      {isPending ? "−" : "+"}
                                      {formatTaka(tx.totalAmount)}
                                    </span>
                                    <span
                                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                        isPending
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-emerald-100 text-emerald-700"
                                      }`}
                                    >
                                      {isPending ? "To Pay" : "Paid"}
                                    </span>
                                    {!isPending && !tx.settlesItemId ? (
                                      <span
                                        className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700"
                                        title="Not linked to any bill — a standalone/unrelated payment."
                                      >
                                        Instant Buy
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </EmployeeLayout>
  );
}
