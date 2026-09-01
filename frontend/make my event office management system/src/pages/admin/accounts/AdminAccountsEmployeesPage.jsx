import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Money,
  Badge,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  Modal,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadEmployeeWallets,
  addMoneyToEmployee,
  exportRowsToCsv,
  formatTaka,
} from "../../../services/adminAccountsService";
import { Download, Loader2, Plus, Search, Wallet } from "lucide-react";

export default function AdminAccountsEmployeesPage() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");
  const [showAddMoney, setShowAddMoney] = useState(false);

  function refresh() {
    setIsLoading(true);
    loadEmployeeWallets()
      .then(setRows)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.fullName.toLowerCase().includes(term) ||
        (row.email || "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      wallet: rows.reduce((sum, row) => sum + row.currentBalance, 0),
      moneyIn: rows.reduce((sum, row) => sum + row.totalMoneyIn, 0),
      stillPayable: rows.reduce((sum, row) => sum + row.totalStillPayable, 0),
      paidToVendors: rows.reduce((sum, row) => sum + row.totalPaidToVendors, 0),
      expenses: rows.reduce((sum, row) => sum + row.totalExpenses, 0),
      negative: rows.filter((row) => row.currentBalance < 0).length,
    }),
    [rows],
  );

  function handleExport() {
    exportRowsToCsv(
      "employee-wallets.csv",
      [
        { label: "Employee", value: (row) => row.fullName },
        { label: "Email", value: (row) => row.email },
        { label: "Current Wallet", value: (row) => row.currentBalance },
        { label: "Total Money In", value: (row) => row.totalMoneyIn },
        { label: "Still Payable", value: (row) => row.totalStillPayable },
        { label: "Paid to Vendors", value: (row) => row.totalPaidToVendors },
        { label: "Expenses", value: (row) => row.totalExpenses },
      ],
      filtered,
    );
  }

  return (
    <AdminAccountsShell
      title="Employee Wallets"
      subtitle="Every employee, including those with no activity yet"
      actions={
        <>
          <button
            type="button"
            onClick={handleExport}
            className="acc-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            <Download size={15} />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowAddMoney(true)}
            className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30"
          >
            <Plus size={15} />
            Add Money
          </button>
        </>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard index={0} label="Total wallet balance" value={formatTaka(totals.wallet)} tone="violet" icon={Wallet} />
        <StatCard index={1} label="Total money in" value={formatTaka(totals.moneyIn)} tone="emerald" />
        <StatCard index={2} label="Still payable to vendors" value={formatTaka(totals.stillPayable)} tone="amber" />
        <StatCard index={3} label="Paid to vendors" value={formatTaka(totals.paidToVendors)} tone="slate" />
        <StatCard index={4} label="Total expenses" value={formatTaka(totals.expenses)} tone="slate" />
        <StatCard
          index={5} label="Negative wallets"
          value={totals.negative}
          tone={totals.negative > 0 ? "rose" : "slate"}
        />
      </div>

      <SectionCard
        title="All employees"
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-8`}
              placeholder="Search employee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      >
        {isLoading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyBlock label="No employees found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">Employee</th>
                  <th className="pb-2 px-3 text-right">Current Wallet</th>
                  <th className="pb-2 px-3 text-right">Total Money In</th>
                  <th className="pb-2 px-3 text-right">Still Payable</th>
                  <th className="pb-2 px-3 text-right">Paid to Vendors</th>
                  <th className="pb-2 px-3 text-right">Expenses</th>
                  <th className="pb-2 pl-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr
                    key={row.employeeId}
                    className={row.currentBalance < 0 ? "bg-rose-50/40" : undefined}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800">{row.fullName}</span>
                        {!row.isActive ? <Badge tone="slate">Inactive</Badge> : null}
                        {row.currentBalance < 0 ? <Badge tone="rose">Negative</Badge> : null}
                      </div>
                      <p className="text-[11px] font-bold text-slate-400">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Money value={row.currentBalance} />
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-600">
                      {formatTaka(row.totalMoneyIn)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-amber-600">
                      {formatTaka(row.totalStillPayable)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600">
                      {formatTaka(row.totalPaidToVendors)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-600">
                      {formatTaka(row.totalExpenses)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Link
                        to={`/admin/accounts/employees/${row.employeeId}`}
                        className="acc-press inline-block rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <AddMoneyModal
        open={showAddMoney}
        employees={rows}
        onClose={() => setShowAddMoney(false)}
        onSaved={(message) => {
          setShowAddMoney(false);
          setNotice({ type: "success", message });
          refresh();
        }}
        onError={(message) => setNotice({ type: "error", message })}
      />
    </AdminAccountsShell>
  );
}

// Admin-entered Money In lands in the same history the employee sees,
// tagged as added by Admin, and increases the wallet automatically.
function AddMoneyModal({ open, employees, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    employeeId: "",
    amount: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await addMoneyToEmployee({
        employeeId: form.employeeId,
        amount: Number(form.amount),
        receivedDate: form.receivedDate,
        note: form.note,
      });
      const employee = employees.find((row) => row.employeeId === form.employeeId);
      onSaved(`${formatTaka(Number(form.amount))} added to ${employee?.fullName || "employee"}.`);
      setForm({
        employeeId: "",
        amount: "",
        receivedDate: new Date().toISOString().slice(0, 10),
        note: "",
      });
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Add money to employee wallet" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Employee">
          <select
            required
            className={inputClass}
            value={form.employeeId}
            onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
          >
            <option value="">Select an employee</option>
            {employees.map((row) => (
              <option key={row.employeeId} value={row.employeeId}>
                {row.fullName}
              </option>
            ))}
          </select>
        </Field>

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

        <Field label="Note (optional)">
          <input
            className={inputClass}
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="What is this money for?"
          />
        </Field>

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
            disabled={busy}
            className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Add Money
          </button>
        </div>
      </form>
    </Modal>
  );
}
