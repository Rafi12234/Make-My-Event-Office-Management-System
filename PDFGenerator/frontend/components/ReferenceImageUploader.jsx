import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

function Thumbnail({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10">
      {previewUrl ? <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" /> : null}
      <button
        type="button"
        onClick={onRemove}
        title="Remove photo"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// Multiple-photo picker for a single event item — an item may carry zero,
// one, or many reference photos, each rendered as its own block/page.
export default function ReferenceImageUploader({ files, onChange }) {
  function handleFileInput(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) onChange([...files, ...selected]);
    event.target.value = "";
  }

  function removeAt(index) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((file, index) => (
        <Thumbnail key={`${file.name}-${index}`} file={file} onRemove={() => removeAt(index)} />
      ))}

      <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-black/15 bg-black/2 text-black/45 transition-colors hover:border-black/30 hover:text-black/70">
        <ImagePlus size={16} />
        <span className="text-[10px] font-bold">Add Photo</span>
        <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={handleFileInput} />
      </label>
    </div>
  );
}
