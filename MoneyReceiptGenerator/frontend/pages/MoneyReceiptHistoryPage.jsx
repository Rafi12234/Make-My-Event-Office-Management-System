import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { History } from "lucide-react";
import MoneyReceiptGeneratorShell from "../components/MoneyReceiptGeneratorShell";
import MoneyReceiptHistoryTable from "../components/MoneyReceiptHistoryTable";
import {
  archiveMoneyReceipt,
  downloadMoneyReceipt,
  listMoneyReceipts,
  saveBlobAs,
} from "../services/moneyReceiptService";

const inputClassName =
  "w-full rounded-xl border border-mme-pink/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-mme-purple";

const EMPTY_FILTERS = { search: "", paymentStatus: "", status: "", dateFrom: "", dateTo: "" };

export default function MoneyReceiptHistoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyReceiptId, setBusyReceiptId] = useState(null);

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      const data = await listMoneyReceipts(filters);
      setReceipts(data);
    } catch (err) {
      setError(err.message || "Could not load money receipts.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!location.state?.toast) return;
    setToast(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function filenameFor(receipt) {
    return `${(receipt.receiptNo || `receipt-${receipt.id}`).replace(/\//g, "-")}.pdf`;
  }

  async function handlePreview(id) {
    setBusyReceiptId(id);
    try {
      const blob = await downloadMoneyReceipt(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message || "Unable to open this receipt.");
    } finally {
      setBusyReceiptId(null);
    }
  }

  async function handleDownload(id) {
    setBusyReceiptId(id);
    try {
      const receipt = receipts.find((r) => r.id === id);
      const blob = await downloadMoneyReceipt(id);
      saveBlobAs(blob, receipt ? filenameFor(receipt) : "money-receipt.pdf");
    } catch (err) {
      setError(err.message || "Unable to download this receipt.");
    } finally {
      setBusyReceiptId(null);
    }
  }

  async function handleArchive(id) {
    setBusyReceiptId(id);
    try {
      const updated = await archiveMoneyReceipt(id);
      setReceipts((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err.message || "Unable to archive this receipt.");
    } finally {
      setBusyReceiptId(null);
    }
  }

  return (
    <MoneyReceiptGeneratorShell
      title="Receipt History"
      subtitle="Every money receipt generated, newest first."
      actions={
        <button
          type="button"
          onClick={() => navigate("/admin/money-receipts")}
          className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-3.5 py-2 text-sm font-black text-white transition hover:-translate-y-0.5"
        >
          <History size={15} /> New Receipt
        </button>
      }
    >
      {toast && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{toast}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={inputClassName}
          placeholder="Search receipt no / client / phone"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
        <select className={inputClassName} value={filters.paymentStatus} onChange={(e) => updateFilter("paymentStatus", e.target.value)}>
          <option value="">All Payment Status</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select className={inputClassName} value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="">All Statuses</option>
          <option value="generated">Generated</option>
          <option value="archived">Archived</option>
        </select>
        <input type="date" className={inputClassName} value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} />
        <input type="date" className={inputClassName} value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} />
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <MoneyReceiptHistoryTable
          receipts={receipts}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onArchive={handleArchive}
          busyReceiptId={busyReceiptId}
        />
      )}
    </MoneyReceiptGeneratorShell>
  );
}
