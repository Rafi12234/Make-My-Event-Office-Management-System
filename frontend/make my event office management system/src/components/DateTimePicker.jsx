import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Parses the same "YYYY-MM-DDTHH:MM" string the rest of the app already
// uses for datetime-local values (toDatetimeLocalValue / nowMinValue etc).
function parseValue(value) {
  if (!value) return null;
  const [datePart, timePart] = String(value).split("T");
  const [y, m, d] = (datePart || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const [h, mi] = (timePart || "00:00").split(":").map(Number);
  return { year: y, month: m - 1, day: d, hour24: h || 0, minute: mi || 0 };
}

function to12Hour(hour24) {
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, period };
}

function to24Hour(hour12, period) {
  let hour = hour12 % 12;
  if (period === "PM") hour += 12;
  return hour;
}

// Always returns 42 cells (6 full weeks) so the grid height never jumps
// between months — leading/trailing cells belong to the neighboring month.
function buildMonthGrid(year, month) {
  const firstWeekday    = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ label: daysInPrevMonth - firstWeekday + i + 1, inMonth: false, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ label: d, inMonth: true, dateStr: `${year}-${pad(month + 1)}-${pad(d)}` });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ label: nextDay++, inMonth: false, dateStr: null });
  }
  return cells;
}

function formatDisplayValue(value) {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const date = new Date(parsed.year, parsed.month, parsed.day, parsed.hour24, parsed.minute);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Position on a clock face for a given value (hour 1-12 or minute 0-59) —
// angle 0 points straight up (12 o'clock), increasing clockwise.
function pointOnDial(value, maxValue, radius) {
  const angle = ((value % maxValue) / maxValue) * Math.PI * 2;
  return { x: 100 + radius * Math.sin(angle), y: 100 - radius * Math.cos(angle) };
}

// Prefers opening below the trigger, flips above if there isn't room, and
// keeps the popover from running off either horizontal edge of the viewport.
function computePopoverPosition(rect, width, height) {
  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  const top = spaceBelow >= height || spaceBelow >= spaceAbove
    ? rect.bottom + 8
    : Math.max(margin, rect.top - height - 8);

  let left = rect.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  if (left < margin) left = margin;

  return { top, left };
}

// A clickable/draggable analog dial for picking an hour (1-12) or minute
// (0-59) — press anywhere to jump the hand to that angle, drag while held
// to keep adjusting it live, same as a native analog clock face.
function ClockDial({ mode, hour12, minute, isValueDisabled, onPick, onDone }) {
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);

  function valueFromPointer(e) {
    const rect  = svgRef.current.getBoundingClientRect();
    const scale = 200 / rect.width;
    const x = (e.clientX - rect.left) * scale - 100;
    const y = (e.clientY - rect.top) * scale - 100;
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += Math.PI * 2;
    if (mode === "hour") {
      const h = Math.round((angle / (Math.PI * 2)) * 12) % 12;
      return h === 0 ? 12 : h;
    }
    return Math.round((angle / (Math.PI * 2)) * 60) % 60;
  }

  function applyPointer(e) {
    const value = valueFromPointer(e);
    if (isValueDisabled(value)) return;
    onPick(value);
  }

  function handlePointerDown(e) {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e);
  }
  function handlePointerMove(e) {
    if (isDraggingRef.current) applyPointer(e);
  }
  function handlePointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    onDone?.();
  }

  const handValue  = mode === "hour" ? hour12 % 12 : minute;
  const handMax    = mode === "hour" ? 12 : 60;
  const handLength = mode === "hour" ? 54 : 74;
  const hand       = pointOnDial(handValue, handMax, handLength);

  const labels = mode === "hour"
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      className="h-44 w-44 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <circle cx="100" cy="100" r="98" className="fill-slate-50" />
      <line x1="100" y1="100" x2={hand.x} y2={hand.y} stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="4" className="fill-slate-900" />
      <circle cx={hand.x} cy={hand.y} r="15" className="fill-slate-900" />
      {labels.map((label) => {
        const value    = mode === "hour" ? label % 12 : label;
        const { x, y } = pointOnDial(value, handMax, 78);
        const selected = mode === "hour" ? hour12 === label : minute === label;
        const disabled = isValueDisabled(label);
        return (
          <text
            key={label}
            x={x}
            y={y + 4}
            textAnchor="middle"
            className={[
              "text-[11px] font-bold",
              selected ? "fill-white" : disabled ? "fill-slate-300" : "fill-slate-600",
            ].join(" ")}
            style={{ pointerEvents: "none" }}
          >
            {mode === "minute" ? pad(label) : label}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * A custom, styled replacement for <input type="datetime-local"> — native
 * pickers look and behave differently across every browser/OS, so this
 * renders identically everywhere. Date (calendar) and time (analog clock)
 * sit side by side, and nothing is committed via onChange until the
 * in-popover OK button is pressed (mirroring the app's existing "edit, then
 * press OK to confirm" pattern). Rendered through a portal at a fixed
 * position so it's never clipped by an ancestor's overflow/rounded-corner
 * card styling.
 *
 * `min` is a "YYYY-MM-DDTHH:MM" floor. By default both the date and the
 * time-of-day are restricted; pass `minDateOnly` to only restrict the date
 * (any time of day is selectable once the date is valid) — matches the
 * existing nowMinValue()/todayMinValue() split used across the app.
 */
export default function DateTimePicker({
  value,
  onChange,
  min,
  minDateOnly = false,
  placeholder = "Select date & time",
  subtle = false,
  disabled = false,
  className = "",
}) {
  const [isOpen,    setIsOpen]    = useState(false);
  const [position,  setPosition]  = useState({ top: 0, left: 0 });
  const [viewYear,  setViewYear]  = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [activeField,  setActiveField]  = useState("hour");
  const [draftDate,    setDraftDate]    = useState(null);
  const [draftHour12,  setDraftHour12]  = useState(12);
  const [draftMinute,  setDraftMinute]  = useState(0);
  const [draftPeriod,  setDraftPeriod]  = useState("AM");

  const containerRef = useRef(null);
  const popoverRef    = useRef(null);

  const minDate = min ? min.slice(0, 10) : null;
  const minTime = min && !minDateOnly ? min.slice(11, 16) : null;

  function openPicker() {
    const now    = new Date();
    const parsed = parseValue(value) || parseValue(min) || {
      year: now.getFullYear(), month: now.getMonth(), day: now.getDate(),
      hour24: now.getHours(), minute: now.getMinutes(),
    };
    const { hour12, period } = to12Hour(parsed.hour24);
    setDraftDate(`${parsed.year}-${pad(parsed.month + 1)}-${pad(parsed.day)}`);
    setDraftHour12(hour12);
    setDraftMinute(parsed.minute);
    setDraftPeriod(period);
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    setActiveField("hour");

    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = window.innerWidth >= 640 ? 560 : Math.min(320, window.innerWidth - 24);
    setPosition(computePopoverPosition(rect, popoverWidth, 460));
    setIsOpen(true);
  }

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setIsOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function handleScrollOrResize() {
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleKey);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  function goToPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }
  function goToNextMonth() {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  function isDayDisabled(dateStr) {
    return Boolean(minDate) && dateStr < minDate;
  }
  function isHourDisabled(hour12, period) {
    if (!minTime || draftDate !== minDate) return false;
    return to24Hour(hour12, period) < Number(minTime.slice(0, 2));
  }
  function isMinuteDisabled(minute) {
    if (!minTime || draftDate !== minDate) return false;
    const hour24 = to24Hour(draftHour12, draftPeriod);
    return `${pad(hour24)}:${pad(minute)}` < minTime;
  }
  function isPeriodDisabled(period) {
    if (!minTime || draftDate !== minDate) return false;
    // AM only covers hour24 0-11 — if the floor is already past 11:59, no AM time on this day works.
    return period === "AM" && Number(minTime.slice(0, 2)) >= 12;
  }

  function handleToday() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (isDayDisabled(todayStr)) return;
    setDraftDate(todayStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  }

  function handleClear() {
    onChange("");
    setIsOpen(false);
  }

  function handleConfirm() {
    if (!draftDate || isMinuteDisabled(draftMinute)) return;
    const hour24 = to24Hour(draftHour12, draftPeriod);
    onChange(`${draftDate}T${pad(hour24)}:${pad(draftMinute)}`);
    setIsOpen(false);
  }

  const cells       = buildMonthGrid(viewYear, viewMonth);
  const monthLabel  = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const displayText = formatDisplayValue(value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-slate-200 ${subtle ? "bg-slate-50" : "bg-white"} px-4 py-3 text-left text-sm font-semibold text-slate-900 outline-none transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-slate-50`}
      >
        <span className={displayText ? "" : "text-slate-400"}>{displayText || placeholder}</span>
        <CalendarClock size={16} className="shrink-0 text-slate-400" />
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: position.top, left: position.left, zIndex: 1000 }}
          className="w-[320px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:w-[560px]"
        >
          <div className="flex flex-col gap-5 sm:flex-row">
            {/* Date panel */}
            <div className="w-full sm:w-[260px]">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={goToPrevMonth} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100">
                  <ChevronLeft size={16} />
                </button>
                <p className="text-sm font-black text-slate-900">{monthLabel}</p>
                <button type="button" onClick={goToNextMonth} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>

              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((cell, idx) => {
                  const disabled   = !cell.inMonth || isDayDisabled(cell.dateStr);
                  const isSelected = cell.inMonth && cell.dateStr === draftDate;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDraftDate(cell.dateStr)}
                      className={[
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-150",
                        !cell.inMonth ? "text-slate-200" : "",
                        cell.inMonth && !disabled && !isSelected ? "text-slate-700 hover:bg-slate-100" : "",
                        disabled && cell.inMonth ? "cursor-not-allowed text-slate-200" : "",
                        isSelected ? "bg-slate-900 text-white shadow-md shadow-slate-900/30" : "",
                      ].join(" ")}
                    >
                      {cell.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden w-px shrink-0 bg-slate-100 sm:block" />

            {/* Time panel */}
            <div className="flex w-full flex-col items-center sm:w-[260px]">
              <div className="mb-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveField("hour")}
                  className={`text-3xl font-black tabular-nums transition ${activeField === "hour" ? "text-slate-900" : "text-slate-300 hover:text-slate-500"}`}
                >
                  {pad(draftHour12)}
                </button>
                <span className="text-3xl font-black text-slate-300">:</span>
                <button
                  type="button"
                  onClick={() => setActiveField("minute")}
                  className={`text-3xl font-black tabular-nums transition ${activeField === "minute" ? "text-slate-900" : "text-slate-300 hover:text-slate-500"}`}
                >
                  {pad(draftMinute)}
                </button>
                <div className="ml-1 flex flex-col gap-1">
                  {["AM", "PM"].map((p) => {
                    const selected = p === draftPeriod;
                    const disabled = isPeriodDisabled(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDraftPeriod(p)}
                        className={[
                          "rounded-lg px-2 py-1 text-[10px] font-black transition",
                          disabled ? "cursor-not-allowed text-slate-200" : selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                        ].join(" ")}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ClockDial
                mode={activeField}
                hour12={draftHour12}
                minute={draftMinute}
                isValueDisabled={activeField === "hour" ? (h) => isHourDisabled(h, draftPeriod) : (m) => isMinuteDisabled(m)}
                onPick={(v) => (activeField === "hour" ? setDraftHour12(v) : setDraftMinute(v))}
                onDone={() => { if (activeField === "hour") setActiveField("minute"); }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleToday} className="text-xs font-bold text-slate-500 transition hover:text-slate-900">
                Today
              </button>
              <button type="button" onClick={handleClear} className="text-xs font-bold text-slate-400 transition hover:text-red-500">
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!draftDate || isMinuteDisabled(draftMinute)}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
