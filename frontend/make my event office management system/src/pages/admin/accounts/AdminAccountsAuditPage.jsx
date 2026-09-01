import { useCallback, useEffect, useState } from "react";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Badge,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  Pagination,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadAuditLogs,
  loadReconciliation,
  loadEmployeeWallets,
  formatTaka,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

const EMPTY_FILTERS = {
  employeeId: "",
  entityType: "",
  action: "",
  dateFrom: "",
  dateTo: "",
};

const TABS = [
  { key: "audit", label: "Correction History" },
  { key: "reconciliation", label: "Reconciliation" },
];

export default function AdminAccountsAuditPage() {
  const [tab, setTab] = useState("audit");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    loadAuditLogs({ ...filters, page, pageSize: 50 })
      .then(setResult)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [filters, page]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    loadEmployeeWallets().then(setEmployees).catch(() => {});
    loadReconciliation()
      .then(setReconciliation)
      .catch((error) => setNotice({ type: "error", message: error.message }));
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AdminAccountsShell
      title="Audit & Corrections"
      subtitle="Every admin financial edit, and stored-vs-calculated balance checks"
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-rose-100 bg-white/80 p-1.5 shadow-sm">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`acc-press rounded-xl px-3.5 py-2 text-sm font-bold ${
              tab === entry.key
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow"
                : "text-slate-600 hover:bg-rose-50 hover:text-rose-600"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "audit" ? (
        <>
          <SectionCard title="Filters" className="mb-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <Field label="Record type">
                <select
                  className={inputClass}
                  value={filters.entityType}
                  onChange={(event) => updateFilter("entityType", event.target.value)}
                >
                  <option value="">All types</option>
                  <option value="money_received">Money In</option>
                  <option value="expense">Expense</option>
                  <option value="vendor">Vendor</option>
                </select>
              </Field>
              <Field label="Action">
                <select
                  className={inputClass}
                  value={filters.action}
                  onChange={(event) => updateFilter("action", event.target.value)}
                >
                  <option value="">All actions</option>
                  <option value="create">Created</option>
                  <option value="update">Corrected</option>
                  <option value="void">Voided</option>
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

          <SectionCard
            title="Correction history"
            subtitle="Original values are preserved and never overwritten"
          >
            {isLoading ? (
              <LoadingBlock />
            ) : !result || result.rows.length === 0 ? (
              <EmptyBlock label="No admin changes match these filters." />
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {result.rows.map((log) => (
                    <li key={log.id} className="py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            log.action === "void"
                              ? "rose"
                              : log.action === "create"
                                ? "emerald"
                                : "violet"
                          }
                        >
                          {log.action}
                        </Badge>
                        <Badge tone="slate">{log.entityType.replace("_", " ")}</Badge>
                        <span className="text-sm font-black text-slate-800">
                          #{log.entityId}
                        </span>
                        <span className="text-sm font-bold text-slate-500">
                          by {log.adminName || "Admin"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {formatDisplayDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-slate-600">{log.reason}</p>
                      {log.beforeData && log.afterData ? (
                        <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold">
                          {log.beforeData.amount !== undefined ? (
                            <span className="text-slate-500">
                              Amount: {formatTaka(log.beforeData.amount)} →{" "}
                              <span className="text-slate-800">
                                {formatTaka(log.afterData.amount)}
                              </span>
                            </span>
                          ) : null}
                          {log.beforeData.totalAmount !== undefined ? (
                            <span className="text-slate-500">
                              Total: {formatTaka(log.beforeData.totalAmount)} →{" "}
                              <span className="text-slate-800">
                                {formatTaka(log.afterData.totalAmount)}
                              </span>
                            </span>
                          ) : null}
                          {log.beforeData.walletDeductionAmount !== undefined ? (
                            <span className="text-slate-500">
                              Wallet deduction:{" "}
                              {formatTaka(log.beforeData.walletDeductionAmount)} →{" "}
                              <span className="text-slate-800">
                                {formatTaka(log.afterData.walletDeductionAmount)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  total={result.total}
                  onChange={setPage}
                />
              </>
            )}
          </SectionCard>
        </>
      ) : null}

      {tab === "reconciliation" ? (
        !reconciliation ? (
          <LoadingBlock label="Running reconciliation…" />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                index={0} label="Wallet mismatches"
                value={reconciliation.walletMismatchCount}
                hint="Stored vs recalculated from history"
                tone={reconciliation.walletMismatchCount > 0 ? "rose" : "emerald"}
                icon={reconciliation.walletMismatchCount > 0 ? AlertTriangle : ShieldCheck}
              />
              <StatCard
                index={1} label="Vendor mismatches"
                value={reconciliation.vendorMismatchCount}
                hint="Stored vs recalculated from transactions"
                tone={reconciliation.vendorMismatchCount > 0 ? "rose" : "emerald"}
                icon={reconciliation.vendorMismatchCount > 0 ? AlertTriangle : ShieldCheck}
              />
            </div>

            <ReconciliationTable
              title="Employee wallet reconciliation"
              nameLabel="Employee"
              rows={reconciliation.wallets}
              nameKey="employeeName"
            />
            <ReconciliationTable
              title="Vendor balance reconciliation"
              nameLabel="Vendor"
              rows={reconciliation.vendors}
              nameKey="vendorName"
            />
          </div>
        )
      ) : null}
    </AdminAccountsShell>
  );
}

function ReconciliationTable({ title, nameLabel, rows, nameKey }) {
  return (
    <SectionCard title={title} subtitle="Stored balance compared against full transaction history">
      {rows.length === 0 ? (
        <EmptyBlock label="Nothing to reconcile yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">{nameLabel}</th>
                <th className="pb-2 px-3 text-right">Stored</th>
                <th className="pb-2 px-3 text-right">Calculated</th>
                <th className="pb-2 px-3 text-right">Difference</th>
                <th className="pb-2 pl-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={index} className={row.matches ? undefined : "bg-rose-50/50"}>
                  <td className="py-2.5 pr-3 font-black text-slate-800">{row[nameKey]}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700">
                    {formatTaka(row.stored)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700">
                    {formatTaka(row.calculated)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-black tabular-nums ${
                      row.matches ? "text-slate-400" : "text-rose-600"
                    }`}
                  >
                    {formatTaka(row.difference)}
                  </td>
                  <td className="py-2.5 pl-3">
                    {row.matches ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600">
                        <CheckCircle2 size={13} />
                        Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-600">
                        <AlertTriangle size={13} />
                        Balance mismatch
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
