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
  StatCard,
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
import { Download, ImageOff, Paperclip } from "lucide-react";

const EMPTY_FILTERS = {
  employeeId: "",
  costType: "",
  vendorId: "",
  paymentStatus: "",
  status: "active",
  paymentSource: "",
  dateField: "cost",
  dateFrom: "",
  dateTo: "",
  purposeSearch: "",
  eventSearch: "",
  minAmount: "",
  maxAmount: "",
  receipt: "",
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

      {result ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            index={0} label="Recorded cost"
            value={formatTaka(result.filteredTotals.recordedCost)}
            hint="Includes unpaid vendor bills"
            tone="slate"
          />
          <StatCard
            index={1} label="Actually paid"
            value={formatTaka(result.filteredTotals.actuallyPaid)}
            tone="emerald"
          />
          <StatCard
            index={2} label="Still to pay"
            value={formatTaka(result.filteredTotals.stillToPay)}
            tone="amber"
          />
          <StatCard index={3} label="Records matched" value={result.total} tone="violet" />
        </div>
      ) : null}

      <SectionCard title="Filters" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

          <Field label="Purpose search">
            <input
              className={inputClass}
              placeholder="Search purpose"
              value={filters.purposeSearch}
              onChange={(event) => updateFilter("purposeSearch", event.target.value)}
            />
          </Field>
          <Field label="Client / event search">
            <input
              className={inputClass}
              placeholder="Search client name"
              value={filters.eventSearch}
              onChange={(event) => updateFilter("eventSearch", event.target.value)}
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
              <option value="">Active & Void</option>
              <option value="active">Active only</option>
              <option value="void">Void only</option>
            </select>
          </Field>
          <Field label="Paid from">
            <select
              className={inputClass}
              value={filters.paymentSource}
              onChange={(event) => updateFilter("paymentSource", event.target.value)}
            >
              <option value="">Any source</option>
              <option value="employee_wallet">Employee wallet</option>
              <option value="company">Company / Admin direct</option>
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            setFilters(EMPTY_FILTERS);
            setPage(1);
          }}
          className="mt-3 acc-press rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          Reset filters
        </button>
      </SectionCard>

      <SectionCard title="Expense records">
        {isLoading ? (
          <LoadingBlock />
        ) : !result || result.rows.length === 0 ? (
          <EmptyBlock label="No expenses match these filters." />
        ) : (
          <>
            <div className="space-y-3">
              {result.rows.map((expense) => (
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
                      Paid:{" "}
                      <span className="text-emerald-600">
                        {formatTaka(expense.walletDeductionAmount)}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      To Pay:{" "}
                      <span className="text-amber-600">
                        {formatTaka(expense.vendorPayableAmount)}
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
    </AdminAccountsShell>
  );
}
