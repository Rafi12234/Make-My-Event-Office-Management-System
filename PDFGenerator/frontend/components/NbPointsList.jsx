import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { createBlankNbPoint } from "../utils/documentForm";

const inputClassName =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black/85 outline-none transition-colors focus:border-black/40";

// Optional "NB:" numbered notes list (e.g. payment terms, disclaimers) shown
// under the summary table on page 1 — entirely optional, may stay empty.
export default function NbPointsList({ points, onChange }) {
  function updateText(index, text) {
    const next = [...points];
    next[index] = { ...next[index], text };
    onChange(next);
  }

  function moveItem(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= points.length) return;
    const next = [...points];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  function deleteItem(index) {
    onChange(points.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...points, createBlankNbPoint()]);
  }

  return (
    <div className="space-y-2">
      {points.map((point, index) => (
        <div key={point.clientId} className="flex items-center gap-2">
          <span className="flex h-9 w-7 shrink-0 items-center justify-center text-xs font-black text-black/40">
            {index + 1}.
          </span>
          <input
            className={inputClassName}
            value={point.text}
            onChange={(e) => updateText(index, e.target.value)}
            placeholder="e.g. 80% of the total money should be paid in advance/confirmation."
          />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              title="Move up"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, 1)}
              disabled={index === points.length - 1}
              title="Move down"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => deleteItem(index)}
              title="Remove note"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-white px-4 py-2.5 text-sm font-black text-black/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:text-black"
      >
        <Plus size={16} />
        Add NB Point
      </button>
    </div>
  );
}
