import { CalendarDays, Paperclip, Plus, Trash2 } from "lucide-react";
import { formatDisplayDate, formatTaka } from "../services/accountsService";

function emptyItem() {
  return {
    purpose: "",
    costDate: new Date().toISOString().slice(0, 10),
    quantity: "1",
    perQtyAmount: "",
    receiptFile: null,
  };
}

export { emptyItem };

// The shared expense item table used by both Event Based Cost and Regular
// Cost flows (Purpose, auto Updated Time, Cost Happened Date, Quantity,
// Per QTY Amount, auto Total, optional Cash Receipt). When eventDate is
// supplied (Event Based Cost with a confirmed client selected) an extra
// Event Date column is shown alongside Purpose/Updated Time. Rows are
// still editable here since nothing has been submitted yet — once "Submit
// Cost" succeeds the whole expense becomes read-only (see HistoryList).
export default function ExpenseItemsTable({ items, onChange, eventDate }) {
  function updateItem(index, patch) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, emptyItem()]);
  }

  const grandTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const perQtyAmount = Number(item.perQtyAmount) || 0;
    return sum + quantity * perQtyAmount;
  }, 0);

  return (
    <div className="rounded-2xl border border-[#d6d6d6]/70 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#d6d6d6]/70 bg-[#f4f4f4]/50 text-left text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
              <th className="px-3 py-3">Purpose</th>
              <th className="px-3 py-3">Updated Time</th>
              {eventDate ? <th className="px-3 py-3">Event Date</th> : null}
              <th className="px-3 py-3">Cost Happened Date</th>
              <th className="px-3 py-3">Quantity</th>
              <th className="px-3 py-3">Per QTY Amount</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Cash Receipt</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const total = (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
              return (
                <tr key={index} className="border-b border-[#d6d6d6]/40 last:border-b-0">
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={item.purpose}
                      onChange={(e) => updateItem(index, { purpose: e.target.value })}
                      placeholder="e.g. Venue decoration"
                      className="w-44 rounded-lg border border-[#d6d6d6] px-2.5 py-2 text-sm outline-none focus:border-black"
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-black/50">
                    Auto (now)
                  </td>
                  {eventDate ? (
                    <td className="px-3 py-2.5 whitespace-nowrap text-black/60">{formatDisplayDate(eventDate)}</td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <input
                      type="date"
                      value={item.costDate}
                      onChange={(e) => updateItem(index, { costDate: e.target.value })}
                      className="w-36 rounded-lg border border-[#d6d6d6] px-2.5 py-2 text-sm outline-none focus:border-black"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      className="w-20 rounded-lg border border-[#d6d6d6] px-2.5 py-2 text-sm outline-none focus:border-black"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.perQtyAmount}
                      onChange={(e) => updateItem(index, { perQtyAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-28 rounded-lg border border-[#d6d6d6] px-2.5 py-2 text-sm outline-none focus:border-black"
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-black text-black">
                    {formatTaka(total)}
                  </td>
                  <td className="px-3 py-2.5">
                    <label className="flex w-36 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#d6d6d6] px-2.5 py-2 text-xs text-black/60 hover:bg-[#f4f4f4]/50">
                      <Paperclip size={13} />
                      <span className="truncate">
                        {item.receiptFile ? item.receiptFile.name : "Attach image"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => updateItem(index, { receiptFile: e.target.files?.[0] || null })}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2.5">
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 transition hover:bg-red-50 hover:text-red-500"
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#d6d6d6]/70 px-4 py-3">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6d6d6] bg-white px-3.5 py-2 text-xs font-black text-black transition hover:bg-[#f4f4f4]/60"
        >
          <Plus size={14} /> Add Item
        </button>
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays size={14} className="text-black/40" />
          <span className="text-black/50">Grand Total</span>
          <span className="text-base font-black text-black">{formatTaka(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
