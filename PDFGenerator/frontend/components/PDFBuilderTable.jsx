import { resolvePdfImageUrl } from "../services/pdfGeneratorService";

const MEETING_META = {
  sl: { label: "SL", weight: 4 },
  itemName: { label: "Item", weight: 12 },
  description: { label: "Description", weight: 22 },
  quantity: { label: "QTY", weight: 6 },
  price: { label: "Item Price", weight: 9 },
  images: { label: "Images", weight: 14 },
  totalPrice: { label: "Price", weight: 9 },
};

function meetingColumns(selectedColumns = [], totalPrice = "") {
  return [
    "sl",
    "itemName",
    "description",
    "quantity",
    ...(selectedColumns.includes("price") ? ["price"] : []),
    "images",
    ...(String(totalPrice || "").trim() ? ["totalPrice"] : []),
  ];
}

function displayValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return String(value);
}

function formatTotalPrice(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function PDFBuilderTable({
  items = [],
  selectedColumns = [],
  totalPrice = "",
}) {
  const columns = meetingColumns(selectedColumns, totalPrice);
  const totalWeight = columns.reduce((sum, key) => sum + MEETING_META[key].weight, 0) || 1;
  const formattedTotalPrice = formatTotalPrice(totalPrice);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {columns.map((key) => (
            <col
              key={key}
              style={{ width: `${(MEETING_META[key].weight / totalWeight) * 100}%` }}
            />
          ))}
        </colgroup>

        <thead>
          <tr className="bg-black/[0.025]">
            {columns.map((key) => (
              <th
                key={key}
                className="border-b border-r border-black/10 px-2 py-2.5 text-center text-[9px] font-black uppercase tracking-wide text-black/45 last:border-r-0"
              >
                {MEETING_META[key].label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="align-top">
              {columns.map((key) => {
                if (key === "sl") {
                  return (
                    <td
                      key={key}
                      className="border-b border-r border-black/10 px-2 py-3 text-center text-xs font-black text-black/50"
                    >
                      {index + 1}
                    </td>
                  );
                }

                if (key === "images") {
                  return (
                    <td key={key} className="border-b border-r border-black/10 p-1.5">
                      {(item.images || []).length ? (
                        <div className="grid grid-cols-2 gap-1">
                          {(item.images || []).map((image) => (
                            <div
                              key={image.id}
                              className="aspect-square overflow-hidden rounded-md border border-black/10 bg-black/[0.03]"
                            >
                              <img
                                src={resolvePdfImageUrl(image.url)}
                                alt={image.originalName || "Reference"}
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-14 items-center justify-center px-2 text-center text-[10px] font-semibold text-black/25">
                          No images
                        </div>
                      )}
                    </td>
                  );
                }

                if (key === "totalPrice") {
                  if (index !== 0) return null;

                  return (
                    <td
                      key={key}
                      rowSpan={Math.max(1, items.length)}
                      className="border-b border-black/10 px-2 py-3 text-center align-middle text-xs font-black text-black/75"
                    >
                      {formattedTotalPrice}
                    </td>
                  );
                }

                const value = item[key] ?? "";
                const isDescription = key === "description";

                return (
                  <td
                    key={key}
                    className="border-b border-r border-black/10 px-2 py-3 last:border-r-0"
                  >
                    <div
                      className={`whitespace-pre-wrap break-words text-[11px] text-black/70 ${
                        isDescription ? "text-left leading-relaxed" : "text-center"
                      }`}
                    >
                      {displayValue(value)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
