import { useMemo, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock3,
  HandCoins,
  Inbox,
  Lock,
  Paperclip,
  PartyPopper,
  ReceiptText,
  Search,
  Store,
  X,
} from "lucide-react";
import { formatDisplayDate, formatDisplayDateTime, formatTaka, resolveImageUrl } from "../services/accountsService";

function StatusPill({ status }) {
  if (!status) return null;
  const isPaid = status === "paid";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {isPaid ? null : <Clock3 size={9} />}
      {isPaid ? "Paid" : "To Pay"}
    </span>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="mm-pop flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/12 bg-[#fafafa] px-4 py-16 text-center">
      <span className="mm-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black/40 shadow-sm">
        <Icon size={22} />
      </span>
      <p className="mt-3.5 text-sm font-black text-black/55">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-xs leading-relaxed text-black/55">{hint}</p> : null}
    </div>
  );
}

function ExpenseHistoryRow({ expense, index }) {
  const [isOpen, setIsOpen] = useState(false);
  const isEvent = expense.costType === "event";

  return (
    <div
      className={`mm-slide overflow-hidden rounded-2xl border bg-white transition-all duration-400 ${
        isOpen
          ? "border-black/25 shadow-[0_16px_36px_-16px_rgba(0,0,0,.3)]"
          : "border-black/8 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,.25)]"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-400 group-hover:scale-110 group-hover:rotate-3 ${
              isEvent ? "bg-violet-50 text-violet-600" : "bg-black/5 text-black/55"
            }`}
          >
            {isEvent ? <PartyPopper size={17} /> : <Briefcase size={17} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-black">
              {isEvent ? expense.eventClientName || "Event based cost" : "Regular cost"}
            </p>
            <p className="truncate text-xs text-black/55">
              {isEvent && expense.eventDate ? `Event ${formatDisplayDate(expense.eventDate)} • ` : ""}
              {expense.items.length} item{expense.items.length === 1 ? "" : "s"} •{" "}
              {formatDisplayDateTime(expense.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-sm font-black text-rose-600">−{formatTaka(expense.totalAmount)}</span>
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-400 ${
              isOpen ? "rotate-180 bg-[#0B0B0F] text-white" : "bg-black/5 text-black/55 group-hover:bg-black/10"
            }`}
          >
            <ChevronDown size={14} />
          </span>
        </div>
      </button>

      {/* Animated height via grid-rows so it eases open instead of snapping. */}
      <div
        className={`grid transition-all duration-400 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-black/6 bg-[#fafafa] p-3 sm:p-4">
            <div className="mm-scroll overflow-x-auto rounded-xl border border-black/8 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-black/8 bg-black/[0.02]">
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Purpose
                    </th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Cost Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Per Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Total
                    </th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Vendor
                    </th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expense.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-black/6 transition-colors duration-200 last:border-b-0 hover:bg-black/[0.02]"
                    >
                      <td className="px-3 py-2.5 font-black text-black">{item.purpose}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-black/50">
                        {formatDisplayDate(item.costDate)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-black/60">{item.quantity}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-black/60">
                        {formatTaka(item.perQtyAmount)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right font-black tabular-nums ${
                          item.paymentStatus === "to_pay"
                            ? "text-rose-600"
                            : item.paymentStatus === "paid"
                              ? "text-emerald-600"
                              : "text-black"
                        }`}
                      >
                        {item.paymentStatus === "to_pay" ? "−" : item.paymentStatus === "paid" ? "+" : ""}
                        {formatTaka(item.totalAmount)}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.vendorName ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-black text-black/60">
                            <Store size={9} /> {item.vendorName}
                          </span>
                        ) : (
                          <span className="text-black/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.paymentStatus ? (
                          <StatusPill status={item.paymentStatus} />
                        ) : (
                          <span className="text-black/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.receiptUrl ? (
                          <a
                            href={resolveImageUrl(item.receiptUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black text-black/60 transition-all duration-300 hover:bg-[#0B0B0F] hover:text-white"
                          >
                            <Paperclip size={10} /> View
                          </a>
                        ) : (
                          <span className="text-black/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black/10 bg-black/[0.02]">
                    <td
                      colSpan={4}
                      className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-[0.14em] text-black/55"
                    >
                      Total
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-black tabular-nums text-black">
                      {formatTaka(expense.totalAmount)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VendorPaymentRow({ payment, index }) {
  const isPending = payment.paymentStatus === "to_pay";

  return (
    <div
      className={`mm-slide group flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3.5 transition-all duration-400 hover:-translate-y-0.5 ${
        isPending
          ? "border-amber-200 hover:border-amber-400 hover:shadow-[0_12px_28px_-14px_rgba(245,158,11,.6)]"
          : "border-black/8 hover:border-emerald-300 hover:shadow-[0_12px_28px_-14px_rgba(16,185,129,.5)]"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-400 group-hover:scale-110 group-hover:rotate-3 ${
            isPending ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <Store size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-black">{payment.vendorName || "Vendor"}</p>
          <p className="truncate text-xs text-black/55">
            {payment.purpose} • {payment.costType === "event" ? payment.eventClientName || "Event" : "Regular"} •{" "}
            {formatDisplayDate(payment.costDate)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-sm font-black ${isPending ? "text-rose-600" : "text-emerald-600"}`}>
          {isPending ? "−" : "+"}
          {formatTaka(payment.totalAmount)}
        </span>
        <StatusPill status={payment.paymentStatus} />
        {!isPending && !payment.settlesItemId ? (
          <span
            className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-700"
            title="Not linked to any bill — a standalone/unrelated payment."
          >
            Instant Buy
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Read-only feed of money received, submitted costs, and vendor payments.
// Everything here is permanently locked — no edit or delete controls,
// matching the backend's immutable audit-trail design.
export default function HistoryList({ moneyReceived, expenses, vendorPayments = [] }) {
  const [activeTab, setActiveTab] = useState("expenses");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return { expenses, vendorPayments, moneyReceived };
    return {
      expenses: expenses.filter(
        (expense) =>
          (expense.eventClientName || "").toLowerCase().includes(needle) ||
          expense.items.some((item) => item.purpose.toLowerCase().includes(needle)),
      ),
      vendorPayments: vendorPayments.filter(
        (payment) =>
          (payment.vendorName || "").toLowerCase().includes(needle) ||
          payment.purpose.toLowerCase().includes(needle),
      ),
      moneyReceived: moneyReceived.filter((entry) => (entry.note || "").toLowerCase().includes(needle)),
    };
  }, [needle, expenses, vendorPayments, moneyReceived]);

  const pendingCount = vendorPayments.filter((payment) => payment.paymentStatus === "to_pay").length;

  const tabs = [
    { key: "expenses", label: "Expenses", icon: ReceiptText, count: expenses.length },
    { key: "vendorPayments", label: "Vendors", icon: Store, count: vendorPayments.length },
    { key: "received", label: "Money In", icon: HandCoins, count: moneyReceived.length },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_2px_24px_-8px_rgba(0,0,0,.14)]">
      <div className="border-b border-black/6 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B0B0F] text-white">
              <Lock size={14} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/75">Activity</p>
              <p className="text-[10px] text-black/55">Locked records — cannot be edited</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2.5 transition-all duration-300 focus-within:border-black focus-within:bg-white focus-within:ring-4 focus-within:ring-black/5 lg:w-72">
            <Search size={14} className="shrink-0 text-black/45" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity…"
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:font-normal placeholder:text-black/45"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 rounded-md p-0.5 text-black/45 transition-all duration-200 hover:rotate-90 hover:text-black"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Underline indicator slides between tabs. */}
        <div className="mm-scroll -mb-px mt-3 flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon, count }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`group relative inline-flex shrink-0 items-center gap-2 px-3.5 py-3 text-xs font-black transition-colors duration-300 ${
                  isActive ? "text-black" : "text-black/55 hover:text-black/70"
                }`}
              >
                <Icon
                  size={14}
                  className={`transition-transform duration-400 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
                />
                {label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] transition-all duration-300 ${
                    isActive ? "bg-[#0B0B0F] text-white" : "bg-black/6 text-black/45"
                  }`}
                >
                  {count}
                </span>
                {key === "vendorPayments" && pendingCount > 0 ? (
                  <span
                    className="mm-ring h-1.5 w-1.5 rounded-full bg-amber-500"
                    title={`${pendingCount} still to pay`}
                  />
                ) : null}
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0B0B0F] transition-all duration-400 ${
                    isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mm-scroll min-h-70 flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "expenses" ? (
          filtered.expenses.length === 0 ? (
            <EmptyState
              icon={needle ? Search : Inbox}
              title={needle ? "No expenses match your search." : "No costs submitted yet."}
              hint={needle ? "Try a different keyword." : "Use “Log a Cost” to record your first spending."}
            />
          ) : (
            <div className="space-y-2.5">
              {filtered.expenses.map((expense, index) => (
                <ExpenseHistoryRow key={expense.id} expense={expense} index={index} />
              ))}
            </div>
          )
        ) : activeTab === "vendorPayments" ? (
          filtered.vendorPayments.length === 0 ? (
            <EmptyState
              icon={needle ? Search : Store}
              title={needle ? "No vendor payments match your search." : "No vendor payments yet."}
              hint={
                needle
                  ? "Try a different keyword."
                  : "Pick a vendor while logging a cost to track what you paid or still owe."
              }
            />
          ) : (
            <div className="space-y-2">
              {filtered.vendorPayments.map((payment, index) => (
                <VendorPaymentRow key={payment.id} payment={payment} index={index} />
              ))}
            </div>
          )
        ) : filtered.moneyReceived.length === 0 ? (
          <EmptyState
            icon={needle ? Search : HandCoins}
            title={needle ? "No entries match your search." : "No money received logged yet."}
            hint={needle ? "Try a different keyword." : "Record cash from your boss with “Money In”."}
          />
        ) : (
          <div className="space-y-2">
            {filtered.moneyReceived.map((entry, index) => (
              <div
                key={entry.id}
                className="mm-slide group flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3.5 transition-all duration-400 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_28px_-14px_rgba(16,185,129,.5)]"
                style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-all duration-400 group-hover:scale-110 group-hover:rotate-3">
                    <HandCoins size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-black">{entry.note || "Money received"}</p>
                    <p className="flex items-center gap-1 text-xs text-black/55">
                      <CalendarDays size={11} /> {formatDisplayDate(entry.receivedDate)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-black text-emerald-600">+{formatTaka(entry.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
