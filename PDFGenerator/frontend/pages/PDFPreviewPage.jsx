import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export default function PDFPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const previewUrl = location.state?.previewUrl;
  const backTo = location.state?.backTo || "/management";
  const backState = location.state?.backState || null;

  useEffect(() => {
    if (!previewUrl) navigate(backTo, { replace: true, state: backState });
  }, [previewUrl, navigate, backTo, backState]);

  function handleBack() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    navigate(backTo, { state: backState });
  }

  if (!previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col bg-black">
      <div className="flex items-center justify-between bg-[#0B0B0F] px-4 py-3 sm:px-6">
        <button type="button" onClick={handleBack} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/20">
          <ArrowLeft size={16} /> Back to PDF Builder
        </button>
        <p className="text-sm font-black text-white/80">Document Preview</p>
        <div className="w-32" aria-hidden="true" />
      </div>
      <object data={previewUrl} type="application/pdf" className="w-full flex-1">
        <p className="p-4 text-sm text-white/70">Your browser can't preview PDFs inline. <a href={previewUrl} className="font-bold text-violet-300 underline">Open it in a new tab</a>.</p>
      </object>
    </div>
  );
}
