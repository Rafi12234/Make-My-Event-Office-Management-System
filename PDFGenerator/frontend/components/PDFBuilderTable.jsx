import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";

import { resolvePdfImageUrl } from "../services/pdfGeneratorService";
import { PDF_OPTIONAL_COLUMNS } from "./PDFColumnSelector";
import { CLIENT_REQUIREMENT_OPTIONS } from "../../../frontend/make my event office management system/src/data/defaultSheet";

const MEETING_META = {
  sl: { label: "SL", weight: 4 },
  itemName: { label: "Item", weight: 10 },
  description: { label: "Description", weight: 18 },
  quantity: { label: "QTY", weight: 5 },
  size: { label: "Size", weight: 8 },
  sqft: { label: "SQFT", weight: 6 },
  tsqft: { label: "TSqft", weight: 6 },
  unit: { label: "Unit", weight: 6 },
  price: { label: "Price", weight: 8 },
  images: { label: "Images", weight: 12 },
};

function meetingColumns(selectedColumns) {
  const optional = PDF_OPTIONAL_COLUMNS
    .map((option) => option.key)
    .filter((key) => selectedColumns.includes(key));

  return ["sl", "itemName", "description", "quantity", ...optional, "images"];
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function excelColumnWeight(column) {
  if (column.role === "description") return 22;
  if (column.role === "item") return 13;

  const label = normalizeLabel(column.label);
  if (label.includes("description") || label.includes("detail")) return 22;
  if (label.includes("item")) return 13;
  if (label.includes("size") || label.includes("dimension")) return 10;
  if (
    label.includes("qty") ||
    label.includes("quantity") ||
    label.includes("sqft") ||
    label.includes("unit") ||
    label.includes("price") ||
    label.includes("amount") ||
    label.includes("rate") ||
    label.includes("cost")
  ) {
    return 7;
  }
  return 9;
}

function inputClass(columnCount) {
  return `w-full min-w-0 rounded-lg border border-black/10 bg-white px-1.5 py-2 text-black/80 outline-none focus:border-black/30 ${
    columnCount >= 12
      ? "text-[9px]"
      : columnCount >= 9
        ? "text-[10px]"
        : columnCount >= 7
          ? "text-[11px]"
          : "text-xs"
  }`;
}

function getItemSelection(item) {
  const itemName = String(item?.itemName || "").trim();
  const matched = CLIENT_REQUIREMENT_OPTIONS.find(
    (option) =>
      option.key !== "other" &&
      option.label.toLowerCase() === itemName.toLowerCase(),
  );

  if (item?._customItem) return "other";
  if (matched) return matched.key;
  if (itemName) return "other";
  return "";
}

export default function PDFBuilderTable({
  items,
  selectedColumns,
  excelColumns = [],
  sourceMode = "meeting",
  editing,
  onChange,
  onAddItem,
  addingItem,
  onUploadImages,
  onDeleteImage,
  onDeleteItem,
  uploadingItemId,
  deletingItemId,
}) {
  const isExcelMode = sourceMode === "excel";

  function updateItem(index, field, value) {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  }

  function updateItemPatch(index, patch) {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function updateExcelCell(index, column, value) {
    const next = [...items];
    const current = next[index];
    const excelRowData = {
      ...(current.excelRowData || {}),
      [column.key]: value,
    };

    const patch = { excelRowData };
    if (column.role === "item") patch.itemName = value;
    if (column.role === "description") patch.description = value;
    if (column.role === "quantity") patch.quantity = String(value || "").trim() || "1";

    next[index] = { ...current, ...patch };
    onChange(next);
  }

  function handleItemSelection(index, value) {
    if (!value) {
      updateItemPatch(index, { itemName: "", _customItem: false });
      return;
    }

    if (value === "other") {
      updateItemPatch(index, { itemName: "Other", _customItem: true });
      return;
    }

    const option = CLIENT_REQUIREMENT_OPTIONS.find((entry) => entry.key === value);
    updateItemPatch(index, {
      itemName: option?.label || "",
      _customItem: false,
    });
  }

  function ImagesCell({ item }) {
    const canUpload = !isExcelMode || Boolean(String(item.itemName || "").trim());

    return (
      <div className="p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {(item.images || []).map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-black/10 bg-black/[0.03]"
            >
              <img
                src={resolvePdfImageUrl(image.url)}
                alt={image.originalName || "Reference"}
                className="h-full w-full object-contain"
                loading="lazy"
              />

              {editing && (
                <button
                  type="button"
                  onClick={() => onDeleteImage(item.id, image.id)}
                  title="Remove from this PDF"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
        </div>

        {editing && canUpload && (
          <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-black/15 px-1 py-1.5 text-[9px] font-black text-black/45 hover:border-black/30 hover:text-black/70">
            {uploadingItemId === item.id ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <ImagePlus size={11} />
            )}

            {uploadingItemId === item.id ? "Uploading" : "Add Images"}

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={uploadingItemId === item.id}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                if (files.length) onUploadImages(item.id, files);
              }}
            />
          </label>
        )}

        {editing && isExcelMode && !canUpload && (
          <p className="mt-1 text-center text-[8px] font-semibold text-black/30">
            No item in this row
          </p>
        )}

        {editing && onDeleteItem && (
          <button
            type="button"
            onClick={() => onDeleteItem(item.id, item.itemName || "this row")}
            disabled={deletingItemId === item.id || items.length <= 1}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-1 py-1.5 text-[9px] font-black text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Remove this row from the PDF draft"
          >
            {deletingItemId === item.id ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Trash2 size={10} />
            )}
            Remove Row
          </button>
        )}
      </div>
    );
  }

  if (isExcelMode) {
    const dynamicColumns = Array.isArray(excelColumns) ? excelColumns : [];
    const visibleColumns = [
      ...dynamicColumns.map((column) => ({
        ...column,
        weight: excelColumnWeight(column),
      })),
      { key: "__images", label: "Images", weight: 12 },
    ];
    const totalWeight = visibleColumns.reduce((sum, column) => sum + column.weight, 0) || 1;

    return (
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {visibleColumns.map((column) => (
              <col
                key={column.key}
                style={{ width: `${(column.weight / totalWeight) * 100}%` }}
              />
            ))}
          </colgroup>

          <thead>
            <tr className="bg-black/[0.025]">
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-r border-black/10 px-1.5 py-2 text-center font-black tracking-wide text-black/45 last:border-r-0 ${
                    visibleColumns.length >= 12
                      ? "text-[7px]"
                      : visibleColumns.length >= 9
                        ? "text-[8px]"
                        : "text-[9px]"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="align-top">
                {dynamicColumns.map((column) => {
                  const value = item.excelRowData?.[column.key] ?? "";

                  return (
                    <td
                      key={column.key}
                      className="border-b border-r border-black/10 p-1"
                    >
                      {editing ? (
                        column.role === "description" ? (
                          <textarea
                            value={value}
                            rows={3}
                            onChange={(event) =>
                              updateExcelCell(index, column, event.target.value)
                            }
                            className={`${inputClass(visibleColumns.length)} resize-y leading-relaxed`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(event) =>
                              updateExcelCell(index, column, event.target.value)
                            }
                            className={inputClass(visibleColumns.length)}
                          />
                        )
                      ) : (
                        <div
                          className={`min-h-8 whitespace-pre-wrap break-words px-1 py-2 text-black/70 ${
                            column.role === "description" ? "text-left" : "text-center"
                          } ${visibleColumns.length >= 10 ? "text-[9px]" : "text-[11px]"}`}
                        >
                          {value || "—"}
                        </div>
                      )}
                    </td>
                  );
                })}

                <td className="border-b border-black/10">
                  <ImagesCell item={item} />
                </td>
              </tr>
            ))}
          </tbody>

          {editing && (
            <tfoot>
              <tr>
                <td colSpan={visibleColumns.length} className="p-2">
                  <button
                    type="button"
                    onClick={onAddItem}
                    disabled={addingItem}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/20 bg-black/[0.02] px-4 py-3 text-xs font-black text-black/55 transition hover:border-black/40 hover:bg-black/[0.04] hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingItem ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {addingItem ? "Adding Row..." : "Add Row"}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  }

  const columns = meetingColumns(selectedColumns);
  const totalWeight = columns.reduce((sum, key) => sum + MEETING_META[key].weight, 0);

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
                className={`border-b border-r border-black/10 px-1.5 py-2 text-center font-black uppercase tracking-wide text-black/45 last:border-r-0 ${
                  columns.length >= 9 ? "text-[8px]" : "text-[9px]"
                }`}
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
                      className="border-b border-r border-black/10 px-1 py-3 text-center text-xs font-black text-black/50"
                    >
                      {index + 1}
                    </td>
                  );
                }

                if (key === "images") {
                  return (
                    <td key={key} className="border-b border-black/10">
                      <ImagesCell item={item} />
                    </td>
                  );
                }

                const value = item[key] ?? "";
                const numeric = ["sqft", "tsqft", "price"].includes(key);

                if (key === "itemName") {
                  const selection = getItemSelection(item);
                  const customItem = selection === "other";
                  const customValue =
                    customItem && String(item.itemName || "") !== "Other"
                      ? item.itemName
                      : "";

                  return (
                    <td key={key} className="border-b border-r border-black/10 p-1">
                      {editing ? (
                        <div className="space-y-1">
                          <select
                            value={selection}
                            onChange={(event) => handleItemSelection(index, event.target.value)}
                            className={inputClass(columns.length)}
                          >
                            <option value="">Select item...</option>
                            {CLIENT_REQUIREMENT_OPTIONS.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {customItem && (
                            <input
                              type="text"
                              value={customValue}
                              placeholder="Other item name"
                              onChange={(event) =>
                                updateItemPatch(index, {
                                  itemName: event.target.value,
                                  _customItem: true,
                                })
                              }
                              className={inputClass(columns.length)}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="min-h-8 whitespace-pre-wrap break-words px-1 py-2 text-center text-[11px] text-black/70">
                          {value || "—"}
                        </div>
                      )}
                    </td>
                  );
                }

                return (
                  <td
                    key={key}
                    className="border-b border-r border-black/10 p-1 last:border-r-0"
                  >
                    {editing ? (
                      key === "description" ? (
                        <textarea
                          value={value}
                          onChange={(event) => updateItem(index, key, event.target.value)}
                          rows={3}
                          className={`${inputClass(columns.length)} resize-y leading-relaxed`}
                        />
                      ) : (
                        <input
                          type="text"
                          inputMode={numeric ? "decimal" : undefined}
                          value={value}
                          onChange={(event) => updateItem(index, key, event.target.value)}
                          className={inputClass(columns.length)}
                        />
                      )
                    ) : (
                      <div
                        className={`min-h-8 whitespace-pre-wrap break-words px-1 py-2 text-center text-black/70 ${
                          columns.length >= 9 ? "text-[9px]" : "text-[11px]"
                        }`}
                      >
                        {value || "—"}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {editing && (
          <tfoot>
            <tr>
              <td colSpan={columns.length} className="p-2">
                <button
                  type="button"
                  onClick={onAddItem}
                  disabled={addingItem}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/20 bg-black/[0.02] px-4 py-3 text-xs font-black text-black/55 transition hover:border-black/40 hover:bg-black/[0.04] hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingItem ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {addingItem ? "Adding Item..." : "Add Item"}
                </button>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
