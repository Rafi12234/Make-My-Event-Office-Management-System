import { Search } from "lucide-react";
import { formatDisplayDate } from "../services/accountsService";

// Lets the employee pick which confirmed/booked event an Event Based Cost
// belongs to. Sourced from GET /api/accounts/booked-events, which is
// itself backed by client_finalizations (the real confirmed-event source
// of truth), not the sheet's derived "booked" display flags.
export default function BookedEventPicker({ events, selectedRowKey, onSelect, searchText, onSearchTextChange }) {
  const filtered = events.filter((event) => {
    if (!searchText.trim()) return true;
    return event.clientName.toLowerCase().includes(searchText.trim().toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-[#d6d6d6]/70 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#d6d6d6] px-3 py-2">
        <Search size={14} className="text-black/40" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          placeholder="Search confirmed events by client name…"
          className="w-full text-sm outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-sm text-black/50">No confirmed booked events found.</p>
      ) : (
        <select
          value={selectedRowKey}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full rounded-xl border border-[#d6d6d6] bg-white px-3.5 py-2.5 text-sm font-bold outline-none focus:border-black"
        >
          <option value="">Select a confirmed client…</option>
          {filtered.map((event) => (
            <option key={event.rowKey} value={event.rowKey}>
              {(event.clientName || "Unnamed client") + "-" + (formatDisplayDate(event.eventDate) || "No date")}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

