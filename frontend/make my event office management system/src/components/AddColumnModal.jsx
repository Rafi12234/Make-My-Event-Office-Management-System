import { useState } from "react";
import { Columns3, X } from "lucide-react";
import { COLUMN_TYPE_OPTIONS } from "../data/defaultSheet";

export default function AddColumnModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Column name is required.");
      return;
    }

    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      width: type === "long_text" ? 300 : 190,
      required: false,
    });
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-mme-purple/55 px-5 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-[28px] border border-mme-pink bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
              <Columns3 size={23} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-mme-purple">Add a new column</h2>
            <p className="mt-2 text-sm leading-6 text-mme-purple/60">Choose the label and input type employees will use.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-mme-purple/60 hover:bg-mme-blush/40">
            <X size={20} />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple">Column name</label>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              placeholder="Example: Event Budget"
              className="w-full rounded-2xl border border-mme-pink px-4 py-3.5 outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
              autoFocus
            />
            {error && <p className="mt-1.5 text-xs font-bold text-red-500">{error}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-mme-purple">Cell type</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-2xl border border-mme-pink bg-white px-4 py-3.5 outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
            >
              {COLUMN_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-mme-purple/20 px-5 py-3.5 font-black text-mme-purple hover:bg-mme-blush/30">
            Cancel
          </button>
          <button className="rounded-2xl bg-mme-purple px-5 py-3.5 font-black text-white hover:bg-[#4b2c55]">
            Add column
          </button>
        </div>
      </form>
    </div>
  );
}
