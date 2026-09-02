import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ImageUp,
  Info,
  Layers,
  Plus,
  Store,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { formatDisplayDate, formatTaka, loadVendorOutstandingItems } from "../services/accountsService";

function emptyItem() {
  return {
    purpose: "",
    costDate: new Date().toISOString().slice(0, 10),
    quantity: "1",
    perQtyAmount: "",
    receiptFile: null,
    vendorId: "",
    paymentStatus: "paid",
    settlesItemId: "",
  };
}

export { emptyItem };

const FIELD =
  "w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-xs font-bold text-black outline-none transition-all duration-300 focus:border-black focus:ring-4 focus:ring-black/8";

// Object URLs must be revoked when the file changes, otherwise every
// re-pick leaks the previous blob for the lifetime of the page.
function ReceiptCell({ file, onPick, onClear }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file) {
    return (
      <div className="mm-pop flex items-center gap-1.5">
        <img src={previewUrl} alt="" title={file.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        <button
          type="button"
          onClick={onClear}
          title="Remove receipt"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-black/45 transition-all duration-300 hover:rotate-90 hover:bg-rose-50 hover:text-rose-500"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <label className="group flex w-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/15 bg-[#fafafa] px-2 py-2.5 text-center text-[9px] font-bold text-black/55 transition-all duration-300 hover:border-black/45 hover:bg-black/[0.03] hover:text-black">
      <ImageUp size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
      Attach
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
    </label>
  );
}

// Cost-item editor shared by the Event Based and Regular flows.
//
// Two modes:
// - Regular (billMode=false): vendor is optional per item; picking one
//   requires a payment status, only "Paid" reduces the wallet.
// - Event bill (billMode=true): every item is a due-bill line for the ONE
//   vendor already chosen above this table (see ExpenseForm) — always
//   "To Pay", never deducts the wallet, so the per-row Vendor/Payment
//   status columns don't apply and are hidden entirely.
// Rendered as one card per item rather than a wide table, so nothing needs
// horizontal scrolling on a phone.
// Column widths are relative weights that always add up to the full table
// width — dragging a header edge steals weight from its right-hand neighbor
// instead of growing the table, so the row never needs to scroll.
const FULL_COLUMNS = [
  { label: "#", minWeight: 1.5 },
  { label: "What was this for?", minWeight: 8 },
  { label: "Cost happened on", minWeight: 8 },
  { label: "Quantity", minWeight: 8 },
  { label: "Amount / qty", minWeight: 7 },
  { label: "Item total", minWeight: 6 },
  {
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Store size={11} /> Vendor
      </span>
    ),
    minWeight: 8,
  },
  { label: "Payment status", minWeight: 8 },
  { label: "Receipt", minWeight: 5 },
  { label: "Actions", minWeight: 3, align: "right" },
];

const BILL_COLUMNS = [
  { label: "#", minWeight: 1.5 },
  { label: "What was this for?", minWeight: 8 },
  { label: "Cost happened on", minWeight: 8 },
  { label: "Quantity", minWeight: 8 },
  { label: "Amount / qty", minWeight: 7 },
  { label: "Item total", minWeight: 6 },
  { label: "Receipt", minWeight: 5 },
  { label: "Actions", minWeight: 3, align: "right" },
];

const DEFAULT_COL_WEIGHTS = [2, 14, 11, 16.5, 11.5, 8.5, 15, 11, 6.5, 4];
const DEFAULT_BILL_COL_WEIGHTS = [3, 24, 15, 20, 13, 10, 8, 7];
const COL_WEIGHTS_STORAGE_KEY = "mme-accounts-expense-item-col-weights";
const BILL_COL_WEIGHTS_STORAGE_KEY = "mme-accounts-expense-item-bill-col-weights";

function loadStoredColWeights(storageKey, defaults) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length === defaults.length && saved.every(Number.isFinite)) {
      return saved;
    }
  } catch {
    // ignore malformed/inaccessible storage, fall back to defaults
  }
  return defaults;
}

