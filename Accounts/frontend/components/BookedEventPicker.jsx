import { CalendarClock, CheckCircle2, PartyPopper } from "lucide-react";
import { formatDisplayDate } from "../services/accountsService";

// Lets the employee pick which event a due-bill belongs to. Sourced from
// GET /api/accounts/booked-events, which returns every confirmed event
// booked through us (client_finalizations, excluding rows flagged as
// booked with another company) — past and upcoming, newest event first.
export default function BookedEventPicker({ events, selectedRowKey, onSelect }) {
  const selected = events.find((event) => event.rowKey === selectedRowKey);

  if (events.length === 0) {
    return (
      <div className="mm-pop flex flex-col items-center rounded-2xl border border-dashed border-black/12 bg-[#fafafa] px-4 py-10 text-center">
        <span className="mm-bob flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black/40 shadow-sm">
          <PartyPopper size={20} />
        </span>
        <p className="mt-3 text-sm font-black text-black/55">No confirmed booked events yet.</p>
        <p className="mt-1 max-w-xs text-xs text-black/55">
          An event must be confirmed and finalized with us to bill a vendor against it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <select
          value={selectedRowKey}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-xl border border-black/12 bg-white py-3.5 pl-11 pr-10 text-sm font-bold text-black outline-none transition-all duration-300 focus:border-black focus:ring-4 focus:ring-black/8"
        >
          <option value="">Select a confirmed client…</option>
          {events.map((event) => (
            <option key={event.rowKey} value={event.rowKey}>
              {`${event.clientName || "Unnamed client"} — ${formatDisplayDate(event.eventDate) || "No date"}`}
            </option>
          ))}
        </select>

        <PartyPopper
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/55"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/55">▾</span>
      </div>

      {selected ? (
        <div className="mm-pop mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-black/8 bg-[#fafafa] px-3.5 py-2.5">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          <span className="text-xs font-black text-black">{selected.clientName || "Unnamed client"}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-black/45">
            <CalendarClock size={11} /> {formatDisplayDate(selected.eventDate) || "No date"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

