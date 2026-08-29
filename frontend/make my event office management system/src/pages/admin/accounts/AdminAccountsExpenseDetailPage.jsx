import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
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
  Modal,
  ReasonModal,
  ReasonPicker,
  StatCard,
} from "../../../components/AdminAccountsWidgets";
import {
  loadExpense,
  loadVendors,
  previewExpenseUpdate,
  updateExpense,
  voidExpense,
  resolveImageUrl,
  formatTaka,
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../services/adminAccountsService";
import { ArrowLeft, Ban, Loader2, Paperclip, Save } from "lucide-react";

export default function AdminAccountsExpenseDetailPage() {
  const { expenseId } = useParams();
  const [expense, setExpense] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [draft, setDraft] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  function refresh() {
    setIsLoading(true);
    loadExpense(expenseId)
      .then((data) => {
        setExpense(data.expense);
        setAuditLogs(data.auditLogs);
        setDraft(
          data.expense.items.map((item) => ({
            id: item.id,
            purpose: item.purpose,
            costDate: item.costDate,
            quantity: String(item.quantity),
            perQtyAmount: String(item.perQtyAmount),
            vendorId: item.vendorId || "",
            paymentStatus: item.paymentStatus || "",
          })),
        );
      })
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, [expenseId]);

  useEffect(() => {
    loadVendors({ includeInactive: true }).then(setVendors).catch(() => {});
  }, []);

  // The admin never types a final total — it always recalculates from
  // quantity × per-qty amount.
  const draftTotal = useMemo(
    () =>
      draft.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0),
        0,
      ),
    [draft],
  );

  function updateItem(index, key, value) {
    setDraft((prev) =>
      prev.map((item, position) => {
        if (position !== index) return item;
        const next = { ...item, [key]: value };
        if (key === "vendorId" && !value) next.paymentStatus = "";
        if (key === "vendorId" && value && !next.paymentStatus) next.paymentStatus = "to_pay";
        return next;
      }),
    );
  }

  function toPayload() {
    return draft.map((item) => ({
      id: item.id,
      purpose: item.purpose,
      costDate: item.costDate,
      quantity: Number(item.quantity),
      perQtyAmount: Number(item.perQtyAmount),
      vendorId: item.vendorId || null,
      paymentStatus: item.vendorId ? item.paymentStatus : null,
    }));
  }

  async function handlePreview() {
    setBusy(true);
    try {
      setPreview(await previewExpenseUpdate(expenseId, toPayload()));
      setReason("");
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    try {
      await updateExpense(expenseId, { items: toPayload(), reason });
      setPreview(null);
      setNotice({ type: "success", message: "Expense corrected and balances adjusted." });
      refresh();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid(voidReason) {
    setBusy(true);
    try {
      const response = await voidExpense(expenseId, voidReason);
      setVoidOpen(false);
      setNotice({
        type: "success",
        message: `Expense voided. Wallet adjusted by ${formatTaka(response.walletChange ?? 0)}.`,
      });
      refresh();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const readOnly = expense?.status === "void";

  return (
    <AdminAccountsShell
      title={`Expense #${expenseId}`}
      subtitle={expense ? expense.employeeName || "Company / Admin direct" : "Loading…"}
      actions={
        <>
          <Link
            to="/admin/accounts/expenses"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={15} />
            All expenses
          </Link>
          {expense && !readOnly ? (
            <button
              type="button"
              onClick={() => setVoidOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-black text-rose-600 hover:bg-rose-50"
            >
              <Ban size={15} />
              Void
            </button>
          ) : null}
        </>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {isLoading || !expense ? (
        <LoadingBlock label="Loading expense…" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Recorded cost"
              value={formatTaka(expense.recordedTotalAmount)}
              tone="slate"
            />
            <StatCard
              label="Actually paid"
              value={formatTaka(expense.walletDeductionAmount)}
              tone="emerald"
            />
            <StatCard
              label="Still to pay"
              value={formatTaka(expense.vendorPayableAmount)}
              tone="amber"
            />
            <StatCard label="Draft new total" value={formatTaka(draftTotal)} tone="violet" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={expense.costType === "event" ? "amber" : "slate"}>
              {expense.costType === "event" ? "Event Based" : "Regular"}
            </Badge>
            {expense.paymentSource === "company" ? (
              <Badge tone="violet">Company direct — no wallet impact</Badge>
            ) : null}
            <StatusBadge status={expense.status} />
            {expense.eventClientName ? (
              <span className="text-sm font-bold text-slate-600">
                {expense.eventClientName} · {formatDisplayDate(expense.eventDate)}
              </span>
            ) : null}
            <span className="text-xs font-bold text-slate-400">
              Submitted {formatDisplayDateTime(expense.createdAt)} · Updated{" "}
              {formatDisplayDateTime(expense.updatedAt)}
            </span>
          </div>

          {readOnly ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
              This expense was voided by {expense.voidedByName || "an admin"} on{" "}
              {formatDisplayDateTime(expense.voidedAt)} — reason: {expense.voidReason}. Its
              financial effect has been reversed, but the record is kept for the audit trail.
            </div>
          ) : null}

          <SectionCard
            title="Expense items"
            subtitle="Totals, wallet deduction and vendor balances all recalculate automatically"
          >
            <div className="space-y-3">
              {draft.map((item, index) => {
                const lineTotal =
                  (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
                const original = expense.items[index];
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Field label="Purpose" className="sm:col-span-2">
                        <input
                          disabled={readOnly}
                          className={inputClass}
                          value={item.purpose}
                          onChange={(event) => updateItem(index, "purpose", event.target.value)}
                        />
                      </Field>
                      <Field label="Cost happened date">
                        <input
                          disabled={readOnly}
                          type="date"
                          className={inputClass}
                          value={item.costDate}
                          onChange={(event) => updateItem(index, "costDate", event.target.value)}
                        />
                      </Field>
                      <Field label="Quantity">
                        <input
                          disabled={readOnly}
                          type="number"
                          min="0.01"
                          step="0.01"
                          className={inputClass}
                          value={item.quantity}
                          onChange={(event) => updateItem(index, "quantity", event.target.value)}
                        />
                      </Field>
                      <Field label="Per qty amount">
                        <input
                          disabled={readOnly}
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputClass}
                          value={item.perQtyAmount}
                          onChange={(event) =>
                            updateItem(index, "perQtyAmount", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Vendor">
                        <select
                          disabled={readOnly}
                          className={inputClass}
                          value={item.vendorId}
                          onChange={(event) => updateItem(index, "vendorId", event.target.value)}
                        >
                          <option value="">No vendor</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.name}
                              {vendor.isActive ? "" : " (inactive)"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Payment status">
                        <select
                          disabled={readOnly || !item.vendorId}
                          className={inputClass}
                          value={item.paymentStatus}
                          onChange={(event) =>
                            updateItem(index, "paymentStatus", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          <option value="to_pay">To Pay</option>
                          <option value="paid">Paid</option>
                        </select>
                      </Field>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-xs font-bold text-slate-500">
                        Line total{" "}
                        <span className="font-black text-slate-800">{formatTaka(lineTotal)}</span>
                        {original && lineTotal !== original.totalAmount ? (
                          <span className="ml-2 text-amber-600">
                            (was {formatTaka(original.totalAmount)})
                          </span>
                        ) : null}
                      </span>
                      {original?.receiptUrl ? (
                        <a
                          href={resolveImageUrl(original.receiptUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-black text-rose-600 hover:underline"
                        >
                          <Paperclip size={13} />
                          View receipt
                        </a>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">No receipt</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!readOnly ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={15} />}
                  Review & save changes
                </button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Correction history" subtitle="Every admin change to this expense">
            {auditLogs.length === 0 ? (
              <EmptyBlock label="This expense has never been corrected." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
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
                    {log.beforeData?.totalAmount !== undefined &&
                    log.afterData?.totalAmount !== undefined ? (
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatTaka(log.beforeData.totalAmount)} →{" "}
                        {formatTaka(log.afterData.totalAmount)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* Confirmation preview: old vs new amount, wallet impact and vendor
          impact are shown before the correction is committed. */}
      <Modal open={Boolean(preview)} title="Confirm financial correction" onClose={() => setPreview(null)}>
        {preview ? (
          <div className="space-y-4">
            <div className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              <p>Old Expense: {formatTaka(preview.oldTotal)}</p>
              <p>New Expense: {formatTaka(preview.newTotal)}</p>
              <p className="pt-1">
                Employee Wallet Change:{" "}
                <span className={preview.walletChange >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  {preview.walletChange > 0 ? "+" : ""}
                  {formatTaka(preview.walletChange)}
                </span>
              </p>
              {preview.vendorImpact.length > 0 ? (
                <div className="pt-1">
                  <p>Vendor impact:</p>
                  <ul className="mt-0.5 space-y-0.5 pl-3">
                    {preview.vendorImpact.map((entry) => (
                      <li key={entry.vendorId}>
                        {entry.vendorName || `Vendor ${entry.vendorId}`}:{" "}
                        <span className={entry.delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                          {entry.delta > 0 ? "+" : ""}
                          {formatTaka(entry.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <ReasonPicker value={reason} onChange={setReason} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || reason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm correction
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ReasonModal
        open={voidOpen}
        title="Void this expense?"
        description="The wallet deduction and every vendor balance effect will be reversed. The record stays visible as voided."
        confirmLabel="Void expense"
        busy={busy}
        onCancel={() => setVoidOpen(false)}
        onConfirm={handleVoid}
      />
    </AdminAccountsShell>
  );
}
