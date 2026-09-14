import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import ReferenceImageUploader from "./ReferenceImageUploader";

const inputClassName =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black/85 outline-none transition-colors focus:border-black/40";

// Single event-item row: serial is derived from position, not stored
// (guide §22 — auto-renumbers whenever items are reordered/deleted).
export default function EventItemEditor({
  serial,
  item,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  canDelete,
}) {
  function updateField(field, value) {
    onChange({ ...item, [field]: value });
  }

  return (
    <div className="mm-slide rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-xs font-black text-black/60">
          {serial}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move up"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move down"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete item"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">Item</label>
          <input
            className={inputClassName}
            value={item.itemName}
            onChange={(e) => updateField("itemName", e.target.value)}
            placeholder="e.g. Stage"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">Quantity</label>
          <input
            className={inputClassName}
            value={item.quantity}
            onChange={(e) => updateField("quantity", e.target.value)}
            placeholder="e.g. 1, 2 set, 1 pair"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">Description</label>
        <textarea
          className={`${inputClassName} min-h-20 resize-y`}
          value={item.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="As per picture, Backdrop White, white artificial flower with Natural Leaves..."
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">
          Photo Caption <span className="font-medium normal-case text-black/35">(optional — defaults to item + description)</span>
        </label>
        <input
          className={inputClassName}
          value={item.customCaption}
          onChange={(e) => updateField("customCaption", e.target.value)}
          placeholder="e.g. Exact Same 2 Set"
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">
          Reference Photos <span className="font-medium normal-case text-black/35">(optional — add as many as needed)</span>
        </label>
        <ReferenceImageUploader files={item.referenceImages} onChange={(files) => updateField("referenceImages", files)} />
      </div>
    </div>
  );
}
