// Centralized Taka currency formatter for the Money Receipt Generator module
// — deliberately a separate copy from adminAccountsService.js's formatTaka
// (module isolation), but matches its exact "৳12,345.67" convention.
export function formatBDT(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}\u09F3${abs}`;
}

export function formatDisplayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year.slice(-2)}`;
}
