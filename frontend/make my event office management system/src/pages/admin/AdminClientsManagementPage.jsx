import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarClock, LayoutGrid, Phone, Search, X } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe } from "../../services/adminService";
import { fetchAdminWorkspace, updateAdminWorkspaceCell } from "../../services/adminWorkspaceService";
import { fetchClientMeetingsForAdmin, fetchClientCallsForAdmin } from "../../services/adminActivityService";
import { loadEmployeeDirectory } from "../../services/managementStorage";
import { VENUE_OPTIONS, SHIFT_OPTIONS } from "../../data/defaultSheet";

// Silently re-fetches in the background so this page stays live as
// employees edit the sheet, without ever showing a disruptive full reload.
const REFRESH_INTERVAL_MS = 20000;

// How long to wait after the admin stops typing before persisting a text
// edit — avoids firing a request on every keystroke.
const CELL_SAVE_DEBOUNCE_MS = 600;

function formatMeetingTimeDisplay(value, emptyLabel) {
  if (!value) return emptyLabel;
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOverdueDatetime(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(" ", "T"));
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

/* ─── Cell Editor (adapted from ManagementPage's, restyled for the admin theme) ─── */

function AdminCellEditor({ column, value, onChange, employeeNames }) {
  const baseClass =
    "h-full min-h-9 w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold text-mme-purple/80 outline-none transition placeholder:text-mme-purple/30 focus:border-mme-purple/25 focus:bg-[#fff9fc] focus:ring-2 focus:ring-mme-purple/15";

  const isNotAvailable = value === "N/A";
  const editableValue = isNotAvailable ? "" : value;

  if (column.type === "checkbox") {
    return (
      <label className="flex min-h-9 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={editableValue === true || editableValue === "true" || editableValue === "1"}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-mme-purple"
        />
      </label>
    );
  }

  if (column.type === "venue") {
    return (
      <select value={editableValue || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">{isNotAvailable ? "N/A — select venue" : "Select venue"}</option>
        {VENUE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "shift") {
    return (
      <select value={editableValue || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">{isNotAvailable ? "N/A — select shift" : "Select shift"}</option>
        {SHIFT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "currency") {
    return (
      <div className="flex h-full min-h-9 items-center">
        <span className="pl-1 text-sm font-bold text-mme-purple/40">৳</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={editableValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNotAvailable ? "N/A" : "0.00"}
          className={`${baseClass} pl-1`}
        />
      </div>
    );
  }

  if (column.type === "long_text") {
    return (
      <textarea
        rows={2}
        value={editableValue ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={isNotAvailable ? "N/A" : `Enter ${column.name.toLowerCase()}`}
        className={`${baseClass} min-h-14 resize-none leading-5`}
      />
    );
  }

  if (column.type === "employee") {
    const listId = `admin-employees-${column.id}`;
    return (
      <>
        <input
          list={listId}
          value={editableValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNotAvailable ? "N/A" : "Choose or type a name"}
          className={baseClass}
        />
        <datalist id={listId}>
          {employeeNames.map((name) => <option key={name} value={name} />)}
        </datalist>
      </>
    );
  }

  const inputType = {
    email: "email",
    phone: "tel",
    number: "number",
    integer: "number",
    date: "date",
    time: "time",
    datetime: "datetime-local",
  }[column.type] || "text";

  return (
    <input
      type={inputType}
      value={editableValue ?? ""}
      step={column.type === "integer" ? "1" : undefined}
      min={column.type === "integer" ? "0" : undefined}
      onChange={(event) => onChange(event.target.value)}
      placeholder={isNotAvailable ? "N/A" : `Enter ${column.name.toLowerCase()}`}
      className={baseClass}
    />
  );
}

/* ─── Hover Preview Panel (mirrors the employee ManagementPage's, read-only, admin-scoped data) ─── */

const HOVER_PANEL_WIDTH = 320;
const HOVER_PANEL_MARGIN = 8;

function PositionedHoverPanel({ preview, onMouseEnter, onMouseLeave, children }) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState({
    top: preview.anchorBottom + HOVER_PANEL_MARGIN,
    left: Math.min(preview.anchorLeft, window.innerWidth - HOVER_PANEL_WIDTH - HOVER_PANEL_MARGIN),
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight || 0;
    const spaceBelow = window.innerHeight - preview.anchorBottom;
    const spaceAbove = preview.anchorTop;
    const fitsBelow = spaceBelow >= height + HOVER_PANEL_MARGIN;
    const fitsAbove = spaceAbove >= height + HOVER_PANEL_MARGIN;

    let top;
    if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
      top = Math.min(preview.anchorBottom + HOVER_PANEL_MARGIN, window.innerHeight - height - HOVER_PANEL_MARGIN);
    } else {
      top = preview.anchorTop - HOVER_PANEL_MARGIN - height;
    }
    top = Math.max(HOVER_PANEL_MARGIN, top);

    const left = Math.max(
      HOVER_PANEL_MARGIN,
      Math.min(preview.anchorLeft, window.innerWidth - HOVER_PANEL_WIDTH - HOVER_PANEL_MARGIN),
    );

    setStyle({ top, left, visibility: "visible" });
  }, [preview.anchorTop, preview.anchorBottom, preview.anchorLeft, preview.status, preview.items]);

  return (
    <div
      ref={panelRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "fixed", top: style.top, left: style.left, visibility: style.visibility }}
      className="animate-[scaleIn_0.2s_ease-out] z-[130] max-h-96 w-80 origin-top-left overflow-auto rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-2xl"
    >
      {children}
    </div>
  );
}

function HoverPreviewPanel({ preview, onMouseEnter, onMouseLeave }) {
  const isMeetings = preview.type === "meetings";
  const now = preview.fetchedAt;

  function isUpcoming(item) {
    const time = isMeetings ? item.meetingDatetime : item.callDatetime;
    if (!time) return false;
    const parsed = new Date(String(time).replace(" ", "T")).getTime();
    return !Number.isNaN(parsed) && parsed >= now;
  }

  function toTime(value) {
    if (!value) return null;
    const parsed = new Date(String(value).replace(" ", "T")).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  let nextMeetingSchedule = null;
  if (isMeetings && preview.status === "ready") {
    for (const item of preview.items) {
      const time = toTime(item.nextMeetingDatetime);
      if (time !== null && (!nextMeetingSchedule || time < nextMeetingSchedule.time)) {
        nextMeetingSchedule = {
          id: `next-meeting-${item.id}`,
          time,
          display: item.nextMeetingDatetime,
          isNextMeetingSchedule: true,
          assignedName: item.nextMeetingAssignedEmployeeName,
        };
      }
    }
  }

  const upcoming = preview.status !== "ready"
    ? []
    : isMeetings
      ? [
          ...(nextMeetingSchedule ? [nextMeetingSchedule] : []),
          ...preview.items.filter(isUpcoming),
        ]
      : [
          ...(preview.nextCallDatetime ? [{ id: "next-call", time: preview.nextCallDatetime, isNextCallSchedule: true }] : []),
          ...preview.items.filter(isUpcoming),
        ];
  const previous = preview.status !== "ready" ? [] : preview.items.filter((item) => !isUpcoming(item));

  const lastDoneByName = previous.length
    ? isMeetings
      ? previous[0].completedByName || previous[0].createdByName
      : previous[0].createdByName
    : null;

  let nextAssignedToName = null;
  if (preview.status === "ready") {
    if (isMeetings) {
      if (nextMeetingSchedule) {
        nextAssignedToName = nextMeetingSchedule.assignedName || null;
      } else {
        nextAssignedToName = preview.items.find(isUpcoming)?.createdByName || null;
      }
    } else {
      const matching = preview.items.find(
        (item) => item.nextCallDatetime && item.nextCallDatetime === preview.nextCallDatetime,
      );
      nextAssignedToName = matching ? matching.nextCallAssignedEmployeeName : preview.items.find(isUpcoming)?.createdByName || null;
    }
  }

  function renderItem(item) {
    const isSyntheticSchedule = item.isNextCallSchedule || item.isNextMeetingSchedule;
    const time = isSyntheticSchedule ? item.display ?? item.time : (isMeetings ? item.meetingDatetime : item.callDatetime);
    const isMissed = isSyntheticSchedule && isOverdueDatetime(item.display ?? item.time);
    return (
      <li key={item.id} className="animate-[fadeInUp_0.2s_ease-out] rounded-xl border border-mme-pink/40 px-3 py-2 transition-all duration-200 hover:border-mme-purple/20 hover:shadow-sm">
        <p className={`text-xs font-bold ${isMissed ? "text-red-600" : "text-mme-purple"}`}>
          {time ? formatMeetingTimeDisplay(time, "Not scheduled") : "Not scheduled"}
        </p>
        {isMeetings && item.isNextMeetingSchedule && (
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wide ${isMissed ? "text-red-600" : "text-[#f2662b]"}`}>
            {isMissed ? "Next meeting · Missed" : "Next meeting"}
          </p>
        )}
        {isMeetings && item.isCompleted && (
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-600">Completed</p>
        )}
        {!isMeetings && item.isNextCallSchedule && (
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wide ${isMissed ? "text-red-600" : "text-[#c2410c]"}`}>
            {isMissed ? "Next call · Missed" : "Next call"}
          </p>
        )}
        {!isMeetings && !item.isNextCallSchedule && item.callDiscussion && (
          <p className="mt-1 line-clamp-2 text-xs text-mme-purple/60">{item.callDiscussion}</p>
        )}
      </li>
    );
  }

  function renderGroup(title, items, metaLabel, metaName) {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-mme-purple/40">{title}</p>
        {metaName && (
          <p className="mb-1.5 text-[11px] font-bold text-mme-purple/55">
            {metaLabel}: <span className="text-mme-purple">{metaName}</span>
          </p>
        )}
        {items.length ? <ul className="space-y-1.5">{items.map(renderItem)}</ul> : <p className="text-xs text-mme-purple/40">None</p>}
      </div>
    );
  }

  return (
    <PositionedHoverPanel preview={preview} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-mme-purple">
        {isMeetings ? <CalendarClock size={14} /> : <Phone size={14} />}
        {isMeetings ? "Meetings" : "Calls"} · {preview.clientName || "Client"}
      </p>

      {preview.status === "loading" && (
        <div className="flex items-center gap-2 py-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-mme-pink border-t-mme-purple" />
          <span className="text-sm text-mme-purple/50">Loading…</span>
        </div>
      )}
      {preview.status === "error" && <p className="text-sm text-red-600">{preview.error}</p>}
      {preview.status === "ready" && (
        <div className="space-y-4">
          {renderGroup("Upcoming", upcoming, "Assigned to", nextAssignedToName)}
          {renderGroup("Previous", previous, "Done by", lastDoneByName)}
        </div>
      )}
    </PositionedHoverPanel>
  );
}

/* ─── Page ─── */

// Overlays any not-yet-confirmed-saved edits on top of a freshly-fetched
// workspace so the admin's in-progress typing is never clobbered by the
// background 20s refresh finishing while a debounced save is still pending.
function mergeWithPendingEdits(freshWorkspace, pendingEditsByRow) {
  if (!pendingEditsByRow.size) return freshWorkspace;
  return {
    ...freshWorkspace,
    rows: freshWorkspace.rows.map((row) => {
      const pending = pendingEditsByRow.get(row.id);
      if (!pending || !pending.size) return row;
      return { ...row, values: { ...row.values, ...Object.fromEntries(pending) } };
    }),
  };
}

export default function AdminClientsManagementPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverHideTimeout = useRef(null);
  const pendingEditsRef = useRef(new Map()); // rowId -> Map<columnId, value not yet confirmed saved>
  const saveTimersRef = useRef(new Map()); // "rowId:columnId" -> debounce timeout id

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!admin) return;
    loadEmployeeDirectory()
      .then(setEmployeeDirectory)
      .catch(() => {});
  }, [admin]);

  useEffect(() => {
    if (!admin) return undefined;
    let cancelled = false;

    async function load(showSpinner) {
      if (showSpinner) setIsLoading(true);
      try {
        const data = await fetchAdminWorkspace();
        if (!cancelled) setWorkspace(mergeWithPendingEdits(data, pendingEditsRef.current));
      } catch (error) {
        if (!cancelled) setNotice({ type: "error", message: error.message });
      } finally {
        if (!cancelled && showSpinner) setIsLoading(false);
      }
    }

    load(true);
    const interval = window.setInterval(() => load(false), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [admin]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const employeeNames = useMemo(() => employeeDirectory.map((e) => e.fullName), [employeeDirectory]);

  function handleCellChange(row, column, value) {
    setWorkspace((current) => ({
      ...current,
      rows: current.rows.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [column.id]: value } } : r)),
    }));

    if (!pendingEditsRef.current.has(row.id)) pendingEditsRef.current.set(row.id, new Map());
    pendingEditsRef.current.get(row.id).set(column.id, value);

    const timerKey = `${row.id}:${column.id}`;
    if (saveTimersRef.current.has(timerKey)) window.clearTimeout(saveTimersRef.current.get(timerKey));

    const timer = window.setTimeout(async () => {
      saveTimersRef.current.delete(timerKey);
      try {
        const result = await updateAdminWorkspaceCell(row.id, column.id, value);
        setWorkspace((current) =>
          current
            ? {
                ...current,
                rows: current.rows.map((r) =>
                  r.id === row.id ? { ...r, values: { ...r.values, [column.id]: result.value } } : r,
                ),
              }
            : current,
        );
      } catch (error) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not save the change." });
      } finally {
        const rowMap = pendingEditsRef.current.get(row.id);
        if (rowMap) {
          rowMap.delete(column.id);
          if (!rowMap.size) pendingEditsRef.current.delete(row.id);
        }
      }
    }, CELL_SAVE_DEBOUNCE_MS);
    saveTimersRef.current.set(timerKey, timer);
  }

  function cancelHoverHide() {
    if (hoverHideTimeout.current) {
      window.clearTimeout(hoverHideTimeout.current);
      hoverHideTimeout.current = null;
    }
  }

  function scheduleHoverHide() {
    cancelHoverHide();
    hoverHideTimeout.current = window.setTimeout(() => setHoverPreview(null), 150);
  }

  async function handlePreviewHover(event, row, type) {
    cancelHoverHide();
    const rect = event.currentTarget.getBoundingClientRect();
    const clientNameColumn = workspace.columns.find((column) => column.id === "client_name");
    const clientName = clientNameColumn ? row.values[clientNameColumn.id] : "";

    setHoverPreview({
      type,
      rowId: row.id,
      clientName,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      anchorLeft: rect.left,
      status: "loading",
      items: [],
      error: "",
      fetchedAt: Date.now(),
      nextCallDatetime: row.nextCallDatetime || "",
    });

    try {
      const data = type === "meetings" ? await fetchClientMeetingsForAdmin(row.id) : await fetchClientCallsForAdmin(row.id);
      setHoverPreview((current) =>
        current && current.rowId === row.id && current.type === type
          ? { ...current, status: "ready", items: (type === "meetings" ? data.meetings : data.calls) || [] }
          : current,
      );
    } catch (error) {
      setHoverPreview((current) =>
        current && current.rowId === row.id && current.type === type
          ? { ...current, status: "error", error: error instanceof Error ? error.message : "Failed to load." }
          : current,
      );
    }
  }

  const filteredRows = useMemo(() => {
    if (!workspace) return [];
    const query = searchText.trim().toLowerCase();
    if (!query) return workspace.rows;
    return workspace.rows.filter((row) =>
      Object.values(row.values).some((value) => String(value ?? "").toLowerCase().includes(query)),
    );
  }, [workspace, searchText]);

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-7 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
          <LayoutGrid size={14} /> Live Worksheet
        </div>
        <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Client Informations and Management</h1>
        <p className="mt-1.5 text-sm text-mme-purple/55">
          The same live client sheet every employee edits — edit any cell here and it saves automatically.
        </p>
      </div>

      {isLoading && !workspace ? (
        <div className="flex justify-center py-24">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
        </div>
      ) : workspace ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mme-purple/40" size={16} />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-2xl border border-mme-pink/60 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-mme-purple placeholder:text-mme-purple/35 focus:border-mme-purple/50 focus:outline-none"
              />
            </div>
            <span className="rounded-full bg-mme-blush px-3 py-1 text-xs font-black text-mme-purple">
              {filteredRows.length} of {workspace.rows.length}
            </span>
          </div>

          {filteredRows.length ? (
            <div className="overflow-x-auto rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-mme-pink/50 bg-[#fff9fc] text-left text-[11px] font-black uppercase tracking-[0.1em] text-mme-plum">
                    {workspace.columns.map((column) => (
                      <th key={column.id} style={{ width: column.width, minWidth: column.width }} className="px-4 py-3">
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="animate-[fadeIn_0.4s_ease-out_both] border-b border-mme-pink/30 last:border-b-0 hover:bg-[#fff9fc]"
                      style={{ animationDelay: `${Math.min(index, 24) * 20}ms` }}
                    >
                      {workspace.columns.map((column) => (
                        <td key={column.id} style={{ width: column.width, minWidth: column.width }} className="px-4 py-3 align-top">
                          {column.type === "meeting_manager" ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onMouseEnter={(event) => handlePreviewHover(event, row, "meetings")}
                                onMouseLeave={scheduleHoverHide}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#f2662b] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#d9541f] hover:shadow-md hover:shadow-[#f2662b]/30 active:scale-[0.96]"
                              >
                                <CalendarClock size={14} /> Meeting
                              </button>
                              <button
                                type="button"
                                onMouseEnter={(event) => handlePreviewHover(event, row, "calls")}
                                onMouseLeave={scheduleHoverHide}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#c2410c] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#9a340a] hover:shadow-md hover:shadow-[#c2410c]/30 active:scale-[0.96]"
                              >
                                <Phone size={14} /> Call
                              </button>
                            </div>
                          ) : (
                            <AdminCellEditor
                              column={column}
                              value={row.values[column.id]}
                              onChange={(value) => handleCellChange(row, column, value)}
                              employeeNames={employeeNames}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-mme-pink/60 bg-white px-6 py-10 text-center text-sm font-bold text-mme-purple/50">
              No clients found.
            </p>
          )}
        </>
      ) : null}

      {hoverPreview && (
        <HoverPreviewPanel preview={hoverPreview} onMouseEnter={cancelHoverHide} onMouseLeave={scheduleHoverHide} />
      )}

      {notice && (
        <div
          className={`fixed bottom-5 right-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
            notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-mme-pink bg-white text-mme-purple"
          }`}
        >
          <X className="mt-0.5 shrink-0" size={17} />
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
