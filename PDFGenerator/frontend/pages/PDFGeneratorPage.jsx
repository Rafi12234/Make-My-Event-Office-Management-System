import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { FileText } from "lucide-react";
import PDFGeneratorShell, { ShellHeaderLink } from "../components/PDFGeneratorShell";
import EventItemList from "../components/EventItemList";
import { createBlankDocumentForm, validateDocumentForm } from "../utils/documentForm";
import { createPdfDocument, previewPdfDocument } from "../services/pdfGeneratorService";

const inputClassName =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black/85 outline-none transition-colors focus:border-black/40";

export default function PDFGeneratorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [documentForm, setDocumentForm] = useState(() => location.state?.documentForm ?? createBlankDocumentForm());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function handlePreview() {
    const validationError = validateDocumentForm(documentForm);
    if (validationError) {
      setPreviewError(validationError);
      return;
    }

    setIsPreviewing(true);
    setPreviewError("");
    try {
      const blob = await previewPdfDocument(documentForm);
      const previewUrl = URL.createObjectURL(blob);
      navigate("/pdf-generator/preview", { state: { previewUrl, documentForm } });
    } catch (error) {
      setPreviewError(error.message || "Unable to generate preview.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleGenerate() {
    const validationError = validateDocumentForm(documentForm);
    if (validationError) {
      setGenerateError(validationError);
      return;
    }

    setIsGenerating(true);
    setGenerateError("");
    try {
      await createPdfDocument(documentForm);
      navigate("/pdf-generator/history", { state: { toast: "Document generated successfully." } });
    } catch (error) {
      setGenerateError(error.message || "Unable to generate the final PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <PDFGeneratorShell
      eyebrow="New Document"
      title="PDF Generator"
      description="Create a Make My Event proposal/decoration specification document."
      icon={FileText}
      backTo="/management"
      headerAction={<ShellHeaderLink to="/pdf-generator/history">Document History</ShellHeaderLink>}
    >
      <div className="space-y-5">
        <div className="mm-rise rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-black/50">Event Information</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">Event Date</label>
              <input
                type="date"
                className={inputClassName}
                value={documentForm.eventDate}
                onChange={(e) => setDocumentForm({ ...documentForm, eventDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-black/45">Event Title</label>
              <input
                className={inputClassName}
                value={documentForm.eventTitle}
                onChange={(e) => setDocumentForm({ ...documentForm, eventTitle: e.target.value })}
                placeholder="e.g. Wedding Reception"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-black/50">Event Items</h2>
          <EventItemList items={documentForm.items} onChange={(items) => setDocumentForm({ ...documentForm, items })} />
        </div>

        {(previewError || generateError) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{previewError || generateError}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing || isGenerating}
            className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black text-black/75 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/30 disabled:opacity-50"
          >
            {isPreviewing ? "Generating Preview..." : "Preview PDF"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPreviewing || isGenerating}
            className="mm-sheen flex-1 rounded-xl bg-[#0B0B0F] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Final PDF"}
          </button>
        </div>
      </div>
    </PDFGeneratorShell>
  );
}
