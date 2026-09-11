import { Plus } from "lucide-react";
import EventItemEditor from "./EventItemEditor";
import { createBlankItem } from "../utils/documentForm";

// Master item array — one single source of truth drives both the summary
// table order AND the reference-photo order (guide §43), so reordering
// here keeps both in sync automatically.
export default function EventItemList({ items, onChange }) {
  function updateItem(index, nextItem) {
    const next = [...items];
    next[index] = nextItem;
    onChange(next);
  }

  function moveItem(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  function deleteItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, createBlankItem()]);
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <EventItemEditor
          key={item.clientId}
          serial={index + 1}
          item={item}
          onChange={(nextItem) => updateItem(index, nextItem)}
          onMoveUp={() => moveItem(index, -1)}
          onMoveDown={() => moveItem(index, 1)}
          onDelete={() => deleteItem(index)}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          canDelete={items.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addItem}
        className="mm-sheen flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-white px-4 py-3.5 text-sm font-black text-black/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:text-black"
      >
        <Plus size={16} />
        Add Item
      </button>
    </div>
  );
}