export default function ExpenseItemsTable({
  items,
  onChange,
  eventDate,
  vendors = [],
  invalidIndex = -1,
  billMode = false,
}) {
  const columns = billMode ? BILL_COLUMNS : FULL_COLUMNS;
  const storageKey = billMode ? BILL_COL_WEIGHTS_STORAGE_KEY : COL_WEIGHTS_STORAGE_KEY;
  const defaultWeights = billMode ? DEFAULT_BILL_COL_WEIGHTS : DEFAULT_COL_WEIGHTS;
  const [colWeights, setColWeights] = useState(() => loadStoredColWeights(storageKey, defaultWeights));
  const [outstandingByVendor, setOutstandingByVendor] = useState({});
  const tableRef = useRef(null);
  const resizeRef = useRef(null);

  // Cached per vendor so switching between items that share a vendor
  // never re-fetches — only lets an already-"Paid" item pick a bill.
  function ensureOutstandingLoaded(vendorId) {
    if (!vendorId || outstandingByVendor[vendorId] !== undefined) return;
    setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: null }));
    loadVendorOutstandingItems(vendorId)
      .then((bills) => setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: bills })))
      .catch(() => setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: [] })));
  }

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(colWeights));
    } catch {
      // ignore storage errors (e.g. private browsing quota)
    }
  }, [colWeights, storageKey]);

  function startColumnResize(index, e) {
    e.preventDefault();
    const tableWidth = tableRef.current?.getBoundingClientRect().width || 1;
    const totalWeight = colWeights.reduce((sum, w) => sum + w, 0);
    const startX = e.clientX;
    const startLeft = colWeights[index];
    const startRight = colWeights[index + 1];
    resizeRef.current = { index, tableWidth, totalWeight, startX, startLeft, startRight };

    function onMouseMove(moveEvent) {
      const state = resizeRef.current;
      if (!state) return;
      const deltaWeight = ((moveEvent.clientX - state.startX) / state.tableWidth) * state.totalWeight;
      const minLeft = columns[state.index].minWeight;
      const minRight = columns[state.index + 1].minWeight;
      const clampedDelta = Math.min(
        Math.max(deltaWeight, minLeft - state.startLeft),
        state.startRight - minRight,
      );
      setColWeights((weights) => {
        const next = [...weights];
        next[state.index] = state.startLeft + clampedDelta;
        next[state.index + 1] = state.startRight - clampedDelta;
        return next;
      });
    }

    function onMouseUp() {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function updateItem(index, patch) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, emptyItem()]);
  }

  function stepQuantity(index, delta) {
    const next = Math.max(0, (Number(items[index].quantity) || 0) + delta);
    updateItem(index, { quantity: String(next) });
  }

  const totals = items.reduce(
    (acc, item) => {
      const total = (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
      acc.grand += total;
      if (billMode || (item.vendorId && item.paymentStatus === "to_pay")) acc.pending += total;
      else acc.wallet += total;
      return acc;
    },
    { grand: 0, wallet: 0, pending: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-black/55">
          <Layers size={13} /> Cost Items ({items.length})
        </div>
        <div className="flex items-center gap-2">
          {eventDate ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B0B0F] px-3 py-1.5 text-[11px] font-black text-white">
              <CalendarClock size={12} /> Event {formatDisplayDate(eventDate)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={addItem}
            className="group flex items-center gap-1.5 rounded-lg border border-dashed border-black/25 bg-white px-3 py-1.5 text-[11px] font-black text-black/55 transition-all duration-300 hover:border-black hover:bg-[#0B0B0F] hover:text-white active:scale-95"
          >
            <Plus size={13} className="transition-transform duration-300 group-hover:rotate-90" />
            Add another item
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
        <table ref={tableRef} className="w-full table-fixed border-collapse text-left">
          <colgroup>
            {columns.map((col, i) => (
              <col key={i} style={{ width: `${colWeights[i]}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-black/10 bg-[#fafafa]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`relative px-2 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-black/55 ${
                    col.align === "right" ? "text-right" : ""
                  }`}
                >
                  {col.label}
                  {i < columns.length - 1 ? (
                    <span
                      onMouseDown={(e) => startColumnResize(i, e)}
                      title="Drag to resize"
                      className="group absolute -right-1 top-0 z-10 flex h-full w-2.5 cursor-col-resize touch-none select-none items-center justify-center"
                    >
                      <span className="h-4 w-px bg-black/15 transition-colors duration-200 group-hover:bg-black/50" />
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const total = (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
              const isPending = billMode || (Boolean(item.vendorId) && item.paymentStatus === "to_pay");
              const isInvalid = index === invalidIndex;
              const impactNote = !item.vendorId
                ? "No vendor — comes straight out of your wallet."
                : isPending
                  ? "Order placed only. Recorded as money owed to this vendor."
                  : "Paying this vendor now — deducted from your wallet.";

              return (
                <tr
                  key={index}
                  className={`mm-rise border-b border-black/6 align-top transition-colors duration-300 last:border-0 ${
                    isInvalid ? "bg-rose-50/70 ring-1 ring-inset ring-rose-300" : "hover:bg-black/[0.015]"
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                >
                  <td className="px-1.5 py-2 text-center text-xs font-black text-black/45">{index + 1}</td>

                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.purpose}
                      onChange={(e) => updateItem(index, { purpose: e.target.value })}
                      placeholder="e.g. Stage decoration flowers"
                      className={FIELD}
                    />
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={item.costDate}
                      onChange={(e) => updateItem(index, { costDate: e.target.value })}
                      className={FIELD}
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => stepQuantity(index, -1)}
                        className="flex w-7 shrink-0 items-center justify-center rounded-lg border border-black/12 bg-white text-base font-black text-black/55 transition-all duration-300 hover:border-black hover:bg-[#0B0B0F] hover:text-white active:scale-90"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        className={`${FIELD} min-w-0 px-1 text-center`}
                      />
                      <button
                        type="button"
                        onClick={() => stepQuantity(index, 1)}
                        className="flex w-7 shrink-0 items-center justify-center rounded-lg border border-black/12 bg-white text-base font-black text-black/55 transition-all duration-300 hover:border-black hover:bg-[#0B0B0F] hover:text-white active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </td>

                  <td className="px-2 py-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-black/45">
                        ৳
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.perQtyAmount}
                        onChange={(e) => updateItem(index, { perQtyAmount: e.target.value })}
                        placeholder="0.00"
                        className={`${FIELD} pl-6`}
                      />
                    </div>
                  </td>

                  <td className="px-2 py-2">
                    <div
                      className={`flex h-[34px] items-center rounded-lg border border-black/8 bg-[#fafafa] px-2.5 text-xs font-black ${
                        isPending ? "text-amber-600" : "text-black"
                      }`}
                    >
                      {formatTaka(total)}
                    </div>
                  </td>

                  {!billMode ? (
                    <>
                      <td className="px-2 py-2">
                        <select
                          value={item.vendorId}
                          onChange={(e) => {
                            const vendorId = e.target.value;
                            updateItem(index, {
                              vendorId,
                              paymentStatus: vendorId ? item.paymentStatus || "paid" : "paid",
                              settlesItemId: "",
                            });
                            if (vendorId) ensureOutstandingLoaded(vendorId);
                          }}
                          className={FIELD}
                        >
                          <option value="">No vendor — paid directly</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.name}
                              {vendor.category ? ` — ${vendor.category}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-2">
                        <div
                          className={`flex gap-1 rounded-lg border border-black/12 bg-white p-1 transition-opacity duration-300 ${
                            item.vendorId ? "" : "opacity-40"
                          }`}
                        >
                          {[
                            { value: "paid", label: "Paid", active: "bg-emerald-600" },
                            { value: "to_pay", label: "To Pay", active: "bg-amber-500" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              disabled={!item.vendorId}
                              onClick={() => {
                                updateItem(index, { paymentStatus: option.value, settlesItemId: "" });
                                if (option.value === "paid" && item.vendorId) ensureOutstandingLoaded(item.vendorId);
                              }}
                              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-black transition-all duration-300 disabled:cursor-not-allowed ${
                                item.paymentStatus === option.value
                                  ? `${option.active} text-white shadow-md`
                                  : "text-black/45 hover:bg-black/5"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p
                          className="mt-1 flex items-start gap-1 text-[9px] leading-tight text-black/45"
                          title={impactNote}
                        >
                          <Info size={10} className="mt-0.5 shrink-0" />
                          <span className="truncate">{impactNote}</span>
                        </p>
                        {item.vendorId && item.paymentStatus === "paid" ? (
                          <select
                            value={item.settlesItemId}
                            onChange={(e) => updateItem(index, { settlesItemId: e.target.value })}
                            className="mt-1.5 w-full rounded-lg border border-black/12 bg-white px-1.5 py-1 text-[9px] font-bold text-black/75 outline-none focus:border-black"
                            title="Which bill is this settling? Leave blank for an instant/unrelated buy."
                          >
                            <option value="">Not settling anything (instant buy)</option>
                            {(outstandingByVendor[item.vendorId] || []).map((bill) => (
                              <option key={bill.id} value={bill.id}>
                                Settle: {bill.purpose} ({formatTaka(bill.stillOwed)} owed)
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </td>
                    </>
                  ) : null}

                  <td className="px-2 py-2">
                    <ReceiptCell
                      file={item.receiptFile}
                      onPick={(file) => updateItem(index, { receiptFile: file })}
                      onClear={() => updateItem(index, { receiptFile: null })}
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          title="Remove this item"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-black/45 transition-all duration-300 hover:scale-110 hover:bg-rose-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`grid gap-3 ${billMode ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div className="rounded-2xl border border-black/8 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/55">Grand Total</p>
          <p className="mt-1.5 text-xl font-black tracking-tight text-black">{formatTaka(totals.grand)}</p>
        </div>
        {!billMode ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-rose-500">
              <Wallet size={11} /> Leaves Wallet
            </p>
            <p className="mt-1.5 text-xl font-black tracking-tight text-rose-600">{formatTaka(totals.wallet)}</p>
          </div>
        ) : null}
        <div
          className={`rounded-2xl border p-4 transition-colors duration-300 ${
            totals.pending > 0 ? "border-amber-200 bg-amber-50" : "border-black/8 bg-white"
          }`}
        >
          <p
            className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] ${
              totals.pending > 0 ? "text-amber-600" : "text-black/55"
            }`}
          >
            <Store size={11} /> {billMode ? "Bill Amount (Owed to Vendor)" : "Owed To Vendors"}
          </p>
          <p
            className={`mt-1.5 text-xl font-black tracking-tight ${
              totals.pending > 0 ? "text-amber-700" : "text-black/45"
            }`}
          >
            {formatTaka(totals.pending)}
          </p>
        </div>
      </div>
    </div>
  );
}
