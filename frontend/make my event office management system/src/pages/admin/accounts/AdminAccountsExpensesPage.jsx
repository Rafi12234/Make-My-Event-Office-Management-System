import { useCallback, useEffect, useState } from "react";
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
} from "../../../components/AdminAccountsWidgets";
import {
  loadExpenses,
  loadEmployeeWallets,
  loadVendors,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { ChevronDown, Download, ImageOff, Paperclip, SlidersHorizontal } from "lucide-react";

// Transaction status is always fixed to "active" — voided records are no
// longer surfaced as a user-facing filter here. Only approved bills show by
// default — a bill isn't a finalized company expense until an admin has
// signed off on it from the Bills page.
const EMPTY_FILTERS = {
  employeeId: "",
  costType: "",
  vendorId: "",
  paymentStatus: "",
  approved: "true",
  status: "active",
  dateField: "cost",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

export default function AdminAccountsExpensesPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("expenses");

  const activeFilterCount = Object.keys(EMPTY_FILTERS).filter(
    (key) => filters[key] !== EMPTY_FILTERS[key],
  ).length;

  const refresh = useCallback(() => {
    setIsLoading(true);
    loadExpenses({ ...filters, page, pageSize: 50 })
      .then(setResult)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [filters, page]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    loadEmployeeWallets().then(setEmployees).catch(() => {});
    loadVendors({ includeInactive: true }).then(setVendors).catch(() => {});
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // "This week" starts on Monday and runs through today, not the whole
  // calendar week — future dates in the range would never have data anyway.
  function applyDateShortcut(range) {
    const toISO = (date) => date.toISOString().slice(0, 10);
    const today = new Date();
    let from = today;
    if (range === "week") {
      from = new Date(today);
      const day = (from.getDay() + 6) % 7; // Monday = 0
      from.setDate(from.getDate() - day);
    } else if (range === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    setPage(1);
    setFilters((prev) => ({ ...prev, dateFrom: toISO(from), dateTo: toISO(today) }));
  }

  function handleExport() {
    const rows = (result?.rows || []).flatMap((expense) =>
      expense.items.map((item) => ({ expense, item })),
    );
    exportRowsToCsv(
      "company-expenses.csv",
      [
        { label: "Expense ID", value: ({ expense }) => expense.id },
        { label: "Employee", value: ({ expense }) => expense.employeeName || "Company/Admin" },
        { label: "Cost Type", value: ({ expense }) => expense.costType },
        { label: "Event/Client", value: ({ expense }) => expense.eventClientName || "" },
        { label: "Cost Date", value: ({ item }) => item.costDate },
        { label: "Purpose", value: ({ item }) => item.purpose },
        { label: "Quantity", value: ({ item }) => item.quantity },
        { label: "Per Qty Amount", value: ({ item }) => item.perQtyAmount },
        { label: "Total Amount", value: ({ item }) => item.totalAmount },
        { label: "Vendor", value: ({ item }) => item.vendorName || "" },
        { label: "Payment Status", value: ({ item }) => item.paymentStatus || "" },
        { label: "Receipt", value: ({ item }) => (item.hasReceipt ? "Yes" : "No") },
        { label: "Status", value: ({ expense }) => expense.status },
        { label: "Submitted", value: ({ expense }) => expense.createdAt },
        { label: "Last Updated", value: ({ expense }) => expense.updatedAt },
      ],
      rows,
    );
  }

  // A vendor "to_pay" item is money the company still owes, not money it
  // has spent yet — kept out of the main expense list/total and surfaced
  // separately here so it's never mistaken for an actual expense.
  const payableEntries = (result?.rows || []).flatMap((expense) =>
    expense.items
      .filter((item) => item.vendorId && item.paymentStatus === "to_pay")
      .map((item) => ({ expense, item })),
  );
  const totalPayable = payableEntries.reduce(
    (sum, entry) => sum + Number(entry.item.totalAmount),
    0,
  );

  // Same "to_pay" items again, but per-expense this time — the Expenses tab
  // must never show an unpaid vendor bill, only what's actually been paid.
  // An expense left with nothing paid doesn't belong in this list at all
  // until the vendor is settled (mirrors the employee panel's own filter).
  const visibleExpenseRows = (result?.rows || [])
    .map((expense) => ({
      ...expense,
      items: expense.items.filter((item) => !(item.vendorId && item.paymentStatus === "to_pay")),
    }))
    .filter((expense) => expense.items.length > 0);

  return (
    <AdminAccountsShell
      title="All Company Expenses"
      subtitle="Every expense submitted by every employee"
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
        <>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <Field label="Cost type">
            <select
              className={inputClass}
              value={filters.costType}
              onChange={(event) => updateFilter("costType", event.target.value)}
            >
              <option value="">Event & Regular</option>
              <option value="event">Event based</option>
              <option value="regular">Regular</option>
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
          <Field label="Payment status">
            <select
              className={inputClass}
              value={filters.paymentStatus}
              onChange={(event) => updateFilter("paymentStatus", event.target.value)}
            >
              <option value="">Paid & To Pay</option>
              <option value="paid">Paid</option>
              <option value="to_pay">To Pay</option>
            </select>
          </Field>
          <Field label="Approval status">
            <select
              className={inputClass}
              value={filters.approved}
              onChange={(event) => updateFilter("approved", event.target.value)}
            >
              <option value="true">Approved</option>
              <option value="false">Pending approval</option>
              <option value="">Both</option>
            </select>
          </Field>

          {/* Cost-happened date and submitted date are genuinely different
              things, so the admin picks which one the range applies to. */}
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
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { key: "today", label: "Today" },
            { key: "week", label: "This week" },
            { key: "month", label: "This month" },
          ].map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => applyDateShortcut(shortcut.key)}
              className="acc-press rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            >
              {shortcut.label}
            </button>
          ))}
        </div>
        </>
        ) : null}
      </SectionCard>

      {/* Segmented slider — switches the panel below between the paid
          expense ledger and the still-owed vendor amounts, so the two
          money-meanings are never shown mixed together. */}
      <div className="mb-6 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setView("expenses")}
          className={`acc-press rounded-xl px-4 py-2 text-xs font-black transition-colors duration-200 ${
            view === "expenses" ? "bg-emerald-500 text-white shadow" : "text-slate-500 hover:text-emerald-600"
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setView("payable")}
          className={`acc-press rounded-xl px-4 py-2 text-xs font-black transition-colors duration-200 ${
            view === "payable" ? "bg-amber-500 text-white shadow" : "text-slate-500 hover:text-amber-600"
          }`}
        >
          Payable Amounts{payableEntries.length > 0 ? ` (${payableEntries.length})` : ""}
        </button>
      </div>

      {view === "payable" ? (
      <SectionCard
        title="Payable Amounts"
        subtitle="Owed to vendors but not yet paid out — not counted as an expense until the company actually pays it"
      >
        {isLoading ? (
          <LoadingBlock />
        ) : payableEntries.length === 0 ? (
          <EmptyBlock label="Nothing currently payable." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-1.5 pr-3">Employee</th>
                  <th className="pb-1.5 px-3">Vendor</th>
                  <th className="pb-1.5 px-3">Event / Client</th>
                  <th className="pb-1.5 px-3">Purpose</th>
                  <th className="pb-1.5 px-3">Cost date</th>
                  <th className="pb-1.5 pl-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payableEntries.map(({ expense, item }) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 font-bold text-slate-700">
                      {expense.employeeName || "Company / Admin"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/accounts/vendors/${item.vendorId}`}
                        className="font-bold text-slate-600 hover:text-rose-600"
                      >
                        {item.vendorName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{expense.eventClientName || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{item.purpose}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDisplayDate(item.costDate)}</td>
                    <td className="py-2 pl-3 text-right font-black tabular-nums text-amber-600">
                      {formatTaka(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100">
                  <td colSpan={5} className="pt-2 pr-3 text-right text-[11px] font-black text-slate-500">
                    Total payable
                  </td>
                  <td className="pt-2 pl-3 text-right font-black tabular-nums text-amber-600">
                    {formatTaka(totalPayable)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
      ) : (
      <SectionCard title="Expense records">
        {isLoading ? (
          <LoadingBlock />
        ) : !result || visibleExpenseRows.length === 0 ? (
          <EmptyBlock label="No expenses match these filters." />
        ) : (
          <>
            <div className="space-y-3">
              {visibleExpenseRows.map((expense) => (
                <div
                  key={expense.id}
                  className={`acc-stagger-fast acc-lift rounded-2xl border p-4 ${
                    expense.status === "void"
                      ? "border-slate-200 bg-slate-50 opacity-70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-800">
                        {expense.employeeName || "Company / Admin"}
                      </span>
                      <Badge tone={expense.costType === "event" ? "amber" : "slate"}>
                        {expense.costType === "event" ? "Event Based" : "Regular"}
                      </Badge>
                      {expense.paymentSource === "company" ? (
                        <Badge tone="violet">Company direct</Badge>
                      ) : null}
                      <StatusBadge status={expense.status} />
                      <Badge tone={expense.approved ? "emerald" : "amber"}>
                        {expense.approved ? "Approved" : "Pending approval"}
                      </Badge>
                      {expense.wasEdited && expense.status === "active" ? (
                        <Badge tone="violet">Corrected</Badge>
                      ) : null}
                      {expense.eventClientName ? (
                        <span className="text-xs font-bold text-slate-500">
                          {expense.eventClientName} · {formatDisplayDate(expense.eventDate)}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      to={`/admin/accounts/expenses/${expense.id}`}
                      className="acc-press inline-block rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                    >
                      Open & edit
                    </Link>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold">
                    <span className="text-slate-500">
                      Recorded:{" "}
                      <span className="text-slate-800">
                        {formatTaka(expense.recordedTotalAmount)}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      Actual expense (paid):{" "}
                      <span className="text-emerald-600">
                        {formatTaka(expense.walletDeductionAmount)}
                      </span>
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
                        {expense.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-3 font-bold text-slate-700">{item.purpose}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {formatDisplayDate(item.costDate)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {formatTaka(item.perQtyAmount)}
                            </td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-slate-800">
                              {formatTaka(item.totalAmount)}
                            </td>
                            <td className="px-3 py-2">
                              {item.vendorName ? (
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
                              {item.hasReceipt ? (
                                <Paperclip size={13} className="text-emerald-500" />
                              ) : (
                                <ImageOff size={13} className="text-slate-300" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-3 text-[11px] font-bold text-slate-400">
                    Submitted {formatDisplayDateTime(expense.createdAt)} · Last updated{" "}
                    {formatDisplayDateTime(expense.updatedAt)}
                  </p>
                </div>
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
      )}
    </AdminAccountsShell>
  );
}
