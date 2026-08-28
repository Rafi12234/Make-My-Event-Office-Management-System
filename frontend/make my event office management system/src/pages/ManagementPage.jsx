import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import {
  BadgeAlert,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Columns3,
  FileSpreadsheet,
  LayoutGrid,
  LogOut,
  Phone,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import AddColumnModal from "../components/AddColumnModal";
import ConfirmDialog from "../components/ConfirmDialog";
import EmployeeLayout from "../components/EmployeeLayout";
import ExcelImportModal from "../components/ExcelImportModal";
import {
  MANDATORY_EXCEL_COLUMNS,
  SHIFT_OPTIONS,
  VENUE_OPTIONS,
  createEmptyRow,
  Showed_Column_Name,
  sortColumnsByDefaultOrder,
} from "../data/defaultSheet";
import { clearCurrentEmployee, fetchTodaySummary, loadCurrentEmployee } from "../services/authStorage";
import {
  loadEmployeeDirectory,
  loadWorkspace,
  saveWorkspace,
} from "../services/managementStorage";
import { parseSpreadsheetFile } from "../utils/excelImport";
import { loadClientMeetings } from "../services/meetingsStorage";
import { loadClientCalls } from "../services/callsStorage";

/* ─── Utility helpers ─── */

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function isNotAvailableValue(raw) {
  const text = String(raw ?? "").trim();
  return text === "" || /^n\/?a$/i.test(text);
}

// The "Event Date" column is a real "date" column now — the API already
// sends/accepts plain "YYYY-MM-DD" for it. This only formats that for
// display as "DD/MM/YYYY" (never MM/DD/YYYY, unlike a native date input's
// own locale-dependent rendering).
function isoDateToDDMMYYYY(iso) {
  const match = String(iso ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

// Local calendar date (not UTC) so "today" matches the employee's own clock.
function getTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const EVENT_DATE_WEEKDAY_PATTERN =
  /\b(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?)\b\.?,?/gi;

const EVENT_DATE_MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function isValidCalendarDate(day, month, year) {
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// Excel/CSV imports for "Event Date" still arrive as loosely-formatted free
// text (weekday names, dd/mm/yyyy, mm/dd/yyyy, month names, or a native Excel
// date cell already converted to "YYYY-MM-DDTHH:MM") — this parses any of
// those into the "YYYY-MM-DD" shape the column now stores as a real date.
// Mirrors backend/.../utils/normalizeEventDate.js's rules. Returns "" when
// unparseable so the cell is left blank for manual entry via the date picker.
function parseFreeTextDateToIso(raw) {
  let text = String(raw ?? "").trim();
  if (!text || /^n\/?a$/i.test(text)) return "";

  const isoDatetimeMatch = text.match(/^(\d{4}-\d{2}-\d{2})(T|$)/);
  if (isoDatetimeMatch) return isoDatetimeMatch[1];

  // Strip any parenthetical/bracketed notes (weekday names, "corrected: ..."
  // remarks, etc.) and weekday words, then search for a date pattern
  // anywhere in what's left — so extra surrounding words never block a
  // parse; only the date itself ends up stored.
  text = text
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(EVENT_DATE_WEEKDAY_PATTERN, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const monthNameMatch =
    text.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/) ||
    text.match(/([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})/);
  if (monthNameMatch) {
    const [, first, second, third] = monthNameMatch;
    const isFirstMonthName = /^[a-zA-Z]+$/.test(first);
    const day = Number(isFirstMonthName ? second : first);
    const monthName = (isFirstMonthName ? first : second).toLowerCase();
    const year = Number(third);
    const month = EVENT_DATE_MONTH_NAMES[monthName] || EVENT_DATE_MONTH_NAMES[monthName.slice(0, 3)];
    if (month && isValidCalendarDate(day, month, year)) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return "";
  }

  const numMatch = text.match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if (numMatch) {
    const a = Number(numMatch[1]);
    const b = Number(numMatch[2]);
    const c = Number(numMatch[3]);
    let day, month, year;

    if (numMatch[1].length === 4 || a > 31) {
      year = a;
      if (b > 12) { day = b; month = c; } else if (c > 12) { day = c; month = b; } else { month = b; day = c; }
    } else if (numMatch[3].length === 4 || c > 31) {
      year = c;
      if (a > 12) { day = a; month = b; } else if (b > 12) { day = b; month = a; } else { day = a; month = b; }
    } else {
      year = c < 100 ? 2000 + c : c;
      if (a > 12) { day = a; month = b; } else if (b > 12) { day = b; month = a; } else { day = a; month = b; }
    }

    if (isValidCalendarDate(day, month, year)) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return "";
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }

  return "";
}

function isRowBlank(row, columns) {
  if (row.alreadyBooked || row.bookedFromMme) return false;
  return columns.every((column) => String(row.values[column.id] ?? "").trim() === "");
}

// Snapshot used to detect meaningful unsaved changes — covers both the cell
// values and the "already booked" badge (stored as a sibling row property,
// not inside `values`).
function rowSignature(row) {
  return JSON.stringify({ values: row.values, alreadyBooked: Boolean(row.alreadyBooked) });
}

function buildRowSignature(values, columns) {
  return columns
    .map((column) => String(values[column.id] ?? "").trim().toLowerCase())
    .join("\u0001");
}

function formatMeetingTimeDisplay(value, emptyLabel) {
  if (!value) return emptyLabel;
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOverdueDatetime(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(" ", "T"));
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function getColumnWidthsStorageKey(employeeId) {
  return `mme_column_widths_v1_${employeeId || "anonymous"}`;
}

function loadStoredColumnWidths(employeeId) {
  try {
    return JSON.parse(localStorage.getItem(getColumnWidthsStorageKey(employeeId)) || "{}");
  } catch {
    return {};
  }
}

function applyStoredColumnWidths(columns, employeeId) {
  const stored = loadStoredColumnWidths(employeeId);
  return columns.map((column) => {
    const width = Number(stored[column.id]);
    if (!Number.isFinite(width) || width < 60) return column;
    return { ...column, width };
  });
}

function saveStoredColumnWidths(employeeId, columns) {
  const next = {};
  for (const column of columns || []) {
    const width = Number(column.width);
    if (Number.isFinite(width) && width >= 60) next[column.id] = width;
  }
  localStorage.setItem(getColumnWidthsStorageKey(employeeId), JSON.stringify(next));
}

// Filters/sort live in sessionStorage (not localStorage) so they persist
// across refreshes and page navigation but reset once the tab is closed.
function getFiltersStorageKey(employeeId) {
  return `mme_management_filters_v1_${employeeId || "anonymous"}`;
}

function loadStoredFilters(employeeId) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(getFiltersStorageKey(employeeId)) || "null");
    if (!raw) return null;
    return {
      dateFrom: raw.dateFrom || "",
      dateTo: raw.dateTo || "",
      shifts: new Set(raw.shifts || []),
      venues: new Set(raw.venues || []),
    };
  } catch {
    return null;
  }
}

function saveStoredFilters(employeeId, filters) {
  try {
    sessionStorage.setItem(
      getFiltersStorageKey(employeeId),
      JSON.stringify({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        shifts: [...filters.shifts],
        venues: [...filters.venues],
      }),
    );
  } catch {
    // Ignore storage failures (e.g. private browsing quota).
  }
}

function getUpcomingOnlyStorageKey(employeeId) {
  return `mme_management_upcoming_only_v1_${employeeId || "anonymous"}`;
}

function loadStoredUpcomingOnly(employeeId) {
  try {
    return sessionStorage.getItem(getUpcomingOnlyStorageKey(employeeId)) === "1";
  } catch {
    return false;
  }
}

function saveStoredUpcomingOnly(employeeId, value) {
  try {
    sessionStorage.setItem(getUpcomingOnlyStorageKey(employeeId), value ? "1" : "0");
  } catch {
    // Ignore storage failures (e.g. private browsing quota).
  }
}

function getSortOrderStorageKey(employeeId) {
  return `mme_management_sort_order_v1_${employeeId || "anonymous"}`;
}

const SORT_ORDER_VALUES = new Set(["newest", "oldest", "eventDateAsc", "eventDateDesc"]);

function loadStoredSortOrder(employeeId) {
  try {
    const stored = sessionStorage.getItem(getSortOrderStorageKey(employeeId));
    return SORT_ORDER_VALUES.has(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

function saveStoredSortOrder(employeeId, sortOrder) {
  try {
    sessionStorage.setItem(getSortOrderStorageKey(employeeId), sortOrder);
  } catch {
    // Ignore storage failures (e.g. private browsing quota).
  }
}

// Remembers the page's scroll position across navigation away and back
// (e.g. opening a client's meetings/calls page then returning here) so the
// employee isn't dropped back to the top of a long, filtered list.
function getScrollStorageKey(employeeId) {
  return `mme_management_scroll_v1_${employeeId || "anonymous"}`;
}

function loadStoredScrollY(employeeId) {
  const raw = Number(sessionStorage.getItem(getScrollStorageKey(employeeId)));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function saveStoredScrollY(employeeId, scrollY) {
  try {
    sessionStorage.setItem(getScrollStorageKey(employeeId), String(scrollY));
  } catch {
    // Ignore storage failures (e.g. private browsing quota).
  }
}

/* ─── Hover Preview Panel ─── */

const HOVER_PANEL_WIDTH = 320; // matches the w-80 class below
const HOVER_PANEL_MARGIN = 8;

// Anchors the panel below the trigger button, but flips it above when there
// isn't enough room below (and vice versa) — picking whichever side actually
// fits, or the side with more room if neither fully does — then clamps
// inside the viewport so it's never rendered off-screen.
function PositionedHoverPanel({ preview, onMouseEnter, onMouseLeave, children }) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState({
    top: preview.anchorBottom + HOVER_PANEL_MARGIN,
    left: Math.min(preview.anchorLeft, window.innerWidth - HOVER_PANEL_WIDTH - HOVER_PANEL_MARGIN),
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight || 0;
    const spaceBelow = window.innerHeight - preview.anchorBottom;
    const spaceAbove = preview.anchorTop;
    const fitsBelow = spaceBelow >= height + HOVER_PANEL_MARGIN;
    const fitsAbove = spaceAbove >= height + HOVER_PANEL_MARGIN;

    let top;
    if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
      top = Math.min(preview.anchorBottom + HOVER_PANEL_MARGIN, window.innerHeight - height - HOVER_PANEL_MARGIN);
    } else {
      top = preview.anchorTop - HOVER_PANEL_MARGIN - height;
    }
    top = Math.max(HOVER_PANEL_MARGIN, top);

    const left = Math.max(
      HOVER_PANEL_MARGIN,
      Math.min(preview.anchorLeft, window.innerWidth - HOVER_PANEL_WIDTH - HOVER_PANEL_MARGIN),
    );

    setStyle({ top, left, visibility: "visible" });
  }, [preview.anchorTop, preview.anchorBottom, preview.anchorLeft, preview.status, preview.items]);

  return (
    <div
      ref={panelRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "fixed", top: style.top, left: style.left, visibility: style.visibility }}
      className="animate-[scaleIn_0.2s_ease-out] z-[130] max-h-96 w-80 origin-top-left overflow-auto rounded-2xl border border-[#d6d6d6] bg-white p-4 shadow-2xl"
    >
      {children}
    </div>
  );
}

function HoverPreviewPanel({ preview, onMouseEnter, onMouseLeave }) {
  const isMeetings = preview.type === "meetings";
  const now = preview.fetchedAt;

  function isUpcoming(item) {
    const time = isMeetings ? item.meetingDatetime : item.callDatetime;
    if (!time) return false;
    const parsed = new Date(String(time).replace(" ", "T")).getTime();
    return !Number.isNaN(parsed) && parsed >= now;
  }

  function toTime(value) {
    if (!value) return null;
    const parsed = new Date(String(value).replace(" ", "T")).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  // A meeting's own "next meeting" follow-up is a separate schedule (not
  // yet its own meeting row) attached to whichever meeting set it — find
  // the soonest one on record across all meetings, same "soonest wins" rule
  // as the backend, so it shows up as its own Upcoming entry.
  let nextMeetingSchedule = null;
  if (isMeetings && preview.status === "ready") {
    for (const item of preview.items) {
      const time = toTime(item.nextMeetingDatetime);
      if (time !== null && (!nextMeetingSchedule || time < nextMeetingSchedule.time)) {
        nextMeetingSchedule = {
          id: `next-meeting-${item.id}`,
          time,
          display: item.nextMeetingDatetime,
          isNextMeetingSchedule: true,
          assignedName: item.nextMeetingAssignedEmployeeName,
        };
      }
    }
  }

  // Meetings keep the old future/past split on their own datetime, plus the
  // explicit next-meeting schedule above. For calls, the follow-up is the
  // explicit next-call date/time set on the most recent call — same value
  // already driving the NMT column — so that's what "Upcoming" shows,
  // alongside any call itself still scheduled for later.
  const upcoming = preview.status !== "ready"
    ? []
    : isMeetings
      ? [
          ...(nextMeetingSchedule ? [nextMeetingSchedule] : []),
          ...preview.items.filter(isUpcoming),
        ]
      : [
          ...(preview.nextCallDatetime ? [{ id: "next-call", time: preview.nextCallDatetime, isNextCallSchedule: true }] : []),
          ...preview.items.filter(isUpcoming),
        ];
  const previous = preview.status !== "ready"
    ? []
    : isMeetings
      ? preview.items.filter((item) => !isUpcoming(item))
      : preview.items.filter((item) => !isUpcoming(item));

  // Whoever logged/held the most recent past meeting or call.
  const lastDoneByName = previous.length
    ? previous[0].createdByName
    : null;

  // Whoever is on the hook for the next meeting/call — mirrors the
  // backend's "soonest wins" rule (computeMeetingCallTimes) so this always
  // matches the NAT column, whether the source is an explicit follow-up
  // schedule or a real future-dated meeting/call row.
  let nextAssignedToName = null;
  if (preview.status === "ready") {
    if (isMeetings) {
      if (nextMeetingSchedule) {
        nextAssignedToName = nextMeetingSchedule.assignedName || null;
      } else {
        const upcomingMeeting = preview.items.find(isUpcoming);
        nextAssignedToName = upcomingMeeting?.createdByName || null;
      }
    } else {
      const matching = preview.items.find(
        (item) => item.nextCallDatetime && item.nextCallDatetime === preview.nextCallDatetime,
      );
      if (matching) {
        nextAssignedToName = matching.nextCallAssignedEmployeeName;
      } else {
        const upcomingCall = preview.items.find(isUpcoming);
        nextAssignedToName = upcomingCall?.createdByName || null;
      }
    }
  }

  function renderItem(item) {
    const isSyntheticSchedule = item.isNextCallSchedule || item.isNextMeetingSchedule;
    const time = isSyntheticSchedule ? item.display ?? item.time : (isMeetings ? item.meetingDatetime : item.callDatetime);
    const isMissed = isSyntheticSchedule && isOverdueDatetime(item.display ?? item.time);
    return (
      <li key={item.id} className="animate-[fadeInUp_0.2s_ease-out] rounded-xl border border-[#d6d6d6]/50 px-3 py-2 transition-all duration-200 hover:border-[#333333]/20 hover:shadow-sm">
        <p className={`text-xs font-bold ${isMissed ? "text-red-600" : "text-black"}`}>
          {time ? formatMeetingTimeDisplay(time, "Not scheduled") : "Not scheduled"}
        </p>
        {isMeetings && item.isNextMeetingSchedule && (
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wide ${isMissed ? "text-red-600" : "text-[#f2662b]"}`}>
            {isMissed ? "Next meeting · Missed" : "Next meeting"}
          </p>
        )}
        {!isMeetings && item.isNextCallSchedule && (
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wide ${isMissed ? "text-red-600" : "text-[#c2410c]"}`}>
            {isMissed ? "Next meeting call · Missed" : "Next meeting call"}
          </p>
        )}
        {!isMeetings && !item.isNextCallSchedule && item.callDiscussion && (
          <p className="mt-1 line-clamp-2 text-xs text-black/60">{item.callDiscussion}</p>
        )}
      </li>
    );
  }

  function renderGroup(title, items, metaLabel, metaName) {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-black/40">{title}</p>
        {metaName && (
          <p className="mb-1.5 text-[11px] font-bold text-black/55">
            {metaLabel}: <span className="text-black">{metaName}</span>
          </p>
        )}
        {items.length ? (
          <ul className="space-y-1.5">{items.map(renderItem)}</ul>
        ) : (
          <p className="text-xs text-black/40">None</p>
        )}
      </div>
    );
  }

  return (
    <PositionedHoverPanel preview={preview} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
        {isMeetings ? <CalendarClock size={14} /> : <Phone size={14} />}
        {isMeetings ? "Meetings" : "Calls"} · {preview.clientName || "Client"}
      </p>

      {preview.status === "loading" && (
        <div className="flex items-center gap-2 py-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6d6d6] border-t-black" />
          <span className="text-sm text-black/50">Loading…</span>
        </div>
      )}
      {preview.status === "error" && <p className="text-sm text-red-600">{preview.error}</p>}
      {preview.status === "ready" && (
        <div className="space-y-4">
          {renderGroup("Upcoming", upcoming, "Assigned to", nextAssignedToName)}
          {renderGroup("Previous", previous, "Done by", lastDoneByName)}
        </div>
      )}
    </PositionedHoverPanel>
  );
}

/* ─── Cell Editor ─── */

// The native date picker itself always renders using the browser/OS locale
// (e.g. MM/DD/YYYY), regardless of the input's underlying value — that can't
// be overridden with markup or CSS. So the visible text here is drawn
// ourselves (already stored as DD/MM/YYYY) and the native input is kept
// fully transparent, only used to power the calendar picker itself. The
// visible text here is drawn ourselves as "DD/MM/YYYY" (never MM/DD/YYYY,
// unlike the native input's own locale-dependent rendering), while the
// hidden input is bound directly to the real "YYYY-MM-DD" value.
function EventDateCellEditor({ value, isNotAvailable, onChange, baseClass }) {
  return (
    <div className={`${baseClass} relative flex items-center justify-between gap-2`}>
      <span className={value ? "" : "text-black/25"}>{value ? isoDateToDDMMYYYY(value) : (isNotAvailable ? "N/A" : "Select event date")}</span>
      <CalendarDays size={15} className="pointer-events-none shrink-0 text-black/30" />
      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function CellEditor({ column, value, onChange, employeeNames }) {
  const baseClass =
    "h-full min-h-11 w-full border-0 bg-transparent px-3 py-2.5 text-sm text-black outline-none transition-all duration-200 placeholder:text-black/25 focus:bg-[#f4f4f4]/40 focus:ring-2 focus:ring-inset focus:ring-[#333333]/30";

  const isNotAvailable = value === "N/A";
  const editableValue = isNotAvailable ? "" : value;

  if (column.type === "checkbox") {
    return (
      <label className="flex min-h-11 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={editableValue === true || editableValue === "true" || editableValue === "1"}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 accent-black transition-transform duration-150 hover:scale-110"
        />
      </label>
    );
  }

  if (column.type === "venue") {
    return (
      <select value={editableValue || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">{isNotAvailable ? "N/A — select venue" : "Select venue"}</option>
        {VENUE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "shift") {
    return (
      <select value={editableValue || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">{isNotAvailable ? "N/A — select shift" : "Select shift"}</option>
        {SHIFT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "currency") {
    return (
      <div className="flex h-full min-h-11 items-center">
        <span className="pl-3 text-sm font-bold text-black/40">৳</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={editableValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNotAvailable ? "N/A" : "0.00"}
          className={`${baseClass} pl-1.5`}
        />
      </div>
    );
  }

  if (column.type === "long_text") {
    return (
      <textarea
        rows={2}
        value={editableValue ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={isNotAvailable ? "N/A" : `Enter ${column.name.toLowerCase()}`}
        className={`${baseClass} min-h-16 resize-none leading-5`}
      />
    );
  }

  if (column.type === "employee") {
    const listId = `employees-${column.id}`;
    return (
      <>
        <input
          list={listId}
          value={editableValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNotAvailable ? "N/A" : "Choose or type a name"}
          className={baseClass}
        />
        <datalist id={listId}>
          {employeeNames.map((name) => <option key={name} value={name} />)}
        </datalist>
      </>
    );
  }

  if (column.id === "event_date") {
    return (
      <EventDateCellEditor
        value={editableValue}
        isNotAvailable={isNotAvailable}
        onChange={onChange}
        baseClass={baseClass}
      />
    );
  }

  const inputType = {
    email: "email",
    phone: "tel",
    number: "number",
    integer: "number",
    date: "date",
    time: "time",
    datetime: "datetime-local",
  }[column.type] || "text";

  return (
    <input
      type={inputType}
      value={editableValue ?? ""}
      step={column.type === "integer" ? "1" : undefined}
      min={column.type === "integer" ? "0" : undefined}
      onChange={(event) => onChange(event.target.value)}
      placeholder={isNotAvailable ? "N/A" : `Enter ${column.name.toLowerCase()}`}
      className={baseClass}
    />
  );
}

/* ─── Empty State ─── */

function EmptyState({ onAddRow, onUpload }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
      <div className="max-w-lg animate-[fadeInUp_0.5s_ease-out]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#f4f4f4] text-black transition-transform duration-300 hover:scale-105">
          <LayoutGrid size={36} />
        </div>
        <h2 className="mt-6 text-2xl font-black text-black">Your management sheet is ready</h2>
        <p className="mt-3 leading-7 text-black/60">
          Add the first row manually or upload an existing Excel file. No formulas or complicated spreadsheet setup is needed.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={onAddRow} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-3.5 font-black text-white transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/20 active:scale-[0.97]">
            <Plus size={18} /> Add first row
          </button>
          <button onClick={onUpload} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/20 bg-white px-6 py-3.5 font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97]">
            <Upload size={18} /> Upload Excel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

// Module-level cache (survives unmount/remount while the SPA tab stays
// open) so navigating to a client's meeting/call page and back shows the
// previous data instantly — no loading spinner, no jump to the top — while
// a fresh copy is still fetched quietly in the background to stay current.
let cachedWorkspace = null;
let cachedEmployeeDirectory = null;

export default function ManagementPage() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(() => loadCurrentEmployee());
  const [employeeDirectory, setEmployeeDirectory] = useState(() => cachedEmployeeDirectory || []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [workspace, setWorkspace] = useState(
    () =>
      cachedWorkspace || {
        id: "meeting-management",
        name: "Meeting Management",
        columns: [],
        rows: [],
      },
  );
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(() => !cachedWorkspace);
  const [searchText, setSearchText] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savePromptRowCount, setSavePromptRowCount] = useState(0);
  const fileInputRef = useRef(null);
  const hasMounted = useRef(false);
  const [rowHeights, setRowHeights] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mme_row_heights_v1") || "{}"); }
    catch { return {}; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
  const filterDropdownRef = useRef(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState(null);
  const [resizeCursor, setResizeCursor] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverHideTimeout = useRef(null);
  const workspaceRef = useRef({ columns: [], rows: [] });
  // Snapshot (rowId -> JSON.stringify(values)) of the sheet as it exists on
  // the server right now — refreshed on load and after every successful
  // save. Lets us tell a brand-new, never-saved row apart from an edit to
  // an already-saved one, and detect real (non-blank) unsaved content.
  const lastSavedRowsSnapshotRef = useRef(new Map());
  const [filters, setFilters] = useState(() =>
    loadStoredFilters(employee?.id) || {
      dateFrom: "",
      dateTo: "",
      shifts: new Set(),
      venues: new Set(),
    },
  );
  const [sortOrder, setSortOrder] = useState(() => loadStoredSortOrder(employee?.id));
  const [upcomingOnly, setUpcomingOnly] = useState(() => loadStoredUpcomingOnly(employee?.id));
  const [todaySummary, setTodaySummary] = useState(null);

  // Powers the header "Due Today" / "Completed Today" widget. Refetched
  // every 60s (not a full websocket) so the count stays roughly live while
  // an employee has the page open across the day without any user action.
  useEffect(() => {
    if (!employee?.id) return undefined;
    let cancelled = false;

    async function loadTodaySummary() {
      try {
        const data = await fetchTodaySummary();
        if (!cancelled) setTodaySummary(data);
      } catch {
        // Silent failure — this is a nice-to-have widget, not core workflow.
      }
    }

    loadTodaySummary();
    const interval = window.setInterval(loadTodaySummary, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [employee?.id]);

  useEffect(() => {
    saveStoredFilters(employee?.id, filters);
  }, [employee, filters]);

  useEffect(() => {
    saveStoredUpcomingOnly(employee?.id, upcomingOnly);
  }, [employee, upcomingOnly]);

  useEffect(() => {
    saveStoredSortOrder(employee?.id, sortOrder);
  }, [employee, sortOrder]);

  const employeeNames = useMemo(() => {
    const names = employeeDirectory.map((item) => item.fullName);
    if (employee?.fullName && !names.includes(employee.fullName)) names.push(employee.fullName);
    return names.sort((a, b) => a.localeCompare(b));
  }, [employee, employeeDirectory]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  function cancelHoverHide() {
    if (hoverHideTimeout.current) {
      window.clearTimeout(hoverHideTimeout.current);
      hoverHideTimeout.current = null;
    }
  }

  function scheduleHoverHide() {
    cancelHoverHide();
    hoverHideTimeout.current = window.setTimeout(() => setHoverPreview(null), 150);
  }

  async function handlePreviewHover(event, row, type) {
    cancelHoverHide();
    const rect = event.currentTarget.getBoundingClientRect();
    const clientNameColumn = workspace.columns.find((column) => column.id === "client_name");
    const clientName = clientNameColumn ? row.values[clientNameColumn.id] : "";

    setHoverPreview({
      type,
      rowId: row.id,
      clientName,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      anchorLeft: rect.left,
      status: "loading",
      items: [],
      error: "",
      fetchedAt: Date.now(),
      nextCallDatetime: row.nextCallDatetime || "",
    });

    try {
      const data = type === "meetings" ? await loadClientMeetings(row.id) : await loadClientCalls(row.id);
      setHoverPreview((current) =>
        current && current.rowId === row.id && current.type === type
          ? { ...current, status: "ready", items: (type === "meetings" ? data.meetings : data.calls) || [] }
          : current,
      );
    } catch (error) {
      setHoverPreview((current) =>
        current && current.rowId === row.id && current.type === type
          ? { ...current, status: "error", error: error instanceof Error ? error.message : "Failed to load." }
          : current,
      );
    }
  }

  const filteredRows = useMemo(() => {
    // Rows added this session that haven't been saved yet are exempt from
    // every filter/search/upcoming-only check below — a still-blank draft
    // would otherwise never match any of them and vanish from view the
    // moment a filter is active. They always float to the top, unfiltered,
    // until Save Changes succeeds (at which point they leave this bucket
    // and become subject to the exact same filters as any other row).
    const isDraftRow = (row) => !lastSavedRowsSnapshotRef.current.has(row.id);
    const draftRows = workspace.rows.filter(isDraftRow);
    let rows = workspace.rows.filter((row) => !isDraftRow(row));

    const query = searchText.trim().toLowerCase();
    if (query) {
      rows = rows.filter((row) =>
        Object.entries(row.values).some(([columnId, value]) => {
          if (String(value ?? "").toLowerCase().includes(query)) return true;
          // "Event Date" is stored as "YYYY-MM-DD" but shown as "DD/MM/YYYY" —
          // search both so typing the displayed date still finds it.
          if (columnId === "event_date") return isoDateToDDMMYYYY(value).toLowerCase().includes(query);
          return false;
        }),
      );
    }

    if (filters.dateFrom || filters.dateTo) {
      // Filters by the "Event Date" column (a real "YYYY-MM-DD" date), not
      // LAT/NAT (Last/Next Meeting Time) — those are live-computed and
      // reflect meeting activity, not when the client's event itself is.
      rows = rows.filter((row) => {
        const date = String(row.values.event_date ?? "");
        if (!date) return false;
        if (filters.dateFrom && date < filters.dateFrom) return false;
        if (filters.dateTo && date > filters.dateTo) return false;
        return true;
      });
    }

    const col = (type) => workspace.columns.find((c) => c.type === type);

    if (filters.shifts.size > 0) {
      const c = col("shift");
      rows = rows.filter((row) => filters.shifts.has(c ? row.values[c.id] ?? "" : ""));
    }
    if (filters.venues.size > 0) {
      const c = col("venue");
      rows = rows.filter((row) => filters.venues.has(c ? row.values[c.id] ?? "" : ""));
    }

    if (upcomingOnly) {
      // Hides clients whose event date is today or already passed — no rows
      // are ever deleted, this only narrows what's currently displayed.
      const today = getTodayIso();
      rows = rows.filter((row) => {
        const date = String(row.values.event_date ?? "");
        return date !== "" && date > today;
      });
    }

    if (sortOrder === "newest" || sortOrder === "oldest") {
      const sign = sortOrder === "newest" ? -1 : 1;
      rows = [...rows].sort((a, b) => sign * (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
    } else if (sortOrder === "eventDateAsc" || sortOrder === "eventDateDesc") {
      const sign = sortOrder === "eventDateAsc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const dateA = String(a.values.event_date ?? "");
        const dateB = String(b.values.event_date ?? "");
        // Rows with no event date always sink to the bottom, in either direction.
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return sign * dateA.localeCompare(dateB);
      });
    }

    return [...draftRows, ...rows];
  }, [searchText, workspace.rows, workspace.columns, filters, upcomingOnly, sortOrder]);

  // True only when there's an unsaved edit to an already-saved row, or a
  // brand-new row that now has real content — NOT when the only unsaved
  // change is a still-empty freshly-added row (that one just vanishes on
  // refresh with no warning needed).
  const hasMeaningfulUnsavedChanges = useMemo(() => {
    return workspace.rows.some((row) => {
      const savedSignature = lastSavedRowsSnapshotRef.current.get(row.id);
      if (savedSignature === undefined) return !isRowBlank(row, workspace.columns);
      return rowSignature(row) !== savedSignature;
    });
  }, [workspace.rows, workspace.columns]);

  const activeFilterCount = useMemo(
    () =>
      (filters.dateFrom ? 1 : 0) +
      (filters.dateTo ? 1 : 0) +
      filters.shifts.size +
      filters.venues.size,
    [filters],
  );

  function toggleFilter(key, value) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  function clearFilters() {
    setFilters({
      dateFrom: "",
      dateTo: "",
      shifts: new Set(),
      venues: new Set(),
    });
  }

  function startColumnResize(e, columnId) {
    e.preventDefault();
    const col = workspace.columns.find((c) => c.id === columnId);
    if (!col) return;
    const startX = e.clientX;
    const startWidth = col.width;
    setResizeCursor("col-resize");
    function onMove(ev) {
      const newWidth = Math.max(60, startWidth + (ev.clientX - startX));
      setWorkspace((prev) => ({
        ...prev,
        columns: prev.columns.map((c) => (c.id === columnId ? { ...c, width: newWidth } : c)),
      }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setResizeCursor(null);

      // Persist per-employee preferred widths immediately after resizing,
      // so refresh keeps the same layout until the employee changes widths again.
      saveStoredColumnWidths(employee?.id, workspaceRef.current.columns);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startRowResize(e, rowId) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = rowHeights[rowId] || 44;
    setResizeCursor("row-resize");
    function onMove(ev) {
      const newHeight = Math.max(44, startHeight + (ev.clientY - startY));
      setRowHeights((prev) => {
        const next = { ...prev, [rowId]: newHeight };
        localStorage.setItem("mme_row_heights_v1", JSON.stringify(next));
        return next;
      });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setResizeCursor(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    document.body.style.cursor = resizeCursor ?? "";
    document.body.style.userSelect = resizeCursor ? "none" : "";
  }, [resizeCursor]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedData() {
      try {
        // Only show the full-page spinner when there's nothing cached to
        // show yet — a cached return visit refreshes silently underneath.
        if (!cachedWorkspace) setIsLoadingWorkspace(true);
        const [nextWorkspace, employees] = await Promise.all([
          loadWorkspace(),
          loadEmployeeDirectory(),
        ]);
        if (cancelled) return;
        const orderedColumns = sortColumnsByDefaultOrder(nextWorkspace.columns);
        const columnsWithStoredWidths = applyStoredColumnWidths(orderedColumns, employee?.id);
        const nextState = {
          ...nextWorkspace,
          columns: columnsWithStoredWidths,
          rows: nextWorkspace.rows.filter((row) => !isRowBlank(row, nextWorkspace.columns)),
        };
        cachedWorkspace = nextState;
        cachedEmployeeDirectory = employees;
        lastSavedRowsSnapshotRef.current = new Map(nextState.rows.map((row) => [row.id, rowSignature(row)]));
        setWorkspace(nextState);
        setEmployeeDirectory(employees);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Could not load shared data.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkspace(false);
          window.setTimeout(() => {
            hasMounted.current = true;
          }, 0);
        }
      }
    }

    loadSharedData();
    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  // Continuously remember scroll position so navigating away (e.g. to a
  // client's meetings/calls page) and back restores exactly where the
  // employee left off, instead of jumping back to the top of the list.
  // NOTE: don't also save on the effect's cleanup — React's StrictMode
  // (dev only) mounts, cleans up, then re-mounts every component once, and
  // saving scrollY=0 during that throwaway cleanup would clobber the real
  // saved position before the restore effect below ever gets to read it.
  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        saveStoredScrollY(employee?.id, window.scrollY);
        ticking = false;
      });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [employee?.id]);

  // Restore the remembered scroll position once the workspace has finished
  // loading and the full row list has rendered. Double-rAF (rather than one)
  // so this runs after the browser has actually painted the restored rows —
  // otherwise the page can still be too short to scroll to the saved spot,
  // e.g. right after returning via the browser/system back button.
  useEffect(() => {
    if (isLoadingWorkspace) return undefined;
    const restoreY = loadStoredScrollY(employee?.id);
    if (!restoreY) return undefined;

    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        window.scrollTo(0, restoreY);
      });
    });
    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [isLoadingWorkspace, employee?.id]);

  useEffect(() => {
    if (!hasMounted.current) return;
    setHasUnsavedChanges(true);
  }, [workspace]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilters(false);
        setHoveredSection(null);
      }
    }
    if (showFilters) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // Native "leave site?" confirmation — only when a refresh/close would
  // actually lose real client data, not just a still-empty freshly-added row.
  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasMeaningfulUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasMeaningfulUnsavedChanges]);

  useEffect(() => {
    if (!employee) return undefined;

    window.history.pushState(null, "", window.location.href);

    function handlePopState() {
      window.history.pushState(null, "", window.location.href);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [employee]);

  // No employee session (e.g. reached via browser back/forward navigation
  // after logging out elsewhere in the SPA) — always send the user to the
  // dedicated /login page rather than showing any inline login UI here.
  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
    }
  }, [employee, navigate]);

  function handleLogout() {
    clearCurrentEmployee();
    cachedWorkspace = null;
    cachedEmployeeDirectory = null;
    setEmployee(null);
    navigate("/", { replace: true });
  }

  function requestLogout() {
    setShowLogoutConfirm(true);
  }

  function confirmLogout() {
    setShowLogoutConfirm(false);
    handleLogout();
  }

  function addRow() {
    setWorkspace((current) => ({
      ...current,
      rows: [...current.rows, createEmptyRow(current.columns, current.rows.length + 1)],
    }));
    setNotice({ type: "success", message: "New row added at the top — fill it in and click Save Changes." });
  }

  async function deleteRow(rowId) {
    const nextRows = workspace.rows
      .filter((row) => row.id !== rowId)
      .map((row, index) => ({ ...row, rowNumber: index + 1 }));

    setRowHeights((prev) => {
      const next = { ...prev };
      delete next[rowId];
      localStorage.setItem("mme_row_heights_v1", JSON.stringify(next));
      return next;
    });

    if (!employee?.id) {
      setWorkspace((current) => ({ ...current, rows: nextRows }));
      setHasUnsavedChanges(true);
      return;
    }

    await handleSaveChanges(nextRows);
  }

  function updateCell(rowId, columnId, value) {
    setWorkspace((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              values: { ...row.values, [columnId]: value },
              updatedAt: new Date().toISOString(),
              updatedBy: employee?.email || null,
            }
          : row,
      ),
    }));
  }

  // Toggled via the badge button beside the Event Date cell — marks a client
  // as already booked with another event management company. Applies
  // immediately to local state (row highlight shows right away) but is only
  // persisted to the database once Save Changes is clicked, same as any
  // other cell edit.
  function toggleAlreadyBooked(rowId) {
    setWorkspace((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId ? { ...row, alreadyBooked: !row.alreadyBooked } : row,
      ),
    }));
  }

  function addColumn(column) {
    setWorkspace((current) => ({
      ...current,
      columns: [...current.columns, column],
      rows: current.rows.map((row) => ({
        ...row,
        values: { ...row.values, [column.id]: "" },
      })),
    }));
    setShowAddColumn(false);
    setNotice({ type: "success", message: `"${column.name}" column added.` });
  }

  async function handleSaveChanges(rowsOverride) {
    if (!employee?.id || isSaving) return;
    setIsSaving(true);
    try {
      const sourceRows = rowsOverride ?? workspace.rows;

      const nonBlankRows = sourceRows.filter((row) => !isRowBlank(row, workspace.columns));
      const rowsRemoved = nonBlankRows.length !== sourceRows.length;

      const eventDateColumn = workspace.columns.find((column) => column.id === "event_date");
      const rows = eventDateColumn
        ? nonBlankRows.map((row) => {
            const current = row.values[eventDateColumn.id];
            if (current && String(current).trim() !== "") return row;
            return { ...row, values: { ...row.values, [eventDateColumn.id]: "N/A" } };
          })
        : nonBlankRows;

      const workspaceToSave = { ...workspace, rows };

      await saveWorkspace(workspaceToSave, employee.id);
      setWorkspace(workspaceToSave);
      lastSavedRowsSnapshotRef.current = new Map(rows.map((row) => [row.id, rowSignature(row)]));
      setHasUnsavedChanges(false);
      setNotice({
        type: "success",
        message: rowsRemoved
          ? "All changes saved successfully. Empty rows were removed automatically."
          : "All changes saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save changes.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.rows.length) throw new Error("The spreadsheet contains headers but no data rows.");

      const normalizedHeaders = new Set(parsed.headers.map(normalizeHeader));
      const missingColumns = MANDATORY_EXCEL_COLUMNS.filter(
        (name) => !normalizedHeaders.has(normalizeHeader(name)),
      );
      if (missingColumns.length) {
        throw new Error(
          `Import failed. Missing mandatory column(s): ${missingColumns.join(", ")}.`,
        );
      }

      setImportPreview({ ...parsed, fileName: file.name });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not read the spreadsheet.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  function confirmImport() {
    if (!importPreview) return;

    const headerMap = new Map(workspace.columns.map((column) => [normalizeHeader(column.name), column]));

    const importedColumns = importPreview.headers
      .map((header) => headerMap.get(normalizeHeader(header)))
      .filter(Boolean);

    const seenSignatures = new Set(
      workspace.rows.map((row) => buildRowSignature(row.values, importedColumns)),
    );

    const importedRows = [];
    let duplicateCount = 0;

    importPreview.rows.forEach((sourceRow) => {
      const values = Object.fromEntries(workspace.columns.map((column) => [column.id, ""]));

      importPreview.headers.forEach((header) => {
        const column = headerMap.get(normalizeHeader(header));
        if (!column) return;
        const rawValue = sourceRow[header];
        if (isNotAvailableValue(rawValue)) {
          values[column.id] = "N/A";
        } else if (column.id === "event_date") {
          values[column.id] = parseFreeTextDateToIso(rawValue);
        } else {
          values[column.id] = String(rawValue);
        }
      });

      const signature = buildRowSignature(values, importedColumns);
      if (seenSignatures.has(signature)) {
        duplicateCount += 1;
        return;
      }
      seenSignatures.add(signature);

      importedRows.push({
        id: crypto.randomUUID(),
        rowNumber: workspace.rows.length + importedRows.length + 1,
        values,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: employee?.email || null,
        importSource: importPreview.fileName,
      });
    });

    setWorkspace((current) => ({ ...current, rows: [...current.rows, ...importedRows] }));

    setNotice({
      type: "success",
      message:
        duplicateCount > 0
          ? `${importedRows.length} row(s) imported from ${importPreview.fileName}. ${duplicateCount} duplicate row(s) skipped (already existed).`
          : `${importedRows.length} row(s) imported from ${importPreview.fileName}.`,
    });
    setImportPreview(null);

    if (importedRows.length > 0) {
      setSavePromptRowCount(importedRows.length);
    }
  }

  async function handleSavePromptConfirm() {
    await handleSaveChanges();
    setSavePromptRowCount(0);
  }

  /* ─── Loading ─── */

  if (isLoadingWorkspace) {
    return (
      <EmployeeLayout>
      <div className="grid min-h-screen place-items-center bg-[#ffffff] text-black">
        <div className="animate-[fadeInUp_0.4s_ease-out] text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d6d6d6] border-t-black" />
          <p className="mt-4 font-black">Loading shared management data...</p>
        </div>
      </div>
      </EmployeeLayout>
    );
  }

  /* ─── Render ─── */

  return (
    <EmployeeLayout>
    <div className="min-h-screen bg-[#ffffff] text-black">
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes heroDrift {
          0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: .5; }
          33% { transform: translate3d(8%,-10%,0) scale(1.25); opacity: .8; }
          66% { transform: translate3d(-9%,8%,0) scale(.85); opacity: .4; }
        }
        @keyframes sheen {
          from { transform: translateX(-120%) skewX(-18deg); }
          to { transform: translateX(320%) skewX(-18deg); }
        }
        .animate-hero-drift { animation: heroDrift 16s ease-in-out infinite; }
        .btn-sheen { position: relative; overflow: hidden; }
        .btn-sheen::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 45%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
          transform: translateX(-120%) skewX(-18deg);
          pointer-events: none;
        }
        .btn-sheen:hover::after { animation: sheen .9s ease-out; }
        .hero-dots {
          background-image: radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px);
          background-size: 22px 22px;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hero-drift { animation: none !important; }
          .btn-sheen:hover::after { animation: none !important; }
        }
      `}</style>

      {showAddColumn && <AddColumnModal onClose={() => setShowAddColumn(false)} onAdd={addColumn} />}
      {importPreview && <ExcelImportModal preview={importPreview} onClose={() => setImportPreview(null)} onConfirm={confirmImport} />}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll be signed out of the workspace and will need to log in again to continue."
          confirmLabel="Logout"
          cancelLabel="Cancel"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileSelection}
        className="hidden"
      />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/85 backdrop-blur-xl transition-all duration-300 animate-[fadeInDown_0.5s_ease-out]">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <img src={mmeLogo} alt="Make My Event - Management Workspace" className="h-27 w-auto shrink-0 object-contain transition-transform duration-300 hover:scale-105 sm:h-28" />
          </div>

          {/* ── Today's activity widget (Meetings vs Calls, per stat) ── */}
          <div className="hidden flex-1 items-center justify-center gap-3 lg:flex">
            <div className="flex items-stretch gap-3 rounded-2xl border border-[#d6d6d6]/60 bg-white px-4 py-2.5 shadow-sm shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/10">
              <div className="flex items-center gap-2.5 pr-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-transform duration-300 group-hover:scale-110">
                  <Clock size={18} />
                </div>
                <div className="leading-tight">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Due Today</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-black">
                      <CalendarClock size={13} className="text-amber-500" />
                      {todaySummary ? todaySummary.dueMeetings : <span className="inline-block h-3 w-3 animate-pulse rounded bg-black/10" />}
                      <span className="font-semibold text-black/40">Meetings</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-black">
                      <Phone size={13} className="text-amber-500" />
                      {todaySummary ? todaySummary.dueCalls : <span className="inline-block h-3 w-3 animate-pulse rounded bg-black/10" />}
                      <span className="font-semibold text-black/40">Calls</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-px bg-[#d6d6d6]/70" />

              <div className="flex items-center gap-2.5 pl-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                  <CheckCircle2 size={18} />
                </div>
                <div className="leading-tight">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Completed Today</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-black">
                      <CalendarClock size={13} className="text-emerald-500" />
                      {todaySummary ? todaySummary.completedMeetings : <span className="inline-block h-3 w-3 animate-pulse rounded bg-black/10" />}
                      <span className="font-semibold text-black/40">Meetings</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-black">
                      <Phone size={13} className="text-emerald-500" />
                      {todaySummary ? todaySummary.completedCalls : <span className="inline-block h-3 w-3 animate-pulse rounded bg-black/10" />}
                      <span className="font-semibold text-black/40">Calls</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handleSaveChanges()}
              disabled={!hasUnsavedChanges || isSaving || !employee?.id}
              className={`btn-sheen hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-200 md:flex ${
                hasUnsavedChanges && !isSaving
                  ? "border-black bg-black text-white shadow-md shadow-black/20 hover:-translate-y-0.5 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/30 active:scale-[0.97] cursor-pointer"
                  : "pointer-events-none border-[#d6d6d6]/60 bg-[#ffffff] text-black/40 opacity-60 cursor-not-allowed"
              }`}
            >
              {isSaving
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                : hasUnsavedChanges ? <Save size={15} /> : <Check size={15} className="text-[#333333]" />}
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Saved"}
            </button>

            <button onClick={requestLogout} title="Logout" className="group flex items-center gap-2 rounded-2xl border border-[#d6d6d6]/70 bg-white px-3 py-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:shadow-md hover:shadow-red-100/50 sm:px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f4f4] text-black transition-colors duration-200 group-hover:bg-red-100 group-hover:text-red-500"><UserRound size={16} /></div>
              <div className="hidden sm:block">
                <p className="max-w-36 truncate text-xs font-black text-black">{employee?.fullName || "Employee"}</p>
                <p className="max-w-36 truncate text-[10px] text-red-400 font-semibold">Logout</p>
              </div>
              <LogOut size={15} className="text-red-400 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-[1800px] animate-[fadeInUp_0.4s_ease-out]">
          <div className="relative mb-6 overflow-hidden rounded-[28px] bg-[#0B0B0F] p-6 text-white shadow-[0_30px_80px_-24px_rgba(0,0,0,.55)] ring-1 ring-white/10 sm:p-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-hero-drift absolute -left-24 -top-32 h-80 w-80 rounded-full bg-violet-600/40 blur-[100px]" />
              <div
                className="animate-hero-drift absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-cyan-500/25 blur-[110px]"
                style={{ animationDelay: "-6s" }}
              />
              <div className="hero-dots absolute inset-0 opacity-30" />
            </div>

            <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Employee Workspace</p>
                <h1 className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl">{workspace.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  Every client, booking and follow-up call, kept in one shared, live-updating sheet.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Link
                  to="/accounts"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black text-white ring-1 ring-white/15 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
                >
                  <Wallet size={17} className="transition-transform duration-300 group-hover:scale-110" /> Accounts
                </Link>
                <Link
                  to="/calendar"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black text-white ring-1 ring-white/15 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
                >
                  <CalendarDays size={17} className="transition-transform duration-300 group-hover:scale-110" /> Calendar
                </Link>
              </div>
            </div>
          </div>

          {/* ─── Sheet Container ─── */}
          <div className="overflow-hidden rounded-[24px] border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-shadow duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-[#d6d6d6]/50 bg-white p-3.5 animate-[fadeIn_0.5s_ease-out] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button onClick={addRow} className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white shadow-md shadow-black/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/25 active:scale-[0.97]">
                  <Plus size={17} /> Add row
                </button>
                <button onClick={() => setShowAddColumn(true)} className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-[#36454F] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[#36454F]/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-[#36454F]/40 active:scale-[0.97]">
                  <Columns3 size={17} /> Add column
                </button>
                <button disabled={isImporting} onClick={() => fileInputRef.current?.click()} className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-[#023020] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[#023020]/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-[#023020]/40 active:scale-[0.97] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none">
                  {isImporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FileSpreadsheet size={17} />}
                  {isImporting ? "Reading file..." : "Upload Excel"}
                </button>

                {/* ── Filters dropdown ── */}
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    onClick={() => { setShowFilters((v) => !v); setHoveredSection(null); }}
                    className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-[#191970] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[#191970]/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-[#191970]/40 active:scale-[0.97]"
                  >
                    <SlidersHorizontal size={17} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-black text-white transition-colors duration-200">{activeFilterCount}</span>
                    )}
                    <ChevronDown size={15} className={`transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`} />
                  </button>

                  {showFilters && (
                    <div className="animate-[fadeInDown_0.2s_ease-out] absolute left-0 top-full z-50 mt-2 flex rounded-2xl border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]" style={{ minWidth: 520 }}>
                      {/* Left — category list */}
                      <div className="w-52 shrink-0 border-r border-[#d6d6d6]/40 py-2">
                        {[
                          { key: "date",     label: "Date Range",       hasValue: filters.dateFrom || filters.dateTo },
                          { key: "shift",    label: "Shift",            hasValue: filters.shifts.size > 0 },
                          { key: "venue",    label: "Venue",            hasValue: filters.venues.size > 0 },
                          { key: "sort",     label: "Sort By",          hasValue: sortOrder !== "default" },
                        ].map(({ key, label, hasValue }) => (
                          <button
                            key={key}
                            onMouseEnter={() => setHoveredSection(key)}
                            onClick={() => setHoveredSection(key)}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition-all duration-150 ${
                              hoveredSection === key
                                ? "bg-black text-white"
                                : "text-black hover:bg-[#f4f4f4]/40"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {label}
                              {hasValue && (
                                <span className={`h-2 w-2 rounded-full transition-colors duration-200 ${hoveredSection === key ? "bg-[#d6d6d6]" : "bg-[#333333]"}`} />
                              )}
                            </span>
                            <span className="text-xs opacity-60">›</span>
                          </button>
                        ))}

                        {activeFilterCount > 0 && (
                          <div className="mx-3 mt-2 border-t border-[#d6d6d6]/40 pt-2">
                            <button
                              onClick={clearFilters}
                              className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black text-red-500 transition-all duration-200 hover:bg-red-50"
                            >
                              <X size={13} /> Clear all ({activeFilterCount})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right — options panel */}
                      <div className="flex-1 p-5">
                        {hoveredSection === null && (
                          <div className="flex h-full min-h-32 items-center justify-center text-center animate-[fadeIn_0.2s_ease-out]">
                            <div>
                              <SlidersHorizontal size={28} className="mx-auto text-[#a9a9a9]" />
                              <p className="mt-3 text-sm font-bold text-black/50">Hover a category to filter</p>
                            </div>
                          </div>
                        )}

                        {hoveredSection === "date" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Date Range (Event Date)</p>
                            <div className="flex flex-col gap-3">
                              <div>
                                <label className="mb-1 block text-xs font-bold text-black/60">From</label>
                                <input
                                  type="date"
                                  value={filters.dateFrom}
                                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                                  className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2 text-sm text-black outline-none transition-all duration-200 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-bold text-black/60">To</label>
                                <input
                                  type="date"
                                  value={filters.dateTo}
                                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                                  className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2 text-sm text-black outline-none transition-all duration-200 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {hoveredSection === "shift" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Shift</p>
                            <div className="space-y-2">
                              {SHIFT_OPTIONS.map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-[#f4f4f4]/30">
                                  <input type="checkbox" checked={filters.shifts.has(opt)} onChange={() => toggleFilter("shifts", opt)} className="h-4 w-4 accent-black" />
                                  <span className="text-sm font-bold text-black">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {hoveredSection === "venue" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Venue</p>
                            <div className="grid grid-cols-2 gap-1">
                              {VENUE_OPTIONS.map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-[#f4f4f4]/30">
                                  <input type="checkbox" checked={filters.venues.has(opt)} onChange={() => toggleFilter("venues", opt)} className="h-4 w-4 accent-black" />
                                  <span className="text-sm font-bold text-black">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {hoveredSection === "sort" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Sort By</p>
                            <div className="space-y-2">
                              {[
                                { value: "default", label: "Default order" },
                                { value: "newest",   label: "Newest upload first" },
                                { value: "oldest",   label: "Oldest upload first" },
                                { value: "eventDateAsc",  label: "Event date (ascending)" },
                                { value: "eventDateDesc", label: "Event date (descending)" },
                              ].map((opt) => (
                                <label key={opt.value} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-[#f4f4f4]/30">
                                  <input
                                    type="radio"
                                    name="sortOrder"
                                    checked={sortOrder === opt.value}
                                    onChange={() => setSortOrder(opt.value)}
                                    className="h-4 w-4 accent-black"
                                  />
                                  <span className="text-sm font-bold text-black">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setUpcomingOnly((v) => !v)}
                  title={upcomingOnly ? "Showing only upcoming events — click to show all clients again" : "Hide clients whose event date is today or already passed"}
                  className={`btn-sheen inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:scale-[0.97] ${
                    upcomingOnly
                      ? "bg-[#0b6e4f] shadow-[#0b6e4f]/30 hover:shadow-[#0b6e4f]/40"
                      : "bg-[#c2410c] shadow-[#c2410c]/30 hover:shadow-[#c2410c]/40"
                  }`}
                >
                  <CalendarClock size={17} />
                  {upcomingOnly ? "Upcoming only" : "Show upcoming only"}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <p className="hidden text-xs font-bold text-black/45 sm:block">
                  {filteredRows.length !== workspace.rows.length
                    ? `${filteredRows.length} of ${workspace.rows.length} rows`
                    : `${workspace.rows.length} total rows`} · {workspace.columns.length} columns
                </p>
                <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#333333]" size={17} />
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search all cells..." className="w-full rounded-xl border border-[#d6d6d6]/70 bg-[#ffffff] py-2.5 pl-10 pr-9 text-sm outline-none transition-all duration-200 focus:border-[#333333] focus:shadow-md focus:ring-4 focus:ring-[#d6d6d6]/20" />
                  {searchText && <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 transition-colors duration-150 hover:text-black"><X size={15} /></button>}
                </div>
              </div>
            </div>

            {/* ─── Table ─── */}
            {workspace.rows.length === 0 ? (
              <EmptyState onAddRow={addRow} onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <div className="min-h-[420px] overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-left" style={{ minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 w-14 min-w-14 border-b border-r border-[#d6d6d6]/60 bg-black px-2 py-3 text-center text-xs font-black text-white">#</th>
                      {workspace.columns.map((column) => (
                        <th
                          key={column.id}
                          style={{ width: column.width, minWidth: column.width }}
                          className="relative border-b border-r border-white/15 bg-black px-3 py-3 align-top text-xs font-black text-white"
                        >
                          <div className="flex items-start justify-between gap-2 pr-1">
                            <span>{Showed_Column_Name[column.name] ?? column.name}{column.required ? " *" : ""}</span>
                          </div>
                          <div
                            onMouseDown={(e) => startColumnResize(e, column.id)}
                            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors duration-150 hover:bg-white/40"
                          />
                        </th>
                      ))}
                      <th className="sticky right-0 z-30 w-[52px] min-w-[52px] border-b border-l border-white/15 bg-black px-2 py-3 text-center text-xs font-black text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const rowH = rowHeights[row.id];
                      const isAlreadyBooked = Boolean(row.alreadyBooked);
                      const isBookedFromMme = Boolean(row.bookedFromMme);
                      const stickyBg = isBookedFromMme
                        ? "bg-emerald-100 group-hover:bg-emerald-300/80"
                        : isAlreadyBooked
                        ? "bg-rose-100 group-hover:bg-rose-300/80"
                        : "bg-[#ffffff] group-hover:bg-[#f8f8f8]";
                      const cellBg = isBookedFromMme
                        ? "bg-emerald-100/80 group-hover:bg-emerald-200/70"
                        : isAlreadyBooked
                        ? "bg-rose-100/80 group-hover:bg-rose-200/70"
                        : "bg-white group-hover:bg-[#fafafa]";
                      const cellBorder = isBookedFromMme
                        ? "border-emerald-300/70"
                        : isAlreadyBooked
                        ? "border-rose-300/70"
                        : "border-[#d6d6d6]/45";
                      return (
                        <tr
                          key={row.id}
                          className="group"
                          title={
                            isBookedFromMme
                              ? "This client has confirmed & finalized their event with MME"
                              : isAlreadyBooked
                              ? "This client has already booked with another event management company"
                              : undefined
                          }
                          style={{
                            ...(rowH ? { height: `${rowH}px` } : {}),
                            animation: `fadeInUp 0.3s ease-out ${Math.min(index * 0.03, 0.5)}s both`,
                          }}
                        >
                          <td
                            className={`sticky left-0 z-10 border-b border-r ${cellBorder} text-center text-xs font-black text-black/45 transition-colors duration-150 ${stickyBg}`}
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="relative flex w-full min-h-11 items-center justify-center px-2" style={rowH ? { height: `${rowH}px` } : undefined}>
                              {row.rowNumber}
                              <div
                                onMouseDown={(e) => startRowResize(e, row.id)}
                                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize transition-colors duration-150 hover:bg-black/20"
                              />
                            </div>
                          </td>
                          {workspace.columns.map((column) => (
                            <td
                              key={column.id}
                              style={{ width: column.width, minWidth: column.width, ...(rowH ? { height: `${rowH}px` } : {}) }}
                              className={`border-b border-r ${cellBorder} align-top transition-colors duration-150 ${cellBg}`}
                            >
                              {column.id === "event_date" ? (
                                <div className="flex h-full min-h-11 items-stretch">
                                  <div className="min-w-0 flex-1">
                                    <CellEditor
                                      column={column}
                                      value={row.values[column.id]}
                                      onChange={(value) => updateCell(row.id, column.id, value)}
                                      employeeNames={employeeNames}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleAlreadyBooked(row.id)}
                                    title={
                                      isAlreadyBooked
                                        ? "Already booked with another event management company — click to unmark"
                                        : "Mark as already booked with another event management company"
                                    }
                                    className={`my-auto mr-1.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black transition-all duration-200 active:scale-90 ${
                                      isAlreadyBooked
                                        ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30 hover:bg-rose-600"
                                        : "bg-[#f4f4f4] text-black/35 hover:bg-rose-50 hover:text-rose-500"
                                    }`}
                                  >
                                    <BadgeAlert size={13} />
                                  </button>
                                </div>
                              ) : column.type === "meeting_manager" ? (
                                <div className="flex h-full min-h-11 items-center justify-center gap-2 p-1.5">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/management/meetings/${row.id}`)}
                                    onMouseEnter={(event) => handlePreviewHover(event, row, "meetings")}
                                    onMouseLeave={scheduleHoverHide}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#f2662b] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#d9541f] hover:shadow-md hover:shadow-[#f2662b]/30 active:scale-[0.96]"
                                  >
                                    <CalendarClock size={14} /> Meetings
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/management/calls/${row.id}`)}
                                    onMouseEnter={(event) => handlePreviewHover(event, row, "calls")}
                                    onMouseLeave={scheduleHoverHide}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#c2410c] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#9a340a] hover:shadow-md hover:shadow-[#c2410c]/30 active:scale-[0.96]"
                                  >
                                    <Phone size={14} /> Calls
                                  </button>
                                </div>
                              ) : column.type === "last_meeting_time" || column.type === "next_meeting_time" ? (
                                <div
                                  className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 p-1.5 text-center text-xs font-bold transition-colors duration-150 ${
                                    row.values[column.id] || (column.type === "last_meeting_time" ? row.lastCallDatetime : row.nextCallDatetime)
                                      ? "text-black/75"
                                      : "text-black/35 italic"
                                  }`}
                                  title="Automatically set from the Meeting and Call managers"
                                >
                                  <p>
                                    <span className="font-black text-black/50">Meeting: </span>
                                    {formatMeetingTimeDisplay(
                                      row.values[column.id],
                                      column.type === "last_meeting_time" ? "No Previous Meeting" : "No Upcoming Meeting",
                                    )}
                                  </p>
                                  <p
                                    className={
                                      column.type === "next_meeting_time" && isOverdueDatetime(row.nextCallDatetime)
                                        ? "font-black text-red-600"
                                        : undefined
                                    }
                                  >
                                    <span className={column.type === "next_meeting_time" && isOverdueDatetime(row.nextCallDatetime) ? "font-black text-red-500" : "font-black text-black/50"}>
                                      Call: 
                                    </span>
                                    {formatMeetingTimeDisplay(
                                      column.type === "last_meeting_time" ? row.lastCallDatetime : row.nextCallDatetime,
                                      column.type === "last_meeting_time" ? "No Previous Call" : "No Upcoming Call",
                                    )}
                                    {column.type === "next_meeting_time" && isOverdueDatetime(row.nextCallDatetime) ? " (Missed)" : ""}
                                  </p>
                                </div>
                              ) : (
                                <CellEditor
                                  column={column}
                                  value={row.values[column.id]}
                                  onChange={(value) => updateCell(row.id, column.id, value)}
                                  employeeNames={employeeNames}
                                />
                              )}
                            </td>
                          ))}
                          <td
                            className={`sticky right-0 z-10 border-b border-l ${cellBorder} px-1 text-center transition-colors duration-150 ${cellBg}`}
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="flex min-h-11 items-center justify-center" style={rowH ? { height: `${rowH}px` } : undefined}>
                              <button onClick={() => setConfirmDeleteRowId(row.id)} className="rounded-xl p-2 text-black/30 transition-all duration-200 hover:bg-red-50 hover:text-red-500 hover:shadow-sm active:scale-90" title="Delete row"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredRows.length === 0 && (
                  <div className="grid min-h-72 place-items-center p-8 text-center animate-[fadeIn_0.3s_ease-out]">
                    <div>
                      <Search className="mx-auto text-[#a9a9a9]" size={34} />
                      <p className="mt-4 font-black text-black">No matching rows</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-3">
                        {searchText && (
                          <button onClick={() => setSearchText("")} className="text-sm font-black text-[#333333] transition-colors duration-150 hover:text-black">
                            Clear search
                          </button>
                        )}
                        {activeFilterCount > 0 && (
                          <button onClick={clearFilters} className="text-sm font-black text-[#333333] transition-colors duration-150 hover:text-black">
                            Clear filters ({activeFilterCount})
                          </button>
                        )}
                        {upcomingOnly && (
                          <button onClick={() => setUpcomingOnly(false)} className="text-sm font-black text-[#333333] transition-colors duration-150 hover:text-black">
                            Show all clients
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col justify-between gap-2 border-t border-[#d6d6d6]/50 bg-[#fafafa] px-4 py-3 text-xs text-black/50 transition-colors duration-300 sm:flex-row sm:items-center">
              <p>Drag column edges to resize width · Drag row edges to resize height · Press <strong>Save Changes</strong> to persist edits to the database.</p>
              <p className="font-bold">Supported imports: .xlsx and .csv</p>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Toast / Notice ─── */}
      {notice && (
        <div
          className={`animate-[slideInRight_0.35s_ease-out] fixed bottom-5 right-5 z-[120] flex max-w-md items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl transition-all duration-300 ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.type === "info"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.type === "error" ? <X className="mt-0.5 shrink-0" size={18} /> : notice.type === "info" ? <CalendarDays className="mt-0.5 shrink-0 text-sky-600" size={18} /> : <Check className="mt-0.5 shrink-0 text-emerald-600" size={18} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-2 opacity-50 transition-opacity duration-150 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* ─── Hover Preview ─── */}
      {hoverPreview && (
        <HoverPreviewPanel preview={hoverPreview} onMouseEnter={cancelHoverHide} onMouseLeave={scheduleHoverHide} />
      )}

      {/* ─── Delete row confirmation modal ─── */}
      {confirmDeleteRowId !== null && (
        <div className="animate-[fadeIn_0.15s_ease-out] fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
          <div className="animate-[scaleIn_0.25s_ease-out] w-full max-w-sm rounded-[28px] border border-[#d6d6d6] bg-white p-7 shadow-2xl">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Trash2 size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black text-black">Delete this row?</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              This row will be permanently removed and saved immediately.
              This action cannot be undone.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setConfirmDeleteRowId(null)}
                disabled={isSaving}
                className="flex-1 rounded-2xl border border-black/20 bg-white py-3 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const rowId = confirmDeleteRowId;
                  setConfirmDeleteRowId(null);
                  await deleteRow(rowId);
                }}
                disabled={isSaving}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white shadow-md shadow-red-200 transition-all duration-200 hover:bg-red-600 hover:shadow-lg hover:shadow-red-300 active:scale-[0.97] disabled:opacity-60"
              >
                {isSaving ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Post-import save prompt ─── */}
      {savePromptRowCount > 0 && (
        <div className="animate-[fadeIn_0.15s_ease-out] fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
          <div className="animate-[scaleIn_0.25s_ease-out] w-full max-w-sm rounded-[28px] border border-[#d6d6d6] bg-white p-7 shadow-2xl">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#f4f4f4] text-black">
              <Save size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black text-black">Save these rows now?</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              {savePromptRowCount} row(s) were added from your Excel import. Save now to persist
              them to the main system, or save later from the toolbar.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setSavePromptRowCount(0)}
                disabled={isSaving}
                className="flex-1 rounded-2xl border border-black/20 bg-white py-3 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Not now
              </button>
              <button
                onClick={handleSavePromptConfirm}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black py-3 text-sm font-black text-white shadow-md shadow-black/15 transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <Save size={15} />}
                {isSaving ? "Saving..." : "Save now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile save FAB ── */}
      {hasUnsavedChanges && !isSaving && employee?.id && (
        <button
          onClick={() => handleSaveChanges()}
          className="animate-[fadeInUp_0.3s_ease-out] fixed bottom-5 left-5 z-[100] flex items-center gap-2 rounded-2xl bg-black px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-black/30 transition-all duration-200 hover:bg-[#222222] hover:shadow-2xl active:scale-[0.96] md:hidden"
        >
          <Save size={16} /> Save
        </button>
      )}
    </div>
    </EmployeeLayout>
  );
}