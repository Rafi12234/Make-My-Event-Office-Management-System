import { useNavigate } from "react-router";
import { CalendarClock, Info, Phone } from "lucide-react";
import { formatDisplay } from "../utils/employeeActivity";

// Shared by AdminPage.jsx (overview) and AdminEmployeeDetailPage.jsx.

export function StatChip({ icon: Icon, label, count, tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>
      <Icon size={11} /> {count} {label}
    </span>
  );
}

// `backTo`/`backLabel` are forwarded as navigation state so the detail page's
// Back button can return here instead of always going to /admin/activity.
export function RoutineEntryRow({ entry, backTo, backLabel }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mme-pink/40 bg-[#fff9fc] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={14} className="shrink-0 text-mme-purple/50" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mme-purple">{entry.clientName || "Unnamed client"}</p>
          <p className="text-xs text-mme-purple/55">
            {formatDisplay(entry.datetime) || "No date set"} {"\u00b7"} {entry.type === "meeting" ? "Meeting" : "Call"}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate(`/admin/activity/${entry.type === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`, {
          state: backTo ? { from: backTo, fromLabel: backLabel } : undefined,
        })}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
      >
        <Info size={11} /> Details
      </button>
    </li>
  );
}
