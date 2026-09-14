import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

// Dedicated full-screen preview route (mirrors PDFGenerator's
// PDFPreviewPage.jsx exactly) — the blob URL + in-progress form travel via
// router state (never persisted), only valid for this SPA session.
//
// IMPORTANT: do NOT revoke the blob URL in a useEffect cleanup — React
// StrictMode double-invokes effects in dev, which revokes the blob
// immediately after mount and breaks the PDF viewer (see PDFPreviewPage.jsx
// for the full story). Revoke only on the explicit "Back" click below.
export default function MoneyReceiptPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const previewUrl = location.state?.previewUrl;
  const form = location.state?.form;

  useEffect(() => {
    if (!previewUrl) {
      navigate("/admin/money-receipts", { replace: true });
    }
  }, [previewUrl, navigate]);

  function handleBack() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    navigate("/admin/money-receipts", { state: { form } });
  }

  if (!previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col bg-black">
      <div className="flex items-center justify-between bg-[#0B0B0F] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-white/20"
        >
          <ArrowLeft size={16} /> Back to Editor
        </button>
        <p className="text-sm font-black text-white/80">Money Receipt Preview</p>
        <div className="w-27.5" aria-hidden="true" />
      </div>

      <object data={previewUrl} type="application/pdf" className="w-full flex-1">
        <p className="p-4 text-sm text-white/70">
          Your browser can't preview PDFs inline.{" "}
          <a href={previewUrl} className="font-bold text-violet-300 underline">Open it in a new tab</a> instead.
        </p>
      </object>
    </div>
  );
}
