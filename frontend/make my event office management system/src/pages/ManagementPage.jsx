import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import mmeLogo from "../assets/mme-logo-cropped.png";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  FileSpreadsheet,
  LayoutGrid,
  LogOut,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import AddColumnModal from "../components/AddColumnModal";
import ConfirmDialog from "../components/ConfirmDialog";
import ExcelImportModal from "../components/ExcelImportModal";
import {
  MANDATORY_EXCEL_COLUMNS,
  SHIFT_OPTIONS,
  VENUE_OPTIONS,
  createEmptyRow,
  Showed_Column_Name,
} from "../data/defaultSheet";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
  loadEmployeeDirectory,
  loadWorkspace,
  saveWorkspace,
} from "../services/managementStorage";
import { parseSpreadsheetFile } from "../utils/excelImport";
import { loadClientMeetings } from "../services/meetingsStorage";
import { loadClientCalls } from "../services/callsStorage";

/* ─── Utility helpers ─── */

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function isNotAvailableValue(raw) {
  const text = String(raw ?? "").trim();
  return text === "" || /^n\/?a$/i.test(text);
}

function isRowBlank(row, columns) {
  return columns.every((column) => String(row.values[column.id] ?? "").trim() === "");
}

function buildRowSignature(values, columns) {
  return columns
    .map((column) => String(values[column.id] ?? "").trim().toLowerCase())
    .join("\u0001");
}

function formatMeetingTimeDisplay(value, emptyLabel) {
  if (!value) return emptyLabel;
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* ─── Hover Preview Panel ─── */

function HoverPreviewPanel({ preview, onMouseEnter, onMouseLeave }) {
  const isMeetings = preview.type === "meetings";
  const now = preview.fetchedAt;

  function getTime(item) {
    return isMeetings ? item.meetingDatetime : item.callDatetime;
  }

  function isUpcoming(item) {
    const time = getTime(item);
    if (!time) return false;
    const parsed = new Date(String(time).replace(" ", "T")).getTime();
    return !Number.isNaN(parsed) && parsed >= now;
  }

  const upcoming = preview.status === "ready" ? preview.items.filter(isUpcoming) : [];
  const previous = preview.status === "ready" ? preview.items.filter((item) => !isUpcoming(item)) : [];

  function renderItem(item) {
    const time = getTime(item);
    return (
      <li key={item.id} className="animate-[fadeInUp_0.2s_ease-out] rounded-xl border border-[#d6d6d6]/50 px-3 py-2 transition-all duration-200 hover:border-[#333333]/20 hover:shadow-sm">
        <p className="text-xs font-bold text-black">
          {time ? formatMeetingTimeDisplay(time, "Not scheduled") : "Not scheduled"}
        </p>
        {isMeetings && item.isCompleted && (
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-600">Completed</p>
        )}
        {!isMeetings && item.callDiscussion && (
          <p className="mt-1 line-clamp-2 text-xs text-black/60">{item.callDiscussion}</p>
        )}
      </li>
    );
  }

  function renderGroup(title, items) {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-black/40">{title}</p>
        {items.length ? (
          <ul className="space-y-1.5">{items.map(renderItem)}</ul>
        ) : (
          <p className="text-xs text-black/40">None</p>
        )}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "fixed", top: preview.top, left: preview.left }}
      className="animate-[scaleIn_0.2s_ease-out] z-[130] max-h-96 w-80 origin-top-left overflow-auto rounded-2xl border border-[#d6d6d6] bg-white p-4 shadow-2xl"
    >
      <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#333333]">
        {isMeetings ? <CalendarClock size={14} /> : <Phone size={14} />}
        {isMeetings ? "Meetings" : "Calls"} · {preview.clientName || "Client"}
      </p>

      {preview.status === "loading" && (
        <div className="flex items-center gap-2 py-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6d6d6] border-t-black" />
          <span className="text-sm text-black/50">Loading…</span>
        </div>
      )}
      {preview.status === "error" && <p className="text-sm text-red-600">{preview.error}</p>}
      {preview.status === "ready" && (
        <div className="space-y-4">
          {renderGroup("Upcoming", upcoming)}
          {renderGroup("Previous", previous)}
        </div>
      )}
    </div>
  );
}

/* ─── Cell Editor ─── */

