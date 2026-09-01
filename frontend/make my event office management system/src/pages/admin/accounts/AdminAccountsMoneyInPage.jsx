import { useCallback, useEffect, useState } from "react";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Money,
  Badge,
  StatusBadge,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  Pagination,
  Modal,
  ReasonModal,
  ReasonPicker,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadMoneyIn,
  loadEmployeeWallets,
  updateMoneyIn,
  voidMoneyIn,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { Ban, Download, Loader2, Pencil } from "lucide-react";

const EMPTY_FILTERS = {
  employeeId: "",
  source: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  sort: "newest",
};

export default function AdminAccountsMoneyInPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    loadMoneyIn({ ...filters, page, pageSize: 50 })
      .then(setResult)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [filters, page]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    loadEmployeeWallets()
      .then(setEmployees)
      .catch(() => {});
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleVoid(reason) {
    setBusy(true);
    try {
      const response = await voidMoneyIn(voiding.id, reason);
      setNotice({
        type: "success",
        message: `Entry voided. Wallet adjusted by ${formatTaka(response.walletChange ?? 0)}.`,
      });
      setVoiding(null);
      refresh();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    exportRowsToCsv(
      "money-in.csv",
      [
        { label: "Employee", value: (row) => row.employeeName },
        { label: "Received Date", value: (row) => row.receivedDate },
        { label: "Amount", value: (row) => row.amount },
        { label: "Note", value: (row) => row.note },
        { label: "Source", value: (row) => row.source },
        { label: "Added By Admin", value: (row) => row.createdByAdminName || "" },
        { label: "Status", value: (row) => row.status },
        { label: "Submitted", value: (row) => row.createdAt },
      ],
      result?.rows || [],
    );
  }

  return (
    <AdminAccountsShell
      title="All Money In"
      subtitle="Every wallet top-up across the company"
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
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <StatCard
            index={0} label="Filtered active total"
            value={formatTaka(result.filteredActiveTotal)}
            hint="Voided entries excluded"
            tone="violet"
          />
          <StatCard index={1} label="Records matched" value={result.total} tone="slate" />
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
          <Field label="Source">
            <select
              className={inputClass}
              value={filters.source}
              onChange={(event) => updateFilter("source", event.target.value)}
            >
              <option value="">Employee & Admin</option>
              <option value="employee">Employee entered</option>
              <option value="admin">Admin entered</option>
            </select>
          </Field>
          <Field label="Status">
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
          <Field label="Search note" className="sm:col-span-2">
            <input
              className={inputClass}
              placeholder="Search inside notes"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
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

      <SectionCard title="Money In records">
        {isLoading ? (
          <LoadingBlock />
        ) : !result || result.rows.length === 0 ? (
          <EmptyBlock label="No Money In records match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-3">Employee</th>
                    <th className="pb-2 px-3">Received</th>
                    <th className="pb-2 px-3">Note</th>
                    <th className="pb-2 px-3">Source</th>
                    <th className="pb-2 px-3">Status</th>
                    <th className="pb-2 px-3 text-right">Amount</th>
                    <th className="pb-2 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row) => (
                    <tr key={row.id} className={row.status === "void" ? "opacity-60" : undefined}>
                      <td className="py-3 pr-3 font-black text-slate-800">
                        {row.employeeName || "Unknown"}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-600">
                        {formatDisplayDate(row.receivedDate)}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate-600">
                        {row.note || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={row.source === "admin" ? "violet" : "slate"}>
                          {row.source === "admin" ? "Admin" : "Employee"}
                        </Badge>
                        {row.createdByAdminName ? (
                          <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                            {row.createdByAdminName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={row.status} />
                        {row.wasEdited && row.status === "active" ? (
                          <p className="mt-0.5 text-[10px] font-bold text-violet-500">Corrected</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Money value={row.amount} />
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {row.status === "active" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                              title="Edit record"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoiding(row)}
                              className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                              title="Void record"
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            {row.voidedByName ? `by ${row.voidedByName}` : "voided"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      <EditMoneyInModal
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null);
          setNotice({ type: "success", message });
          refresh();
        }}
        onError={(message) => setNotice({ type: "error", message })}
      />

      <ReasonModal
        open={Boolean(voiding)}
        title="Void this Money In entry?"
        description={
          voiding
            ? `${formatTaka(voiding.amount)} will be reversed from ${voiding.employeeName}'s wallet. The record stays visible as voided.`
            : ""
        }
        confirmLabel="Void entry"
        busy={busy}
        onCancel={() => setVoiding(null)}
        onConfirm={handleVoid}
      />
    </AdminAccountsShell>
  );
}

// Correcting an amount never touches the wallet directly — the backend
// moves the wallet by exactly the difference.
function EditMoneyInModal({ entry, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ amount: "", receivedDate: "", note: "" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setForm({
      amount: String(entry.amount),
      receivedDate: entry.receivedDate,
      note: entry.note || "",
    });
    setReason("");
  }, [entry]);

  if (!entry) return null;

  const difference = Number(form.amount || 0) - entry.amount;

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await updateMoneyIn(entry.id, {
        amount: Number(form.amount),
        receivedDate: form.receivedDate,
        note: form.note,
        reason,
      });
      onSaved(
        `Record updated. Wallet adjusted by ${formatTaka(response.walletChange ?? 0)}.`,
      );
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Correct Money In record" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
          {entry.employeeName} · originally {formatTaka(entry.amount)} on{" "}
          {formatDisplayDate(entry.receivedDate)} · entered {formatDisplayDateTime(entry.createdAt)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
          </Field>
          <Field label="Received date">
            <input
              required
              type="date"
              className={inputClass}
              value={form.receivedDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, receivedDate: event.target.value }))
              }
            />
          </Field>
        </div>

        <Field label="Note">
          <input
            className={inputClass}
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        </Field>

        {difference !== 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-700">
            <p>Old amount: {formatTaka(entry.amount)}</p>
            <p>New amount: {formatTaka(Number(form.amount || 0))}</p>
            <p className="mt-1">
              Employee wallet change:{" "}
              <span className={difference > 0 ? "text-emerald-700" : "text-rose-700"}>
                {difference > 0 ? "+" : ""}
                {formatTaka(difference)}
              </span>
            </p>
          </div>
        ) : null}

        <ReasonPicker value={reason} onChange={setReason} />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="acc-press rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || reason.trim().length < 3}
            className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Save correction
          </button>
        </div>
      </form>
    </Modal>
  );
}
