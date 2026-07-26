import { FileSpreadsheet, PlusCircle, X } from "lucide-react";

export default function ExcelImportModal({ preview, onClose, onConfirm }) {
  const visibleRows = preview.rows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#d6d6d6]/50 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4f4f4] text-black">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#333333]">Import preview</p>
              <h2 className="mt-1 text-2xl font-black text-black">{preview.fileName}</h2>
              <p className="mt-1 text-sm text-black/60">
                Sheet: {preview.sheetName} · {preview.headers.length} columns · {preview.rows.length} data rows
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-black/60 hover:bg-[#f4f4f4]/40">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto px-6 py-6 sm:px-8">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d6d6d6] bg-[#f4f4f4]/25 p-4">
            <PlusCircle className="mt-0.5 shrink-0 text-[#333333]" size={19} />
            <p className="text-sm leading-6 text-black/70">
              The first Excel row becomes column headings and must include every mandatory column
              (Client Name, Venue, Shift, Client Phone Number, Floor, Guest Count, Event Date).
              Only columns matching an existing sheet column are imported — any extra columns are
              ignored. Blank or "N/A" cells are stored and shown as N/A. Blank rows are ignored.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#d6d6d6]/70">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-black text-left text-white">
                <tr>
                  {preview.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap border-r border-white/15 px-4 py-3 font-black last:border-r-0">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-[#d6d6d6]/40 even:bg-[#ffffff]">
                    {preview.headers.map((header) => (
                      <td key={header} className="max-w-[240px] truncate border-r border-[#d6d6d6]/35 px-4 py-3 text-black/75 last:border-r-0">
                        {String(row[header] ?? "") || <span className="text-black/25">Empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > 5 && (
            <p className="mt-3 text-center text-xs font-semibold text-black/50">
              Showing 5 of {preview.rows.length} rows
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#d6d6d6]/50 bg-[#ffffff] px-6 py-5 sm:px-8">
          <button onClick={onClose} className="rounded-2xl border border-black/20 bg-white px-5 py-3.5 font-black text-black hover:bg-[#f4f4f4]/30">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-2xl bg-black px-5 py-3.5 font-black text-white shadow-lg shadow-black/20 hover:bg-[#222222]">
            Import all rows
          </button>
        </div>
      </div>
    </div>
  );
}
