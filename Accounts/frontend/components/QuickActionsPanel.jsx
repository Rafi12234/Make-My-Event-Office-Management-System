import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, FileCheck2, HandCoins, ReceiptText, Store } from "lucide-react";
import SubmittedBillsModal from "./SubmittedBillsModal";

const ACTIONS = [
  {
    to: "/accounts/money-in",
    icon: HandCoins,
    title: "Money In",
    caption: "Log cash from your boss",
    ring: "group-hover:ring-emerald-400/40",
    tint: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white",
    glow: "bg-emerald-400/25",
  },
  {
    to: "/accounts/log-cost",
    icon: ReceiptText,
    title: "Log a Cost",
    caption: "Event based or regular",
    ring: "group-hover:ring-violet-400/40",
    tint: "bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    glow: "bg-violet-400/25",
  },
  {
    to: "/accounts/vendors",
    icon: Store,
    title: "Vendor Ledger",
    caption: "Balances & history",
    ring: "group-hover:ring-amber-400/40",
    tint: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
    glow: "bg-amber-400/25",
  },
];

function ActionCard({ icon: Icon, title, caption, ring, tint, glow, children, delay }) {
  return (
    <div
      className={`mm-rise group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/8 bg-white p-4 text-left ring-2 ring-transparent transition-all duration-400 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,.28)] active:scale-[.98] ${ring}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${glow}`}
      />
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-400 group-hover:scale-110 group-hover:rotate-6 ${tint}`}
      >
        <Icon size={20} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-black">{title}</span>
        <span className="block truncate text-xs text-black/45">{caption}</span>
      </span>
      {children}
    </div>
  );
}

// Compact action rail — includes a read-only employee bill-status view so an
// employee can see every bill they submitted and its admin review state.
export default function QuickActionsPanel() {
  const [showBills, setShowBills] = useState(false);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {ACTIONS.map(({ to, icon, title, caption, ring, tint, glow }, index) => (
          <Link key={to} to={to} className="block">
            <ActionCard
              icon={icon}
              title={title}
              caption={caption}
              ring={ring}
              tint={tint}
              glow={glow}
              delay={index * 80 + 120}
            >
              <ArrowUpRight
                size={17}
                className="relative shrink-0 text-black/30 transition-all duration-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black"
              />
            </ActionCard>
          </Link>
        ))}

        <button type="button" onClick={() => setShowBills(true)} className="block w-full">
          <ActionCard
            icon={FileCheck2}
            title="My Submitted Bills"
            caption="Pending, approved & rejected"
            ring="group-hover:ring-sky-400/40"
            tint="bg-sky-500/10 text-sky-600 group-hover:bg-sky-600 group-hover:text-white"
            glow="bg-sky-400/25"
            delay={360}
          >
            <ArrowUpRight
              size={17}
              className="relative shrink-0 text-black/30 transition-all duration-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black"
            />
          </ActionCard>
        </button>
      </div>

      <SubmittedBillsModal open={showBills} onClose={() => setShowBills(false)} />
    </>
  );
}