function CellEditor({ column, value, onChange, employeeNames }) {
  const baseClass =
    "h-full min-h-11 w-full border-0 bg-transparent px-3 py-2.5 text-sm text-black outline-none transition-all duration-200 placeholder:text-black/25 focus:bg-[#f4f4f4]/40 focus:ring-2 focus:ring-inset focus:ring-[#333333]/30";

  const isNotAvailable = value === "N/A";
  const editableValue = isNotAvailable ? "" : value;

  if (column.type === "checkbox") {
    return (
      <label className="flex min-h-11 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={editableValue === true || editableValue === "true" || editableValue === "1"}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 accent-black transition-transform duration-150 hover:scale-110"
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
      <div className="flex h-full min-h-11 items-center">
        <span className="pl-3 text-sm font-bold text-black/40">৳</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={editableValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNotAvailable ? "N/A" : "0.00"}
          className={`${baseClass} pl-1.5`}
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
        className={`${baseClass} min-h-16 resize-none leading-5`}
      />
    );
  }

  if (column.type === "employee") {
    const listId = `employees-${column.id}`;
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

/* ─── Empty State ─── */

function EmptyState({ onAddRow, onUpload }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
      <div className="max-w-lg animate-[fadeInUp_0.5s_ease-out]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#f4f4f4] text-black transition-transform duration-300 hover:scale-105">
          <LayoutGrid size={36} />
        </div>
        <h2 className="mt-6 text-2xl font-black text-black">Your management sheet is ready</h2>
        <p className="mt-3 leading-7 text-black/60">
          Add the first row manually or upload an existing Excel file. No formulas or complicated spreadsheet setup is needed.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={onAddRow} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-3.5 font-black text-white transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/20 active:scale-[0.97]">
            <Plus size={18} /> Add first row
          </button>
          <button onClick={onUpload} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/20 bg-white px-6 py-3.5 font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97]">
            <Upload size={18} /> Upload Excel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function ManagementPage() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(() => loadCurrentEmployee());
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [workspace, setWorkspace] = useState(() => ({
    id: "meeting-management",
    name: "Meeting Management",
    columns: [],
    rows: [],
  }));
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savePromptRowCount, setSavePromptRowCount] = useState(0);
  const fileInputRef = useRef(null);
  const hasMounted = useRef(false);
  const [rowHeights, setRowHeights] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mme_row_heights_v1") || "{}"); }
    catch { return {}; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
  const filterDropdownRef = useRef(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState(null);
  const [resizeCursor, setResizeCursor] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverHideTimeout = useRef(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    shifts: new Set(),
    assigneeText: "",
    venues: new Set(),
  });

  const employeeNames = useMemo(() => {
    const names = employeeDirectory.map((item) => item.fullName);
    if (employee?.fullName && !names.includes(employee.fullName)) names.push(employee.fullName);
    return names.sort((a, b) => a.localeCompare(b));
  }, [employee, employeeDirectory]);

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
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 340),
      status: "loading",
      items: [],
      error: "",
      fetchedAt: Date.now(),
    });

    try {
      const data = type === "meetings" ? await loadClientMeetings(row.id) : await loadClientCalls(row.id);
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
    let rows = workspace.rows;

    const query = searchText.trim().toLowerCase();
    if (query) {
      rows = rows.filter((row) =>
        Object.values(row.values).some((value) => String(value ?? "").toLowerCase().includes(query)),
      );
    }

    const col = (type) => workspace.columns.find((c) => c.type === type);

    if (filters.dateFrom || filters.dateTo) {
      const dtCol =
        workspace.columns.find((c) => c.type === "last_meeting_time") ||
        workspace.columns.find((c) => c.name.toLowerCase().includes("last meeting") || c.name.toLowerCase().includes("current meeting")) ||
        col("datetime");
      rows = rows.filter((row) => {
        const raw = dtCol ? String(row.values[dtCol.id] ?? "").replace(" ", "T") : "";
        const date = raw.slice(0, 10);
        if (!date) return false;
        if (filters.dateFrom && date < filters.dateFrom) return false;
        if (filters.dateTo && date > filters.dateTo) return false;
        return true;
      });
    }

    if (filters.shifts.size > 0) {
      const c = col("shift");
      rows = rows.filter((row) => filters.shifts.has(c ? row.values[c.id] ?? "" : ""));
    }
    if (filters.venues.size > 0) {
      const c = col("venue");
      rows = rows.filter((row) => filters.venues.has(c ? row.values[c.id] ?? "" : ""));
    }
    if (filters.assigneeText.trim()) {
      const c = col("employee");
      const q = filters.assigneeText.trim().toLowerCase();
      rows = rows.filter((row) => String(c ? row.values[c.id] ?? "" : "").toLowerCase().includes(q));
    }

    return rows;
  }, [searchText, workspace.rows, workspace.columns, filters]);

  const activeFilterCount = useMemo(
    () =>
      (filters.dateFrom ? 1 : 0) +
      (filters.dateTo ? 1 : 0) +
      filters.shifts.size +
      (filters.assigneeText.trim() ? 1 : 0) +
      filters.venues.size,
    [filters],
  );

  function toggleFilter(key, value) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  function clearFilters() {
    setFilters({
      dateFrom: "",
      dateTo: "",
      shifts: new Set(),
      assigneeText: "",
      venues: new Set(),
    });
  }

  function startColumnResize(e, columnId) {
    e.preventDefault();
    const col = workspace.columns.find((c) => c.id === columnId);
    if (!col) return;
    const startX = e.clientX;
    const startWidth = col.width;
    setResizeCursor("col-resize");
    function onMove(ev) {
      const newWidth = Math.max(60, startWidth + (ev.clientX - startX));
      setWorkspace((prev) => ({
        ...prev,
        columns: prev.columns.map((c) => (c.id === columnId ? { ...c, width: newWidth } : c)),
      }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setResizeCursor(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startRowResize(e, rowId) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = rowHeights[rowId] || 44;
    setResizeCursor("row-resize");
    function onMove(ev) {
      const newHeight = Math.max(44, startHeight + (ev.clientY - startY));
      setRowHeights((prev) => {
        const next = { ...prev, [rowId]: newHeight };
        localStorage.setItem("mme_row_heights_v1", JSON.stringify(next));
        return next;
      });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setResizeCursor(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    document.body.style.cursor = resizeCursor ?? "";
    document.body.style.userSelect = resizeCursor ? "none" : "";
  }, [resizeCursor]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedData() {
      try {
        setIsLoadingWorkspace(true);
        const [nextWorkspace, employees] = await Promise.all([
          loadWorkspace(),
          loadEmployeeDirectory(),
        ]);
        if (cancelled) return;
        setWorkspace({
          ...nextWorkspace,
          rows: nextWorkspace.rows.filter((row) => !isRowBlank(row, nextWorkspace.columns)),
        });
        setEmployeeDirectory(employees);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Could not load shared data.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkspace(false);
          window.setTimeout(() => {
            hasMounted.current = true;
          }, 0);
        }
      }
    }

    loadSharedData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasMounted.current) return;
    setHasUnsavedChanges(true);
  }, [workspace]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilters(false);
        setHoveredSection(null);
      }
    }
    if (showFilters) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!employee) return undefined;

    window.history.pushState(null, "", window.location.href);

    function handlePopState() {
      window.history.pushState(null, "", window.location.href);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [employee]);

  // No employee session (e.g. reached via browser back/forward navigation
  // after logging out elsewhere in the SPA) — always send the user to the
  // dedicated /login page rather than showing any inline login UI here.
  useEffect(() => {
    if (!employee) {
      navigate("/login", { replace: true });
    }
  }, [employee, navigate]);

  function handleLogout() {
    clearCurrentEmployee();
    setEmployee(null);
    navigate("/", { replace: true });
  }

  function requestLogout() {
    setShowLogoutConfirm(true);
  }

  function confirmLogout() {
    setShowLogoutConfirm(false);
    handleLogout();
  }

  function addRow() {
    setWorkspace((current) => ({
      ...current,
      rows: [...current.rows, createEmptyRow(current.columns, current.rows.length + 1)],
    }));
  }

  async function deleteRow(rowId) {
    const nextRows = workspace.rows
      .filter((row) => row.id !== rowId)
      .map((row, index) => ({ ...row, rowNumber: index + 1 }));

    setRowHeights((prev) => {
      const next = { ...prev };
      delete next[rowId];
      localStorage.setItem("mme_row_heights_v1", JSON.stringify(next));
      return next;
    });

    if (!employee?.id) {
      setWorkspace((current) => ({ ...current, rows: nextRows }));
      setHasUnsavedChanges(true);
      return;
    }

    await handleSaveChanges(nextRows);
  }

  function updateCell(rowId, columnId, value) {
    setWorkspace((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              values: { ...row.values, [columnId]: value },
              updatedAt: new Date().toISOString(),
              updatedBy: employee?.email || null,
            }
          : row,
      ),
    }));
  }

  function addColumn(column) {
    setWorkspace((current) => ({
      ...current,
      columns: [...current.columns, column],
      rows: current.rows.map((row) => ({
        ...row,
        values: { ...row.values, [column.id]: "" },
      })),
    }));
    setShowAddColumn(false);
    setNotice({ type: "success", message: `"${column.name}" column added.` });
  }

  function resetWorkspace() {
    const accepted = window.confirm("Reset the entire management sheet? This removes all rows and custom columns stored in this browser.");
    if (!accepted) return;

    setWorkspace((current) => ({ ...current, rows: [] }));
    setNotice({ type: "success", message: "Management sheet cleared. Press Save Changes to persist." });
  }

  async function handleSaveChanges(rowsOverride) {
    if (!employee?.id || isSaving) return;
    setIsSaving(true);
    try {
      const sourceRows = rowsOverride ?? workspace.rows;

      const nonBlankRows = sourceRows.filter((row) => !isRowBlank(row, workspace.columns));
      const rowsRemoved = nonBlankRows.length !== sourceRows.length;

      const eventDateColumn = workspace.columns.find((column) => column.id === "event_date");
      const rows = eventDateColumn
        ? nonBlankRows.map((row) => {
            const current = row.values[eventDateColumn.id];
            if (current && String(current).trim() !== "") return row;
            return { ...row, values: { ...row.values, [eventDateColumn.id]: "N/A" } };
          })
        : nonBlankRows;

      const workspaceToSave = { ...workspace, rows };

      await saveWorkspace(workspaceToSave, employee.id);
      setWorkspace(workspaceToSave);
      setHasUnsavedChanges(false);
      setNotice({
        type: "success",
        message: rowsRemoved
          ? "All changes saved successfully. Empty rows were removed automatically."
          : "All changes saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save changes.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.rows.length) throw new Error("The spreadsheet contains headers but no data rows.");

      const normalizedHeaders = new Set(parsed.headers.map(normalizeHeader));
      const missingColumns = MANDATORY_EXCEL_COLUMNS.filter(
        (name) => !normalizedHeaders.has(normalizeHeader(name)),
      );
      if (missingColumns.length) {
        throw new Error(
          `Import failed. Missing mandatory column(s): ${missingColumns.join(", ")}.`,
        );
      }

      setImportPreview({ ...parsed, fileName: file.name });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not read the spreadsheet.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  function confirmImport() {
    if (!importPreview) return;

    const headerMap = new Map(workspace.columns.map((column) => [normalizeHeader(column.name), column]));

    const importedColumns = importPreview.headers
      .map((header) => headerMap.get(normalizeHeader(header)))
      .filter(Boolean);

    const seenSignatures = new Set(
      workspace.rows.map((row) => buildRowSignature(row.values, importedColumns)),
    );

    const importedRows = [];
    let duplicateCount = 0;

    importPreview.rows.forEach((sourceRow) => {
      const values = Object.fromEntries(workspace.columns.map((column) => [column.id, ""]));

      importPreview.headers.forEach((header) => {
        const column = headerMap.get(normalizeHeader(header));
        if (!column) return;
        const rawValue = sourceRow[header];
        values[column.id] = isNotAvailableValue(rawValue) ? "N/A" : String(rawValue);
      });

      const signature = buildRowSignature(values, importedColumns);
      if (seenSignatures.has(signature)) {
        duplicateCount += 1;
        return;
      }
      seenSignatures.add(signature);

      importedRows.push({
        id: crypto.randomUUID(),
        rowNumber: workspace.rows.length + importedRows.length + 1,
        values,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: employee?.email || null,
        importSource: importPreview.fileName,
      });
    });

    setWorkspace((current) => ({ ...current, rows: [...current.rows, ...importedRows] }));

    setNotice({
      type: "success",
      message:
        duplicateCount > 0
          ? `${importedRows.length} row(s) imported from ${importPreview.fileName}. ${duplicateCount} duplicate row(s) skipped (already existed).`
          : `${importedRows.length} row(s) imported from ${importPreview.fileName}.`,
    });
    setImportPreview(null);

    if (importedRows.length > 0) {
      setSavePromptRowCount(importedRows.length);
    }
  }

  async function handleSavePromptConfirm() {
    await handleSaveChanges();
    setSavePromptRowCount(0);
  }

  /* ─── Loading ─── */

  if (isLoadingWorkspace) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#ffffff] text-black">
        <div className="animate-[fadeInUp_0.4s_ease-out] text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d6d6d6] border-t-black" />
          <p className="mt-4 font-black">Loading shared management data...</p>
        </div>
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="min-h-screen bg-[#ffffff] text-black">
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {showAddColumn && <AddColumnModal onClose={() => setShowAddColumn(false)} onAdd={addColumn} />}
      {importPreview && <ExcelImportModal preview={importPreview} onClose={() => setImportPreview(null)} onConfirm={confirmImport} />}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll be signed out of the workspace and will need to log in again to continue."
          confirmLabel="Logout"
          cancelLabel="Cancel"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileSelection}
        className="hidden"
      />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-[#d6d6d6]/50 bg-white/95 backdrop-blur-xl transition-all duration-300">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <img src={mmeLogo} alt="Make My Event - Management Workspace" className="h-27 w-auto shrink-0 object-contain sm:h-28" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handleSaveChanges()}
              disabled={!hasUnsavedChanges || isSaving || !employee?.id}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-200 md:flex ${
                hasUnsavedChanges && !isSaving
                  ? "border-black bg-black text-white shadow-md shadow-black/20 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/30 active:scale-[0.97] cursor-pointer"
                  : "pointer-events-none border-[#d6d6d6]/60 bg-[#ffffff] text-black/40 opacity-60 cursor-not-allowed"
              }`}
            >
              {isSaving
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                : hasUnsavedChanges ? <Save size={15} /> : <Check size={15} className="text-[#333333]" />}
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Saved"}
            </button>

            <button onClick={requestLogout} title="Logout" className="group flex items-center gap-2 rounded-2xl border border-[#d6d6d6]/70 bg-white px-3 py-2.5 text-left transition-all duration-200 hover:bg-red-50 hover:border-red-200 hover:shadow-md hover:shadow-red-100/50 sm:px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f4f4] text-black transition-colors duration-200 group-hover:bg-red-100 group-hover:text-red-500"><UserRound size={16} /></div>
              <div className="hidden sm:block">
                <p className="max-w-36 truncate text-xs font-black text-black">{employee?.fullName || "Employee"}</p>
                <p className="max-w-36 truncate text-[10px] text-red-400 font-semibold">Logout</p>
              </div>
              <LogOut size={15} className="text-red-400 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-[1800px] animate-[fadeInUp_0.4s_ease-out]">
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#333333]">
                <LayoutGrid size={15} /> Shared office data
              </div>
              <h1 className="mt-2 text-2xl font-black text-black sm:text-3xl">{workspace.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-black/60">
                Edit cells directly, create rows and columns, or import a complete Excel file. Every employee works with the same sheet after backend connection.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/calendar" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md hover:border-[#333333]/20 active:scale-[0.97]">
                <CalendarDays size={17} /> Calendar
              </Link>
              <button onClick={resetWorkspace} className="inline-flex items-center gap-2 rounded-xl border border-[#d6d6d6]/70 bg-white px-4 py-2.5 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md hover:border-[#333333]/20 active:scale-[0.97]">
                <RotateCcw size={17} /> Reset demo
              </button>
            </div>
          </div>

          {/* ─── Sheet Container ─── */}
          <div className="overflow-hidden rounded-[24px] border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-shadow duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-[#d6d6d6]/50 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button onClick={addRow} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-black text-white shadow-md shadow-black/15 transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/25 active:scale-[0.97]">
                  <Plus size={17} /> Add row
                </button>
                <button onClick={() => setShowAddColumn(true)} className="inline-flex items-center gap-2 rounded-xl border border-black/20 bg-white px-4 py-2.5 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97]">
                  <Columns3 size={17} /> Add column
                </button>
                <button disabled={isImporting} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-black/20 bg-white px-4 py-2.5 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97] disabled:opacity-60 disabled:hover:shadow-none">
                  {isImporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6d6d6] border-t-black" /> : <FileSpreadsheet size={17} />}
                  {isImporting ? "Reading file..." : "Upload Excel"}
                </button>

                {/* ── Filters dropdown ── */}
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    onClick={() => { setShowFilters((v) => !v); setHoveredSection(null); }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition-all duration-200 active:scale-[0.97] ${
                      showFilters || activeFilterCount > 0
                        ? "border-black bg-black text-white shadow-md shadow-black/15"
                        : "border-black/20 bg-white text-black hover:bg-[#f4f4f4]/30 hover:shadow-md"
                    }`}
                  >
                    <SlidersHorizontal size={17} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-black transition-colors duration-200 ${
                        showFilters || activeFilterCount > 0 ? "bg-white/20 text-white" : "bg-black/10 text-black"
                      }`}>{activeFilterCount}</span>
                    )}
                    <ChevronDown size={15} className={`transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`} />
                  </button>

                  {showFilters && (
                    <div className="animate-[fadeInDown_0.2s_ease-out] absolute left-0 top-full z-50 mt-2 flex rounded-2xl border border-[#d6d6d6]/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]" style={{ minWidth: 520 }}>
                      {/* Left — category list */}
                      <div className="w-52 shrink-0 border-r border-[#d6d6d6]/40 py-2">
                        {[
                          { key: "date",     label: "Date Range",       hasValue: filters.dateFrom || filters.dateTo },
                          { key: "shift",    label: "Shift",            hasValue: filters.shifts.size > 0 },
                          { key: "venue",    label: "Venue",            hasValue: filters.venues.size > 0 },
                          { key: "employee", label: "Assigned Employee",hasValue: !!filters.assigneeText.trim() },
                        ].map(({ key, label, hasValue }) => (
                          <button
                            key={key}
                            onMouseEnter={() => setHoveredSection(key)}
                            onClick={() => setHoveredSection(key)}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition-all duration-150 ${
                              hoveredSection === key
                                ? "bg-black text-white"
                                : "text-black hover:bg-[#f4f4f4]/40"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {label}
                              {hasValue && (
                                <span className={`h-2 w-2 rounded-full transition-colors duration-200 ${hoveredSection === key ? "bg-[#d6d6d6]" : "bg-[#333333]"}`} />
                              )}
                            </span>
                            <span className="text-xs opacity-60">›</span>
                          </button>
                        ))}

                        {activeFilterCount > 0 && (
                          <div className="mx-3 mt-2 border-t border-[#d6d6d6]/40 pt-2">
                            <button
                              onClick={clearFilters}
                              className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black text-red-500 transition-all duration-200 hover:bg-red-50"
                            >
                              <X size={13} /> Clear all ({activeFilterCount})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right — options panel */}
                      <div className="flex-1 p-5">
                        {hoveredSection === null && (
                          <div className="flex h-full min-h-32 items-center justify-center text-center animate-[fadeIn_0.2s_ease-out]">
                            <div>
                              <SlidersHorizontal size={28} className="mx-auto text-[#a9a9a9]" />
                              <p className="mt-3 text-sm font-bold text-black/50">Hover a category to filter</p>
                            </div>
                          </div>
                        )}

                        {hoveredSection === "date" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Date Range (Meeting)</p>
                            <div className="flex flex-col gap-3">
                              <div>
                                <label className="mb-1 block text-xs font-bold text-black/60">From</label>
                                <input
                                  type="date"
                                  value={filters.dateFrom}
                                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                                  className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2 text-sm text-black outline-none transition-all duration-200 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-bold text-black/60">To</label>
                                <input
                                  type="date"
                                  value={filters.dateTo}
                                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                                  className="w-full rounded-xl border border-[#d6d6d6] px-3 py-2 text-sm text-black outline-none transition-all duration-200 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {hoveredSection === "shift" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Shift</p>
                            <div className="space-y-2">
                              {SHIFT_OPTIONS.map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-[#f4f4f4]/30">
                                  <input type="checkbox" checked={filters.shifts.has(opt)} onChange={() => toggleFilter("shifts", opt)} className="h-4 w-4 accent-black" />
                                  <span className="text-sm font-bold text-black">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {hoveredSection === "venue" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Venue</p>
                            <div className="grid grid-cols-2 gap-1">
                              {VENUE_OPTIONS.map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-[#f4f4f4]/30">
                                  <input type="checkbox" checked={filters.venues.has(opt)} onChange={() => toggleFilter("venues", opt)} className="h-4 w-4 accent-black" />
                                  <span className="text-sm font-bold text-black">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {hoveredSection === "employee" && (
                          <div className="animate-[fadeIn_0.15s_ease-out]">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#333333]">Assigned Employee</p>
                            <div className="relative">
                              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#333333]" />
                              <input
                                type="text"
                                value={filters.assigneeText}
                                onChange={(e) => setFilters((f) => ({ ...f, assigneeText: e.target.value }))}
                                placeholder="Type employee name…"
                                autoFocus
                                className="w-full rounded-xl border border-[#d6d6d6] py-2.5 pl-9 pr-8 text-sm font-medium text-black outline-none transition-all duration-200 placeholder:text-black/35 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20"
                              />
                              {filters.assigneeText && (
                                <button
                                  onClick={() => setFilters((f) => ({ ...f, assigneeText: "" }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 transition-colors duration-150 hover:text-black"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-black/45">Filters rows containing this name.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <p className="hidden text-xs font-bold text-black/45 sm:block">
                  {filteredRows.length !== workspace.rows.length
                    ? `${filteredRows.length} of ${workspace.rows.length} rows`
                    : `${workspace.rows.length} total rows`} · {workspace.columns.length} columns
                </p>
                <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#333333]" size={17} />
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search all cells..." className="w-full rounded-xl border border-[#d6d6d6]/70 bg-[#ffffff] py-2.5 pl-10 pr-9 text-sm outline-none transition-all duration-200 focus:border-[#333333] focus:ring-4 focus:ring-[#d6d6d6]/20 focus:shadow-md" />
                  {searchText && <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 transition-colors duration-150 hover:text-black"><X size={15} /></button>}
                </div>
              </div>
            </div>

            {/* ─── Table ─── */}
            {workspace.rows.length === 0 ? (
              <EmptyState onAddRow={addRow} onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <div className="max-h-[calc(100vh-265px)] min-h-[420px] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-left" style={{ minWidth: "100%" }}>
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 w-14 min-w-14 border-b border-r border-[#d6d6d6]/60 bg-black px-2 py-3 text-center text-xs font-black text-white">#</th>
                      {workspace.columns.map((column) => (
                        <th
                          key={column.id}
                          style={{ width: column.width, minWidth: column.width }}
                          className="relative border-b border-r border-white/15 bg-black px-3 py-3 align-top text-xs font-black text-white"
                        >
                          <div className="flex items-start justify-between gap-2 pr-1">
                            <span>{Showed_Column_Name[column.name] ?? column.name}{column.required ? " *" : ""}</span>
                          </div>
                          <div
                            onMouseDown={(e) => startColumnResize(e, column.id)}
                            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors duration-150 hover:bg-white/40"
                          />
                        </th>
                      ))}
                      <th className="sticky right-0 z-30 w-[52px] min-w-[52px] border-b border-l border-white/15 bg-black px-2 py-3 text-center text-xs font-black text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const rowH = rowHeights[row.id];
                      return (
                        <tr
                          key={row.id}
                          className="group"
                          style={{
                            ...(rowH ? { height: `${rowH}px` } : {}),
                            animation: `fadeInUp 0.3s ease-out ${Math.min(index * 0.03, 0.5)}s both`,
                          }}
                        >
                          <td
                            className="sticky left-0 z-10 border-b border-r border-[#d6d6d6]/50 bg-[#ffffff] text-center text-xs font-black text-black/45 transition-colors duration-150 group-hover:bg-[#f8f8f8]"
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="relative flex w-full min-h-11 items-center justify-center px-2" style={rowH ? { height: `${rowH}px` } : undefined}>
                              {row.rowNumber}
                              <div
                                onMouseDown={(e) => startRowResize(e, row.id)}
                                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize transition-colors duration-150 hover:bg-black/20"
                              />
                            </div>
                          </td>
                          {workspace.columns.map((column) => (
                            <td
                              key={column.id}
                              style={{ width: column.width, minWidth: column.width, ...(rowH ? { height: `${rowH}px` } : {}) }}
                              className="border-b border-r border-[#d6d6d6]/45 bg-white align-top transition-colors duration-150 group-hover:bg-[#fafafa]"
                            >
                              {column.type === "meeting_manager" ? (
                                <div className="flex h-full min-h-11 items-center justify-center gap-2 p-1.5">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/management/meetings/${row.id}`)}
                                    onMouseEnter={(event) => handlePreviewHover(event, row, "meetings")}
                                    onMouseLeave={scheduleHoverHide}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#f2662b] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#d9541f] hover:shadow-md hover:shadow-[#f2662b]/30 active:scale-[0.96]"
                                  >
                                    <CalendarClock size={14} /> Meetings
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/management/calls/${row.id}`)}
                                    onMouseEnter={(event) => handlePreviewHover(event, row, "calls")}
                                    onMouseLeave={scheduleHoverHide}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#c2410c] px-3 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[#9a340a] hover:shadow-md hover:shadow-[#c2410c]/30 active:scale-[0.96]"
                                  >
                                    <Phone size={14} /> Calls
                                  </button>
                                </div>
                              ) : column.type === "last_meeting_time" || column.type === "next_meeting_time" ? (
                                <div
                                  className={`flex h-full min-h-11 items-center justify-center p-1.5 text-center text-xs font-bold transition-colors duration-150 ${
                                    row.values[column.id] ? "text-black/75" : "text-black/35 italic"
                                  }`}
                                  title="Automatically set from the Meeting Manager"
                                >
                                  {formatMeetingTimeDisplay(
                                    row.values[column.id],
                                    column.type === "last_meeting_time" ? "No Previous Meeting" : "No Upcoming Meeting",
                                  )}
                                </div>
                              ) : (
                                <CellEditor
                                  column={column}
                                  value={row.values[column.id]}
                                  onChange={(value) => updateCell(row.id, column.id, value)}
                                  employeeNames={employeeNames}
                                />
                              )}
                            </td>
                          ))}
                          <td
                            className="sticky right-0 z-10 border-b border-l border-[#d6d6d6]/50 bg-white px-1 text-center transition-colors duration-150 group-hover:bg-[#fafafa]"
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="flex min-h-11 items-center justify-center" style={rowH ? { height: `${rowH}px` } : undefined}>
                              <button onClick={() => setConfirmDeleteRowId(row.id)} className="rounded-xl p-2 text-black/30 transition-all duration-200 hover:bg-red-50 hover:text-red-500 hover:shadow-sm active:scale-90" title="Delete row"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredRows.length === 0 && (
                  <div className="grid min-h-72 place-items-center p-8 text-center animate-[fadeIn_0.3s_ease-out]">
                    <div>
                      <Search className="mx-auto text-[#a9a9a9]" size={34} />
                      <p className="mt-4 font-black text-black">No matching rows</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-3">
                        {searchText && (
                          <button onClick={() => setSearchText("")} className="text-sm font-black text-[#333333] transition-colors duration-150 hover:text-black">
                            Clear search
                          </button>
                        )}
                        {activeFilterCount > 0 && (
                          <button onClick={clearFilters} className="text-sm font-black text-[#333333] transition-colors duration-150 hover:text-black">
                            Clear filters ({activeFilterCount})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col justify-between gap-2 border-t border-[#d6d6d6]/50 bg-[#ffffff] px-4 py-3 text-xs text-black/50 sm:flex-row sm:items-center">
              <p>Drag column edges to resize width · Drag row edges to resize height · Press <strong>Save Changes</strong> to persist edits to the database.</p>
              <p className="font-bold">Supported imports: .xlsx and .csv</p>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Toast / Notice ─── */}
      {notice && (
        <div
          className={`animate-[slideInRight_0.35s_ease-out] fixed bottom-5 right-5 z-[120] flex max-w-md items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl transition-all duration-300 ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.type === "info"
              ? "border-[#d6d6d6] bg-white text-black"
              : "border-[#d6d6d6] bg-white text-black"
          }`}
        >
          {notice.type === "error" ? <X className="mt-0.5 shrink-0" size={18} /> : notice.type === "info" ? <CalendarDays className="mt-0.5 shrink-0 text-[#333333]" size={18} /> : <Check className="mt-0.5 shrink-0 text-[#333333]" size={18} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-2 opacity-50 transition-opacity duration-150 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* ─── Hover Preview ─── */}
      {hoverPreview && (
        <HoverPreviewPanel preview={hoverPreview} onMouseEnter={cancelHoverHide} onMouseLeave={scheduleHoverHide} />
      )}

      {/* ─── Delete row confirmation modal ─── */}
      {confirmDeleteRowId !== null && (
        <div className="animate-[fadeIn_0.15s_ease-out] fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
          <div className="animate-[scaleIn_0.25s_ease-out] w-full max-w-sm rounded-[28px] border border-[#d6d6d6] bg-white p-7 shadow-2xl">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Trash2 size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black text-black">Delete this row?</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              This row will be permanently removed and saved immediately.
              This action cannot be undone.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setConfirmDeleteRowId(null)}
                disabled={isSaving}
                className="flex-1 rounded-2xl border border-black/20 bg-white py-3 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const rowId = confirmDeleteRowId;
                  setConfirmDeleteRowId(null);
                  await deleteRow(rowId);
                }}
                disabled={isSaving}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white shadow-md shadow-red-200 transition-all duration-200 hover:bg-red-600 hover:shadow-lg hover:shadow-red-300 active:scale-[0.97] disabled:opacity-60"
              >
                {isSaving ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Post-import save prompt ─── */}
      {savePromptRowCount > 0 && (
        <div className="animate-[fadeIn_0.15s_ease-out] fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
          <div className="animate-[scaleIn_0.25s_ease-out] w-full max-w-sm rounded-[28px] border border-[#d6d6d6] bg-white p-7 shadow-2xl">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#f4f4f4] text-black">
              <Save size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black text-black">Save these rows now?</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              {savePromptRowCount} row(s) were added from your Excel import. Save now to persist
              them to the main system, or save later from the toolbar.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setSavePromptRowCount(0)}
                disabled={isSaving}
                className="flex-1 rounded-2xl border border-black/20 bg-white py-3 text-sm font-black text-black transition-all duration-200 hover:bg-[#f4f4f4]/30 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Not now
              </button>
              <button
                onClick={handleSavePromptConfirm}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black py-3 text-sm font-black text-white shadow-md shadow-black/15 transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <Save size={15} />}
                {isSaving ? "Saving..." : "Save now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile save FAB ── */}
      {hasUnsavedChanges && !isSaving && employee?.id && (
        <button
          onClick={() => handleSaveChanges()}
          className="animate-[fadeInUp_0.3s_ease-out] fixed bottom-5 left-5 z-[100] flex items-center gap-2 rounded-2xl bg-black px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-black/30 transition-all duration-200 hover:bg-[#222222] hover:shadow-2xl active:scale-[0.96] md:hidden"
        >
          <Save size={16} /> Save
        </button>
      )}
    </div>
  );
}