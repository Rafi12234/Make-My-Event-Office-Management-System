// Item/document blank-state helpers for the PDF Generator form — one master
// item array drives both the summary table and the reference-photo order
// (guide §43-44), so serial numbers/reference order always stay in sync.
export function createBlankItem() {
  return {
    clientId: crypto.randomUUID(),
    itemName: "",
    description: "",
    quantity: "",
    referenceImages: [],
    customCaption: "",
  };
}

// Optional "NB:" numbered notes shown under the summary table on page 1 —
// never required, may stay empty.
export function createBlankNbPoint() {
  return { clientId: crypto.randomUUID(), text: "" };
}

export function createBlankDocumentForm() {
  return {
    eventDate: "",
    eventTitle: "",
    items: [createBlankItem()],
    nbPoints: [],
  };
}

export function validateDocumentForm(documentForm) {
  if (!documentForm.eventDate) return "Event date is required.";
  if (!documentForm.eventTitle.trim()) return "Event title is required.";
  if (documentForm.items.length === 0) return "Add at least one event item.";

  for (const [index, item] of documentForm.items.entries()) {
    if (!item.itemName.trim() || !item.description.trim() || !item.quantity.trim()) {
      return `Item ${index + 1} is missing required fields (item, description, or quantity).`;
    }
  }

  return null;
}
