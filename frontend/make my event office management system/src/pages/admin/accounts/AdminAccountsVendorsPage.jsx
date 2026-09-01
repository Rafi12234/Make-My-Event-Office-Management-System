import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
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
  loadVendors,
  createVendor,
  updateVendor,
  setVendorStatus,
  exportRowsToCsv,
  formatTaka,
  formatDisplayDate,
} from "../../../services/adminAccountsService";
import { Download, Loader2, Pencil, Plus, Power, Search, Store } from "lucide-react";

const BLANK_VENDOR = {
  name: "",
  category: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
};

export default function AdminAccountsVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    setIsLoading(true);
    loadVendors({ includeInactive: true })
      .then(setVendors)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (!showInactive && !vendor.isActive) return false;
      if (!term) return true;
      return (
        vendor.name.toLowerCase().includes(term) ||
        (vendor.category || "").toLowerCase().includes(term)
      );
    });
  }, [vendors, search, showInactive]);

  const totals = useMemo(
    () => ({
      payable: vendors.reduce((sum, vendor) => sum + vendor.amountPayable, 0),
      advance: vendors.reduce((sum, vendor) => sum + vendor.advancePaid, 0),
      active: vendors.filter((vendor) => vendor.isActive).length,
    }),
    [vendors],
  );

  async function handleToggleStatus(vendor) {
    try {
      await setVendorStatus(vendor.id, !vendor.isActive);
      setNotice({
        type: "success",
        message: `${vendor.name} ${vendor.isActive ? "deactivated" : "reactivated"}.`,
      });
      refresh();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  }

  function handleExport() {
    exportRowsToCsv(
      "vendors.csv",
      [
        { label: "Vendor", value: (row) => row.name },
        { label: "Category", value: (row) => row.category || "" },
        { label: "Contact", value: (row) => row.contactName || "" },
        { label: "Phone", value: (row) => row.contactPhone || "" },
        { label: "Current Balance", value: (row) => row.currentBalance },
        { label: "Amount Payable", value: (row) => row.amountPayable },
        { label: "Advance Paid", value: (row) => row.advancePaid },
        { label: "Status", value: (row) => (row.isActive ? "Active" : "Inactive") },
        { label: "Last Transaction", value: (row) => row.lastTransactionDate || "" },
      ],
      filtered,
    );
  }

  return (
    <AdminAccountsShell
      title="Vendors"
      subtitle="Company-wide payee ledger"
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
            onClick={() => setCreating(true)}
            className="acc-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-2 text-sm font-black text-white shadow-lg shadow-rose-500/25 enabled:hover:shadow-xl enabled:hover:shadow-rose-500/30"
          >
            <Plus size={15} />
            New Vendor
          </button>
        </>
      }
    >
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Total payable" value={formatTaka(totals.payable)} tone="amber" icon={Store} />
        <StatCard index={1} label="Total advanced" value={formatTaka(totals.advance)} tone="emerald" />
        <StatCard index={2} label="Active vendors" value={totals.active} tone="violet" />
      </div>

      <SectionCard
        title="All vendors"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="size-3.5 accent-rose-500"
              />
              Show inactive
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputClass} pl-8`}
                placeholder="Search vendor"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        }
      >
        {isLoading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyBlock label="No vendors found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">Vendor</th>
                  <th className="pb-2 px-3">Category</th>
                  <th className="pb-2 px-3">Contact</th>
                  <th className="pb-2 px-3 text-right">Balance</th>
                  <th className="pb-2 px-3 text-right">Payable</th>
                  <th className="pb-2 px-3">Last txn</th>
                  <th className="pb-2 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((vendor) => (
                  <tr key={vendor.id} className={vendor.isActive ? undefined : "opacity-60"}>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/accounts/vendors/${vendor.id}`}
                          className="font-black text-slate-800 hover:text-rose-600"
                        >
                          {vendor.name}
                        </Link>
                        {vendor.isActive ? null : <Badge tone="slate">Inactive</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{vendor.category || "—"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {vendor.contactName || "—"}
                      {vendor.contactPhone ? (
                        <p className="text-[11px] font-bold text-slate-400">{vendor.contactPhone}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Money value={vendor.currentBalance} />
                    </td>
                    <td className="px-3 py-3 text-right font-black tabular-nums text-amber-700">
                      {vendor.amountPayable > 0 ? formatTaka(vendor.amountPayable) : "—"}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-500">
                      {formatDisplayDate(vendor.lastTransactionDate)}
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(vendor)}
                          className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                          title="Edit vendor"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(vendor)}
                          className="acc-press rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                          title={vendor.isActive ? "Deactivate" : "Reactivate"}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <VendorFormModal
        open={creating || Boolean(editing)}
        vendor={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(message) => {
          setCreating(false);
          setEditing(null);
          setNotice({ type: "success", message });
          refresh();
        }}
        onError={(message) => setNotice({ type: "error", message })}
      />
    </AdminAccountsShell>
  );
}

function VendorFormModal({ open, vendor, onClose, onSaved, onError }) {
  const [form, setForm] = useState(BLANK_VENDOR);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      vendor
        ? {
            name: vendor.name,
            category: vendor.category || "",
            contactName: vendor.contactName || "",
            contactPhone: vendor.contactPhone || "",
            contactEmail: vendor.contactEmail || "",
            notes: vendor.notes || "",
          }
        : BLANK_VENDOR,
    );
  }, [open, vendor]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (vendor) {
        await updateVendor(vendor.id, form);
        onSaved(`${form.name} updated.`);
      } else {
        await createVendor(form);
        onSaved(`${form.name} created — employees can now select it.`);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={vendor ? "Edit vendor" : "New vendor"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor name">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Field>
          <Field label="Category">
            <input
              className={inputClass}
              placeholder="Transportation, Flowers…"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            />
          </Field>
          <Field label="Contact name">
            <input
              className={inputClass}
              value={form.contactName}
              onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
            />
          </Field>
          <Field label="Contact phone">
            <input
              className={inputClass}
              value={form.contactPhone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactPhone: event.target.value }))
              }
            />
          </Field>
          <Field label="Contact email" className="sm:col-span-2">
            <input
              type="email"
              className={inputClass}
              value={form.contactEmail}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
              }
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              rows={2}
              className={inputClass}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </Field>
        </div>

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
            {vendor ? "Save changes" : "Create vendor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
