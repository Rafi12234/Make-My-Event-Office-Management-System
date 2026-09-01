import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  StatCard,
  SectionCard,
  Money,
  Badge,
  StatusBadge,
  LoadingBlock,
  EmptyBlock,
  Notice,
} from "../../../components/AdminAccountsWidgets";
import {
  loadEmployeeProfile,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { ArrowLeft, Banknote, ClipboardList, Store, Wallet } from "lucide-react";

const TABS = [
  { key: "money", label: "Money In History" },
  { key: "expenses", label: "Expense History" },
  { key: "vendors", label: "Vendor Activity" },
];

export default function AdminAccountsEmployeeProfilePage() {
  const { employeeId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState("money");

  useEffect(() => {
    setIsLoading(true);
    loadEmployeeProfile(employeeId)
      .then(setData)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [employeeId]);

  return (
    <AdminAccountsShell
      title={data?.employee?.fullName || "Employee Accounts"}
      subtitle={data?.employee?.email || "Individual wallet, costs and vendor activity"}
      actions={
        <Link
          to="/admin/accounts/employees"
          className="acc-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          <ArrowLeft size={15} />
          All employees
        </Link>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {isLoading || !data ? (
        <LoadingBlock label="Loading employee accounts…" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              index={0} label="Current wallet"
              value={formatTaka(data.currentBalance)}
              tone={data.currentBalance < 0 ? "rose" : "emerald"}
              icon={Wallet}
            />
            <StatCard
              index={1} label="Total money received"
              value={formatTaka(data.totalMoneyIn)}
              tone="violet"
              icon={Banknote}
            />
            <StatCard
              index={2} label="Total recorded cost"
              value={formatTaka(data.totalRecordedCost)}
              hint="Paid only — To Pay not counted"
              tone="slate"
              icon={ClipboardList}
            />
            <StatCard
              index={3} label="Still payable to vendors"
              value={formatTaka(data.totalStillPayable)}
              tone="amber"
            />
            <StatCard
              index={4} label="Actually paid"
              value={formatTaka(data.totalActuallyPaid)}
              tone="emerald"
            />
            <StatCard index={5} label="Event based costs" value={formatTaka(data.eventCostTotal)} tone="amber" />
            <StatCard index={6} label="Regular costs" value={formatTaka(data.regularCostTotal)} tone="slate" />
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-rose-100 bg-white/80 p-1.5 shadow-sm">
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

          {tab === "money" ? (
            <SectionCard title="Money In history">
              {data.moneyInHistory.length === 0 ? (
                <EmptyBlock label="No Money In entries yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 px-3">Note</th>
                        <th className="pb-2 px-3">Source</th>
                        <th className="pb-2 px-3">Status</th>
                        <th className="pb-2 pl-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.moneyInHistory.map((entry) => (
                        <tr key={entry.id} className={entry.status === "void" ? "opacity-60" : undefined}>
                          <td className="py-2.5 pr-3 font-bold text-slate-700">
                            {formatDisplayDate(entry.receivedDate)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{entry.note || "—"}</td>
                          <td className="px-3 py-2.5">
                            <Badge tone={entry.source === "admin" ? "violet" : "slate"}>
                              {entry.source === "admin"
                                ? `Admin${entry.createdByAdminName ? ` · ${entry.createdByAdminName}` : ""}`
                                : "Employee"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <Money value={entry.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : null}

          {tab === "expenses" ? (
            <SectionCard title="Expense history">
              {data.expenseHistory.length === 0 ? (
                <EmptyBlock label="No expenses submitted yet." />
              ) : (
                <div className="space-y-3">
                  {data.expenseHistory.map((expense) => (
                    <div
                      key={expense.id}
                      className={`acc-stagger-fast acc-lift rounded-2xl border border-slate-200 p-4 ${
                        expense.status === "void" ? "bg-slate-50 opacity-70" : "bg-white"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={expense.costType === "event" ? "amber" : "slate"}>
                            {expense.costType === "event" ? "Event Based" : "Regular"}
                          </Badge>
                          <StatusBadge status={expense.status} />
                          {expense.wasEdited ? <Badge tone="violet">Corrected</Badge> : null}
                          {expense.eventClientName ? (
                            <span className="text-sm font-black text-slate-700">
                              {expense.eventClientName}
                            </span>
                          ) : null}
                        </div>
                        <Link
                          to={`/admin/accounts/expenses/${expense.id}`}
                          className="acc-press inline-block rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                        >
                          Open
                        </Link>
                      </div>

                      <div className="mb-3 grid gap-2 text-xs font-bold sm:grid-cols-3">
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

                      <ul className="space-y-1 text-xs">
                        {expense.items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3">
                            <span className="truncate font-bold text-slate-600">
                              {item.purpose}
                              {item.vendorName ? ` · ${item.vendorName}` : ""}
                            </span>
                            <span className="shrink-0 font-black tabular-nums text-slate-700">
                              {item.quantity} × {formatTaka(item.perQtyAmount)} ={" "}
                              {formatTaka(item.totalAmount)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-3 text-[11px] font-bold text-slate-400">
                        Submitted {formatDisplayDateTime(expense.createdAt)}
                        {expense.wasEdited ? ` · updated ${formatDisplayDateTime(expense.updatedAt)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {tab === "vendors" ? (
            <SectionCard
              title="Vendor activity"
              subtitle="Vendor-linked costs and payments made by this employee"
            >
              {data.vendorItems.length === 0 ? (
                <EmptyBlock label="No vendor activity for this employee." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="pb-2 pr-3">Vendor</th>
                        <th className="pb-2 px-3">Purpose</th>
                        <th className="pb-2 px-3">Cost date</th>
                        <th className="pb-2 px-3">Status</th>
                        <th className="pb-2 pl-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.vendorItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 pr-3">
                            <Link
                              to={`/admin/accounts/vendors/${item.vendorId}`}
                              className="font-black text-slate-700 hover:text-rose-600"
                            >
                              {item.vendorName}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{item.purpose}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-600">
                            {formatDisplayDate(item.costDate)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={item.paymentStatus === "paid" ? "emerald" : "amber"}>
                              {item.paymentStatus === "paid" ? "Paid" : "To Pay"}
                            </Badge>
                          </td>
                          <td className="py-2.5 pl-3 text-right font-black tabular-nums text-slate-700">
                            {formatTaka(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : null}
        </div>
      )}
    </AdminAccountsShell>
  );
}
