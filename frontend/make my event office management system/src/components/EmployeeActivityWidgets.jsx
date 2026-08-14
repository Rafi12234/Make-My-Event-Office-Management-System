import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, CalendarClock, ChevronDown, Info, Phone } from "lucide-react";
import { formatDisplay } from "../utils/employeeActivity";
import { CLIENT_REQUIREMENT_OPTIONS } from "../data/defaultSheet";

// Shared by AdminPage.jsx (overview) and AdminEmployeeDetailPage.jsx.

// A discussion this long won't fit on one line, so the row shows an
// ellipsis + "Read More" instead of always rendering the full text.
const DISCUSSION_PREVIEW_LIMIT = 90;

function itemLabel(item) {
  if (item.itemKey === "other") return item.customLabel || "Other";
  return CLIENT_REQUIREMENT_OPTIONS.find((opt) => opt.key === item.itemKey)?.label || item.itemKey;
}

export function StatChip({ icon: Icon, label, count, tone }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-2xl border border-transparent px-3.5 py-2 text-[11px] font-black shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/60">
        <Icon size={12} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-black">{count}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      </span>
    </span>
  );
}

// Inline "one line + Read More" preview of a call's discussion notes, shown
// directly in the routine list so an admin doesn't have to open the details
// page just to see what was discussed.
function CallDiscussionPreview({ discussion }) {
  const [expanded, setExpanded] = useState(false);
  if (!discussion) return null;
  const isLong = discussion.length > DISCUSSION_PREVIEW_LIMIT;

  return (
    <div className="mt-2 border-t border-mme-pink/30 pt-2">
      <p
        className={
          expanded
            ? "animate-fadeIn whitespace-pre-wrap text-xs font-semibold text-mme-purple/90"
            : "truncate text-xs font-semibold text-mme-purple/90"
        }
      >
        {discussion}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-mme-plum transition hover:gap-1.5 hover:underline"
        >
          {expanded ? "Read Less" : "Read More"}
          <ChevronDown size={11} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

// Inline "items × quantity" preview of a meeting, with a "Read More" that
// expands into a full item/quantity/description table on the same page.
function MeetingItemsPreview({ items }) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;

  return (
    <div className="mt-2 border-t border-mme-pink/30 pt-2">
      <p className="truncate text-xs font-semibold text-mme-purple/90">
        {items.map((item) => `${itemLabel(item)} \u00d7${item.quantity ?? 1}`).join(", ")}
      </p>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-mme-plum transition hover:gap-1.5 hover:underline"
      >
        {expanded ? "Hide Items" : "Read More"}
        <ChevronDown size={11} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <table className="animate-fadeIn mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-mme-purple/65">
              <th className="pb-1 pr-3 font-black uppercase tracking-wide">Item</th>
              <th className="pb-1 pr-3 font-black uppercase tracking-wide">Qty</th>
              <th className="pb-1 font-black uppercase tracking-wide">Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mme-pink/20 align-top">
                <td className="py-1.5 pr-3 font-bold text-mme-purple">{itemLabel(item)}</td>
                <td className="py-1.5 pr-3 font-semibold text-mme-purple/90">{item.quantity ?? 1}</td>
                <td className="py-1.5 font-semibold text-mme-purple/90">{item.description || "\u2014"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// `backTo`/`backLabel` are forwarded as navigation state so the detail page's
// Back button can return here instead of always going to /admin/activity.
// `index` (optional) drives a light stagger effect on initial render.
export function RoutineEntryRow({ entry, backTo, backLabel, index = 0 }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;
  const isMeeting = entry.type === "meeting";

  return (
    <li
      className="animate-fadeInUp group rounded-xl border border-mme-pink/40 bg-[#fff9fc] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-mme-pink hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${
              isMeeting ? "bg-mme-blush text-mme-plum" : "bg-mme-purple/10 text-mme-purple"
            }`}
          >
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-mme-purple">{entry.clientName || "Unnamed client"}</p>
            <p className="text-xs font-semibold text-mme-purple/75">
              {formatDisplay(entry.datetime) || "No date set"} {"\u00b7"} {isMeeting ? "Meeting" : "Call"}
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            navigate(`/admin/activity/${entry.type === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`, {
              state: backTo ? { from: backTo, fromLabel: backLabel } : undefined,
            })
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition-all duration-200 hover:-translate-y-0.5 hover:bg-mme-blush/40 hover:shadow-sm"
        >
          <Info size={11} /> Details
        </button>
      </div>
      {entry.type === "call" ? (
        <CallDiscussionPreview discussion={entry.discussion} />
      ) : (
        <MeetingItemsPreview items={entry.items} />
      )}
    </li>
  );
}

// Same shape as RoutineEntryRow but styled as an overdue/missed entry, with
// a red "how late" duration badge instead of just the scheduled datetime.
export function MissedEntryRow({ entry, lateLabel, backTo, backLabel, index = 0 }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;

  return (
    <li
      className="animate-fadeInUp group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-500 transition-transform duration-200 group-hover:scale-110">
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mme-purple">{entry.clientName || "Unnamed client"}</p>
          <p className="text-xs font-semibold text-mme-purple/75">
            {formatDisplay(entry.datetime) || "No date set"} {"\u00b7"} {entry.type === "meeting" ? "Meeting" : "Call"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-600">
          <AlertTriangle size={11} /> {lateLabel}
        </span>
        <button
          onClick={() =>
            navigate(`/admin/activity/${entry.type === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`, {
              state: backTo ? { from: backTo, fromLabel: backLabel } : undefined,
            })
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition-all duration-200 hover:-translate-y-0.5 hover:bg-mme-blush/40 hover:shadow-sm"
        >
          <Info size={11} /> Details
        </button>
      </div>
    </li>
  );
}