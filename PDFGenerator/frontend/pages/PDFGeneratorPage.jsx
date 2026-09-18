import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Pencil,
  RefreshCcw,
  Save,
} from "lucide-react";

import PDFGeneratorShell, {
  ShellHeaderLink,
} from "../components/PDFGeneratorShell";

import PDFBuilderTable from "../components/PDFBuilderTable";
import PDFColumnSelector from "../components/PDFColumnSelector";
import NbPointsList from "../components/NbPointsList";

import { parsePdfExcelFile } from "../utils/excelPdfImport";

import {
  createPdfDocumentItem,
  deletePdfDocumentItem,
  deletePdfItemImage,
  ensureMeetingPdfDraft,
  generatePdfDocument,
  importExcelIntoPdfDraft,
  previewPdfDocument,
  resetPdfDraftFromMeeting,
  savePdfDraft,
  uploadPdfItemImage,
} from "../services/pdfGeneratorService";

const inputClassName =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-semibold text-black/80 outline-none transition focus:border-black/35 disabled:bg-black/[0.025] disabled:text-black/55";

/*
|--------------------------------------------------------------------------
| Prepare only editable document fields
|--------------------------------------------------------------------------
|
| Images are managed separately through image upload/delete APIs.
| We only save the editable table/document information here.
|
*/
function editablePayload(document) {
  return {
    eventDate: document.eventDate || "",
    eventTitle: document.eventTitle || "",
    selectedColumns: document.selectedColumns || [],
    excelColumns: document.excelColumns || [],
    nbPoints: document.nbPoints || [],

    items: (document.items || []).map((item) => ({
      id: item.id,
      itemName: item.itemName || "",
      description: item.description || "",
      quantity: item.quantity || "1",
      size: item.size || "",
      sqft: item.sqft || "",
      tsqft: item.tsqft || "",
      unit: item.unit || "",
      price: item.price || "",
      excelRowData:
        item.excelRowData && typeof item.excelRowData === "object"
          ? item.excelRowData
          : null,
    })),
  };
}

/*
|--------------------------------------------------------------------------
| Used for dirty-state checking
|--------------------------------------------------------------------------
*/
function signature(document) {
  return JSON.stringify(editablePayload(document));
}

