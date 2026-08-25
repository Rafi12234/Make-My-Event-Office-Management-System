import { useState } from "react";
import { CalendarDays, ChevronDown, HandCoins, Lock, Paperclip, ReceiptText } from "lucide-react";
import { formatDisplayDate, formatDisplayDateTime, formatTaka, resolveImageUrl } from "../services/accountsService";

function ExpenseHistoryRow({ expense }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#d6d6d6]/60 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f4f4] text-black">
            <ReceiptText size={15} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-black">
              {expense.costType === "event" ? expense.eventClientName || "Event based cost" : "Regular cost"}
            </p>
            <p className="text-xs text-black/50">
              {expense.costType === "event" && expense.eventDate
                ? `Event date: ${formatDisplayDate(expense.eventDate)} \u00b7 `
                : ""}
              Submitted {formatDisplayDateTime(expense.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-black text-black">-{formatTaka(expense.totalAmount)}</span>
          <ChevronDown size={16} className={`text-black/40 transition ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-[#d6d6d6]/50 px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="text-left font-black uppercase tracking-[0.1em] text-black/40">
                  <th className="py-2 pr-3">Purpose</th>
                  <th className="py-2 pr-3">Updated Time</th>
                  <th className="py-2 pr-3">Cost Date</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Per QTY</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {expense.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#d6d6d6]/30">
                    <td className="py-2 pr-3 font-bold text-black">{item.purpose}</td>
                    <td className="py-2 pr-3 text-black/60">{formatDisplayDateTime(item.updatedTime)}</td>
                    <td className="py-2 pr-3 text-black/60">{formatDisplayDate(item.costDate)}</td>
                    <td className="py-2 pr-3 text-black/60">{item.quantity}</td>
                    <td className="py-2 pr-3 text-black/60">{formatTaka(item.perQtyAmount)}</td>
                    <td className="py-2 pr-3 font-black text-black">{formatTaka(item.totalAmount)}</td>
                    <td className="py-2 pr-3">
                      {item.receiptUrl ? (
                        <a
                          href={resolveImageUrl(item.receiptUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-black underline underline-offset-2"
                        >
                          <Paperclip size={12} /> View
                        </a>
                      ) : (
                        <span className="text-black/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Full read-only history of past money-received entries and past
// submitted expenses. Everything here is permanently locked — no edit or
// delete controls, matching the backend's immutable audit-trail design.
export default function HistoryList({ moneyReceived, expenses }) {
  const [activeTab, setActiveTab] = useState("expenses");

  return (
    <div className="rounded-2xl border border-[#d6d6d6]/70 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-black/50">
          <Lock size={13} /> History (locked records)
        </div>
        <div className="flex gap-1.5 rounded-xl border border-[#d6d6d6]/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
              activeTab === "expenses" ? "bg-black text-white" : "text-black/60 hover:bg-[#f4f4f4]"
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
              activeTab === "received" ? "bg-black text-white" : "text-black/60 hover:bg-[#f4f4f4]"
            }`}
          >
            Money Received
          </button>
        </div>
      </div>

      {activeTab === "expenses" ? (
        expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-black/50">No costs submitted yet.</p>
        ) : (
          <div className="space-y-2.5">
            {expenses.map((expense) => (
              <ExpenseHistoryRow key={expense.id} expense={expense} />
            ))}
          </div>
        )
      ) : moneyReceived.length === 0 ? (
        <p className="py-6 text-center text-sm text-black/50">No money received logged yet.</p>
      ) : (
        <div className="space-y-2">
          {moneyReceived.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#d6d6d6]/60 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f4f4] text-black">
                  <HandCoins size={15} />
                </div>
                <div>
                  <p className="text-sm font-black text-black">{entry.note || "Money received"}</p>
                  <p className="flex items-center gap-1 text-xs text-black/50">
                    <CalendarDays size={12} /> {formatDisplayDate(entry.receivedDate)}
                  </p>
                </div>
              </div>
              <span className="text-sm font-black text-black">+{formatTaka(entry.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
