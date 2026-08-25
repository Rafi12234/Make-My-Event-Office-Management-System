import { useState } from "react";
import { HandCoins } from "lucide-react";
import { addMoneyReceived } from "../services/accountsService";

// Quick-entry form for logging a repeatable "Money Received" record.
// Each submission is immutable once added (matches the backend, which has
// no edit/delete endpoint for account_money_received).
export default function MoneyReceivedForm({ onAdded }) {
  const [amount, setAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#d6d6d6]/70 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-black/50">
        <HandCoins size={14} /> Log Money Received
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm outline-none focus:border-black"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Received Date</label>
          <input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm outline-none focus:border-black"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-black/60">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. From boss - cash"
            className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2.5 text-sm outline-none focus:border-black"
          />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-red-500">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#222222] disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Add to Wallet"}
      </button>
    </form>
  );
}
