// Money Receipt form blank-state, live payment-summary calculation, and
// client-side validation. Mirrors the backend controller's validation
// messages/logic exactly (parseReceiptPayload in moneyReceiptController.js)
// for consistent UX — the backend always recalculates/re-validates anyway,
// this is purely for instant feedback.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function todayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function createBlankMoneyReceiptForm() {
  return {
    receiptDate: todayDateString(),
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    clientAddress: "",
    eventName: "",
    eventDate: "",
    eventVenue: "",
    bookingReference: "",
    totalPayment: "",
    advancePayment: "",
    paymentMethod: "cash",
    paymentMethodOther: "",
    transactionReference: "",
    remarks: "",
  };
}

// Integer-paisa arithmetic (same convention as the backend) — avoids
// floating point rounding artifacts like 99999.999999997 in the UI.
function toPaisa(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

// Returns { duePayment, paymentStatus } — null values while total/advance
// aren't valid numbers yet (so the UI can show a neutral placeholder).
export function computePaymentSummary({ totalPayment, advancePayment }) {
  const totalPaisa = toPaisa(totalPayment);
  const advancePaisa = toPaisa(advancePayment);

  if (totalPaisa === null || totalPaisa < 0 || advancePaisa === null || advancePaisa < 0) {
    return { duePayment: null, paymentStatus: null };
  }

  const duePaisa = totalPaisa - advancePaisa;
  const paymentStatus = advancePaisa === 0 ? "unpaid" : duePaisa <= 0 ? "paid" : "partially_paid";

  return { duePayment: duePaisa / 100, paymentStatus };
}

export function validateMoneyReceiptForm(form) {
  if (!form.receiptDate) return "A valid receipt date is required.";
  if (!form.clientName.trim()) return "Client name is required.";
  if (!form.clientPhone.trim()) return "Client phone number is required.";

  if (form.clientEmail.trim() && !EMAIL_PATTERN.test(form.clientEmail.trim())) {
    return "Please provide a valid client email address.";
  }

  if (form.eventDate && Number.isNaN(new Date(form.eventDate).getTime())) {
    return "Please provide a valid event date.";
  }

  const totalPaisa = toPaisa(form.totalPayment);
  if (totalPaisa === null || totalPaisa < 0) {
    return "Total payment must be a valid non-negative amount.";
  }

  const advancePaisa = toPaisa(form.advancePayment);
  if (advancePaisa === null || advancePaisa < 0) {
    return "Advance payment must be a valid non-negative amount.";
  }

  if (advancePaisa > totalPaisa) {
    return "Advance payment cannot exceed the total payment.";
  }

  if (form.paymentMethod === "other" && !form.paymentMethodOther.trim()) {
    return 'Please specify the payment method when "Other" is selected.';
  }

  return null;
}
