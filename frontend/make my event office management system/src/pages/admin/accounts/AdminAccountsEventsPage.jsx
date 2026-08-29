import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadEventCostOverview,
  loadRangeSummary,
  loadEmployeeWallets,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
} from "../../../services/adminAccountsService";
import { CalendarRange, Download, Search } from "lucide-react";

export default function AdminAccountsEventsPage() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState([]);
  const [range, setRange] = useState({
    dateFrom: "",
    dateTo: "",
    employeeId: "",
  });
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    loadEventCostOverview()
      .then(setRows)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
    loadEmployeeWallets().then(setEmployees).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.clientName.toLowerCase().includes(term) ||
        String(row.eventDate || "").includes(term) ||
        row.employees.some((name) => name.toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      recorded: rows.reduce((sum, row) => sum + row.recordedCost, 0),
      paid: rows.reduce((sum, row) => sum + row.actuallyPaid, 0),
      toPay: rows.reduce((sum, row) => sum + row.stillToPay, 0),
    }),
    [rows],
  );

  async function handleLoadSummary(event) {
    event.preventDefault();
    setSummaryLoading(true);
    try {
      setSummary(await loadRangeSummary(range));
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleExport() {
    exportRowsToCsv(
      "event-costs.csv",
      [
        { label: "Client", value: (row) => row.clientName },
        { label: "Event Date", value: (row) => row.eventDate || "" },
        { label: "Recorded Cost", value: (row) => row.recordedCost },
        { label: "Actually Paid", value: (row) => row.actuallyPaid },
        { label: "Still To Pay", value: (row) => row.stillToPay },
        { label: "Vendor Cost", value: (row) => row.vendorCost },
        { label: "Submissions", value: (row) => row.expenseCount },
        { label: "Employees", value: (row) => row.employees.join(" / ") },
      ],
      filtered,
    );
  }

  return (
    <AdminAccountsShell
      title="Event Cost Overview"
      subtitle="Costs grouped by confirmed event, plus company financial summaries"
      actions={
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
        >
          <Download size={15} />
          Export
        </button>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total event recorded cost"
          value={formatTaka(totals.recorded)}
          tone="slate"
          icon={CalendarRange}
        />
        <StatCard label="Actually paid" value={formatTaka(totals.paid)} tone="emerald" />
        <StatCard label="Still to pay" value={formatTaka(totals.toPay)} tone="amber" />
      </div>

      <SectionCard
        title="Financial summary by date range"
        subtitle="Leave employee blank for a company-wide summary"
        className="mb-6"
      >
        <form onSubmit={handleLoadSummary} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Date from">
            <input
              required
              type="date"
              className={inputClass}
              value={range.dateFrom}
              onChange={(event) => setRange((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </Field>
          <Field label="Date to">
            <input
              required
              type="date"
              className={inputClass}
              value={range.dateTo}
              onChange={(event) => setRange((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </Field>
          <Field label="Employee (optional)">
            <select
              className={inputClass}
              value={range.employeeId}
              onChange={(event) => setRange((prev) => ({ ...prev, employeeId: event.target.value }))}
            >
              <option value="">Whole company</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={summaryLoading}
              className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow disabled:opacity-50"
            >
              {summaryLoading ? "Loading…" : "Generate summary"}
            </button>
          </div>
        </form>

        {summary ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Money given to employees"
              value={formatTaka(summary.moneyGivenToEmployees)}
              tone="violet"
            />
            <StatCard label="Recorded cost" value={formatTaka(summary.recordedCost)} tone="slate" />
            <StatCard label="Actually paid" value={formatTaka(summary.actuallyPaid)} tone="emerald" />
            <StatCard label="Still to pay" value={formatTaka(summary.stillToPay)} tone="amber" />
            <StatCard label="Event costs" value={formatTaka(summary.eventCost)} tone="slate" />
            <StatCard label="Regular costs" value={formatTaka(summary.regularCost)} tone="slate" />
            <StatCard label="Vendor billed" value={formatTaka(summary.vendorBilled)} tone="slate" />
            <StatCard label="Vendor paid" value={formatTaka(summary.vendorPaid)} tone="emerald" />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Costs by event"
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-8`}
              placeholder="Search client, date or employee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      >
        {isLoading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyBlock label="No event costs recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">Client</th>
                  <th className="pb-2 px-3">Event date</th>
                  <th className="pb-2 px-3">Employees</th>
                  <th className="pb-2 px-3 text-right">Recorded</th>
                  <th className="pb-2 px-3 text-right">Paid</th>
                  <th className="pb-2 px-3 text-right">To Pay</th>
                  <th className="pb-2 px-3 text-right">Vendor cost</th>
                  <th className="pb-2 pl-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.linkedRowKey || row.clientName}>
                    <td className="py-3 pr-3 font-black text-slate-800">{row.clientName}</td>
                    <td className="px-3 py-3 font-bold text-slate-600">
                      {formatDisplayDate(row.eventDate)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-slate-600">
                      {row.employees.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-black tabular-nums text-slate-800">
                      {formatTaka(row.recordedCost)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600">
                      {formatTaka(row.actuallyPaid)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-amber-600">
                      {formatTaka(row.stillToPay)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-600">
                      {formatTaka(row.vendorCost)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {row.linkedRowKey ? (
                        <Link
                          to={`/admin/accounts/expenses?linkedRowKey=${row.linkedRowKey}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          Costs
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AdminAccountsShell>
  );
}
