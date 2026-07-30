import { AlertTriangle } from "lucide-react";

// Generic confirmation dialog (used e.g. before logging an employee out).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/40 bg-white shadow-[0_30px_100px_rgba(35,16,45,0.35)]">
        <div className="p-7 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertTriangle size={22} />
          </div>
          <h2 className="mt-5 text-xl font-black text-black">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-black/60">{message}</p>

          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-[#d6d6d6] bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-[#f4f4f4]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-[#222222]"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
