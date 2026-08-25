import { Wallet } from "lucide-react";
import { formatTaka } from "../services/accountsService";

// Top summary card showing the employee's live wallet balance
// (money received − expenses submitted so far). Can go negative.
export default function WalletSummaryCard({ currentBalance, totalReceived, totalSpent }) {
  const isNegative = currentBalance < 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col gap-5 bg-linear-to-r from-black to-[#333333] px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
              Current wallet balance
            </p>
            <p className={`mt-1 text-3xl font-black ${isNegative ? "text-red-300" : "text-white"}`}>
              {formatTaka(currentBalance)}
            </p>
          </div>
        </div>

        <div className="flex gap-6 sm:gap-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              Total received
            </p>
            <p className="mt-1 text-lg font-black text-white">{formatTaka(totalReceived)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              Total spent
            </p>
            <p className="mt-1 text-lg font-black text-white">{formatTaka(totalSpent)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
