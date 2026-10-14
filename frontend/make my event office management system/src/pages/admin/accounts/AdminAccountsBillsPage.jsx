import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Badge,
  StatusBadge,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  Pagination,
  ReasonPicker,
} from "../../../components/AdminAccountsWidgets";
import {
  loadExpenses,
  loadApprovedBillsForEmployee,
  loadEmployeeWallets,
  loadVendors,
  loadVendorOutstandingItems,
  loadPendingBillsCounts,
  updateExpense,
  approveExpense,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
  SETTLE_ALL_SENTINEL,
} from "../../../services/adminAccountsService";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  ImageOff,
  Loader2,
  Paperclip,
  Pencil,
  SlidersHorizontal,
  X,
} from "lucide-react";

// A "bill" is any expense — Event Based or Regular, vendor-linked or not —
// that an admin hasn't approved yet. Once approved, it drops off this list
// and moves to the Expenses page.
// costType always picks exactly one of the two tabs below — there's no
// "both" option here (unlike the Expenses page).
const EMPTY_FILTERS = {
  employeeId: "",
  costType: "event",
  vendorId: "",
  paymentStatus: "",
  status: "active",
  dateField: "cost",
  dateFrom: "",
  dateTo: "",
  eventSearch: "",
  minAmount: "",
  maxAmount: "",
  receipt: "",
  sort: "newest",
};

