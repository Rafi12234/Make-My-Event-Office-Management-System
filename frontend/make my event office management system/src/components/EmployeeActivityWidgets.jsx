import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, Info, Phone } from "lucide-react";
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>
      <Icon size={11} /> {count} {label}
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
      <p className={expanded ? "whitespace-pre-wrap text-xs text-mme-purple/70" : "truncate text-xs text-mme-purple/70"}>
        {discussion}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-mme-plum hover:underline"
        >
          {expanded ? <>Read Less <ChevronUp size={11} /></> : <>Read More <ChevronDown size={11} /></>}
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
      <p className="truncate text-xs text-mme-purple/70">
        {items.map((item) => `${itemLabel(item)} \u00d7${item.quantity ?? 1}`).join(", ")}
      </p>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-mme-plum hover:underline"
      >
        {expanded ? <>Hide Items <ChevronUp size={11} /></> : <>Read More <ChevronDown size={11} /></>}
      </button>
      {expanded && (
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-mme-purple/45">
              <th className="pb-1 pr-3 font-black uppercase tracking-wide">Item</th>
              <th className="pb-1 pr-3 font-black uppercase tracking-wide">Qty</th>
              <th className="pb-1 font-black uppercase tracking-wide">Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mme-pink/20 align-top">
                <td className="py-1.5 pr-3 font-bold text-mme-purple">{itemLabel(item)}</td>
                <td className="py-1.5 pr-3 text-mme-purple/70">{item.quantity ?? 1}</td>
                <td className="py-1.5 text-mme-purple/70">{item.description || "\u2014"}</td>
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
export function RoutineEntryRow({ entry, backTo, backLabel }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;
  return (
    <li className="rounded-xl border border-mme-pink/40 bg-[#fff9fc] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
export function MissedEntryRow({ entry, lateLabel, backTo, backLabel }) {
  const navigate = useNavigate();
  const Icon = entry.type === "meeting" ? CalendarClock : Phone;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={14} className="shrink-0 text-red-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mme-purple">{entry.clientName || "Unnamed client"}</p>
          <p className="text-xs text-mme-purple/55">
            {formatDisplay(entry.datetime) || "No date set"} {"\u00b7"} {entry.type === "meeting" ? "Meeting" : "Call"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-600">
          <AlertTriangle size={11} /> {lateLabel}
        </span>
        <button
          onClick={() => navigate(`/admin/activity/${entry.type === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`, {
            state: backTo ? { from: backTo, fromLabel: backLabel } : undefined,
          })}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
        >
          <Info size={11} /> Details
        </button>
      </div>
    </li>
  );
}
