import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock3, Sparkles, Wallet } from "lucide-react";
import { formatTaka } from "../services/accountsService";

// Eases 0 -> target on mount, and between values on later updates.
function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// Circular gauge of spent-vs-received; stroke animates via dashoffset.
function SpendGauge({ ratio }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, ratio));
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => setOffset(circumference * (1 - clamped / 100)), 200);
    return () => clearTimeout(timer);
  }, [clamped, circumference]);

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="url(#mm-gauge)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }}
        />
        <defs>
          <linearGradient id="mm-gauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={clamped >= 100 ? "#fb7185" : "#a78bfa"} />
            <stop offset="100%" stopColor={clamped >= 100 ? "#f43f5e" : "#22d3ee"} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none text-white">{Math.round(clamped)}%</span>
        <span className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/60">used</span>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tint, glow, delay }) {
  return (
    <div
      className="mm-rise group relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-500 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.08]"
      style={{ animationDelay: delay }}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60 ${glow}`}
      />
      <div className="relative flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}>
          <Icon size={13} />
        </span>
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/65">{label}</p>
      </div>
      <p className="relative mt-2.5 text-2xl font-black tracking-tight text-white">{formatTaka(value)}</p>
    </div>
  );
}

// Wallet command panel. "Pending to vendors" is money ordered but not yet
// handed over, so it sits outside both the balance and the spent figure.
export default function WalletSummaryCard({
  currentBalance,
  totalReceived,
  totalSpent,
  totalPending = 0,
}) {
  const animated = useCountUp(currentBalance);
  const isNegative = currentBalance < 0;
  const ratio = totalReceived > 0 ? (totalSpent / totalReceived) * 100 : 0;

  return (
    <div className="mm-pop relative h-full overflow-hidden rounded-[30px] bg-[#0B0B0F] shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)] ring-1 ring-white/10">
      {/* Ambient colour fields — decorative, must never block clicks. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mm-drift absolute -left-28 -top-32 h-96 w-96 rounded-full bg-violet-600/50 blur-[110px]" />
        <div
          className="mm-drift absolute -bottom-40 -right-16 h-96 w-96 rounded-full bg-cyan-500/30 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="mm-drift absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[100px]"
          style={{ animationDelay: "-11s" }}
        />
        <div className="mm-dots absolute inset-0 opacity-[0.35]" />
      </div>

      <div className="relative flex h-full flex-col justify-between gap-7 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mm-rise flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                <Wallet size={16} />
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/65">
                Current Balance
              </p>
            </div>

            <p
              className={`mm-rise mt-4 text-[2.75rem] font-black leading-none tracking-tighter sm:text-6xl ${
                isNegative ? "text-rose-400" : "text-white"
              }`}
              style={{ animationDelay: "0.06s" }}
            >
              {formatTaka(animated)}
            </p>

            <div
              className="mm-rise mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10"
              style={{ animationDelay: "0.12s" }}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isNegative ? "bg-rose-400" : "bg-emerald-400"}`}
              />
              <p className="text-[11px] font-bold text-white/75">
                {isNegative ? "Overspent — settle up with your boss" : "Cash you are still holding"}
              </p>
            </div>
          </div>

          {totalReceived > 0 ? (
            <div className="mm-pop hidden sm:block" style={{ animationDelay: "0.18s" }}>
              <SpendGauge ratio={ratio} />
            </div>
          ) : (
            <Sparkles size={22} className="mm-bob hidden text-white/25 sm:block" />
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Metric
            icon={ArrowDownLeft}
            label="Received"
            value={totalReceived}
            tint="bg-emerald-500/20 text-emerald-300"
            glow="bg-emerald-500"
            delay="0.2s"
          />
          <Metric
            icon={ArrowUpRight}
            label="Spent"
            value={totalSpent}
            tint="bg-rose-500/20 text-rose-300"
            glow="bg-rose-500"
            delay="0.27s"
          />
          <Metric
            icon={Clock3}
            label="To Pay"
            value={totalPending}
            tint="bg-amber-500/20 text-amber-300"
            glow="bg-amber-500"
            delay="0.34s"
          />
        </div>
      </div>
    </div>
  );
}
