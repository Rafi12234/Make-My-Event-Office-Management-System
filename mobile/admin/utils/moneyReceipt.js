export const PAYMENT_METHOD_OPTIONS =
  [
    {
      value: "cash",
      label: "Cash",
    },

    {
      value:
        "bank_transfer",
      label:
        "Bank Transfer",
    },

    {
      value: "cheque",
      label: "Cheque",
    },

    {
      value: "bkash",
      label: "bKash",
    },

    {
      value: "nagad",
      label: "Nagad",
    },

    {
      value: "card",
      label: "Card",
    },

    {
      value: "other",
      label: "Other",
    },
  ];

export const BOOKING_STATUS_OPTIONS =
  [
    {
      value: "confirmed",
      label: "Confirmed",
    },

    {
      value:
        "not_confirmed",
      label: "Not Confirm",
    },
  ];

export function todayDateString() {
  const now =
    new Date();

  const y =
    now.getFullYear();

  const m =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const d =
    String(
      now.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${y}-${m}-${d}`;
}

export function blankMoneyReceiptForm() {
  return {
    receiptDate:
      todayDateString(),

    clientName: "",

    clientPhone: "",

    clientEmail: "",

    clientAddress: "",

    billedTo: "",

    eventName: "",

    eventDate: "",

    eventVenue: "",

    bookingReference: "",

    bookingStatus:
      "not_confirmed",

    totalPayment: "",

    advancePayment: "",

    paymentMethod:
      "cash",

    paymentMethodOther:
      "",

    transactionReference:
      "",

    remarks: "",
  };
}

function toPaisa(value) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? Math.round(
        n * 100,
      )
    : null;
}

export function computePaymentSummary(
  form,
) {
  const total =
    toPaisa(
      form.totalPayment,
    );

  const advance =
    toPaisa(
      form.advancePayment,
    );

  if (
    total === null ||
    advance === null ||
    total < 0 ||
    advance < 0
  ) {
    return {
      duePayment: null,

      paymentStatus:
        null,
    };
  }

  const due =
    total - advance;

  return {
    duePayment:
      due / 100,

    paymentStatus:
      advance === 0
        ? "unpaid"
        : due <= 0
          ? "paid"
          : "partially_paid",
  };
}

export function validateMoneyReceiptForm(
  form,
) {
  if (!form.receiptDate) {
    return "A valid receipt date is required.";
  }

  if (
    !form.clientName.trim()
  ) {
    return "Client name is required.";
  }

  if (
    !form.clientPhone.trim()
  ) {
    return "Client phone number is required.";
  }

  if (
    form.clientEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.clientEmail.trim(),
    )
  ) {
    return "Please provide a valid client email address.";
  }

  if (
    form.eventDate &&
    Number.isNaN(
      new Date(
        form.eventDate,
      ).getTime(),
    )
  ) {
    return "Please provide a valid event date.";
  }

  const total =
    toPaisa(
      form.totalPayment,
    );

  if (
    total === null ||
    total < 0
  ) {
    return "Total payment must be a valid non-negative amount.";
  }

  const advance =
    toPaisa(
      form.advancePayment,
    );

  if (
    advance === null ||
    advance < 0
  ) {
    return "Advance payment must be a valid non-negative amount.";
  }

  if (
    advance > total
  ) {
    return "Advance payment cannot exceed the total payment.";
  }

  if (
    form.paymentMethod ===
      "other" &&
    !form.paymentMethodOther.trim()
  ) {
    return 'Please specify the payment method when "Other" is selected.';
  }

  return null;
}

export function toMoneyReceiptPayload(
  form,
) {
  return {
    receiptDate:
      form.receiptDate,

    clientName:
      form.clientName.trim(),

    clientPhone:
      form.clientPhone.trim(),

    clientEmail:
      form.clientEmail.trim() ||
      null,

    clientAddress:
      form.clientAddress.trim() ||
      null,

    billedTo:
      form.billedTo.trim() ||
      null,

    eventName:
      form.eventName.trim() ||
      null,

    eventDate:
      form.eventDate ||
      null,

    eventVenue:
      form.eventVenue.trim() ||
      null,

    bookingReference:
      form.bookingReference.trim() ||
      null,

    bookingStatus:
      form.bookingStatus,

    totalPayment:
      form.totalPayment,

    advancePayment:
      form.advancePayment,

    paymentMethod:
      form.paymentMethod,

    paymentMethodOther:
      form.paymentMethod ===
      "other"
        ? form.paymentMethodOther.trim()
        : null,

    transactionReference:
      form.transactionReference.trim() ||
      null,

    remarks:
      form.remarks.trim() ||
      null,
  };
}