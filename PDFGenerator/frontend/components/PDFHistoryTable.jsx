import {
  Archive,
  Download,
  Eye,
  FileText,
  LoaderCircle,
} from "lucide-react";

import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../Accounts/frontend/services/accountsService";

// Document history table — employees only ever see their own documents.
// Ownership is enforced server-side.
export default function PDFHistoryTable({
  documents,
  onPreview,
  onDownload,
  onArchive,
  busyAction,
}) {
  if (
    documents.length ===
    0
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-white py-14 text-black/35">
        <FileText
          size={28}
        />

        <p className="text-sm font-bold">
          No documents
          generated yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="border-b border-black/8 bg-black/2 text-[11px] font-black uppercase tracking-wide text-black/45">
            <tr>
              <th className="px-4 py-3">
                Document No
              </th>

              <th className="px-4 py-3">
                Event Date
              </th>

              <th className="px-4 py-3">
                Event Title
              </th>

              <th className="px-4 py-3">
                Items
              </th>

              <th className="px-4 py-3">
                Photos
              </th>

              <th className="px-4 py-3">
                Pages
              </th>

              <th className="px-4 py-3">
                Generated
              </th>

              <th className="px-4 py-3">
                Status
              </th>

              <th className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/5">
            {documents.map(
              (doc) => {
                /*
                |--------------------------------------------------------------------------
                | Current row action
                |--------------------------------------------------------------------------
                */

                const busyType =
                  busyAction?.id ===
                  doc.id
                    ? busyAction.type
                    : null;

                const isBusy =
                  Boolean(
                    busyType,
                  );

                const isPreviewing =
                  busyType ===
                  "preview";

                const isDownloading =
                  busyType ===
                  "download";

                const isArchiving =
                  busyType ===
                  "archive";

                return (
                  <tr
                    key={
                      doc.id
                    }
                    className="transition-colors hover:bg-black/1.5"
                  >
                    <td className="px-4 py-3 font-bold text-black/70">
                      {doc.documentNo ||
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-black/60">
                      {formatDisplayDate(
                        doc.eventDate,
                      )}
                    </td>

                    <td className="px-4 py-3 font-semibold text-black/80">
                      {
                        doc.eventTitle
                      }
                    </td>

                    <td className="px-4 py-3 text-black/60">
                      {doc.itemCount ??
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-black/60">
                      {doc.photoCount ??
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-black/60">
                      {doc.pageCount ??
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-black/60">
                      {formatDisplayDateTime(
                        doc.generatedAt,
                      ) ||
                        "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          doc.status ===
                          "archived"
                            ? "bg-black/5 text-black/45"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {
                          doc.status
                        }
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/*
                        |--------------------------------------------------------------------------
                        | Loading status text
                        |--------------------------------------------------------------------------
                        */}

                        {isDownloading && (
                          <span className="mr-1 hidden whitespace-nowrap text-[10px] font-bold text-black/45 sm:inline">
                            Preparing
                            PDF…
                          </span>
                        )}

                        {isPreviewing && (
                          <span className="mr-1 hidden whitespace-nowrap text-[10px] font-bold text-black/45 sm:inline">
                            Opening…
                          </span>
                        )}

                        {isArchiving && (
                          <span className="mr-1 hidden whitespace-nowrap text-[10px] font-bold text-black/45 sm:inline">
                            Archiving…
                          </span>
                        )}

                        {/*
                        |--------------------------------------------------------------------------
                        | Preview
                        |--------------------------------------------------------------------------
                        */}

                        <button
                          type="button"
                          onClick={() =>
                            onPreview(
                              doc.id,
                            )
                          }
                          disabled={
                            isBusy
                          }
                          title={
                            isPreviewing
                              ? "Opening PDF preview..."
                              : "Preview"
                          }
                          aria-label={
                            isPreviewing
                              ? "Opening PDF preview"
                              : "Preview PDF"
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                            isPreviewing
                              ? "bg-black/5 text-black"
                              : "text-black/45 hover:bg-black/5 hover:text-black"
                          } disabled:cursor-not-allowed`}
                        >
                          {isPreviewing ? (
                            <LoaderCircle
                              size={
                                16
                              }
                              className="animate-spin"
                            />
                          ) : (
                            <Eye
                              size={
                                16
                              }
                            />
                          )}
                        </button>

                        {/*
                        |--------------------------------------------------------------------------
                        | Download
                        |--------------------------------------------------------------------------
                        |
                        | The icon immediately becomes a spinner after click.
                        |
                        */}

                        <button
                          type="button"
                          onClick={() =>
                            onDownload(
                              doc.id,
                            )
                          }
                          disabled={
                            isBusy
                          }
                          title={
                            isDownloading
                              ? "Preparing PDF download..."
                              : "Download"
                          }
                          aria-label={
                            isDownloading
                              ? "Preparing PDF download"
                              : "Download PDF"
                          }
                          className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                            isDownloading
                              ? "bg-black text-white shadow-sm"
                              : "text-black/45 hover:bg-black/5 hover:text-black"
                          } disabled:cursor-not-allowed`}
                        >
                          {isDownloading ? (
                            <LoaderCircle
                              size={
                                16
                              }
                              className="animate-spin"
                            />
                          ) : (
                            <Download
                              size={
                                16
                              }
                            />
                          )}
                        </button>

                        {/*
                        |--------------------------------------------------------------------------
                        | Archive
                        |--------------------------------------------------------------------------
                        */}

                        {doc.status !==
                          "archived" && (
                          <button
                            type="button"
                            onClick={() =>
                              onArchive(
                                doc.id,
                              )
                            }
                            disabled={
                              isBusy
                            }
                            title={
                              isArchiving
                                ? "Archiving..."
                                : "Archive"
                            }
                            aria-label={
                              isArchiving
                                ? "Archiving PDF"
                                : "Archive PDF"
                            }
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                              isArchiving
                                ? "bg-black/5 text-black"
                                : "text-black/45 hover:bg-black/5 hover:text-black"
                            } disabled:cursor-not-allowed`}
                          >
                            {isArchiving ? (
                              <LoaderCircle
                                size={
                                  16
                                }
                                className="animate-spin"
                              />
                            ) : (
                              <Archive
                                size={
                                  16
                                }
                              />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}