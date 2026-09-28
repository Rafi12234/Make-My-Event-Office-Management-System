import { apiRequest } from "./client";

// Mirrors the web Accounts module's accountsService.js one-to-one — same
// /api/accounts endpoints, same request/response shapes. The backend route
// is already mounted with attachBearerToken + requireEmployee (see
// server.js), so this mobile client's existing Bearer-token apiRequest
// works against it unchanged — no backend or web frontend changes needed.

export function getAccountsSummary() {
  return apiRequest("/accounts/summary");
}

export function getBookedEvents() {
  return apiRequest("/accounts/booked-events");
}

export function getVendors() {
  return apiRequest("/accounts/vendors");
}

export function getVendorProfile(vendorId) {
  return apiRequest(`/accounts/vendors/${vendorId}`);
}

export function payVendor(vendorId, { amount, paidOn, note }) {
  return apiRequest(`/accounts/vendors/${vendorId}/pay`, {
    method: "POST",
    body: JSON.stringify({ amount, paidOn, note }),
  });
}

export function addMoneyReceived({ amount, receivedDate, note }) {
  return apiRequest("/accounts/money-received", {
    method: "POST",
    body: JSON.stringify({ amount, receivedDate, note }),
  });
}

// items: [{ purpose, costDate, quantity, perQtyAmount, vendorId, paymentStatus, receiptAsset? }]
// receiptAsset is an expo-image-picker asset ({ uri, fileName, mimeType }),
// sent the same way uploadMeetingItemImages() sends picker assets.
// costType: "event" | "regular"; linkedRowKey required when costType is "event".
export function submitExpense({ costType, linkedRowKey, items }) {
  const formData = new FormData();
  formData.append("costType", costType);
  if (linkedRowKey) formData.append("linkedRowKey", linkedRowKey);
  formData.append(
    "items",
    JSON.stringify(
      items.map(({ purpose, costDate, quantity, perQtyAmount, vendorId, paymentStatus }) => ({
        purpose,
        costDate,
        quantity,
        perQtyAmount,
        vendorId: vendorId || null,
        paymentStatus: vendorId ? paymentStatus : null,
      })),
    ),
  );
  items.forEach((item, index) => {
    if (!item.receiptAsset) return;
    const extension = item.receiptAsset.uri.split(".").pop() || "jpg";
    formData.append(`receipt_${index}`, {
      uri: item.receiptAsset.uri,
      name: item.receiptAsset.fileName || `receipt-${index}.${extension}`,
      type: item.receiptAsset.mimeType || `image/${extension}`,
    });
  });

  return apiRequest("/accounts/expenses", {
    method: "POST",
    body: formData,
  });
}
