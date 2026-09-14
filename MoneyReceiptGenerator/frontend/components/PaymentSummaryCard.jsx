import { formatBDT } from "../utils/moneyFormatter";

const STATUS_STYLES = {
  paid: { label: "PAID", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partially_paid: { label: "PARTIALLY PAID", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  unpaid: { label: "UNPAID", className: "bg-red-50 text-red-700 ring-red-200" },
};

// Live-updating Total/Advance/Due summary — due is ALWAYS derived, never
// directly editable (guide requirement: admin never manually sets due).
export default function PaymentSummaryCard({ totalPayment, advancePayment, duePayment, paymentStatus }) {
  const status = paymentStatus ? STATUS_STYLES[paymentStatus] : null;

  return (
    <div className="rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Total</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatBDT(totalPayment || 0)}</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Advance</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatBDT(advancePayment || 0)}</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Due</p>
          <p className={`mt-1 text-lg font-black ${duePayment > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {duePayment === null ? "—" : formatBDT(duePayment)}
          </p>
        </div>
      </div>

      {status ? (
        <span
          className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${status.className}`}
        >
          {status.label}
        </span>
      ) : null}
    </div>
  );
}
