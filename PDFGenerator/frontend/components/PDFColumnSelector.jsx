import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Columns3 } from "lucide-react";

export const PDF_OPTIONAL_COLUMNS = [
  { key: "size", label: "Size" },
  { key: "sqft", label: "SQFT" },
  { key: "tsqft", label: "TSqft" },
  { key: "unit", label: "Unit" },
  { key: "price", label: "Price" },
];

export default function PDFColumnSelector({ selectedColumns, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function toggle(key) {
    const next = selectedColumns.includes(key)
      ? selectedColumns.filter((value) => value !== key)
      : PDF_OPTIONAL_COLUMNS.map((option) => option.key).filter(
          (value) => value === key || selectedColumns.includes(value),
        );
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/70 shadow-sm transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Columns3 size={15} />
        Add Columns
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px]">{selectedColumns.length}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
          {PDF_OPTIONAL_COLUMNS.map((option) => {
            const checked = selectedColumns.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggle(option.key)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-black/70 hover:bg-black/5"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-black bg-black text-white" : "border-black/20"}`}>
                  {checked ? <Check size={11} /> : null}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
