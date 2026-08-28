import { Link } from "react-router";
import { ArrowUpRight, HandCoins, ReceiptText, Store } from "lucide-react";

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

// Compact action rail — sized to its content so buttons never stretch
// across the viewport the way full-width blocks do.
export default function QuickActionsPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {ACTIONS.map(({ to, icon: Icon, title, caption, ring, tint, glow }, index) => (
        <Link
          key={to}
          to={to}
          className={`mm-rise group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/8 bg-white p-4 text-left ring-2 ring-transparent transition-all duration-400 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,.28)] active:scale-[.98] ${ring} ${
            index === 2 ? "sm:col-span-2 xl:col-span-1" : ""
          }`}
          style={{ animationDelay: `${index * 80 + 120}ms` }}
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
          <ArrowUpRight
            size={17}
            className="relative shrink-0 text-black/30 transition-all duration-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black"
          />
        </Link>
      ))}
    </div>
  );
}
