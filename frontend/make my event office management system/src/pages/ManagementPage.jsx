import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  FileSpreadsheet,
  LayoutGrid,
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
import EmployeeIdentityModal from "../components/EmployeeIdentityModal";
import ExcelImportModal from "../components/ExcelImportModal";
import {
  PRIORITY_OPTIONS,
  SHIFT_OPTIONS,
  STATUS_OPTIONS,
  VENUE_OPTIONS,
  createEmptyRow,
} from "../data/defaultSheet";
import {
  clearCurrentEmployee,
  loadCurrentEmployee,
  loadEmployeeDirectory,
  loadWorkspace,
  saveCurrentEmployee,
  saveWorkspace,
} from "../services/managementStorage";
import { parseSpreadsheetFile } from "../utils/excelImport";

function inferColumnType(header, rows) {
  const name = header.toLowerCase();
  const values = rows
    .slice(0, 20)
    .map((row) => String(row[header] ?? "").trim())
    .filter(Boolean);

  if (name.includes("venue") || name.includes("hall") || name.includes("location")) return "venue";
  if (name.includes("shift")) return "shift";
  if (name.includes("email")) return "email";
  if (name.includes("phone") || name.includes("number") || name.includes("mobile")) return "phone";
  if (name.includes("assigned") || name.includes("employee")) return "employee";
  if (name === "status" || name.includes("status")) return "status";
  if (name.includes("priority")) return "priority";
  if (name.includes("note") || name.includes("discussion") || name.includes("requirement")) return "long_text";
  if (name.includes("date") && name.includes("time")) return "datetime";
  if (name.includes("meeting time") || name.includes("deadline") || name.includes("schedule")) return "datetime";
  if (name.includes("date")) return "date";
  if (name.includes("time")) return "time";
  if (values.length && values.every((value) => !Number.isNaN(Number(value)))) return "number";
  return "text";
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function CellEditor({ column, value, onChange, employeeNames }) {
  const baseClass =
    "h-full min-h-11 w-full border-0 bg-transparent px-3 py-2.5 text-sm text-mme-purple outline-none transition placeholder:text-mme-purple/25 focus:bg-mme-blush/25 focus:ring-2 focus:ring-inset focus:ring-mme-plum/40";

  if (column.type === "checkbox") {
    return (
      <label className="flex min-h-11 items-center justify-center">
        <input
          type="checkbox"
          checked={value === true || value === "true" || value === "1"}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 accent-mme-purple"
        />
      </label>
    );
  }

  if (column.type === "venue") {
    return (
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Select venue</option>
        {VENUE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "shift") {
    return (
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Select shift</option>
        {SHIFT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "status") {
    return (
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Select status</option>
        {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "priority") {
    return (
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Select priority</option>
        {PRIORITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (column.type === "currency") {
    return (
      <div className="flex h-full min-h-11 items-center">
        <span className="pl-3 text-sm font-bold text-mme-purple/40">৳</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          className={`${baseClass} pl-1.5`}
        />
      </div>
    );
  }

  if (column.type === "long_text") {
    return (
      <textarea
        rows={2}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Enter ${column.name.toLowerCase()}`}
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
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Choose or type a name"
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
    date: "date",
    time: "time",
    datetime: "datetime-local",
  }[column.type] || "text";

  return (
    <input
      type={inputType}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${column.name.toLowerCase()}`}
      className={baseClass}
    />
  );
}

function EmptyState({ onAddRow, onUpload }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-mme-blush text-mme-purple">
          <LayoutGrid size={36} />
        </div>
        <h2 className="mt-6 text-2xl font-black text-mme-purple">Your management sheet is ready</h2>
        <p className="mt-3 leading-7 text-mme-purple/60">
          Add the first row manually or upload an existing Excel file. No formulas or complicated spreadsheet setup is needed.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={onAddRow} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mme-purple px-6 py-3.5 font-black text-white hover:bg-[#4b2c55]">
            <Plus size={18} /> Add first row
          </button>
          <button onClick={onUpload} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-mme-purple/20 bg-white px-6 py-3.5 font-black text-mme-purple hover:bg-mme-blush/30">
            <Upload size={18} /> Upload Excel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  const [employee, setEmployee] = useState(() => loadCurrentEmployee());
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
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
  const fileInputRef = useRef(null);
  const hasMounted = useRef(false);
  const [rowHeights, setRowHeights] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mme_row_heights_v1") || "{}"); }
    catch { return {}; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [resizeCursor, setResizeCursor] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    shifts: new Set(),
    assignees: new Set(),
    venues: new Set(),
    statuses: new Set(),
    priorities: new Set(),
  });

  const employeeNames = useMemo(() => {
    const names = employeeDirectory.map((item) => item.fullName);
    if (employee?.fullName && !names.includes(employee.fullName)) names.push(employee.fullName);
    return names.sort((a, b) => a.localeCompare(b));
  }, [employee, employeeDirectory]);

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
      const dtCol = workspace.columns.find((c) => c.name.toLowerCase().includes("current meeting")) || col("datetime");
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
    if (filters.assignees.size > 0) {
      const c = col("employee");
      rows = rows.filter((row) => filters.assignees.has(c ? row.values[c.id] ?? "" : ""));
    }
    if (filters.statuses.size > 0) {
      const c = col("status");
      rows = rows.filter((row) => filters.statuses.has(c ? row.values[c.id] ?? "" : ""));
    }
    if (filters.priorities.size > 0) {
      const c = col("priority");
      rows = rows.filter((row) => filters.priorities.has(c ? row.values[c.id] ?? "" : ""));
    }

    return rows;
  }, [searchText, workspace.rows, workspace.columns, filters]);

  const activeFilterCount = useMemo(
    () =>
      (filters.dateFrom ? 1 : 0) +
      (filters.dateTo ? 1 : 0) +
      filters.shifts.size +
      filters.assignees.size +
      filters.venues.size +
      filters.statuses.size +
      filters.priorities.size,
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
      assignees: new Set(),
      venues: new Set(),
      statuses: new Set(),
      priorities: new Set(),
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
        setWorkspace(nextWorkspace);
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
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleEmployeeSubmit(nextEmployee) {
    try {
      const savedEmployee = await saveCurrentEmployee(nextEmployee);
      setEmployee(savedEmployee);
      setEmployeeDirectory(await loadEmployeeDirectory());
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save employee information.",
      });
    }
  }

  function switchEmployee() {
    clearCurrentEmployee();
    setEmployee(null);
  }

  function addRow() {
    setWorkspace((current) => ({
      ...current,
      rows: [...current.rows, createEmptyRow(current.columns, current.rows.length + 1)],
    }));
  }

  function deleteRow(rowId) {
    setWorkspace((current) => ({
      ...current,
      rows: current.rows
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({ ...row, rowNumber: index + 1 })),
    }));
    setRowHeights((prev) => {
      const next = { ...prev };
      delete next[rowId];
      localStorage.setItem("mme_row_heights_v1", JSON.stringify(next));
      return next;
    });
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
    setNotice({ type: "success", message: `“${column.name}” column added.` });
  }

  function resetWorkspace() {
    const accepted = window.confirm("Reset the entire management sheet? This removes all rows and custom columns stored in this browser.");
    if (!accepted) return;

    setWorkspace((current) => ({ ...current, rows: [] }));
    setNotice({ type: "success", message: "Management sheet cleared. Press Save Changes to persist." });
  }

  async function handleSaveChanges() {
    if (!employee?.id || isSaving) return;
    setIsSaving(true);
    try {
      await saveWorkspace(workspace, employee.id);
      setHasUnsavedChanges(false);
      setNotice({ type: "success", message: "All changes saved successfully." });
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

    setWorkspace((current) => {
      const nextColumns = [...current.columns];
      const headerMap = new Map(nextColumns.map((column) => [normalizeHeader(column.name), column]));

      importPreview.headers.forEach((header) => {
        const key = normalizeHeader(header);
        if (!headerMap.has(key)) {
          const column = {
            id: crypto.randomUUID(),
            name: header,
            type: inferColumnType(header, importPreview.rows),
            width: header.toLowerCase().match(/note|discussion|requirement/) ? 300 : 190,
            required: false,
          };
          nextColumns.push(column);
          headerMap.set(key, column);
        }
      });

      const importedRows = importPreview.rows.map((sourceRow, index) => {
        const values = Object.fromEntries(nextColumns.map((column) => [column.id, ""]));

        importPreview.headers.forEach((header) => {
          const column = headerMap.get(normalizeHeader(header));
          values[column.id] = sourceRow[header] ?? "";
        });

        return {
          id: crypto.randomUUID(),
          rowNumber: current.rows.length + index + 1,
          values,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: employee?.email || null,
          importSource: importPreview.fileName,
        };
      });

      return {
        ...current,
        columns: nextColumns,
        rows: [...current.rows, ...importedRows],
      };
    });

    setNotice({
      type: "success",
      message: `${importPreview.rows.length} rows imported from ${importPreview.fileName}.`,
    });
    setImportPreview(null);
  }

  if (isLoadingWorkspace) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fff9fc] text-mme-purple">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-mme-pink border-t-mme-purple" />
          <p className="mt-4 font-black">Loading shared management data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff9fc] text-mme-purple">
      {!employee && <EmployeeIdentityModal onSubmit={handleEmployeeSubmit} />}
      {showAddColumn && <AddColumnModal onClose={() => setShowAddColumn(false)} onAdd={addColumn} />}
      {importPreview && <ExcelImportModal preview={importPreview} onClose={() => setImportPreview(null)} onConfirm={confirmImport} />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileSelection}
        className="hidden"
      />

      <header className="sticky top-0 z-40 border-b border-mme-pink/50 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="hidden rounded-xl p-2 text-mme-purple/60 hover:bg-mme-blush/40 sm:block" title="Back to landing page">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mme-purple font-black text-white shadow-lg shadow-mme-purple/20">M</div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-mme-purple sm:text-lg">Make My Event</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-mme-plum sm:text-xs">Management Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleSaveChanges}
              disabled={!hasUnsavedChanges || isSaving || !employee?.id}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition md:flex ${
                hasUnsavedChanges && !isSaving
                  ? "border-mme-purple bg-mme-purple text-white shadow-md shadow-mme-purple/20 hover:bg-[#4b2c55] cursor-pointer"
                  : "pointer-events-none border-mme-pink/60 bg-[#fff9fc] text-mme-purple/40 opacity-60 cursor-not-allowed"
              }`}
            >
              {isSaving
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                : hasUnsavedChanges ? <Save size={15} /> : <Check size={15} className="text-mme-plum" />}
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Saved"}
            </button>

            <button onClick={switchEmployee} className="flex items-center gap-2 rounded-2xl border border-mme-pink/70 bg-white px-3 py-2.5 text-left transition hover:bg-mme-blush/30 sm:px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mme-blush text-mme-purple"><UserRound size={16} /></div>
              <div className="hidden sm:block">
                <p className="max-w-36 truncate text-xs font-black text-mme-purple">{employee?.fullName || "Employee"}</p>
                <p className="max-w-36 truncate text-[10px] text-mme-purple/50">Switch employee</p>
              </div>
              <ChevronDown size={15} className="hidden text-mme-plum sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 py-5 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-[1800px]">
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
                <LayoutGrid size={15} /> Shared office data
              </div>
              <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">{workspace.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-mme-purple/60">
                Edit cells directly, create rows and columns, or import a complete Excel file. Every employee works with the same sheet after backend connection.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/calendar" className="inline-flex items-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30">
                <CalendarDays size={17} /> Calendar
              </Link>
              <button onClick={resetWorkspace} className="inline-flex items-center gap-2 rounded-xl border border-mme-pink/70 bg-white px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30">
                <RotateCcw size={17} /> Reset demo
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-mme-pink/60 bg-white shadow-[0_20px_60px_rgba(91,55,101,0.09)]">
            <div className="flex flex-col gap-3 border-b border-mme-pink/50 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button onClick={addRow} className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-4 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/15 hover:bg-[#4b2c55]">
                  <Plus size={17} /> Add row
                </button>
                <button onClick={() => setShowAddColumn(true)} className="inline-flex items-center gap-2 rounded-xl border border-mme-purple/20 bg-white px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30">
                  <Columns3 size={17} /> Add column
                </button>
                <button disabled={isImporting} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-mme-purple/20 bg-white px-4 py-2.5 text-sm font-black text-mme-purple hover:bg-mme-blush/30 disabled:opacity-60">
                  {isImporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-mme-pink border-t-mme-purple" /> : <FileSpreadsheet size={17} />}
                  {isImporting ? "Reading file..." : "Upload Excel"}
                </button>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                    showFilters || activeFilterCount > 0
                      ? "border-mme-purple bg-mme-purple text-white"
                      : "border-mme-purple/20 bg-white text-mme-purple hover:bg-mme-blush/30"
                  }`}
                >
                  <SlidersHorizontal size={17} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                      showFilters || activeFilterCount > 0 ? "bg-white/20 text-white" : "bg-mme-purple/10 text-mme-purple"
                    }`}>{activeFilterCount}</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <p className="hidden text-xs font-bold text-mme-purple/45 sm:block">
                  {filteredRows.length !== workspace.rows.length
                    ? `${filteredRows.length} of ${workspace.rows.length} rows`
                    : `${workspace.rows.length} total rows`} · {workspace.columns.length} columns
                </p>
                <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mme-plum" size={17} />
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search all cells..." className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-2.5 pl-10 pr-9 text-sm outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20" />
                  {searchText && <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40 hover:text-mme-purple"><X size={15} /></button>}
                </div>
              </div>
            </div>

            {/* ── Filter Panel ── */}
            {showFilters && (
              <div className="border-b border-mme-pink/50 bg-[#fff9fc] px-5 py-5">
                <div className="flex flex-wrap gap-x-8 gap-y-5">

                  {/* Date Range */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Date Range (Meeting)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                        className="rounded-xl border border-mme-pink px-3 py-2 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                      />
                      <span className="text-xs font-bold text-mme-purple/40">to</span>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                        className="rounded-xl border border-mme-pink px-3 py-2 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                      />
                    </div>
                  </div>

                  {/* Shift */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Shift</p>
                    <div className="flex gap-4">
                      {SHIFT_OPTIONS.map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.shifts.has(opt)}
                            onChange={() => toggleFilter("shifts", opt)}
                            className="h-4 w-4 accent-mme-purple"
                          />
                          <span className="text-sm font-bold text-mme-purple">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Venue */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Venue</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {VENUE_OPTIONS.map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.venues.has(opt)}
                            onChange={() => toggleFilter("venues", opt)}
                            className="h-4 w-4 accent-mme-purple"
                          />
                          <span className="text-sm font-bold text-mme-purple">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Employee */}
                  <div className="min-w-44">
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Assigned Employee</p>
                    <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                      {employeeNames.length === 0 ? (
                        <p className="text-xs text-mme-purple/40">No employees yet</p>
                      ) : (
                        employeeNames.map((name) => (
                          <label key={name} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={filters.assignees.has(name)}
                              onChange={() => toggleFilter("assignees", name)}
                              className="h-4 w-4 accent-mme-purple"
                            />
                            <span className="text-sm font-bold text-mme-purple">{name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Status</p>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.statuses.has(opt)}
                            onChange={() => toggleFilter("statuses", opt)}
                            className="h-4 w-4 accent-mme-purple"
                          />
                          <span className="text-sm font-bold text-mme-purple">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">Priority</p>
                    <div className="space-y-2">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.priorities.has(opt)}
                            onChange={() => toggleFilter("priorities", opt)}
                            className="h-4 w-4 accent-mme-purple"
                          />
                          <span className="text-sm font-bold text-mme-purple">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>

                {activeFilterCount > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-mme-purple/20 px-3 py-1.5 text-xs font-black text-mme-purple hover:bg-mme-blush/30"
                    >
                      <X size={13} /> Clear all filters
                    </button>
                    <span className="text-xs text-mme-purple/50">{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active · {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""} shown</span>
                  </div>
                )}
              </div>
            )}

            {workspace.rows.length === 0 ? (
              <EmptyState onAddRow={addRow} onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <div className="max-h-[calc(100vh-265px)] min-h-[420px] overflow-auto">
                <table className="border-separate border-spacing-0 text-left">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 w-14 min-w-14 border-b border-r border-mme-pink/60 bg-mme-purple px-2 py-3 text-center text-xs font-black text-white">#</th>
                      {workspace.columns.map((column) => (
                        <th
                          key={column.id}
                          style={{ width: column.width, minWidth: column.width }}
                          className="relative border-b border-r border-white/15 bg-mme-purple px-3 py-3 align-top text-xs font-black text-white"
                        >
                          <div className="flex items-start justify-between gap-2 pr-1">
                            <span>{column.name}{column.required ? " *" : ""}</span>
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mme-pink">{column.type.replace("_", " ")}</span>
                          </div>
                          <div
                            onMouseDown={(e) => startColumnResize(e, column.id)}
                            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-white/40"
                          />
                        </th>
                      ))}
                      <th className="sticky right-0 z-30 w-16 min-w-16 border-b border-l border-white/15 bg-mme-purple px-2 py-3 text-center text-xs font-black text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const rowH = rowHeights[row.id];
                      return (
                        <tr key={row.id} className="group" style={rowH ? { height: `${rowH}px` } : undefined}>
                          <td
                            className="sticky left-0 z-10 border-b border-r border-mme-pink/50 bg-[#fff9fc] text-center text-xs font-black text-mme-purple/45 group-hover:bg-mme-blush/35"
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="relative flex w-full min-h-11 items-center justify-center px-2" style={rowH ? { height: `${rowH}px` } : undefined}>
                              {row.rowNumber}
                              <div
                                onMouseDown={(e) => startRowResize(e, row.id)}
                                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-mme-purple/30"
                              />
                            </div>
                          </td>
                          {workspace.columns.map((column) => (
                            <td
                              key={column.id}
                              style={{ width: column.width, minWidth: column.width, ...(rowH ? { height: `${rowH}px` } : {}) }}
                              className="border-b border-r border-mme-pink/45 bg-white align-top group-hover:bg-[#fffbfd]"
                            >
                              <CellEditor
                                column={column}
                                value={row.values[column.id]}
                                onChange={(value) => updateCell(row.id, column.id, value)}
                                employeeNames={employeeNames}
                              />
                            </td>
                          ))}
                          <td
                            className="sticky right-0 z-10 border-b border-l border-mme-pink/50 bg-white px-2 text-center group-hover:bg-[#fffbfd]"
                            style={rowH ? { height: `${rowH}px` } : undefined}
                          >
                            <div className="flex min-h-11 items-center justify-center" style={rowH ? { height: `${rowH}px` } : undefined}>
                              <button onClick={() => deleteRow(row.id)} className="rounded-xl p-2 text-mme-purple/35 transition hover:bg-red-50 hover:text-red-500" title="Delete row"><Trash2 size={17} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredRows.length === 0 && (
                  <div className="grid min-h-72 place-items-center p-8 text-center">
                    <div>
                      <Search className="mx-auto text-mme-mauve" size={34} />
                      <p className="mt-4 font-black text-mme-purple">No matching rows</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-3">
                        {searchText && (
                          <button onClick={() => setSearchText("")} className="text-sm font-black text-mme-plum hover:text-mme-purple">
                            Clear search
                          </button>
                        )}
                        {activeFilterCount > 0 && (
                          <button onClick={clearFilters} className="text-sm font-black text-mme-plum hover:text-mme-purple">
                            Clear filters ({activeFilterCount})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col justify-between gap-2 border-t border-mme-pink/50 bg-[#fff9fc] px-4 py-3 text-xs text-mme-purple/50 sm:flex-row sm:items-center">
              <p>Drag column edges to resize width · Drag row edges to resize height · Press <strong>Save Changes</strong> to persist edits to the database.</p>
              <p className="font-bold">Supported imports: .xlsx and .csv</p>
            </div>
          </div>
        </section>
      </main>

      {notice && (
        <div className={`fixed bottom-5 right-5 z-[120] flex max-w-md items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : notice.type === "info" ? "border-mme-pink bg-white text-mme-purple" : "border-mme-pink bg-white text-mme-purple"}`}>
          {notice.type === "error" ? <X className="mt-0.5 shrink-0" size={18} /> : notice.type === "info" ? <CalendarDays className="mt-0.5 shrink-0 text-mme-plum" size={18} /> : <Check className="mt-0.5 shrink-0 text-mme-plum" size={18} />}
          <p className="text-sm font-bold leading-6">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
