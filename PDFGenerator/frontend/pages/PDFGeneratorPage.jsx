import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { FileText, Loader2, RefreshCcw, Save } from "lucide-react";

import PDFGeneratorShell from "../components/PDFGeneratorShell";
import PDFBuilderTable from "../components/PDFBuilderTable";
import NbPointsList from "../components/NbPointsList";

import {
  ensureMeetingPdfDraft,
  generatePdfDocument,
  previewPdfDocument,
  resetPdfDraftFromMeeting,
  savePdfDraft,
} from "../services/pdfGeneratorService";

function nbText(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) return String(points[0] ?? "");
  return points
    .map((point, index) => `${index + 1}. ${String(point ?? "").trim()}`)
    .join("\n");
}

function formatPrice(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function PDFGeneratorPage() {
  const { rowKey, meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const meetingPage = location.state?.from || `/management/meetings/${rowKey}`;
  const builderPath = `/management/meetings/${rowKey}/${meetingId}/pdf`;

  const [document, setDocument] = useState(null);
  const [savedNbText, setSavedNbText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentNbText = useMemo(() => nbText(document?.nbPoints), [document?.nbPoints]);
  const isNbDirty = document ? currentNbText !== savedNbText : false;
  const busy = isLoading || isSaving || isRefreshing || isPreviewing || isGenerating;

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError("");

    ensureMeetingPdfDraft(rowKey, meetingId)
      .then((data) => {
        if (!active) return;
        setDocument(data);
        setSavedNbText(nbText(data.nbPoints));
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Could not open the PDF builder.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [rowKey, meetingId]);

  function updateNbPoints(nbPoints) {
    setDocument((current) => ({
      ...current,
      nbPoints,
    }));
    setNotice("");
  }

  async function saveNb({ quiet = false } = {}) {
    if (!document) return null;
    if (!isNbDirty) return document;

    setIsSaving(true);
    if (!quiet) setError("");

    try {
      const saved = await savePdfDraft(document.id, {
        nbPoints: document.nbPoints || [],
      });

      setDocument(saved);
      setSavedNbText(nbText(saved.nbPoints));

      if (!quiet) {
        setNotice("N.B. saved for this client PDF.");
      }

      return saved;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveNb() {
    setError("");

    try {
      await saveNb();
    } catch (err) {
      setError(err.message || "Could not save N.B. text.");
    }
  }

  async function handleRefreshFromMeeting() {
    if (!document) return;

    setError("");
    setNotice("");
    setIsRefreshing(true);

    try {
      const saved = await saveNb({ quiet: true });
      const refreshed = await resetPdfDraftFromMeeting(saved.id);
      setDocument(refreshed);
      setSavedNbText(nbText(refreshed.nbPoints));
      setNotice("PDF content refreshed from the latest saved Client Meeting.");
    } catch (err) {
      setError(err.message || "Could not refresh from Client Meeting.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handlePreview() {
    if (!document) return;

    setError("");
    setIsPreviewing(true);

    try {
      const saved = await saveNb({ quiet: true });
      const blob = await previewPdfDocument(saved.id);
      const previewUrl = URL.createObjectURL(blob);

      navigate("/pdf-generator/preview", {
        state: {
          previewUrl,
          backTo: builderPath,
          backState: { from: meetingPage },
        },
      });
    } catch (err) {
      setError(err.message || "Unable to generate the preview.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleGenerate() {
    if (!document) return;

    setError("");
    setIsGenerating(true);

    try {
      const saved = await saveNb({ quiet: true });
      generatePdfDocument(saved.id);
      setNotice("PDF generation started. The latest saved Client Meeting content will be used.");
    } catch (err) {
      setError(err.message || "Unable to generate the final PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <PDFGeneratorShell
        eyebrow="Client Meeting PDF"
        title="PDF Builder"
        description="Loading the latest saved Client Meeting..."
        icon={FileText}
        backTo={meetingPage}
        maxWidthClassName="max-w-7xl"
      >
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-black/10 bg-white">
          <Loader2 size={24} className="animate-spin text-black/45" />
        </div>
      </PDFGeneratorShell>
    );
  }

  if (!document) {
    return (
      <PDFGeneratorShell
        eyebrow="Client Meeting PDF"
        title="PDF Builder"
        description="The PDF draft could not be opened."
        icon={FileText}
        backTo={meetingPage}
        maxWidthClassName="max-w-7xl"
      >
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {error || "PDF draft not found."}
        </p>
      </PDFGeneratorShell>
    );
  }

  const totalPrice = formatPrice(document.totalPrice);
  const itemPriceIncluded = (document.selectedColumns || []).includes("price");

  return (
    <PDFGeneratorShell
      eyebrow="Client Meeting PDF"
      title="PDF Builder"
      description="PDF items are read-only and always come from the saved Client Meeting."
      icon={FileText}
      backTo={meetingPage}
      maxWidthClassName="max-w-7xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-sm leading-relaxed text-violet-900">
          <p className="font-black">PDF content is controlled from Client Meeting.</p>
          <p className="mt-1 text-violet-800/80">
            To add, delete, rename, or change an item, description, quantity, Item Price, Total Price, or image, go back to Client Meeting and save it there. Then return here or click Refresh from Meeting.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Event Date</p>
                <p className="mt-1 text-sm font-black text-black/75">{document.eventDate || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Event / Table Title</p>
                <p className="mt-1 text-sm font-black text-black/75">{document.eventTitle || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Document</p>
                <p className="mt-1 text-sm font-black text-black/75">{document.documentNo || `Draft #${document.id}`}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshFromMeeting}
            disabled={busy}
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 text-xs font-black text-black/65 shadow-sm transition hover:border-black/25 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
            {isRefreshing ? "Refreshing..." : "Refresh from Meeting"}
          </button>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-black/50">PDF Summary Table</h2>
              <p className="mt-1 text-xs leading-relaxed text-black/40">
                Item Price is included automatically when the meeting contains item-wise prices. The overall Total Price is shown as the far-right Price column, matching the final proposal layout.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
              {itemPriceIncluded && (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Item Price Included</span>
              )}
              {totalPrice && (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Total Price Included</span>
              )}
            </div>
          </div>

          <PDFBuilderTable
            items={document.items || []}
            selectedColumns={document.selectedColumns || []}
            totalPrice={document.totalPrice || ""}
          />
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-black/50">N.B.</h2>
              <p className="mt-1 text-xs leading-relaxed text-black/40">
                Copy and paste the complete N.B. at once. Numbering and line breaks are kept in the generated PDF.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveNb}
              disabled={busy || !isNbDirty}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {isSaving ? "Saving..." : "Save N.B."}
            </button>
          </div>

          <NbPointsList
            points={document.nbPoints || []}
            onChange={updateNbPoints}
          />
        </div>

        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePreview}
            disabled={busy}
            className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing ? "Generating Preview..." : "Preview PDF"}
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="flex-1 rounded-xl bg-[#0B0B0F] px-4 py-3 text-sm font-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Starting Download..." : "Generate & Download PDF"}
          </button>
        </div>
      </div>
    </PDFGeneratorShell>
  );
}
