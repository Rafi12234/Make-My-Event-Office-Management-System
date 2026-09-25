import { useEffect, useState } from "react";
import { AlertCircle, Ban, Briefcase, CalendarClock, Check, PartyPopper, Store } from "lucide-react";
import { formatTaka, loadBookedEvents, loadVendors, submitExpense } from "../services/accountsService";
import ExpenseItemsTable, { emptyItem } from "./ExpenseItemsTable";
import BookedEventPicker from "./BookedEventPicker";
import { parseExpenseExcelFile } from "../utils/expenseExcelImport.js";

const EVENT_OTHER_VALUE = "__other__";

const COST_TYPES = [
  {
    value: "event",
    icon: PartyPopper,
    title: "Event Based Cost",
    description: "Confirmed-event spending — choose a vendor bill or a direct Other cost.",
  },
  {
    value: "regular",
    icon: Briefcase,
    title: "Regular Cost",
    description: "Day-to-day office spending, not tied to any event.",
  },
];

// Full "log a new cost" flow.
// - Event Based Cost: choose a confirmed event, then either a real vendor
//   (creates a due-bill) or Other (direct non-vendor event spending).
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
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportNotice, setExcelImportNotice] = useState("");

  const selectedEvent = events.find((event) => event.rowKey === selectedRowKey);
  const isEventBill = costType === "event";
  const isOtherEventCost = isEventBill && eventVendorId === EVENT_OTHER_VALUE;
  const isVendorEventBill = isEventBill && Boolean(eventVendorId) && !isOtherEventCost;

  const billTotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0),
    0,
  );

  // Mirrors the backend rule:
  // - Event + real vendor: due-bill only, so wallet deduction is 0.
  // - Event + Other: direct non-vendor spend, so the full amount is pending
  //   wallet deduction until Admin approval.
  // - Regular: existing per-item vendor/payment rules remain unchanged.
  const walletDeduction = isVendorEventBill
    ? 0
    : isOtherEventCost
      ? billTotal
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

  function hasMeaningfulManualRows() {
    return items.some((item) =>
      Boolean(
        item.purpose?.trim() ||
          item.perQtyAmount ||
          item.receiptFile ||
          item.vendorId ||
          Number(item.quantity || 1) !== 1,
      ),
    );
  }

  async function handleExcelUpload(file) {
    if (!file) return;

    setError("");
    setInvalidIndex(-1);
    setExcelImportNotice("");
    setIsImportingExcel(true);

    try {
      const parsed = await parseExpenseExcelFile(file);

      if (hasMeaningfulManualRows()) {
        const shouldReplace = window.confirm(
          `Import ${parsed.rows.length} cost row${parsed.rows.length === 1 ? "" : "s"} from ${file.name}? This will replace the cost rows currently in the form.`,
        );

        if (!shouldReplace) {
          return;
        }
      }

      const importedItems = parsed.rows.map((row) => ({
        ...emptyItem(),
        purpose: row.purpose,
        costDate: row.costDate,
        quantity: row.quantity,
        perQtyAmount: row.perQtyAmount,

        // Excel intentionally does not carry vendor/payment information.
        // In Regular Cost the employee can choose a vendor afterwards.
        vendorId: "",
        paymentStatus: "paid",
        settlesItemId: "",
        receiptFile: null,
      }));

      setItems(importedItems);

      const ignoredText =
        parsed.ignoredRowCount > 0
          ? ` ${parsed.ignoredRowCount} extra or invalid row${
              parsed.ignoredRowCount === 1 ? " was" : "s were"
            } ignored.`
          : "";

      setExcelImportNotice(
        `Imported ${importedItems.length} cost row${
          importedItems.length === 1 ? "" : "s"
        } from ${parsed.sheetName}.${ignoredText} Extra Excel columns are ignored automatically.`,
      );
    } catch (err) {
      setError(err.message || "Could not read this Excel file.");
    } finally {
      setIsImportingExcel(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInvalidIndex(-1);

    if (isEventBill && !selectedRowKey) {
      setError("Select which confirmed event this cost belongs to.");
      return;
    }
    if (isEventBill && !eventVendorId) {
      setError("Select a vendor or choose Other for a non-vendor event cost.");
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
        perQtyAmount <= 0
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
                    setExcelImportNotice("");
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
          <div className="mm-rise grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                <CalendarClock size={12} /> Which confirmed event is this cost for?
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
            </div>

            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                <Store size={12} /> Vendor / Other
              </p>
              <select
                value={eventVendorId}
                onChange={(e) => {
                  setEventVendorId(e.target.value);
                  setError("");
                }}
                className="w-full rounded-xl border border-black/12 bg-white px-3.5 py-3 text-sm font-bold text-black outline-none transition-all duration-300 focus:border-black focus:ring-4 focus:ring-black/8"
              >
                <option value="">Select a vendor or Other…</option>
                <option value={EVENT_OTHER_VALUE}>Other — direct event cost (no vendor)</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                    {vendor.category ? ` — ${vendor.category}` : ""}
                  </option>
                ))}
              </select>
              {isOtherEventCost ? (
                <p className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-sky-700">
                  Use Other for event expenses that are not tied to a vendor, such as food,
                  transport, tips, helper payments, or small cash purchases. No vendor ledger
                  entry will be created.
                </p>
              ) : isVendorEventBill ? (
                <p className="mt-2 text-[11px] font-bold leading-relaxed text-black/45">
                  This amount will be recorded as money owed to the selected vendor.
                </p>
              ) : null}
            </div>
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
            billMode={isVendorEventBill}
            directEventMode={isOtherEventCost}
            onExcelUpload={handleExcelUpload}
            isImportingExcel={isImportingExcel}
          />
        ) : null}

        {excelImportNotice ? (
          <p className="mm-pop rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {excelImportNotice}
          </p>
        ) : null}

        {error ? (
          <p className="mm-pop flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            <AlertCircle size={15} /> {error}
          </p>
        ) : null}

        <p className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-[11px] leading-relaxed text-black/45">
          <Ban size={12} className="mt-0.5 shrink-0" />
          {isVendorEventBill
            ? "This creates a due-bill for the selected vendor. It does not deduct your wallet. Once submitted, it is locked permanently."
            : isOtherEventCost
              ? "This is a direct event expense with no vendor. It will not affect any vendor ledger and will be deducted from your wallet only after Admin approval."
              : "Once submitted, this cost is locked permanently — it cannot be edited or deleted."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/8 bg-[#fafafa] px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
            {isVendorEventBill
              ? "Bill total (owed to vendor)"
              : isOtherEventCost
                ? "Direct event cost"
                : "Leaves wallet now"}
          </p>
          <p
            className={`truncate text-xl font-black tracking-tight ${
              isVendorEventBill ? "text-amber-600" : "text-rose-600"
            }`}
          >
            {isVendorEventBill ? "" : "−"}
            {formatTaka(isVendorEventBill ? billTotal : walletDeduction)}
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
            {isSubmitting
              ? "Submitting…"
              : isVendorEventBill
                ? "Create Bill"
                : isOtherEventCost
                  ? "Submit Event Cost"
                  : "Submit Cost"}
          </button>
        </div>
      </div>
    </form>
  );
}
