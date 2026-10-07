const textareaClassName =
  "min-h-[320px] w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm leading-7 text-black/80 outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/[0.03] disabled:bg-black/[0.025] disabled:text-black/55";

function pointsToText(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) return String(points[0] ?? "");
  return points
    .map((point, index) => `${index + 1}. ${String(point ?? "").trim()}`)
    .join("\n");
}

export default function NbPointsList({ points, onChange, disabled = false }) {
  const text = pointsToText(points);

  return (
    <div>
      <textarea
        className={textareaClassName}
        value={text}
        disabled={disabled}
        onChange={(event) => onChange([event.target.value])}
        placeholder="Paste the full N.B. text here. Numbering and line breaks will be kept in the PDF."
      />

      <p className="mt-2 text-[11px] leading-relaxed text-black/40">
        Paste or edit the complete N.B. in one place. This change applies only to this client PDF; the default N.B. for other clients is unchanged.
      </p>
    </div>
  );
}
