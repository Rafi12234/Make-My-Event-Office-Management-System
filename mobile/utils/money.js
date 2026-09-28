import { API_ORIGIN } from "@/constants/config";

// ৳12,345.00 / -৳4,000.00 — used everywhere a money amount is displayed,
// mirrors the web Accounts module's formatTaka() exactly.
export function formatTaka(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}\u09F3${abs}`;
}

// Receipt image URLs come back as server-relative paths
// (/accounts-uploads/expense-receipts/xxx.jpg) — resolve against the API
// origin the same way the web service's resolveImageUrl() does.
export function resolveImageUrl(url) {
  if (!url) return "";
  return `${API_ORIGIN}${url}`;
}
