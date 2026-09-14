import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

// Dedicated full-screen route so the native PDF viewer isn't squeezed into
// the editor's layout. The blob URL + in-progress form travel via router
// state (never persisted), and are only valid for this SPA session.
export default function PDFPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const previewUrl = location.state?.previewUrl;
  const documentForm = location.state?.documentForm;

  useEffect(() => {
    if (!previewUrl) {
      navigate("/pdf-generator", { replace: true });
    }
  }, [previewUrl, navigate]);

  // NOTE: intentionally NOT revoking previewUrl in an effect cleanup — React
  // StrictMode (see main.jsx) double-invokes effects in dev, which would
  // revoke the blob immediately after mount and break the PDF viewer/downloads
  // ("Check internet connection" error). Revoke explicitly instead, only on
  // the deliberate "back" action below.
  function handleBack() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    navigate("/pdf-generator", { state: { documentForm } });
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
        <p className="text-sm font-black text-white/80">Document Preview</p>
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
