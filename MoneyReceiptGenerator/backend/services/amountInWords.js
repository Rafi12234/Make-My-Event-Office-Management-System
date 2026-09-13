// Converts a Taka amount to words using the Bangladeshi/Indian numbering
// system (thousand, lakh, crore — not million/billion), since this is a
// Bangladesh-specific business receipt. Handles paisa (2 decimal places)
// consistently; drops the paisa clause entirely when it's exactly zero.
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

// Integer part uses the lakh/crore grouping: crore(10^7), lakh(10^5), thousand(10^3), hundred(10^2).
function integerToWords(value) {
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 1e7);
  const lakh = Math.floor((value % 1e7) / 1e5);
  const thousand = Math.floor((value % 1e5) / 1e3);
  const hundred = value % 1e3;

  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return parts.join(" ");
}

// amount: number or numeric string (e.g. from Prisma Decimal.toString()).
// Returns e.g. "Fifty Thousand Taka Only" or "One Lakh Fifty Thousand Taka
// And Fifty Paisa Only".
export function amountToWordsBDT(amount) {
  const numeric = Math.round((Number(amount) || 0) * 100) / 100; // snap to 2dp
  const isNegative = numeric < 0;
  const absolute = Math.abs(numeric);

  const taka = Math.floor(absolute);
  const paisa = Math.round((absolute - taka) * 100);

  const takaWords = integerToWords(taka);
  let result = `${takaWords} Taka`;

  if (paisa > 0) {
    result += ` And ${twoDigitsToWords(paisa)} Paisa`;
  }

  result += " Only";

  return isNegative ? `Negative ${result}` : result;
}
