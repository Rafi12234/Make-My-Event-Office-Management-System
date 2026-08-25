import { useEffect, useState } from "react";
import { AlertCircle, Ban, CalendarClock, ReceiptText } from "lucide-react";
import { loadBookedEvents, submitExpense } from "../services/accountsService";
import ExpenseItemsTable, { emptyItem } from "./ExpenseItemsTable";
import BookedEventPicker from "./BookedEventPicker";

// Full "log a new cost" flow: choose Event Based Cost (pick a confirmed
// event) or Regular Cost, fill in the shared item table, then permanently
// lock it in with Submit Cost — no edit/delete afterwards.
export default function ExpenseForm({ onSubmitted, onCancel }) {
  const [costType, setCostType] = useState("regular");
  const [events, setEvents] = useState([]);
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const [eventSearchText, setEventSearchText] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedEvent = events.find((event) => event.rowKey === selectedRowKey);

  useEffect(() => {
    if (costType !== "event" || events.length) return;
    loadBookedEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [costType, events.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (costType === "event" && !selectedRowKey) {
      setError("Select which confirmed event this cost belongs to.");
      return;
    }

    const invalidIndex = items.findIndex((item) => {
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
    if (invalidIndex !== -1) {
      setError(`Item ${invalidIndex + 1} is missing required fields.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitExpense({
        costType,
        linkedRowKey: costType === "event" ? selectedRowKey : null,
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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#d6d6d6]/70 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-black/50">
        <ReceiptText size={14} /> Log a New Cost
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => { setCostType("event"); setError(""); }}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition ${
            costType === "event" ? "border-black bg-black text-white" : "border-[#d6d6d6] bg-white hover:bg-[#f4f4f4]/60"
          }`}
        >
          Event Based Cost
        </button>
        <button
          type="button"
          onClick={() => { setCostType("regular"); setSelectedRowKey(""); setError(""); }}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition ${
            costType === "regular" ? "border-black bg-black text-white" : "border-[#d6d6d6] bg-white hover:bg-[#f4f4f4]/60"
          }`}
        >
          Regular Cost
        </button>
      </div>

      {costType === "event" ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-black/60">
            <CalendarClock size={13} /> Select the confirmed event
          </p>
          <BookedEventPicker
            events={events}
            selectedRowKey={selectedRowKey}
            onSelect={setSelectedRowKey}
            searchText={eventSearchText}
            onSearchTextChange={setEventSearchText}
          />
        </div>
      ) : null}

      <div className="mt-5">
        <ExpenseItemsTable
          items={items}
          onChange={setItems}
          eventDate={costType === "event" ? selectedEvent?.eventDate : null}
        />
      </div>

      {error ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-red-500">
          <AlertCircle size={15} /> {error}
        </p>
      ) : null}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-black/50">
        <Ban size={13} /> Once submitted, this cost is locked permanently — it cannot be edited or deleted.
      </p>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[#d6d6d6] bg-white px-5 py-2.5 text-sm font-black text-black transition hover:bg-[#f4f4f4]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#222222] disabled:opacity-50"
        >
          {isSubmitting ? "Submitting…" : "Submit Cost"}
        </button>
      </div>
    </form>
  );
}
