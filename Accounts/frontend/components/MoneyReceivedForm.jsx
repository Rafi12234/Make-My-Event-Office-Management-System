import { useState } from "react";
import { AlertCircle, Check, Lock } from "lucide-react";
import { addMoneyReceived, formatTaka } from "../services/accountsService";

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

const FIELD =
  "w-full rounded-xl border border-black/12 bg-white px-3.5 py-3 text-sm font-bold text-black outline-none transition-all duration-300 focus:border-black focus:ring-4 focus:ring-black/8";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-black/55";

// Quick-entry form for a repeatable "Money Received" record. Each entry is
// immutable once added (the backend has no edit/delete endpoint for it).
export default function MoneyReceivedForm({ onAdded, onCancel }) {
  const [amount, setAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const numericAmount = Number(amount);
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isAmountValid) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!receivedDate) {
      setError("Received date is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addMoneyReceived({ amount: numericAmount, receivedDate, note });
      setAmount("");
      setNote("");
      onAdded?.(result);
    } catch (err) {
      setError(err.message || "Could not save this entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-6 p-5 sm:p-7">
        <div
          className="mm-rise relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-white p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />

          <label className={LABEL}>How much did you receive?</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-600/30">
              ৳
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full rounded-2xl border border-black/10 bg-white py-5 pl-12 pr-4 text-3xl font-black tracking-tight text-black outline-none transition-all duration-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
            />
          </div>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((quick, index) => (
              <button
                key={quick}
                type="button"
                onClick={() => setAmount(String((Number(amount) || 0) + quick))}
                className="mm-pop rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black text-black/55 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-90"
                style={{ animationDelay: `${index * 45 + 80}ms` }}
              >
                +{quick.toLocaleString("en-US")}
              </button>
            ))}
            {amount ? (
              <button
                type="button"
                onClick={() => setAmount("")}
                className="rounded-xl px-3 py-1.5 text-[11px] font-black text-black/55 transition-colors duration-200 hover:text-rose-500"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="mm-rise grid gap-5 sm:grid-cols-2" style={{ animationDelay: "0.1s" }}>
          <div>
            <label className={LABEL}>Received on</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cash from boss"
              className={FIELD}
            />
          </div>
        </div>

        {error ? (
          <p className="mm-pop flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            <AlertCircle size={15} /> {error}
          </p>
        ) : null}

        <p className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-[11px] leading-relaxed text-black/45">
          <Lock size={12} className="mt-0.5 shrink-0" />
          Once added this entry is locked permanently and cannot be edited or deleted.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/8 bg-[#fafafa] px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Adding</p>
          <p className="truncate text-xl font-black tracking-tight text-emerald-600">
            +{formatTaka(isAmountValid ? numericAmount : 0)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-black text-black/60 transition-all duration-300 hover:border-black/30 hover:text-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isAmountValid}
            className="mm-sheen inline-flex items-center gap-2 rounded-xl bg-[#0B0B0F] px-6 py-3 text-sm font-black text-white shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Check size={16} />
            )}
            {isSubmitting ? "Saving…" : "Add to Wallet"}
          </button>
        </div>
      </div>
    </form>
  );
}
