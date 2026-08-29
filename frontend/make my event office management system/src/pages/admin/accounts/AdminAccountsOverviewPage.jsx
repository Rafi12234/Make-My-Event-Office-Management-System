import { useEffect, useState } from "react";
import { Link } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  StatCard,
  SectionCard,
  Money,
  Badge,
  LoadingBlock,
  EmptyBlock,
  Notice,
} from "../../../components/AdminAccountsWidgets";
import {
  loadOverview,
  loadActivityFeed,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  Store,
  TrendingDown,
  Wallet,
} from "lucide-react";

export default function AdminAccountsOverviewPage() {
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    Promise.all([loadOverview(), loadActivityFeed()])
      .then(([overview, activity]) => {
        setData(overview);
        setFeed(activity);
      })
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AdminAccountsShell
      title="Accounts Overview"
      subtitle="Company-wide wallet, expense and vendor position"
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {isLoading || !data ? (
        <LoadingBlock label="Loading accounts overview…" />
      ) : (
        <div className="space-y-6">
          {/* Recorded cost, money actually paid and amounts still payable are
              shown separately on purpose — never merged into one figure. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Given to employees"
              value={formatTaka(data.totalMoneyGivenToEmployees)}
              hint="All active Money In entries"
              tone="violet"
              icon={Banknote}
            />
            <StatCard
              label="Employee wallet balance"
              value={formatTaka(data.totalWalletBalance)}
              hint="Sum of all current wallets"
              tone={data.totalWalletBalance < 0 ? "rose" : "emerald"}
              icon={Wallet}
            />
            <StatCard
              label="Total recorded cost"
              value={formatTaka(data.totalRecordedCost)}
              hint="Includes unpaid vendor bills"
              tone="slate"
              icon={ClipboardList}
            />
            <StatCard
              label="Actually paid out"
              value={formatTaka(data.totalActuallyPaid)}
              hint="Money that really left wallets"
              tone="emerald"
              icon={Banknote}
            />
            <StatCard
              label="Still payable to vendors"
              value={formatTaka(data.totalStillPayableToVendors)}
              hint="Open To Pay balances"
              tone="amber"
              icon={Store}
            />
            <StatCard
              label="Negative wallets"
              value={data.negativeWalletCount}
              hint="Employees currently overdrawn"
              tone={data.negativeWalletCount > 0 ? "rose" : "slate"}
              icon={TrendingDown}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Negative wallets"
              subtitle="Employees who have spent beyond what they received"
            >
              {data.negativeWallets.length === 0 ? (
                <EmptyBlock label="No employee is overdrawn." />
              ) : (
                <ul className="space-y-2">
                  {data.negativeWallets.map((wallet) => (
                    <li
                      key={wallet.employeeId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2"
                    >
                      <Link
                        to={`/admin/accounts/employees/${wallet.employeeId}`}
                        className="text-sm font-black text-slate-700 hover:text-rose-600"
                      >
                        {wallet.employeeName}
                      </Link>
                      <Money value={wallet.currentBalance} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Vendor dues" subtitle="Highest outstanding To Pay first">
              {data.vendorDues.length === 0 ? (
                <EmptyBlock label="No vendor has an outstanding balance." />
              ) : (
                <ul className="space-y-2">
                  {data.vendorDues.map((vendor) => (
                    <li
                      key={vendor.vendorId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2"
                    >
                      <Link
                        to={`/admin/accounts/vendors/${vendor.vendorId}`}
                        className="text-sm font-black text-slate-700 hover:text-rose-600"
                      >
                        {vendor.vendorName}
                      </Link>
                      <span className="font-black tabular-nums text-amber-700">
                        {formatTaka(vendor.amountPayable)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Recent Money In" subtitle="Latest wallet top-ups">
              {data.recentMoneyIn.length === 0 ? (
                <EmptyBlock label="No Money In entries yet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentMoneyIn.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-700">
                          {entry.employeeName || "Unknown"}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {formatDisplayDate(entry.receivedDate)}
                          {entry.source === "admin" ? " · added by Admin" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.status === "void" ? <Badge tone="rose">Void</Badge> : null}
                        <Money value={entry.amount} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recent vendor activity" subtitle="Costs and payments across vendors">
              {data.recentVendorActivity.length === 0 ? (
                <EmptyBlock label="No vendor activity yet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentVendorActivity.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-700">
                          {entry.vendorName}
                        </p>
                        <p className="truncate text-[11px] font-bold text-slate-400">
                          {entry.purpose} ·{" "}
                          {entry.paymentSource === "company" ? "Company" : entry.employeeName || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={entry.paymentStatus === "paid" ? "emerald" : "amber"}>
                          {entry.paymentStatus === "paid" ? "Paid" : "To Pay"}
                        </Badge>
                        <span className="font-black tabular-nums text-slate-700">
                          {formatTaka(entry.amount)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Company activity feed" subtitle="Everything happening across Accounts">
            {feed.length === 0 ? (
              <EmptyBlock label="No activity recorded yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {feed.map((entry, index) => (
                  <li key={`${entry.kind}-${index}`} className="flex items-start gap-3 py-2.5">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        entry.kind === "correction"
                          ? "bg-amber-400"
                          : entry.kind === "money_in"
                            ? "bg-violet-400"
                            : "bg-rose-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-700">
                        <span className="font-black">{entry.actor}</span> {entry.detail}
                        {entry.subject ? (
                          <span className="font-black"> {entry.subject}</span>
                        ) : null}
                        {entry.amount !== null ? (
                          <span className="font-black text-slate-900"> {formatTaka(entry.amount)}</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {formatDisplayDateTime(entry.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {data.negativeWalletCount > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-sm font-bold text-rose-600">
                {data.negativeWalletCount} employee wallet(s) are negative. Review them before
                issuing more money.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </AdminAccountsShell>
  );
}
