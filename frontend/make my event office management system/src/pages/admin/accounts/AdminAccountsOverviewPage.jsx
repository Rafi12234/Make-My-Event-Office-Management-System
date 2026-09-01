import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import AdminAccountsShell from "../../../components/AdminAccountsShell";
import {
  StatCard,
  SectionCard,
  Money,
  Badge,
  Field,
  inputClass,
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
  CalendarRange,
  ClipboardList,
  Store,
  TrendingDown,
  Wallet,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

function yearRange(year) {
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

function monthRange(year, month) {
  return {
    dateFrom: toIso(new Date(year, month - 1, 1)),
    dateTo: toIso(new Date(year, month, 0)),
  };
}

function weekOfMonthRange(year, month, week) {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(startDay + 6, lastDayOfMonth);
  return {
    dateFrom: toIso(new Date(year, month - 1, startDay)),
    dateTo: toIso(new Date(year, month - 1, endDay)),
  };
}

const ALL_TIME = { dateFrom: "", dateTo: "", label: "All time" };

// Builds the one-sentence description shown per row in the activity feed —
// backend sends raw fields (amount, vendor, paymentStatus, reason, etc.) so
// currency formatting stays in one place (formatTaka).
function describeActivity(entry) {
  if (entry.kind === "money_in") {
    return entry.source === "admin"
      ? `added ${formatTaka(entry.amount)} to ${entry.employeeName}'s wallet as Money In`
      : `received ${formatTaka(entry.amount)} as Money In`;
  }
  if (entry.kind === "expense_item") {
    const costLabel =
      entry.costType === "event"
        ? `Event Cost${entry.eventClientName ? ` for ${entry.eventClientName}` : ""}`
        : "Regular Cost";
    if (entry.vendorName && entry.paymentStatus === "paid") {
      return `paid ${formatTaka(entry.amount)} to ${entry.vendorName} for "${entry.purpose}" (${costLabel})`;
    }
    if (entry.vendorName && entry.paymentStatus === "to_pay") {
      return `recorded ${formatTaka(entry.amount)} as To Pay to ${entry.vendorName} for "${entry.purpose}" (${costLabel})`;
    }
    return `submitted ${formatTaka(entry.amount)} for "${entry.purpose}" (${costLabel})`;
  }
  if (entry.kind === "correction" || entry.kind === "void") {
    const verb = entry.kind === "void" ? "voided" : "corrected";
    const subject = entry.subjectName ? ` for ${entry.subjectName}` : "";
    const amountPart = entry.amount !== null ? ` (${formatTaka(entry.amount)})` : "";
    return `${verb} ${entry.entityLabel}${subject}${amountPart} — "${entry.reason}"`;
  }
  return "";
}

function activityDotClass(entry) {
  if (entry.kind === "money_in") return "bg-violet-400";
  if (entry.kind === "expense_item") {
    if (entry.paymentStatus === "paid") return "bg-emerald-400";
    if (entry.paymentStatus === "to_pay") return "bg-amber-400";
    return "bg-slate-400";
  }
  if (entry.kind === "correction") return "bg-amber-400";
  return "bg-rose-400";
}

export default function AdminAccountsOverviewPage() {
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const [range, setRange] = useState(ALL_TIME);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [advanced, setAdvanced] = useState({ year: "", month: "", week: "" });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => current - i);
  }, []);

  useEffect(() => {
    Promise.all([loadOverview(), loadActivityFeed()])
      .then(([overview, activity]) => {
        setData(overview);
        setFeed(activity);
      })
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, []);

  async function applyRange(next) {
    setRange(next);
    setIsFilterLoading(true);
    try {
      setData(await loadOverview({ dateFrom: next.dateFrom, dateTo: next.dateTo }));
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setIsFilterLoading(false);
    }
  }

  function applyPreset(label) {
    const today = new Date();
    if (label === "All time") return applyRange(ALL_TIME);
    if (label === "This week") {
      const start = startOfWeekMonday(today);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return applyRange({ dateFrom: toIso(start), dateTo: toIso(end), label });
    }
    if (label === "Last week") {
      const start = startOfWeekMonday(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return applyRange({ dateFrom: toIso(start), dateTo: toIso(end), label });
    }
    if (label === "This month") {
      return applyRange({ ...monthRange(today.getFullYear(), today.getMonth() + 1), label });
    }
    if (label === "Last month") {
      const month = today.getMonth() === 0 ? 12 : today.getMonth();
      const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      return applyRange({ ...monthRange(year, month), label });
    }
    if (label === "This year") return applyRange({ ...yearRange(today.getFullYear()), label });
    if (label === "Last year") return applyRange({ ...yearRange(today.getFullYear() - 1), label });
  }

  function handleAdvancedChange(next) {
    setAdvanced(next);
    if (!next.year) return;
    const year = Number(next.year);
    if (!next.month) return applyRange({ ...yearRange(year), label: `Year ${year}` });
    const month = Number(next.month);
    if (!next.week) {
      return applyRange({
        ...monthRange(year, month),
        label: `${MONTH_NAMES[month - 1]} ${year}`,
      });
    }
    const week = Number(next.week);
    return applyRange({
      ...weekOfMonthRange(year, month, week),
      label: `Week ${week} · ${MONTH_NAMES[month - 1]} ${year}`,
    });
  }

  function handleCustomApply(event) {
    event.preventDefault();
    if (!customFrom || !customTo) return;
    setAdvanced({ year: "", month: "", week: "" });
    applyRange({ dateFrom: customFrom, dateTo: customTo, label: "Custom range" });
  }

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
          <SectionCard
            title="Filter period"
            subtitle="Applies to Given to employees, Total expense, Paid to vendors & Still payable — wallet balance and negative wallets always reflect right now"
          >
            <div className="flex flex-wrap gap-2">
              {["All time", "This week", "Last week", "This month", "Last month", "This year", "Last year"].map(
                (label) => (
                  <button
                    key={label}
                    type="button"
                    disabled={isFilterLoading}
                    onClick={() => applyPreset(label)}
                    className={`acc-press rounded-xl border px-3 py-1.5 text-xs font-black transition-colors duration-200 disabled:opacity-50 ${
                      range.label === label
                        ? "border-rose-400 bg-rose-50 text-rose-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Field label="Year">
                <select
                  className={inputClass}
                  value={advanced.year}
                  onChange={(event) =>
                    handleAdvancedChange({ year: event.target.value, month: "", week: "" })
                  }
                >
                  <option value="">Any year</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Month">
                <select
                  className={inputClass}
                  disabled={!advanced.year}
                  value={advanced.month}
                  onChange={(event) =>
                    handleAdvancedChange({ ...advanced, month: event.target.value, week: "" })
                  }
                >
                  <option value="">Whole year</option>
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Week">
                <select
                  className={inputClass}
                  disabled={!advanced.month}
                  value={advanced.week}
                  onChange={(event) => handleAdvancedChange({ ...advanced, week: event.target.value })}
                >
                  <option value="">Whole month</option>
                  {[1, 2, 3, 4, 5].map((week) => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Custom from">
                <input
                  type="date"
                  className={inputClass}
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Custom to" className="flex-1">
                  <input
                    type="date"
                    className={inputClass}
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo || isFilterLoading}
                  className="acc-press h-[42px] rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 text-sm font-black text-white shadow disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs font-bold text-slate-400">
              Showing: <span className="text-slate-600">{range.label}</span>
              {range.dateFrom ? ` (${formatDisplayDate(range.dateFrom)} – ${formatDisplayDate(range.dateTo)})` : ""}
              {isFilterLoading ? " · updating…" : ""}
            </p>
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              index={0}
              label="Given to employees"
              value={formatTaka(data.totalMoneyGivenToEmployees)}
              hint={range.label === "All time" ? "All active Money In entries" : range.label}
              tone="violet"
              icon={Banknote}
            />
            <StatCard
              index={1}
              label="Employee wallet balance"
              value={formatTaka(data.totalWalletBalance)}
              hint="Sum of all current wallets — right now"
              tone={data.totalWalletBalance < 0 ? "rose" : "emerald"}
              icon={Wallet}
            />
            <StatCard
              index={2}
              label="Total expense"
              value={formatTaka(data.totalExpense)}
              hint={range.label === "All time" ? "Paid only — To Pay not counted" : range.label}
              tone="slate"
              icon={ClipboardList}
            />
            <StatCard
              index={3}
              label="Paid to vendors"
              value={formatTaka(data.totalPaidToVendors)}
              hint={range.label === "All time" ? "Vendor items marked Paid" : range.label}
              tone="emerald"
              icon={Banknote}
            />
            <StatCard
              index={4}
              label="Still payable to vendors"
              value={formatTaka(data.totalStillPayableToVendors)}
              hint={range.label === "All time" ? "Open To Pay balances — right now" : `Open To Pay recorded in ${range.label}`}
              tone="amber"
              icon={Store}
            />
            <StatCard
              index={5}
              label="Negative wallets"
              value={data.negativeWalletCount}
              hint="Employees currently overdrawn — right now"
              tone={data.negativeWalletCount > 0 ? "rose" : "slate"}
              icon={TrendingDown}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              index={6}
              title="Negative wallets"
              subtitle="Employees who have spent beyond what they received"
            >
              {data.negativeWallets.length === 0 ? (
                <EmptyBlock label="No employee is overdrawn." />
              ) : (
                <ul className="space-y-2">
                  {data.negativeWallets.map((wallet, index) => (
                    <li
                      key={wallet.employeeId}
                      style={{ "--acc-i": index }}
                      className="acc-stagger-fast acc-press flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 hover:border-rose-300 hover:bg-rose-50"
                    >
                      <Link
                        to={`/admin/accounts/employees/${wallet.employeeId}`}
                        className="text-sm font-black text-slate-700 transition-colors duration-200 hover:text-rose-600"
                      >
                        {wallet.employeeName}
                      </Link>
                      <Money value={wallet.currentBalance} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard index={7} title="Vendor dues" subtitle="Highest outstanding To Pay first">
              {data.vendorDues.length === 0 ? (
                <EmptyBlock label="No vendor has an outstanding balance." />
              ) : (
                <ul className="space-y-2">
                  {data.vendorDues.map((vendor, index) => (
                    <li
                      key={vendor.vendorId}
                      style={{ "--acc-i": index }}
                      className="acc-stagger-fast acc-press flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 hover:border-amber-300 hover:bg-amber-50"
                    >
                      <Link
                        to={`/admin/accounts/vendors/${vendor.vendorId}`}
                        className="text-sm font-black text-slate-700 transition-colors duration-200 hover:text-rose-600"
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
            <SectionCard index={8} title="Recent Money In" subtitle="Latest wallet top-ups">
              {data.recentMoneyIn.length === 0 ? (
                <EmptyBlock label="No Money In entries yet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentMoneyIn.map((entry, index) => (
                    <li
                      key={entry.id}
                      style={{ "--acc-i": index }}
                      className="acc-stagger-fast acc-row flex items-center justify-between gap-3 rounded-lg px-2 py-2.5"
                    >
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

            <SectionCard index={9} title="Recent vendor activity" subtitle="Costs and payments across vendors">
              {data.recentVendorActivity.length === 0 ? (
                <EmptyBlock label="No vendor activity yet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentVendorActivity.map((entry, index) => (
                    <li
                      key={entry.id}
                      style={{ "--acc-i": index }}
                      className="acc-stagger-fast acc-row flex items-center justify-between gap-3 rounded-lg px-2 py-2.5"
                    >
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

          <SectionCard index={10} title="Company activity feed" subtitle="Everything happening across Accounts">
            {feed.length === 0 ? (
              <EmptyBlock label="No activity recorded yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {feed.map((entry, index) => (
                  <li
                    key={`${entry.kind}-${index}`}
                    style={{ "--acc-i": index }}
                    className="acc-stagger-fast acc-row flex items-start gap-3 rounded-lg px-2 py-2.5"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full transition-transform duration-300 ${activityDotClass(entry)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-700">
                        <span className="font-black">{entry.actor}</span> {describeActivity(entry)}
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
            <div className="acc-scale-in flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 animate-pulse text-rose-500" />
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
