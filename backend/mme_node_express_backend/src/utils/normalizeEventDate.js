// Parses the many inconsistent formats employees have typed into the
// free-text "Event Date" column (weekday names, mm/dd/yyyy, yyyy/dd/mm,
// dd-mm-yyyy, month names, etc.) into one consistent "DD/MM/YYYY" string.
// Returns null for blank/"N/A"/unparseable input (caller decides what to do).

const WEEKDAY_PATTERN =
  /\b(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?)\b\.?,?/gi;

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidDate(day, month, year) {
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function normalizeEventDateText(raw) {
  if (raw === null || raw === undefined) return null;
  let text = String(raw).trim();
  if (!text || /^n\/?a$/i.test(text)) return null;

  // Strip "(Saturday)"-style suffixes and bare weekday names/commas.
  text = text.replace(/\([^)]*\)/g, " ");
  text = text.replace(WEEKDAY_PATTERN, " ");
  text = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  // "18 July 2026" or "July 18 2026".
  const monthNameMatch =
    text.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/) ||
    text.match(/^([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (monthNameMatch) {
    const [, first, second, third] = monthNameMatch;
    const isFirstMonthName = /^[a-zA-Z]+$/.test(first);
    const day = Number(isFirstMonthName ? second : first);
    const monthName = (isFirstMonthName ? first : second).toLowerCase();
    const year = Number(third);
    const month = MONTH_NAMES[monthName] || MONTH_NAMES[monthName.slice(0, 3)];
    if (month && isValidDate(day, month, year)) return `${pad2(day)}/${pad2(month)}/${year}`;
    return null;
  }

  // Purely numeric, in any of dd/mm/yyyy, mm/dd/yyyy, yyyy/mm/dd, yyyy/dd/mm
  // (any of -, /, ., or space as separator).
  const numMatch = text.match(/^(\d{1,4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,4})$/);
  if (numMatch) {
    const a = Number(numMatch[1]);
    const b = Number(numMatch[2]);
    const c = Number(numMatch[3]);
    let day, month, year;

    if (numMatch[1].length === 4 || a > 31) {
      // Year leads — ISO-like convention: remaining pair defaults to month/day.
      year = a;
      if (b > 12) { day = b; month = c; }
      else if (c > 12) { day = c; month = b; }
      else { month = b; day = c; }
    } else if (numMatch[3].length === 4 || c > 31) {
      // Year trails — regional convention: remaining pair defaults to day/month.
      year = c;
      if (a > 12) { day = a; month = b; }
      else if (b > 12) { day = b; month = a; }
      else { day = a; month = b; }
    } else {
      // No unambiguous 4-digit year — treat the last part as a 2-digit year.
      year = c < 100 ? 2000 + c : c;
      if (a > 12) { day = a; month = b; }
      else if (b > 12) { day = b; month = a; }
      else { day = a; month = b; }
    }

    if (isValidDate(day, month, year)) return `${pad2(day)}/${pad2(month)}/${year}`;
    return null;
  }

  // Last resort — anything else JS's own parser recognizes (e.g. "18-Jul-2026").
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  }

  return null;
}
