import { Link } from "react-router";
import { ArrowRight, Clock3, ShieldCheck, Store } from "lucide-react";
import { formatTaka } from "../services/accountsService";

// Right-rail companion to the activity feed: what is still owed, per
// vendor. Derived from the summary already in memory, so it costs no
// extra request. Only "to pay" items count — paid ones are settled.
export default function VendorWatchPanel({ vendorOutstanding, totalPending }) {
  const top = vendorOutstanding.slice(0, 5);
  const largest = top[0]?.amount || 1;

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_2px_24px_-8px_rgba(0,0,0,.14)]">
      <div className="flex items-center justify-between gap-3 border-b border-black/6 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B0B0F] text-white">
            <Store size={15} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/75">Vendor Watch</p>
            <p className="text-[10px] text-black/55">What you still owe</p>
          </div>
        </div>
        {top.length > 0 ? (
          <span className="mm-ring rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
            {vendorOutstanding.length} due
          </span>
        ) : null}
      </div>

      {top.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span className="mm-bob mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck size={20} />
          </span>
          <p className="mt-3 text-sm font-black text-black/60">All settled</p>
          <p className="mt-0.5 text-xs text-black/55">You do not owe any vendor right now.</p>
        </div>
      ) : (
        <>
          <div className="border-b border-black/6 bg-gradient-to-br from-rose-50 to-white px-5 py-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-rose-700/70">
              Total Outstanding
            </p>
            <p className="mt-1 text-3xl font-black tracking-tighter text-rose-600">
              −{formatTaka(totalPending)}
            </p>
          </div>

          <div className="space-y-3.5 p-5">
            {top.map((vendor, index) => (
              <div key={vendor.name} className="mm-slide group" style={{ animationDelay: `${index * 70}ms` }}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-black text-black/75 transition-colors duration-200 group-hover:text-black">
                    {vendor.name}
                  </p>
                  <p className="shrink-0 text-xs font-black text-rose-600">−{formatTaka(vendor.amount)}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{
                      width: `${Math.max((vendor.amount / largest) * 100, 6)}%`,
                      transition: "width 1.1s cubic-bezier(.22,1,.36,1)",
                      transitionDelay: `${index * 70 + 150}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        to="/accounts/vendors"
        className="group flex items-center justify-between gap-2 border-t border-black/6 px-5 py-4 text-xs font-black text-black/60 transition-colors duration-300 hover:bg-[#0B0B0F] hover:text-white"
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={13} /> Open vendor ledger
        </span>
        <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1.5" />
      </Link>
    </div>
  );
}
