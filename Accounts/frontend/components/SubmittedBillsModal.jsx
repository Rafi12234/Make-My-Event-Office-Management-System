import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  PartyPopper,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatTaka,
  resolveImageUrl,
} from "../services/accountsService";
import { loadSubmittedBills } from "../services/submittedBillsService";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "corrected", label: "Corrected" },
];

function ReviewBadge({ status }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
        <CheckCircle2 size={11} /> Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
        <XCircle size={11} /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
      <Clock3 size={11} /> Pending
    </span>
  );
}

function CorrectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">
      <Sparkles size={11} /> Corrected
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.slate}`}>
          <Icon size={17} />
        </span>
        <div>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function BillDetails({ bill }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        {bill.reviewStatus === "approved" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Approved</p>
            <p className="mt-1 text-xs font-bold text-emerald-900">
              {bill.approvedByName || "Admin"}
              {bill.approvedAt ? ` · ${formatDisplayDateTime(bill.approvedAt)}` : ""}
            </p>
          </div>
        ) : null}

        {bill.reviewStatus === "rejected" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-600">Rejected by admin</p>
            <p className="mt-1 text-xs font-bold text-rose-900">
              {bill.rejectedByName || "Admin"}
              {bill.rejectedAt ? ` · ${formatDisplayDateTime(bill.rejectedAt)}` : ""}
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-rose-700">
              {bill.rejectedReason || "No rejection reason was recorded."}
            </p>
          </div>
        ) : null}

        {bill.wasCorrected ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Admin correction</p>
            <p className="mt-1 text-xs font-bold text-violet-900">
              Bill details were corrected
              {bill.correctedAt ? ` · ${formatDisplayDateTime(bill.correctedAt)}` : ""}
            </p>
          </div>
        ) : null}

        {bill.reviewStatus === "pending" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Awaiting review</p>
            <p className="mt-1 text-xs font-bold text-amber-900">This bill is still waiting for admin approval.</p>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Purpose</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Cost Date</th>
              <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-wider text-slate-500">Qty</th>
              <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-wider text-slate-500">Per Qty</th>
              <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Vendor</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Payment</th>
              <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 font-bold text-slate-800">{item.purpose}</td>
                <td className="px-3 py-3 text-slate-600">{formatDisplayDate(item.costDate) || "—"}</td>
                <td className="px-3 py-3 text-right text-slate-600">{item.quantity}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-700">{formatTaka(item.perQtyAmount)}</td>
                <td className="px-3 py-3 text-right font-black text-slate-900">{formatTaka(item.totalAmount)}</td>
                <td className="px-3 py-3 text-slate-600">{item.vendorName || "—"}</td>
                <td className="px-3 py-3">
                  {item.paymentStatus ? (
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                      item.paymentStatus === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {item.paymentStatus === "paid" ? "Paid" : "To Pay"}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-3">
                  {item.receiptUrl ? (
                    <a
                      href={resolveImageUrl(item.receiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-black text-violet-600 hover:text-violet-800"
                    >
                      <Paperclip size={12} /> View
                    </a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SubmittedBillsModal({ open, onClose }) {
  const [data, setData] = useState({ bills: [], summary: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [costType, setCostType] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      const result = await loadSubmittedBills();
      setData({ bills: result.bills || [], summary: result.summary || {} });
    } catch (err) {
      setError(err.message || "Could not load your submitted bills.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const filteredBills = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data.bills || []).filter((bill) => {
      if (filter === "corrected" && !bill.wasCorrected) return false;
      if (filter !== "all" && filter !== "corrected" && bill.reviewStatus !== filter) return false;
      if (costType !== "all" && bill.costType !== costType) return false;
      if (!search) return true;
      return [
        bill.id,
        bill.eventClientName,
        bill.costType,
        ...(bill.items || []).map((item) => item.purpose),
        ...(bill.items || []).map((item) => item.vendorName),
      ].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [data.bills, filter, costType, query]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[96vh] w-[98vw] max-w-[1650px] flex-col overflow-hidden rounded-[28px] border border-white/30 bg-[#f8f9fb] shadow-2xl sm:h-[94vh] sm:w-[96vw]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <FileCheck2 size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">My Accounts</p>
              <h2 className="mt-0.5 text-xl font-black text-slate-900 sm:text-2xl">My Submitted Bills</h2>
              <p className="mt-1 text-sm text-slate-500">
                Every cost you submitted, with the latest admin review status.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard icon={FileText} label="Total Submitted" value={data.summary.total || 0} tone="slate" />
            <SummaryCard icon={Clock3} label="Pending" value={data.summary.pending || 0} tone="amber" />
            <SummaryCard icon={ShieldCheck} label="Approved" value={data.summary.approved || 0} tone="emerald" />
            <SummaryCard icon={XCircle} label="Rejected" value={data.summary.rejected || 0} tone="rose" />
            <SummaryCard icon={Sparkles} label="Corrected" value={data.summary.corrected || 0} tone="violet" />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                      filter === item.key
                        ? "bg-slate-900 text-white shadow-md"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search bill, client, purpose..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white sm:w-72"
                  />
                </div>
                <div className="relative">
                  <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={costType}
                    onChange={(event) => setCostType(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-xs font-black text-slate-700 outline-none sm:w-40"
                  >
                    <option value="all">All types</option>
                    <option value="event">Event Based</option>
                    <option value="regular">Regular</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">
              <AlertCircle size={18} />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {isLoading && !data.bills.length ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 size={28} className="animate-spin" />
                <p className="text-sm font-bold">Loading submitted bills...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
                <FileText size={34} className="text-slate-300" />
                <p className="font-black text-slate-500">No submitted bills match this view.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Bill</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Type / Event</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Submitted</th>
                      <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Amount</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Review Status</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Admin Update</th>
                      <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill) => {
                      const openRow = expandedId === bill.id;
                      const isEvent = bill.costType === "event";
                      return (
                        <Fragment key={bill.id}>
                          <tr key={bill.id} className="border-b border-slate-100 align-middle hover:bg-slate-50/70">
                            <td className="px-4 py-4">
                              <p className="text-sm font-black text-slate-900">#{bill.id}</p>
                              <p className="mt-0.5 text-[10px] font-bold text-slate-400">{bill.items.length} item{bill.items.length === 1 ? "" : "s"}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isEvent ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                                  {isEvent ? <PartyPopper size={14} /> : <Briefcase size={14} />}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-800">{isEvent ? "Event Based" : "Regular"}</p>
                                  {isEvent ? (
                                    <p className="mt-0.5 max-w-60 truncate text-xs font-semibold text-slate-500">
                                      {bill.eventClientName || "Event"}{bill.eventDate ? ` · ${formatDisplayDate(bill.eventDate)}` : ""}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-slate-600">{formatDisplayDateTime(bill.submittedAt) || "—"}</td>
                            <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatTaka(bill.totalAmount)}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                <ReviewBadge status={bill.reviewStatus} />
                                {bill.wasCorrected ? <CorrectedBadge /> : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-slate-600">
                              {bill.reviewStatus === "approved" ? (
                                <>
                                  <p className="font-black text-emerald-700">Approved by {bill.approvedByName || "Admin"}</p>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{formatDisplayDateTime(bill.approvedAt)}</p>
                                </>
                              ) : bill.reviewStatus === "rejected" ? (
                                <>
                                  <p className="font-black text-rose-700">Rejected by {bill.rejectedByName || "Admin"}</p>
                                  <p className="mt-0.5 max-w-56 truncate text-[10px] text-rose-500" title={bill.rejectedReason || ""}>{bill.rejectedReason || "Reason not recorded"}</p>
                                </>
                              ) : bill.wasCorrected ? (
                                <p className="font-black text-violet-700">Corrected · awaiting review</p>
                              ) : (
                                <p className="font-black text-amber-700">Waiting for admin</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(openRow ? null : bill.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                {openRow ? "Hide" : "View"}
                                <ChevronDown size={13} className={`transition-transform ${openRow ? "rotate-180" : ""}`} />
                              </button>
                            </td>
                          </tr>
                          {openRow ? (
                            <tr key={`${bill.id}-details`}>
                              <td colSpan={7} className="p-0">
                                <BillDetails bill={bill} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
