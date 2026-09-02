import { useEffect, useState } from "react";
import { AlertCircle, Ban, Briefcase, CalendarClock, Check, PartyPopper, Store } from "lucide-react";
import { formatTaka, loadBookedEvents, loadVendors, submitExpense } from "../services/accountsService";
import ExpenseItemsTable, { emptyItem } from "./ExpenseItemsTable";
import BookedEventPicker from "./BookedEventPicker";

const COST_TYPES = [
  {
    value: "event",
    icon: PartyPopper,
    title: "Event Based Cost",
    description: "Vendor due-bill to send to the boss for a confirmed event.",
  },
  {
    value: "regular",
    icon: Briefcase,
    title: "Regular Cost",
    description: "Day-to-day office spending, not tied to any event.",
  },
];

// Full "log a new cost" flow.
// - Event Based Cost: pick any confirmed event (past or upcoming) + the ONE
//   vendor this bill is for, then list what's owed — every line is always
//   "To Pay" (this only ever creates a due-bill for the boss to settle,
//   never deducts the employee's own wallet).
// - Regular Cost: unchanged, flexible per-item vendor + paid/to-pay.
// Either way, Submit permanently locks it in — no edit/delete afterwards.
export default function ExpenseForm({ onSubmitted, onCancel }) {
  const [costType, setCostType] = useState("regular");
  const [events, setEvents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const [eventVendorId, setEventVendorId] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invalidIndex, setInvalidIndex] = useState(-1);

  const selectedEvent = events.find((event) => event.rowKey === selectedRowKey);
  const isEventBill = costType === "event";

  const billTotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0),
    0,
  );

  // Mirrors the backend rule: only vendor-less items and "paid" vendor
  // items actually leave the wallet. An event bill is always "To Pay", so
  // it never touches the wallet at all.
  const walletDeduction = isEventBill
    ? 0
    : items.reduce((sum, item) => {
        if (item.vendorId && item.paymentStatus === "to_pay") return sum;
        return sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
      }, 0);

  useEffect(() => {
    loadVendors()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    if (costType !== "event" || events.length) return;
    loadBookedEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [costType, events.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInvalidIndex(-1);

    if (isEventBill && !selectedRowKey) {
      setError("Select which confirmed event this bill belongs to.");
      return;
    }
    if (isEventBill && !eventVendorId) {
      setError("Select which vendor this bill is for.");
      return;
    }

    const badIndex = items.findIndex((item) => {
      const quantity = Number(item.quantity);
      const perQtyAmount = Number(item.perQtyAmount);
      return (
        !item.purpose.trim() ||
        !item.costDate ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(perQtyAmount) ||
        perQtyAmount < 0
      );
    });
    if (badIndex !== -1) {
      setInvalidIndex(badIndex);
      setError(`Item ${badIndex + 1} is missing a purpose, date, quantity or amount.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitExpense({
        costType,
        linkedRowKey: isEventBill ? selectedRowKey : null,
        vendorId: isEventBill ? eventVendorId : undefined,
        items,
      });
      onSubmitted?.(result);
    } catch (err) {
      setError(err.message || "Could not submit this cost.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-6 p-5 sm:p-7">
        <div className="mm-rise">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
            What kind of cost is this?
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {COST_TYPES.map(({ value, icon: Icon, title, description }, index) => {
              const isActive = costType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCostType(value);
                    if (value === "regular") {
                      setSelectedRowKey("");
                      setEventVendorId("");
                    }
                    setError("");
                    setInvalidIndex(-1);
                  }}
                  className={`mm-pop group relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-400 hover:-translate-y-1 ${
                    isActive
                      ? "border-black bg-black/[0.04] ring-2 ring-black/12"
                      : "border-black/10 bg-white hover:border-black/35 hover:shadow-lg"
                  }`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-400 group-hover:scale-110 group-hover:rotate-6 ${
                      isActive ? "bg-[#0B0B0F] text-white" : "bg-black/5 text-black/55"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-black">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-black/45">{description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {isEventBill ? (
          <div className="mm-rise">
            <p className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
              <CalendarClock size={12} /> Which confirmed event is this bill for?
              {selectedEvent ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                  {selectedEvent.clientName || "Selected"}
                </span>
              ) : null}
            </p>
            <BookedEventPicker
              events={events}
              selectedRowKey={selectedRowKey}
              onSelect={(rowKey) => {
                setSelectedRowKey(rowKey);
                setError("");
              }}
            />

            {selectedRowKey ? (
              <div className="mt-5">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                  <Store size={12} /> Which vendor is this bill for?
                </p>
                <select
                  value={eventVendorId}
                  onChange={(e) => {
                    setEventVendorId(e.target.value);
                    setError("");
                  }}
                  className="w-full rounded-xl border border-black/12 bg-white px-3.5 py-3 text-sm font-bold text-black outline-none transition-all duration-300 focus:border-black focus:ring-4 focus:ring-black/8"
                >
                  <option value="">Select a vendor…</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                      {vendor.category ? ` — ${vendor.category}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isEventBill || (selectedRowKey && eventVendorId) ? (
          <ExpenseItemsTable
            items={items}
            onChange={(next) => {
              setItems(next);
              setInvalidIndex(-1);
            }}
            eventDate={isEventBill ? selectedEvent?.eventDate : null}
            vendors={vendors}
            invalidIndex={invalidIndex}
            billMode={isEventBill}
          />
        ) : null}

        {error ? (
          <p className="mm-pop flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            <AlertCircle size={15} /> {error}
          </p>
        ) : null}

        <p className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-[11px] leading-relaxed text-black/45">
          <Ban size={12} className="mt-0.5 shrink-0" />
          {isEventBill
            ? "This creates a due-bill for the boss to settle — it never deducts your own wallet. Once submitted, it is locked permanently."
            : "Once submitted, this cost is locked permanently — it cannot be edited or deleted."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/8 bg-[#fafafa] px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
            {isEventBill ? "Bill total (owed to vendor)" : "Leaves wallet now"}
          </p>
          <p
            className={`truncate text-xl font-black tracking-tight ${
              isEventBill ? "text-amber-600" : "text-rose-600"
            }`}
          >
            {isEventBill ? "" : "−"}
            {formatTaka(isEventBill ? billTotal : walletDeduction)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-black text-black/60 transition-all duration-300 hover:border-black/30 hover:text-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mm-sheen inline-flex items-center gap-2 rounded-xl bg-[#0B0B0F] px-6 py-3 text-sm font-black text-white shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Check size={16} />
            )}
            {isSubmitting ? "Submitting…" : isEventBill ? "Create Bill" : "Submit Cost"}
          </button>
        </div>
      </div>
    </form>
  );
}
