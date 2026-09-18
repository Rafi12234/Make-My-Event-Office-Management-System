import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { History } from "lucide-react";
import PDFGeneratorShell from "../components/PDFGeneratorShell";
import PDFHistoryTable from "../components/PDFHistoryTable";
import {
  archivePdfDocument,
  downloadPdfDocument,
  listPdfDocuments,
  saveBlobAs,
} from "../services/pdfGeneratorService";

export default function PDFHistoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyDocumentId, setBusyDocumentId] = useState(null);
  const backTo = location.state?.backTo || "/management";

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      const data = await listPdfDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err.message || "Could not load your documents.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!location.state?.toast) return;
    setToast(location.state.toast);
    navigate(location.pathname, { replace: true, state: { backTo } });
  }, [location.state, location.pathname, navigate, backTo]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function filenameFor(doc) {
    return `${(doc.documentNo || `document-${doc.id}`).replace(/\//g, "-")}.pdf`;
  }

  async function handlePreview(id) {
    setBusyDocumentId(id);
    try {
      const blob = await downloadPdfDocument(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message || "Unable to open this document.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleDownload(id) {
    setBusyDocumentId(id);
    try {
      const doc = documents.find((d) => d.id === id);
      const blob = await downloadPdfDocument(id);
      saveBlobAs(blob, doc ? filenameFor(doc) : "document.pdf");
    } catch (err) {
      setError(err.message || "Unable to download this document.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleArchive(id) {
    setBusyDocumentId(id);
    try {
      const updated = await archivePdfDocument(id);
      setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
    } catch (err) {
      setError(err.message || "Unable to archive this document.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  return (
    <PDFGeneratorShell
      eyebrow="Document History"
      title="Document History"
      description="Every PDF you've generated, newest first."
      icon={History}
      backTo={backTo}
    >
      {toast && <p className="mm-fade mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{toast}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

      {isLoading ? (
        <div className="mm-skeleton h-64 rounded-2xl" />
      ) : (
        <PDFHistoryTable
          documents={documents}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onArchive={handleArchive}
          busyDocumentId={busyDocumentId}
        />
      )}
    </PDFGeneratorShell>
  );
}
