import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router";

import {
  History,
} from "lucide-react";

import PDFGeneratorShell
  from "../components/PDFGeneratorShell";

import PDFHistoryTable
  from "../components/PDFHistoryTable";

import {
  archivePdfDocument,
  downloadPdfDocument,
  listPdfDocuments,
  startPdfDocumentDownload,
} from "../services/pdfGeneratorService";

export default function PDFHistoryPage() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    documents,
    setDocuments,
  ] =
    useState([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    toast,
    setToast,
  ] =
    useState("");

  const [
    busyDocumentId,
    setBusyDocumentId,
  ] =
    useState(null);

  const backTo =
    location.state
      ?.backTo ||
    "/management";

  /*
  |--------------------------------------------------------------------------
  | Load history
  |--------------------------------------------------------------------------
  */

  async function refresh() {
    setIsLoading(
      true,
    );

    setError("");

    try {
      const data =
        await listPdfDocuments();

      setDocuments(
        data,
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not load your documents.",
      );
    } finally {
      setIsLoading(
        false,
      );
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Success toast passed from generator
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !location.state
        ?.toast
    ) {
      return;
    }

    setToast(
      location.state
        .toast,
    );

    navigate(
      location.pathname,
      {
        replace:
          true,

        state: {
          backTo,
        },
      },
    );
  }, [
    location.state,
    location.pathname,
    navigate,
    backTo,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Auto-hide toast
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          setToast(
            "",
          );
        },
        3500,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [toast]);

  /*
  |--------------------------------------------------------------------------
  | Preview
  |--------------------------------------------------------------------------
  |
  | Keep Preview working the same way as before.
  |
  | Preview requires the PDF bytes as a Blob because it creates an object URL
  | and opens the PDF inside a browser tab.
  |
  */

  async function handlePreview(
    id,
  ) {
    setError("");

    setBusyDocumentId(
      id,
    );

    try {
      const blob =
        await downloadPdfDocument(
          id,
        );

      const url =
        URL.createObjectURL(
          blob,
        );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );

      /*
      | Keep the Blob URL alive long enough for the new browser tab to finish
      | reading it.
      */

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url,
          );
        },
        60000,
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to open this document.",
      );
    } finally {
      setBusyDocumentId(
        null,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Download
  |--------------------------------------------------------------------------
  |
  | IMPORTANT CHANGE:
  |
  | OLD FLOW:
  |
  | click
  |   ↓
  | fetch PDF
  |   ↓
  | wait for COMPLETE PDF
  |   ↓
  | response.blob()
  |   ↓
  | JavaScript memory
  |   ↓
  | saveBlobAs()
  |   ↓
  | browser download starts
  |
  |
  | NEW FLOW:
  |
  | click
  |   ↓
  | browser directly requests download endpoint
  |   ↓
  | Express sends existing generated PDF
  |   ↓
  | browser download starts immediately
  |
  |
  | This is especially important for PDFs containing 30-40+ images.
  |
  */

  function handleDownload(
    id,
  ) {
    setError("");

    /*
    | Briefly mark the row busy so repeated double-clicks are prevented while
    | the browser starts the native download.
    */

    setBusyDocumentId(
      id,
    );

    try {
      /*
      | This does NOT fetch the PDF into JavaScript.
      |
      | It sends the employee directly to:
      |
      | GET /api/pdf-generator/documents/:id/download
      |
      | The existing backend res.download(...) response controls the filename
      | and browser download.
      */

      startPdfDocumentDownload(
        id,
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to start this document download.",
      );
    } finally {
      /*
      | JavaScript does not own the file transfer anymore.
      |
      | Once the browser download has been triggered, the browser download
      | manager is responsible for showing the transfer/progress.
      |
      | Therefore we only keep the row disabled briefly.
      */

      window.setTimeout(
        () => {
          setBusyDocumentId(
            (current) =>
              current ===
              id
                ? null
                : current,
          );
        },
        900,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Archive
  |--------------------------------------------------------------------------
  */

  async function handleArchive(
    id,
  ) {
    setError("");

    setBusyDocumentId(
      id,
    );

    try {
      const updated =
        await archivePdfDocument(
          id,
        );

      setDocuments(
        (prev) =>
          prev.map(
            (doc) =>
              doc.id ===
              id
                ? updated
                : doc,
          ),
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to archive this document.",
      );
    } finally {
      setBusyDocumentId(
        null,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <PDFGeneratorShell
      eyebrow="Document History"
      title="Document History"
      description="Every PDF you've generated, newest first."
      icon={History}
      backTo={backTo}
    >
      {toast && (
        <p className="mm-fade mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {toast}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="mm-skeleton h-64 rounded-2xl" />
      ) : (
        <PDFHistoryTable
          documents={
            documents
          }
          onPreview={
            handlePreview
          }
          onDownload={
            handleDownload
          }
          onArchive={
            handleArchive
          }
          busyDocumentId={
            busyDocumentId
          }
        />
      )}
    </PDFGeneratorShell>
  );
}