import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { formatTaka } from "../services/adminAccountsService";

export function StatCard({ label, value, hint, tone = "slate", icon: Icon, index = 0 }) {
  const tones = {
    slate: "from-slate-50 to-white text-slate-900 border-slate-200",
    rose: "from-rose-50 to-white text-rose-700 border-rose-200",
    emerald: "from-emerald-50 to-white text-emerald-700 border-emerald-200",
    amber: "from-amber-50 to-white text-amber-700 border-amber-200",
    violet: "from-violet-50 to-white text-violet-700 border-violet-200",
  };
  return (
    <div
      className={`acc-stagger acc-lift group rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${
        tones[tone] || tones.slate
      }`}
      style={{ "--acc-i": index }}
    >
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider opacity-70">
        {Icon ? (
          <Icon size={13} className="transition-transform duration-300 group-hover:scale-125" />
        ) : null}
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight transition-transform duration-300 group-hover:translate-x-0.5">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs font-semibold opacity-60">{hint}</div> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = "", index = 0 }) {
  return (
    <section
      className={`acc-stagger rounded-2xl border border-rose-100 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md ${className}`}
      style={{ "--acc-i": index }}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-black text-slate-900">{title}</h2> : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

// Signed money display: negative is a liability/owed, positive is a credit.
export function Money({ value, invertColors = false, className = "" }) {
  const amount = Number(value) || 0;
  const positive = invertColors ? amount < 0 : amount > 0;
  const negative = invertColors ? amount > 0 : amount < 0;
  const tone = positive ? "text-emerald-600" : negative ? "text-rose-600" : "text-slate-700";
  return <span className={`font-black tabular-nums ${tone} ${className}`}>{formatTaka(amount)}</span>;
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide transition-transform duration-200 hover:scale-105 ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (status === "void") return <Badge tone="rose">Void</Badge>;
  return <Badge tone="emerald">Active</Badge>;
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

export function Notice({ notice, onDismiss }) {
  if (!notice) return null;
  const isError = notice.type === "error";
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-600"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <span className="flex items-start gap-2">
        {isError ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : null}
        {notice.message}
      </span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-400">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function EmptyBlock({ label }) {
  return <div className="py-10 text-center text-sm font-bold text-slate-400">{label}</div>;
}

export function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) {
    return <div className="pt-3 text-xs font-bold text-slate-400">{total} record(s)</div>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <span className="text-xs font-bold text-slate-500">
        Page {page} of {totalPages} · {total} record(s)
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-40 enabled:hover:bg-slate-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-40 enabled:hover:bg-slate-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Rendered via a portal straight into <body> — nesting it inside the page
// tree let an animated ancestor's transform become a containing block for
// this "fixed" overlay, shrinking the blur/dim to only the content column.
export function Modal({ open, title, onClose, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;
  return createPortal(
    <div className="acc-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        className={`acc-panel w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const PRESET_REASONS = [
  "Wrong quantity",
  "Wrong vendor",
  "Duplicate expense",
  "Incorrect amount",
  "Corrected according to invoice",
  "Entered by mistake",
  "Wrong employee",
  "Cancelled transaction",
];

// Every admin financial edit/void requires a written reason — it is stored
// on the audit trail alongside the before/after snapshot.
export function ReasonPicker({ value, onChange, label = "Reason for this change" }) {
  return (
    <div>
      <Field label={label}>
        <input
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Explain why this record is being changed"
        />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESET_REASONS.map((preset, index) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            style={{ "--acc-i": index }}
            className={`acc-press acc-stagger-fast rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              value === preset
                ? "border-rose-400 bg-rose-50 text-rose-600"
                : "border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

// Confirm dialog used before a destructive/financial action; requires a
// reason before the confirm button becomes usable.
export function ReasonModal({ open, title, description, confirmLabel, onCancel, onConfirm, busy }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {description ? (
        <p className="mb-4 text-sm font-semibold text-slate-500">{description}</p>
      ) : null}
      <ReasonPicker value={reason} onChange={setReason} />
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="acc-press rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={reason.trim().length < 3 || busy}
          onClick={() => onConfirm(reason.trim())}
          className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 disabled:opacity-40 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