export default function PDFGeneratorPage() {
  const { rowKey, meetingId } = useParams();

  const location = useLocation();
  const navigate = useNavigate();

  const excelInputRef = useRef(null);

  /*
  |--------------------------------------------------------------------------
  | Main document state
  |--------------------------------------------------------------------------
  */
  const [document, setDocument] = useState(null);

  const [savedSignature, setSavedSignature] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Editing state
  |--------------------------------------------------------------------------
  */
  const [editing, setEditing] = useState(true);

  /*
  |--------------------------------------------------------------------------
  | Loading/action states
  |--------------------------------------------------------------------------
  */
  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [isPreviewing, setIsPreviewing] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  const [isResetting, setIsResetting] = useState(false);

  const [isCreatingItem, setIsCreatingItem] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Item/image operation states
  |--------------------------------------------------------------------------
  */
  const [uploadingItemId, setUploadingItemId] = useState(null);

  const [deletingItemId, setDeletingItemId] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | UI messages
  |--------------------------------------------------------------------------
  */
  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  // N.B. terms are included in every generated PDF, but stay collapsed in
  // the builder so they do not consume most of the screen during normal work.
  const [nbExpanded, setNbExpanded] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Navigation paths
  |--------------------------------------------------------------------------
  */
  const meetingPage =
    location.state?.from ||
    `/management/meetings/${rowKey}`;

  const builderPath =
    `/management/meetings/${rowKey}/${meetingId}/pdf`;

  /*
  |--------------------------------------------------------------------------
  | Detect unsaved changes
  |--------------------------------------------------------------------------
  */
  const isDirty = useMemo(() => {
    if (!document) return false;

    return signature(document) !== savedSignature;
  }, [document, savedSignature]);

  /*
  |--------------------------------------------------------------------------
  | Load / create PDF draft from Client Meeting
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError("");

    ensureMeetingPdfDraft(rowKey, meetingId)
      .then((data) => {
        if (!active) return;

        setDocument(data);
        setSavedSignature(signature(data));

        /*
          Open builder directly in editable mode.
        */
        setEditing(true);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.message ||
            "Could not open the PDF builder.",
        );
      })
      .finally(() => {
        if (!active) return;

        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [rowKey, meetingId]);

  /*
  |--------------------------------------------------------------------------
  | Generic document updater
  |--------------------------------------------------------------------------
  */
  function updateDocument(patch) {
    setDocument((current) => ({
      ...current,
      ...patch,
    }));

    setNotice("");
  }

  /*
  |--------------------------------------------------------------------------
  | Validate PDF draft
  |--------------------------------------------------------------------------
  */
  function validateDraft() {
    if (!document?.eventDate) {
      return "Event date is required.";
    }

    if (!document?.eventTitle?.trim()) {
      return "Event title is required.";
    }

    if (!document?.items?.length) {
      return "At least one table row is required.";
    }

    if (document.sourceMode === "excel") {
      const columns = Array.isArray(document.excelColumns)
        ? document.excelColumns
        : [];

      const hasItemColumn = columns.some((column) => column?.role === "item");
      const hasDescriptionColumn = columns.some(
        (column) => column?.role === "description",
      );

      if (!hasItemColumn || !hasDescriptionColumn) {
        return 'Excel mode requires both an "Item/Items" column and a "Description/Details" column.';
      }

      if (!document.items.some((item) => String(item.itemName || "").trim())) {
        return "The Excel table must contain at least one Item/Items value.";
      }

      // Blank Item/Description cells are allowed on subtotal, total and footer
      // rows. Only the column names themselves are mandatory in Excel mode.
      return "";
    }

    for (const [index, item] of document.items.entries()) {
      if (!item.itemName?.trim()) {
        return `Item name is required in row ${index + 1}.`;
      }

      if (!String(item.quantity || "").trim()) {
        return `QTY is required in row ${index + 1}.`;
      }
    }

    return "";
  }

  /*
  |--------------------------------------------------------------------------
  | Save PDF draft
  |--------------------------------------------------------------------------
  */
  async function saveCurrentDraft({
    quiet = false,
  } = {}) {
    const validation = validateDraft();

    if (validation) {
      throw new Error(validation);
    }

    setIsSaving(true);

    if (!quiet) {
      setError("");
    }

    try {
      const saved = await savePdfDraft(
        document.id,
        editablePayload(document),
      );

      setDocument(saved);

      setSavedSignature(signature(saved));

      if (!quiet) {
        setNotice("PDF table saved.");
      }

      return saved;
    } finally {
      setIsSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Manual Save button
  |--------------------------------------------------------------------------
  */
  async function handleSave() {
    setError("");

    try {
      await saveCurrentDraft();

      /*
        After saving, switch to view mode.
        Employee can click Edit again.
      */
      setEditing(false);
    } catch (err) {
      setError(
        err.message ||
          "Could not save the PDF table.",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Save automatically before another operation
  |--------------------------------------------------------------------------
  */
  async function saveBeforeAction() {
    if (!isDirty) {
      return document;
    }

    return saveCurrentDraft({
      quiet: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Preview PDF
  |--------------------------------------------------------------------------
  */
  async function handlePreview() {
    setError("");
    setIsPreviewing(true);

    try {
      const saved = await saveBeforeAction();

      const blob = await previewPdfDocument(
        saved.id,
      );

      const previewUrl =
        URL.createObjectURL(blob);

      navigate("/pdf-generator/preview", {
        state: {
          previewUrl,

          backTo: builderPath,

          backState: {
            from: meetingPage,
          },
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to generate the preview.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Generate final PDF
  |--------------------------------------------------------------------------
  */
  async function handleGenerate() {
    setError("");
    setIsGenerating(true);

    try {
      const saved = await saveBeforeAction();

      await generatePdfDocument(saved.id);

      navigate("/pdf-generator/history", {
        state: {
          toast:
            "Document generated successfully.",

          backTo: meetingPage,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to generate the final PDF.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Upload images to a PDF item
  |--------------------------------------------------------------------------
  |
  | These uploads belong to this PDF draft.
  |
  */
  async function handleUploadImages(
    itemId,
    files,
  ) {
    if (!files?.length) return;

    setUploadingItemId(itemId);
    setError("");

    try {
      const uploaded = [];

      /*
        Upload images sequentially.
      */
      for (const file of files) {
        const image =
          await uploadPdfItemImage(
            document.id,
            itemId,
            file,
          );

        uploaded.push(image);
      }

      setDocument((current) => ({
        ...current,

        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,

                images: [
                  ...(item.images || []),
                  ...uploaded,
                ],
              }
            : item,
        ),
      }));

      setNotice(
        uploaded.length > 1
          ? `${uploaded.length} images added to this PDF draft.`
          : "Image added to this PDF draft.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Image upload failed.",
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Delete PDF image
  |--------------------------------------------------------------------------
  |
  | Important:
  | This only removes the image from the PDF snapshot.
  | It does NOT delete the Client Meeting image.
  |
  */
  async function handleDeleteImage(
    itemId,
    imageId,
  ) {
    setError("");

    try {
      await deletePdfItemImage(
        document.id,
        itemId,
        imageId,
      );

      setDocument((current) => ({
        ...current,

        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,

                images: (
                  item.images || []
                ).filter(
                  (image) =>
                    image.id !== imageId,
                ),
              }
            : item,
        ),
      }));

      setNotice(
        "Image removed from this PDF only. The Client Meeting image was not deleted.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not remove the image.",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Add new PDF item
  |--------------------------------------------------------------------------
  |
  | SIMPLIFIED FLOW:
  |
  | 1. Employee clicks "Add Item" at bottom of PDFBuilderTable.
  | 2. Existing unsaved changes are saved.
  | 3. One new row is immediately created at the bottom.
  | 4. The employee chooses Stage / Entry Gate / Photo Booth /
  |    Other etc. directly from that row's Item dropdown.
  |
  | No extra modal.
  | No extra Add Item panel.
  | No confirmation required.
  |
  */
  async function handleAddPdfItem() {
    setIsCreatingItem(true);
    setError("");
    setNotice("");

    try {
      /*
        Preserve existing table changes first.
      */
      const saved =
        await saveBeforeAction();

      /*
        "Other" is simply the temporary starting value.

        PDFBuilderTable will render the same Client Meeting
        item dropdown inside the row, so employee can
        immediately select the correct item.
      */
      const updated =
        await createPdfDocumentItem(
          saved.id,
          "Other",
        );

      setDocument(updated);

      setSavedSignature(
        signature(updated),
      );

      /*
        Make sure the table remains editable.
      */
      setEditing(true);

      setNotice(
        saved.sourceMode === "excel"
          ? "New Excel-style row added at the bottom of the table."
          : "New item row added at the bottom of the PDF table.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not add the item.",
      );
    } finally {
      setIsCreatingItem(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Delete PDF item
  |--------------------------------------------------------------------------
  |
  | This only deletes the row from the PDF draft.
  | Original Client Meeting item remains untouched.
  |
  */
  async function handleDeletePdfItem(
    itemId,
    itemName,
  ) {
    /*
      Delete confirmation is intentionally kept because
      removing an existing populated row can otherwise
      happen accidentally.

      Add Item itself requires NO confirmation.
    */
    const confirmed = window.confirm(
      `Remove "${
        itemName || "this item"
      }" from this PDF draft? The Client Meeting will not be changed.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingItemId(itemId);
    setError("");

    try {
      const saved =
        await saveBeforeAction();

      const updated =
        await deletePdfDocumentItem(
          saved.id,
          itemId,
        );

      setDocument(updated);

      setSavedSignature(
        signature(updated),
      );

      setEditing(true);

      setNotice(
        "Item removed from this PDF only. The Client Meeting item was not deleted.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not remove the item.",
      );
    } finally {
      setDeletingItemId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Excel import
  |--------------------------------------------------------------------------
  */
  async function handleExcelFile(event) {
    const file =
      event.target.files?.[0];

    /*
      Reset input so the same file can be selected again.
    */
    event.target.value = "";

    if (!file) return;

    setIsImporting(true);
    setError("");

    try {
      const parsed =
        await parsePdfExcelFile(file);

      const imported =
        await importExcelIntoPdfDraft(
          document.id,
          parsed,
        );

      setDocument(imported);

      setSavedSignature(
        signature(imported),
      );

      setEditing(true);

      setNotice(
        `${parsed.rows.length} Excel rows imported from ${parsed.sheetName}. Excel mode is now active; Client Meeting rows and images are not used in this PDF draft. Upload reference images separately for each Excel item.`,
      );
    } catch (err) {
      setError(
        err.message ||
          "Excel import failed.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Reload original meeting data
  |--------------------------------------------------------------------------
  */
  async function handleResetFromMeeting() {
    const confirmed = window.confirm(
      "Replace this PDF table with the current items and images from the Client Meeting? PDF-only edits and Excel rows in this draft will be replaced.",
    );

    if (!confirmed) {
      return;
    }

    setIsResetting(true);
    setError("");

    try {
      const reset =
        await resetPdfDraftFromMeeting(
          document.id,
        );

      setDocument(reset);

      setSavedSignature(
        signature(reset),
      );

      setEditing(true);

      setNotice(
        "Meeting items and images reloaded into the PDF draft.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not reload meeting data.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Initial loading screen
  |--------------------------------------------------------------------------
  */
  if (isLoading) {
    return (
      <PDFGeneratorShell
        eyebrow="Client Meeting PDF"
        title="PDF Builder"
        description="Loading the meeting items and images..."
        icon={FileText}
        backTo={meetingPage}
      >
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-black/10 bg-white">
          <Loader2
            size={28}
            className="animate-spin text-black/30"
          />
        </div>
      </PDFGeneratorShell>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Draft could not be opened
  |--------------------------------------------------------------------------
  */
  if (!document) {
    return (
      <PDFGeneratorShell
        eyebrow="Client Meeting PDF"
        title="PDF Builder"
        description="The PDF draft could not be opened."
        icon={FileText}
        backTo={meetingPage}
      >
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {error ||
            "Document not found."}
        </p>
      </PDFGeneratorShell>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Global busy state
  |--------------------------------------------------------------------------
  */
  const busy =
    isSaving ||
    isPreviewing ||
    isGenerating ||
    isImporting ||
    isResetting ||
    isCreatingItem ||
    deletingItemId !== null;

  return (
    <PDFGeneratorShell
      eyebrow="Client Meeting PDF"
      title="PDF Builder"
      description="Prepare the summary table, N.B. and item reference pages using the existing Make My Event letterhead."
      icon={FileText}
      backTo={meetingPage}
      maxWidthClassName="max-w-[1500px]"
      headerAction={
        <ShellHeaderLink
          to="/pdf-generator/history"
          state={{
            backTo: meetingPage,
          }}
        >
          <History size={14} />

          Document History
        </ShellHeaderLink>
      }
    >
      <div className="space-y-5">
        {/* ================================================================
            DOCUMENT SOURCE
        ================================================================= */}
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                  Document source
                </p>

                <p className="mt-1 text-sm font-black text-black/80">
                  {document.sourceMode ===
                  "excel"
                    ? "Excel Upload"
                    : "Client Meeting Data"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Reload meeting */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={
                    handleResetFromMeeting
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isResetting ? (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCcw
                      size={14}
                    />
                  )}

                  Reload Meeting Data
                </button>

                {/* Excel */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    excelInputRef.current?.click()
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <FileSpreadsheet
                      size={14}
                    />
                  )}

                  Excel Upload
                </button>

                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={
                    handleExcelFile
                  }
                />
              </div>
            </div>

            <p className="text-xs leading-relaxed text-black/45">
              Meeting mode starts with
              the exact items and images
              from this meeting. Excel mode
              replaces the PDF table only;
              the original Client Meeting is
              never changed.
            </p>
          </div>

          {/* Document info */}
          <div className="flex min-w-56 flex-col justify-center rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
              Document
            </p>

            <p className="mt-1 text-sm font-black text-black/75">
              {document.documentNo ||
                `Draft #${document.id}`}
            </p>

            <span className="mt-2 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
              Draft
            </span>
          </div>
        </div>

        {/* ================================================================
            EVENT INFORMATION
        ================================================================= */}
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wide text-black/50">
              Event Information
            </h2>

            {!editing ? (
              <button
                type="button"
                onClick={() =>
                  setEditing(true)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-black text-white transition hover:bg-black/80"
              >
                <Pencil size={13} />

                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  busy || !isDirty
                }
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={13} />
                )}

                Save Changes
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Event Date */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-black/40">
                Event Date
              </label>

              <input
                type="date"
                disabled={!editing}
                className={
                  inputClassName
                }
                value={
                  document.eventDate || ""
                }
                onChange={(event) =>
                  updateDocument({
                    eventDate:
                      event.target.value,
                  })
                }
              />
            </div>

            {/* Event title */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-black/40">
                Event / Table Title
              </label>

              <input
                type="text"
                disabled={!editing}
                className={
                  inputClassName
                }
                value={
                  document.eventTitle || ""
                }
                onChange={(event) =>
                  updateDocument({
                    eventTitle:
                      event.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* ================================================================
            PDF SUMMARY TABLE
        ================================================================= */}
        <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-black/50">
                PDF Summary Table
              </h2>

              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-black/40">
                {document.sourceMode === "excel"
                  ? "Excel mode preserves the uploaded table's column names, column order, row order and cell values. Images are managed separately and are not added to the summary-table columns in the PDF."
                  : "Images remain available here for the detailed reference pages, but the generated PDF summary table does not include an Images column. All selected data columns are fitted inside the fixed letterhead width."}
              </p>
            </div>

            {document.sourceMode === "excel" ? (
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                Excel columns preserved
              </span>
            ) : (
              <PDFColumnSelector
                disabled={!editing || busy}
                selectedColumns={document.selectedColumns || []}
                onChange={(selectedColumns) =>
                  updateDocument({ selectedColumns })
                }
              />
            )}
          </div>

          <PDFBuilderTable
            items={
              document.items || []
            }
            selectedColumns={
              document.selectedColumns ||
              []
            }
            excelColumns={document.excelColumns || []}
            sourceMode={document.sourceMode}
            editing={editing}
            onChange={(items) =>
              updateDocument({
                items,
              })
            }

            /*
              NEW SIMPLE ADD ITEM FLOW
            */
            onAddItem={
              handleAddPdfItem
            }
            addingItem={
              isCreatingItem
            }

            /*
              Images
            */
            onUploadImages={
              handleUploadImages
            }
            onDeleteImage={
              handleDeleteImage
            }

            /*
              Delete PDF-only item
            */
            onDeleteItem={
              handleDeletePdfItem
            }

            uploadingItemId={
              uploadingItemId
            }
            deletingItemId={
              deletingItemId
            }
          />

          <p className="mt-2 px-1 text-[11px] leading-relaxed text-black/35">
            {document.sourceMode === "excel"
              ? "Excel mode uses only the imported rows. Upload one or multiple JPG/PNG reference images in the Images cell for each item; those images will appear in that item's detailed PDF section."
              : "PDF reference rendering supports JPG/PNG. If a meeting contains GIF/WEBP, remove it from this PDF draft and upload a JPG/PNG copy here."}
          </p>
        </div>

        {/* ================================================================
            N.B. - collapsed by default
        ================================================================= */}
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setNbExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-black/[0.02] sm:px-5"
            aria-expanded={nbExpanded}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wide text-black/55">
                  N.B. Terms
                </h2>
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-black text-black/45">
                  {(document.nbPoints || []).length} points
                </span>
              </div>
              <p className="mt-1 text-xs text-black/35">
                Included automatically immediately after the PDF summary table. Open only when you need to review or edit the terms.
              </p>
            </div>

            <ChevronDown
              size={18}
              className={`shrink-0 text-black/40 transition-transform ${
                nbExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {nbExpanded && (
            <div className="border-t border-black/10 px-4 pb-5 pt-4 sm:px-5">
              <NbPointsList
                points={document.nbPoints || []}
                disabled={!editing}
                onChange={(nbPoints) =>
                  updateDocument({
                    nbPoints,
                  })
                }
              />
            </div>
          )}
        </div>

        {/* ================================================================
            SUCCESS MESSAGE
        ================================================================= */}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {notice}
          </p>
        )}

        {/* ================================================================
            ERROR MESSAGE
        ================================================================= */}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {error}
          </p>
        )}

        {/* ================================================================
            PREVIEW / FINAL GENERATE
        ================================================================= */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Preview */}
          <button
            type="button"
            onClick={
              handlePreview
            }
            disabled={busy}
            className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing
              ? "Generating Preview..."
              : "Preview PDF"}
          </button>

          {/* Generate */}
          <button
            type="button"
            onClick={
              handleGenerate
            }
            disabled={busy}
            className="flex-1 rounded-xl bg-[#0B0B0F] px-4 py-3 text-sm font-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating
              ? "Generating..."
              : "Generate Final PDF"}
          </button>
        </div>
      </div>
    </PDFGeneratorShell>
  );
}