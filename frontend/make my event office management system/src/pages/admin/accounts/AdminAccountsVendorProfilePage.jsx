import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  SectionCard,
  Badge,
  Money,
  Field,
  inputClass,
  LoadingBlock,
  EmptyBlock,
  Notice,
  Modal,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadVendorProfile,
  loadVendorOutstandingItems,
  addDirectVendorCost,
  addDirectVendorPayment,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { ArrowLeft, Banknote, Download, Loader2, Plus, Store } from "lucide-react";

const EMPTY_TXN_FILTERS = {
  dateFrom: "",
  dateTo: "",
  entryKind: "",
  paymentStatus: "",
  paymentSource: "",
  costType: "",
  employee: "",
};

export default function AdminAccountsVendorProfilePage() {
  const { vendorId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [filters, setFilters] = useState(EMPTY_TXN_FILTERS);
  const [modal, setModal] = useState(null);

  function refresh() {
    setIsLoading(true);
    loadVendorProfile(vendorId)
      .then(setData)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, [vendorId]);

  const transactions = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((entry) => {
      if (filters.entryKind && entry.entryKind !== filters.entryKind) return false;
      if (filters.paymentStatus && entry.paymentStatus !== filters.paymentStatus) return false;
      if (filters.paymentSource && entry.paymentSource !== filters.paymentSource) return false;
      if (filters.costType && entry.costType !== filters.costType) return false;
      if (filters.dateFrom && entry.costDate < filters.dateFrom) return false;
      if (filters.dateTo && entry.costDate > filters.dateTo) return false;
      if (filters.employee) {
        const name = (entry.employeeName || entry.createdByAdminName || "").toLowerCase();
        if (!name.includes(filters.employee.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, filters]);

  function handleExport() {
    exportRowsToCsv(
      `vendor-${data?.vendor?.name || vendorId}.csv`,
      [
        { label: "Cost Date", value: (row) => row.costDate },
        { label: "Purpose", value: (row) => row.purpose },
        { label: "Entry Kind", value: (row) => row.entryKind },
        { label: "Payment Status", value: (row) => row.paymentStatus },
        { label: "Amount", value: (row) => row.amount },
        { label: "Paid From", value: (row) => row.paymentSource },
        { label: "Employee", value: (row) => row.employeeName || row.createdByAdminName || "" },
        { label: "Cost Type", value: (row) => row.costType || "" },
        { label: "Event/Client", value: (row) => row.eventClientName || "" },
        { label: "Status", value: (row) => row.expenseStatus },
      ],
      transactions,
    );
  }

  return (
    <AdminAccountsShell
      title={data?.vendor?.name || "Vendor"}
      subtitle={data?.vendor?.category || "Vendor ledger and transaction history"}
      actions={
        <>
          <Link
            to="/admin/accounts/vendors"
            className="acc-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            <ArrowLeft size={15} />
            All vendors
          </Link>
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
            onClick={() => setModal("cost")}
            className="acc-press inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-black text-rose-600 hover:bg-rose-50"
          >
            <Plus size={15} />
            Company Cost
          </button>
          <button
            type="button"
            onClick={() => setModal("payment")}
            className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30"
          >
            <Banknote size={15} />
            Company Payment
          </button>
        </>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {isLoading || !data ? (
        <LoadingBlock label="Loading vendor…" />
      ) : (
        <div className="space-y-6">
          {/* Bills, payments and the still-open balance are shown separately —
              paying an existing bill is never re-counted as a new cost. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} label="Total bills" value={formatTaka(data.totalBilled)} tone="slate" icon={Store} />
            <StatCard index={1} label="Total paid" value={formatTaka(data.totalPaid)} tone="emerald" />
            <StatCard index={2} label="Still to pay" value={formatTaka(data.stillToPay)} tone="amber" />
            <StatCard
              index={3} label="Current balance"
              value={formatTaka(data.currentBalance)}
              hint={data.currentBalance < 0 ? "We owe this vendor" : "Advance / settled"}
              tone={data.currentBalance < 0 ? "rose" : "emerald"}
            />
          </div>

          {data.vendor.contactName || data.vendor.contactPhone || data.vendor.notes ? (
            <SectionCard title="Vendor details">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-400">Contact</p>
                  <p className="font-bold text-slate-700">{data.vendor.contactName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-400">Phone</p>
                  <p className="font-bold text-slate-700">{data.vendor.contactPhone || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-400">Email</p>
                  <p className="font-bold text-slate-700">{data.vendor.contactEmail || "—"}</p>
                </div>
                {data.vendor.notes ? (
                  <div className="sm:col-span-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">Notes</p>
                    <p className="font-bold text-slate-700">{data.vendor.notes}</p>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Transaction filters">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Date from">
                <input
                  type="date"
                  className={inputClass}
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                  }
                />
              </Field>
              <Field label="Date to">
                <input
                  type="date"
                  className={inputClass}
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                  }
                />
              </Field>
              <Field label="Entry kind">
                <select
                  className={inputClass}
                  value={filters.entryKind}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, entryKind: event.target.value }))
                  }
                >
                  <option value="">Cost & Payment</option>
                  <option value="cost">Cost (new bill)</option>
                  <option value="payment">Payment (settling)</option>
                </select>
              </Field>
              <Field label="Payment status">
                <select
                  className={inputClass}
                  value={filters.paymentStatus}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))
                  }
                >
                  <option value="">Paid & To Pay</option>
                  <option value="paid">Paid</option>
                  <option value="to_pay">To Pay</option>
                </select>
              </Field>
              <Field label="Paid from">
                <select
                  className={inputClass}
                  value={filters.paymentSource}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, paymentSource: event.target.value }))
                  }
                >
                  <option value="">Any source</option>
                  <option value="employee_wallet">Employee wallet</option>
                  <option value="company">Company / Admin direct</option>
                </select>
              </Field>
              <Field label="Cost type">
                <select
                  className={inputClass}
                  value={filters.costType}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, costType: event.target.value }))
                  }
                >
                  <option value="">Event & Regular</option>
                  <option value="event">Event based</option>
                  <option value="regular">Regular</option>
                </select>
              </Field>
              <Field label="Employee / Admin" className="sm:col-span-2">
                <input
                  className={inputClass}
                  placeholder="Search by name"
                  value={filters.employee}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, employee: event.target.value }))
                  }
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_TXN_FILTERS)}
              className="mt-3 acc-press rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            >
              Reset filters
            </button>
          </SectionCard>

          <SectionCard title="Transaction history" subtitle={`${transactions.length} record(s)`}>
            {transactions.length === 0 ? (
              <EmptyBlock label="No transactions match these filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 px-3">Purpose</th>
                      <th className="pb-2 px-3">Kind</th>
                      <th className="pb-2 px-3">Paid from</th>
                      <th className="pb-2 px-3">Responsible</th>
                      <th className="pb-2 px-3">Event</th>
                      <th className="pb-2 pl-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((entry) => (
                      <tr
                        key={entry.id}
                        className={entry.expenseStatus === "void" ? "opacity-50" : undefined}
                      >
                        <td className="py-3 pr-3 font-bold text-slate-600">
                          {formatDisplayDate(entry.costDate)}
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-700">{entry.purpose}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={entry.entryKind === "payment" ? "emerald" : "amber"}>
                              {entry.entryKind === "payment" ? "Payment" : "Cost"}
                            </Badge>
                            {entry.entryKind === "payment" && !entry.settlesItemId ? (
                              <Badge tone="sky">Instant Buy</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={entry.paymentSource === "company" ? "violet" : "sky"}>
                            {entry.paymentSource === "company" ? "Company" : "Wallet"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {entry.employeeId ? (
                            <Link
                              to={`/admin/accounts/employees/${entry.employeeId}`}
                              className="font-bold hover:text-rose-600"
                            >
                              {entry.employeeName}
                            </Link>
                          ) : (
                            entry.createdByAdminName || "Admin"
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500">{entry.eventClientName || "—"}</td>
                        <td className="py-3 pl-3 text-right font-black tabular-nums text-slate-800">
                          {formatTaka(entry.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Admin changes" subtitle="Corrections made to this vendor">
            {data.auditLogs.length === 0 ? (
              <EmptyBlock label="No admin changes recorded." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.auditLogs.map((log) => (
                  <li key={log.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={log.action === "void" ? "rose" : "violet"}>{log.action}</Badge>
                      <span className="text-sm font-black text-slate-700">
                        {log.adminName || "Admin"}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {formatDisplayDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-600">{log.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      <DirectEntryModal
        mode={modal}
        vendorId={vendorId}
        vendorName={data?.vendor?.name}
        onClose={() => setModal(null)}
        onSaved={(message) => {
          setModal(null);
          setNotice({ type: "success", message });
          refresh();
        }}
        onError={(message) => setNotice({ type: "error", message })}
      />
    </AdminAccountsShell>
  );
}

// Admin direct vendor cost/payment: recorded against the company, never
// deducted from any employee wallet.
function DirectEntryModal({ mode, vendorId, vendorName, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    amount: "",
    costDate: new Date().toISOString().slice(0, 10),
    purpose: "",
    paymentStatus: "to_pay",
    settlesItemId: "",
  });
  const [outstandingBills, setOutstandingBills] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setForm({
      amount: "",
      costDate: new Date().toISOString().slice(0, 10),
      purpose: "",
      paymentStatus: mode === "payment" ? "paid" : "to_pay",
      settlesItemId: "",
    });
    loadVendorOutstandingItems(vendorId)
      .then(setOutstandingBills)
      .catch(() => setOutstandingBills([]));
  }, [mode, vendorId]);

  if (!mode) return null;
  const isPayment = mode === "payment";

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        amount: Number(form.amount),
        costDate: form.costDate,
        purpose: form.purpose,
        paymentStatus: form.paymentStatus,
        settlesItemId: form.paymentStatus === "paid" ? form.settlesItemId || null : null,
      };
      if (isPayment) {
        await addDirectVendorPayment(vendorId, payload);
        onSaved(`${formatTaka(Number(form.amount))} paid to ${vendorName} from company funds.`);
      } else {
        await addDirectVendorCost(vendorId, payload);
        onSaved(`Company cost of ${formatTaka(Number(form.amount))} recorded for ${vendorName}.`);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={isPayment ? "Direct vendor payment" : "Direct vendor cost"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs font-bold text-violet-700">
          {vendorName} · Source: Company / Admin. No employee wallet will be deducted.
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
          <Field label="Date">
            <input
              required
              type="date"
              className={inputClass}
              value={form.costDate}
              onChange={(event) => setForm((prev) => ({ ...prev, costDate: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="Purpose">
          <input
            className={inputClass}
            placeholder={isPayment ? "Settling outstanding bill" : "What is this cost for?"}
            value={form.purpose}
            onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
          />
        </Field>

        {!isPayment ? (
          <Field label="Status">
            <select
              className={inputClass}
              value={form.paymentStatus}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, paymentStatus: event.target.value }))
              }
            >
              <option value="to_pay">To Pay (new liability)</option>
              <option value="paid">Paid (settled immediately)</option>
            </select>
          </Field>
        ) : null}

        {form.paymentStatus === "paid" ? (
          <Field label="Which bill is this settling? (optional)">
            <select
              className={inputClass}
              value={form.settlesItemId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, settlesItemId: event.target.value }))
              }
            >
              <option value="">Not settling anything (instant/unrelated payment)</option>
              {outstandingBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.purpose} — {formatTaka(bill.stillOwed)} still owed
                  {bill.eventClientName ? ` (${bill.eventClientName})` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

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
            {isPayment ? "Record payment" : "Record cost"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
