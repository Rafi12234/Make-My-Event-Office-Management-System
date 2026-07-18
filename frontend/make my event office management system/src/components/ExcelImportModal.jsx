import { FileSpreadsheet, PlusCircle, X } from "lucide-react";

export default function ExcelImportModal({ preview, onClose, onConfirm }) {
  const visibleRows = preview.rows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-mme-purple/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-mme-pink/50 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mme-plum">Import preview</p>
              <h2 className="mt-1 text-2xl font-black text-mme-purple">{preview.fileName}</h2>
              <p className="mt-1 text-sm text-mme-purple/60">
                Sheet: {preview.sheetName} · {preview.headers.length} columns · {preview.rows.length} data rows
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-mme-purple/60 hover:bg-mme-blush/40">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto px-6 py-6 sm:px-8">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-mme-pink bg-mme-blush/25 p-4">
            <PlusCircle className="mt-0.5 shrink-0 text-mme-plum" size={19} />
            <p className="text-sm leading-6 text-mme-purple/70">
              The first Excel row becomes column headings. Matching headings use existing columns; new headings create new columns. Blank rows are ignored.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-mme-pink/70">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-mme-purple text-left text-white">
                <tr>
                  {preview.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap border-r border-white/15 px-4 py-3 font-black last:border-r-0">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-mme-pink/40 even:bg-[#fff9fc]">
                    {preview.headers.map((header) => (
                      <td key={header} className="max-w-[240px] truncate border-r border-mme-pink/35 px-4 py-3 text-mme-purple/75 last:border-r-0">
                        {String(row[header] ?? "") || <span className="text-mme-purple/25">Empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > 5 && (
            <p className="mt-3 text-center text-xs font-semibold text-mme-purple/50">
              Showing 5 of {preview.rows.length} rows
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-mme-pink/50 bg-[#fff9fc] px-6 py-5 sm:px-8">
          <button onClick={onClose} className="rounded-2xl border border-mme-purple/20 bg-white px-5 py-3.5 font-black text-mme-purple hover:bg-mme-blush/30">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-2xl bg-mme-purple px-5 py-3.5 font-black text-white shadow-lg shadow-mme-purple/20 hover:bg-[#4b2c55]">
            Import all rows
          </button>
        </div>
      </div>
    </div>
  );
}