export default function AdminAccountsBillsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [counts, setCounts] = useState({ event: 0, regular: 0, total: 0 });

  const activeFilterCount = Object.keys(EMPTY_FILTERS).filter(
    (key) => key !== "costType" && filters[key] !== EMPTY_FILTERS[key],
  ).length;

  const refreshCounts = useCallback(() => {
    loadPendingBillsCounts()
      .then(setCounts)
      .catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    loadExpenses({
      ...filters,
      pendingApproval: true,
      approved: "false",
      page,
      pageSize: 50,
    })
      .then(setResult)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
    refreshCounts();
  }, [filters, page, refreshCounts]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    loadEmployeeWallets().then(setEmployees).catch(() => {});
    loadVendors({ includeInactive: true }).then(setVendors).catch(() => {});
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleExport() {
    const rows = (result?.rows || []).flatMap((bill) =>
      bill.items.map((item) => ({ bill, item })),
    );
    exportRowsToCsv(
      "bills.csv",
      [
        { label: "Bill ID", value: ({ bill }) => bill.id },
        { label: "Cost Type", value: ({ bill }) => bill.costType },
        { label: "Employee", value: ({ bill }) => bill.employeeName || "" },
        { label: "Event/Client", value: ({ bill }) => bill.eventClientName || "" },
        { label: "Event Date", value: ({ bill }) => bill.eventDate || "" },
        { label: "Vendor", value: ({ item }) => item.vendorName || "" },
        { label: "Cost Date", value: ({ item }) => item.costDate },
        { label: "Purpose", value: ({ item }) => item.purpose },
        { label: "Quantity", value: ({ item }) => item.quantity },
        { label: "Per Qty Amount", value: ({ item }) => item.perQtyAmount },
        { label: "Item Total", value: ({ item }) => item.totalAmount },
        { label: "Payment Status", value: ({ item }) => item.paymentStatus || "" },
        { label: "Receipt", value: ({ item }) => (item.hasReceipt ? "Yes" : "No") },
        { label: "Status", value: ({ bill }) => bill.status },
        { label: "Submitted", value: ({ bill }) => bill.createdAt },
      ],
      rows,
    );
  }

  return (
    <AdminAccountsShell
      title="Bills"
      subtitle="Costs employees have submitted, awaiting admin approval — Event Based or Regular"
      actions={
        <button
          type="button"
          onClick={handleExport}
          className="acc-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          <Download size={15} />
          Export
        </button>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {showSummary ? (
        <ApprovedBillsSummaryModal
          employees={employees}
          onClose={() => setShowSummary(false)}
        />
      ) : null}

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-rose-100 bg-white/80 p-1.5 shadow-sm">
        {[
          { key: "event", label: "Event Based Bills" },
          { key: "regular", label: "Regular Bills" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => updateFilter("costType", tab.key)}
            className={`acc-press rounded-xl px-3.5 py-2 text-sm font-bold ${
              filters.costType === tab.key
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow"
                : "text-slate-600 hover:bg-rose-50 hover:text-rose-600"
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 ? (
              <span
                className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${
                  filters.costType === tab.key ? "bg-white/25 text-white" : "bg-rose-100 text-rose-600"
                }`}
              >
                {counts[tab.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <SectionCard
        title="Filters"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active` : "No filters applied"}
        className="mb-6"
        actions={
          <>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
                className="acc-press rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
              >
                Reset filters
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="acc-press inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            >
              <SlidersHorizontal size={13} />
              {showFilters ? "Hide filters" : "Show filters"}
              <ChevronDown
                size={13}
                className={`transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
              />
            </button>
          </>
        }
      >
        {showFilters ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
          <Field label="Employee">
            <select
              className={inputClass}
              value={filters.employeeId}
              onChange={(event) => updateFilter("employeeId", event.target.value)}
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor">
            <select
              className={inputClass}
              value={filters.vendorId}
              onChange={(event) => updateFilter("vendorId", event.target.value)}
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Event / client search">
            <input
              className={inputClass}
              placeholder="Search client name"
              value={filters.eventSearch}
              onChange={(event) => updateFilter("eventSearch", event.target.value)}
            />
          </Field>
          <Field label="Payment status">
            <select
              className={inputClass}
              value={filters.paymentStatus}
              onChange={(event) => updateFilter("paymentStatus", event.target.value)}
            >
              <option value="">Any</option>
              <option value="paid">Paid</option>
              <option value="to_pay">To Pay</option>
            </select>
          </Field>
          <Field label="Sort">
            <select
              className={inputClass}
              value={filters.sort}
              onChange={(event) => updateFilter("sort", event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
              <option value="employee">Employee name</option>
            </select>
          </Field>
          <Field label="Date filter means">
            <select
              className={inputClass}
              value={filters.dateField}
              onChange={(event) => updateFilter("dateField", event.target.value)}
            >
              <option value="cost">Cost happened date</option>
              <option value="submitted">Submitted date</option>
            </select>
          </Field>
          <Field label="Date from">
            <input
              type="date"
              className={inputClass}
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field label="Date to">
            <input
              type="date"
              className={inputClass}
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
          <Field label="Minimum amount">
            <input
              type="number"
              min="0"
              className={inputClass}
              value={filters.minAmount}
              onChange={(event) => updateFilter("minAmount", event.target.value)}
            />
          </Field>
          <Field label="Maximum amount">
            <input
              type="number"
              min="0"
              className={inputClass}
              value={filters.maxAmount}
              onChange={(event) => updateFilter("maxAmount", event.target.value)}
            />
          </Field>
          <Field label="Receipt">
            <select
              className={inputClass}
              value={filters.receipt}
              onChange={(event) => updateFilter("receipt", event.target.value)}
            >
              <option value="">Any</option>
              <option value="with">Receipt available</option>
              <option value="without">Missing receipt</option>
            </select>
          </Field>
          <Field label="Transaction status">
            <select
              className={inputClass}
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="active">Active</option>
              <option value="void">Inactive</option>
              <option value="">All</option>
            </select>
          </Field>
        </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Bills"
        actions={
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="acc-press inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 hover:border-rose-300 hover:bg-rose-100"
          >
            <ClipboardList size={14} />
            Summary
          </button>
        }
      >
        {isLoading ? (
          <LoadingBlock />
        ) : !result || result.rows.length === 0 ? (
          <EmptyBlock label="No bills match these filters." />
        ) : (
          <>
            <div className="space-y-3">
              {result.rows.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  vendors={vendors}
                  onSaved={(message) => {
                    setNotice({ type: "success", message });
                    refresh();
                  }}
                  onError={(message) => setNotice({ type: "error", message })}
                />
              ))}
            </div>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              onChange={setPage}
            />
          </>
        )}
      </SectionCard>
    </AdminAccountsShell>
  );
}

function ApprovedBillsSummaryModal({ employees, onClose }) {
  const [employeeId, setEmployeeId] = useState("");
  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!employeeId) {
      setBills([]);
      setError("");
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setBills([]);
    setError("");
    setIsLoading(true);

    loadApprovedBillsForEmployee(employeeId)
      .then((rows) => {
        if (!cancelled) setBills(rows);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load approved bills.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Rendered through a portal (see return below), so lock the real document
  // scroll while this full-screen modal is open. This also prevents the
  // underlying Bills page from moving behind the dialog.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const selectedEmployee = employees.find(
    (employee) => String(employee.employeeId) === String(employeeId),
  );
  const totalApprovedAmount = bills.reduce(
    (sum, bill) => sum + Number(bill.recordedTotalAmount ?? bill.totalAmount ?? 0),
    0,
  );
  const eventBillCount = bills.filter((bill) => bill.costType === "event").length;
  const regularBillCount = bills.filter((bill) => bill.costType === "regular").length;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Approved bills summary"
        className="flex h-[94dvh] w-[96vw] max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-rose-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ClipboardList size={21} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">
                Admin Accounts
              </p>
              <h2 className="mt-0.5 text-xl font-black text-slate-900">Approved Bills Summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select an employee to see every currently active bill approved by admin, in approval order.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="acc-press rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            title="Close summary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div className="max-w-md">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Employee
            </label>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {!employeeId ? (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div>
                <ClipboardList className="mx-auto text-slate-300" size={34} />
                <p className="mt-3 font-black text-slate-700">Choose an employee</p>
                <p className="mt-1 text-sm text-slate-400">
                  Their complete approved bill history will appear here.
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <LoadingBlock />
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : bills.length === 0 ? (
            <EmptyBlock label={`No approved bills found for ${selectedEmployee?.fullName || "this employee"}.`} />
          ) : (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Approved bills</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{bills.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Approved amount</p>
                  <p className="mt-1 text-xl font-black text-emerald-700">{formatTaka(totalApprovedAmount)}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Event Based</p>
                  <p className="mt-1 text-2xl font-black text-amber-700">{eventBillCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Regular</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">{regularBillCount}</p>
                </div>
              </div>

              <div className="space-y-3">
                {bills.map((bill, index) => (
                  <div key={bill.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-2 text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-800">
                              Bill #{bill.id}
                            </p>
                            <Badge tone={bill.costType === "event" ? "amber" : "slate"}>
                              {bill.costType === "event" ? "Event Based" : "Regular"}
                            </Badge>
                            <Badge tone="emerald">Approved</Badge>
                          </div>
                          {bill.eventClientName ? (
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {bill.eventClientName} · {formatDisplayDate(bill.eventDate)}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] font-semibold text-slate-400">
                            Approved {formatDisplayDateTime(bill.approvedAt)}
                            {bill.approvedByName ? ` by ${bill.approvedByName}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bill total</p>
                        <p className="mt-0.5 text-base font-black text-slate-900">
                          {formatTaka(bill.recordedTotalAmount ?? bill.totalAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="px-3 py-2">Purpose</th>
                            <th className="px-3 py-2">Cost date</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Per qty</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2">Vendor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(bill.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 font-bold text-slate-700">{item.purpose}</td>
                              <td className="px-3 py-2 text-slate-500">{formatDisplayDate(item.costDate)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{item.quantity}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatTaka(item.perQtyAmount)}</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums text-slate-800">{formatTaka(item.totalAmount)}</td>
                              <td className="px-3 py-2 text-slate-500">
                                {item.vendorName || "—"}
                                {item.vendorName && item.paymentStatus ? (
                                  <span className="ml-1.5 text-[10px] font-black uppercase text-slate-400">
                                    {item.paymentStatus === "paid" ? "Paid" : "To Pay"}
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// A bill's items are edited in place — the pencil icon flips the whole
// table from a read-only summary into editable inputs, one row per item.
function BillCard({ bill, vendors, onSaved, onError }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [outstandingByVendor, setOutstandingByVendor] = useState({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);

  function ensureOutstandingLoaded(vendorId) {
    if (!vendorId || outstandingByVendor[vendorId] !== undefined) return;
    setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: null }));
    loadVendorOutstandingItems(vendorId)
      .then((bills) => setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: bills })))
      .catch(() => setOutstandingByVendor((prev) => ({ ...prev, [vendorId]: [] })));
  }

  function startEditing() {
    setDraft(
      bill.items.map((item) => ({
        id: item.id,
        purpose: item.purpose,
        costDate: item.costDate,
        quantity: String(item.quantity),
        perQtyAmount: String(item.perQtyAmount),
        vendorId: item.vendorId || "",
        paymentStatus: item.paymentStatus || "",
        settlesItemId: item.settlesItemId || "",
      })),
    );
    for (const item of bill.items) {
      if (item.vendorId && item.paymentStatus === "paid") ensureOutstandingLoaded(item.vendorId);
    }
    setReason("");
    setIsEditing(true);
  }

  function updateItem(index, key, value) {
    setDraft((prev) =>
      prev.map((item, position) => {
        if (position !== index) return item;
        const next = { ...item, [key]: value };
        if (key === "vendorId") {
          next.settlesItemId = "";
          if (!value) next.paymentStatus = "";
          if (value && !next.paymentStatus) next.paymentStatus = "to_pay";
          if (value) ensureOutstandingLoaded(value);
        }
        if (key === "paymentStatus") {
          next.settlesItemId = "";
          if (value === "paid" && next.vendorId) ensureOutstandingLoaded(next.vendorId);
        }
        if (key === "settlesItemId" && value === SETTLE_ALL_SENTINEL) {
          const totalOwed = (outstandingByVendor[next.vendorId] || [])
            .filter((entry) => entry.id !== next.id)
            .reduce((sum, entry) => sum + Number(entry.stillOwed || 0), 0);
          next.quantity = "1";
          next.perQtyAmount = String(totalOwed);
        }
        return next;
      }),
    );
  }

  async function handleSave() {
    if (reason.trim().length < 3) {
      onError("A reason for this correction is required.");
      return;
    }
    setBusy(true);
    try {
      const items = draft.map((item) => ({
        id: item.id,
        purpose: item.purpose,
        costDate: item.costDate,
        quantity: Number(item.quantity),
        perQtyAmount: Number(item.perQtyAmount),
        vendorId: item.vendorId || null,
        paymentStatus: item.vendorId ? item.paymentStatus : null,
        settlesItemId:
          item.vendorId && item.paymentStatus === "paid" ? item.settlesItemId || null : null,
      }));
      await updateExpense(bill.id, { items, reason });
      setIsEditing(false);
      onSaved("Bill corrected and balances adjusted.");
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await approveExpense(bill.id);
      onSaved("Bill approved — it now moves to the Expenses section.");
    } catch (error) {
      onError(error.message);
    } finally {
      setApproving(false);
    }
  }

  const draftTotal = draft.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0),
    0,
  );

  return (
    <div
      className={`acc-stagger-fast acc-lift rounded-2xl border p-4 ${
        bill.status === "void"
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-slate-800">
            {bill.employeeName || "Unknown employee"}
          </span>
          <StatusBadge status={bill.status} />
          <Badge tone={bill.costType === "event" ? "amber" : "slate"}>
            {bill.costType === "event" ? "Event Based" : "Regular"}
          </Badge>
          {bill.wasEdited && bill.status === "active" ? (
            <Badge tone="violet">Corrected</Badge>
          ) : null}
          {bill.eventClientName ? (
            <span className="text-xs font-bold text-slate-500">
              {bill.eventClientName} · {formatDisplayDate(bill.eventDate)}
            </span>
          ) : null}
        </div>
        {bill.status !== "void" ? (
          isEditing ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={busy}
                title="Cancel"
                className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                title="Save changes"
                className="acc-press rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                title="Approve this bill"
                className="acc-press inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Approve
              </button>
              <button
                type="button"
                onClick={startEditing}
                title="Edit this bill"
                className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
              >
                <Pencil size={14} />
              </button>
            </div>
          )
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold">
        <span className="text-slate-500">
          Bill total:{" "}
          <span className="text-slate-800">
            {formatTaka(isEditing ? draftTotal : bill.recordedTotalAmount)}
          </span>
        </span>
        <span className="text-slate-500">
          Still to pay: <span className="text-amber-600">{formatTaka(bill.vendorPayableAmount)}</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="pb-1.5 pr-3">Purpose</th>
              <th className="pb-1.5 px-3">Cost date</th>
              <th className="pb-1.5 px-3 text-right">Qty</th>
              <th className="pb-1.5 px-3 text-right">Per qty</th>
              <th className="pb-1.5 px-3 text-right">Total</th>
              <th className="pb-1.5 px-3">Vendor</th>
              <th className="pb-1.5 pl-3">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(isEditing ? draft : bill.items).map((item, index) => {
              const original = bill.items[index];
              const lineTotal = isEditing
                ? (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0)
                : Number(item.totalAmount);
              return (
                <tr key={item.id}>
                  <td className="py-2 pr-3 font-bold text-slate-700">
                    {isEditing ? (
                      <input
                        className={`${inputClass} text-xs`}
                        value={item.purpose}
                        onChange={(event) => updateItem(index, "purpose", event.target.value)}
                      />
                    ) : (
                      item.purpose
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {isEditing ? (
                      <input
                        type="date"
                        className={`${inputClass} text-xs`}
                        value={item.costDate}
                        onChange={(event) => updateItem(index, "costDate", event.target.value)}
                      />
                    ) : (
                      formatDisplayDate(item.costDate)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={`${inputClass} text-right text-xs`}
                        value={item.quantity}
                        onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${inputClass} text-right text-xs`}
                        value={item.perQtyAmount}
                        onChange={(event) => updateItem(index, "perQtyAmount", event.target.value)}
                      />
                    ) : (
                      formatTaka(item.perQtyAmount)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-slate-800">
                    {formatTaka(lineTotal)}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="space-y-1">
                        <select
                          className={`${inputClass} text-xs`}
                          value={item.vendorId}
                          onChange={(event) => updateItem(index, "vendorId", event.target.value)}
                        >
                          <option value="">No vendor</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.name}
                              {vendor.isActive ? "" : " (inactive)"}
                            </option>
                          ))}
                        </select>
                        {item.vendorId ? (
                          <select
                            className={`${inputClass} text-xs`}
                            value={item.paymentStatus}
                            onChange={(event) =>
                              updateItem(index, "paymentStatus", event.target.value)
                            }
                          >
                            <option value="to_pay">To Pay</option>
                            <option value="paid">Paid</option>
                          </select>
                        ) : null}
                        {item.vendorId && item.paymentStatus === "paid" ? (
                          <select
                            className={`${inputClass} text-xs`}
                            value={item.settlesItemId}
                            onChange={(event) =>
                              updateItem(index, "settlesItemId", event.target.value)
                            }
                          >
                            <option value="">Instant/unrelated buy</option>
                            {(outstandingByVendor[item.vendorId] || []).filter(
                              (entry) => entry.id !== item.id,
                            ).length ? (
                              <option value={SETTLE_ALL_SENTINEL}>Settle ALL owed at once</option>
                            ) : null}
                            {(outstandingByVendor[item.vendorId] || [])
                              .filter((entry) => entry.id !== item.id)
                              .map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {entry.purpose} — {formatTaka(entry.stillOwed)} owed
                                </option>
                              ))}
                          </select>
                        ) : null}
                      </div>
                    ) : item.vendorName ? (
                      <span className="flex items-center gap-1.5">
                        <Link
                          to={`/admin/accounts/vendors/${item.vendorId}`}
                          className="font-bold text-slate-600 hover:text-rose-600"
                        >
                          {item.vendorName}
                        </Link>
                        <Badge tone={item.paymentStatus === "paid" ? "emerald" : "amber"}>
                          {item.paymentStatus === "paid" ? "Paid" : "To Pay"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-3">
                    {original?.hasReceipt ? (
                      <Paperclip size={13} className="text-emerald-500" />
                    ) : (
                      <ImageOff size={13} className="text-slate-300" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditing ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ReasonPicker value={reason} onChange={setReason} label="Reason for this correction" />
        </div>
      ) : null}

      <p className="mt-3 text-[11px] font-bold text-slate-400">
        Submitted {formatDisplayDateTime(bill.createdAt)} · Last updated{" "}
        {formatDisplayDateTime(bill.updatedAt)}
      </p>
    </div>
  );
}
