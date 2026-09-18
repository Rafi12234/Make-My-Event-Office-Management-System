import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Receipt, User } from "lucide-react";
import MoneyReceiptGeneratorShell from "../components/MoneyReceiptGeneratorShell";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import {
  createBlankMoneyReceiptForm,
  computePaymentSummary,
  validateMoneyReceiptForm,
  PAYMENT_METHOD_OPTIONS,
  BOOKING_STATUS_OPTIONS,
} from "../utils/moneyReceiptForm";
import { previewMoneyReceipt, createMoneyReceipt, listConfirmedClients } from "../services/moneyReceiptService";

const inputClassName =
  "w-full rounded-xl border border-mme-pink/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-mme-purple";
// min-h reserves room for a 2-line label (e.g. "Transaction/Reference No. /
// Account No. (optional)") so its input stays aligned with 1-line labels in
// the same grid row, instead of sitting lower than its row-mates.
const labelClassName = "mb-1 block min-h-[2.4em] text-[11px] font-black uppercase leading-tight tracking-wide text-slate-500";

export default function MoneyReceiptGeneratorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(() => location.state?.form ?? createBlankMoneyReceiptForm());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [confirmedClients, setConfirmedClients] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Loaded once — the confirmed-clients list backing the Client Name
  // autocomplete (rows marked "booked from MME" on the main workspace sheet).
  useEffect(() => {
    let cancelled = false;
    listConfirmedClients()
      .then((data) => {
        if (!cancelled) setConfirmedClients(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Non-fatal — the form still works without the autocomplete.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientSuggestions = useMemo(() => {
    const term = form.clientName.trim().toLowerCase();
    const matches = term
      ? confirmedClients.filter((client) => client.clientName.toLowerCase().includes(term))
      : confirmedClients;
    return matches.slice(0, 8);
  }, [confirmedClients, form.clientName]);

  function handleSelectConfirmedClient(client) {
    setForm((prev) => ({
      ...prev,
      clientName: client.clientName || prev.clientName,
      clientPhone: client.clientPhone || prev.clientPhone,
      eventDate: client.eventDate || prev.eventDate,
      eventVenue: client.eventVenue || prev.eventVenue,
    }));
    setShowClientSuggestions(false);
  }

  const summary = computePaymentSummary(form);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePreview() {
    const validationError = validateMoneyReceiptForm(form);
    if (validationError) {
      setPreviewError(validationError);
      return;
    }

    setIsPreviewing(true);
    setPreviewError("");
    try {
      const blob = await previewMoneyReceipt(form);
      const previewUrl = URL.createObjectURL(blob);
      navigate("/admin/money-receipts/preview", { state: { previewUrl, form } });
    } catch (error) {
      setPreviewError(error.message || "Unable to preview money receipt.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleGenerate() {
    const validationError = validateMoneyReceiptForm(form);
    if (validationError) {
      setGenerateError(validationError);
      return;
    }

    setIsGenerating(true);
    setGenerateError("");
    try {
      await createMoneyReceipt(form);
      navigate("/admin/money-receipts/history", { state: { toast: "Money receipt generated successfully." } });
    } catch (error) {
      setGenerateError(error.message || "Unable to generate money receipt.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <MoneyReceiptGeneratorShell
      title="Money Receipt Generator"
      subtitle="Create an official payment receipt for a client."
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
            <Receipt size={15} /> Receipt Information
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div>
              <label className={labelClassName}>Receipt Date</label>
              <input
                type="date"
                className={inputClassName}
                value={form.receiptDate}
                onChange={(e) => updateField("receiptDate", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClassName}>Receipt No.</label>
              <input className={inputClassName} value="Generated automatically" disabled />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Client Information</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="relative">
              <label className={labelClassName}>Client Name</label>
              <input
                className={inputClassName}
                value={form.clientName}
                onChange={(e) => {
                  updateField("clientName", e.target.value);
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                placeholder="e.g. John Doe"
                autoComplete="off"
              />
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-mme-pink/60 bg-white shadow-lg">
                  {clientSuggestions.map((client) => (
                    <button
                      key={client.rowKey}
                      type="button"
                      onMouseDown={() => handleSelectConfirmedClient(client)}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-mme-blush/30"
                    >
                      <User size={14} className="shrink-0 text-mme-purple/50" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-bold">{client.clientName}</span>
                        {client.clientPhone ? <span className="text-slate-400"> · {client.clientPhone}</span> : null}
                        {client.eventVenue ? <span className="text-slate-400"> · {client.eventVenue}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelClassName}>Phone Number</label>
              <input className={inputClassName} value={form.clientPhone} onChange={(e) => updateField("clientPhone", e.target.value)} placeholder="e.g. 01700000000" />
            </div>
            <div>
              <label className={labelClassName}>Email <span className="font-medium normal-case text-slate-400">(optional)</span></label>
              <input type="email" className={inputClassName} value={form.clientEmail} onChange={(e) => updateField("clientEmail", e.target.value)} placeholder="e.g. client@example.com" />
            </div>
            <div>
              <label className={labelClassName}>Address <span className="font-medium normal-case text-slate-400">(optional)</span></label>
              <input className={inputClassName} value={form.clientAddress} onChange={(e) => updateField("clientAddress", e.target.value)} placeholder="Client address" />
            </div>
            <div>
              <label className={labelClassName}>Billed To <span className="font-medium normal-case text-slate-400">(optional)</span></label>
              <input className={inputClassName} value={form.billedTo} onChange={(e) => updateField("billedTo", e.target.value)} placeholder="e.g. company/person being billed" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">
            Event Information <span className="font-medium normal-case text-slate-400">(optional)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div>
              <label className={labelClassName}>Event Name</label>
              <input className={inputClassName} value={form.eventName} onChange={(e) => updateField("eventName", e.target.value)} placeholder="e.g. Wedding Reception" />
            </div>
            <div>
              <label className={labelClassName}>Event Date</label>
              <input type="date" className={inputClassName} value={form.eventDate} onChange={(e) => updateField("eventDate", e.target.value)} />
            </div>
            <div>
              <label className={labelClassName}>Venue</label>
              <input className={inputClassName} value={form.eventVenue} onChange={(e) => updateField("eventVenue", e.target.value)} placeholder="e.g. Grand Hall, Sena Prangan" />
            </div>
            <div>
              <label className={labelClassName}>Booking/Reference ID</label>
              <input className={inputClassName} value={form.bookingReference} onChange={(e) => updateField("bookingReference", e.target.value)} placeholder="e.g. BOOK-001" />
            </div>
            <div>
              <label className={labelClassName}>Status</label>
              <select className={inputClassName} value={form.bookingStatus} onChange={(e) => updateField("bookingStatus", e.target.value)}>
                {BOOKING_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-mme-pink/60 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Payment Information</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div>
              <label className={labelClassName}>Total Payment (৳)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClassName}
                value={form.totalPayment}
                onChange={(e) => updateField("totalPayment", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClassName}>Advance Payment (৳)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClassName}
                value={form.advancePayment}
                onChange={(e) => updateField("advancePayment", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClassName}>Payment Method</label>
              <select className={inputClassName} value={form.paymentMethod} onChange={(e) => updateField("paymentMethod", e.target.value)}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {form.paymentMethod === "other" ? (
              <div>
                <label className={labelClassName}>Specify Method</label>
                <input className={inputClassName} value={form.paymentMethodOther} onChange={(e) => updateField("paymentMethodOther", e.target.value)} placeholder="e.g. Cheque via courier" />
              </div>
            ) : null}
            <div>
              <label className={labelClassName}>Transaction/Reference No. / Account No. <span className="font-medium normal-case text-slate-400">(optional)</span></label>
              <input className={inputClassName} value={form.transactionReference} onChange={(e) => updateField("transactionReference", e.target.value)} placeholder="e.g. TXN123456789" />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClassName}>Remarks <span className="font-medium normal-case text-slate-400">(optional)</span></label>
            <textarea
              className={`${inputClassName} min-h-20 resize-y`}
              value={form.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
              placeholder="e.g. Advance received for event booking."
            />
          </div>

          <div className="mt-4">
            <PaymentSummaryCard
              totalPayment={Number(form.totalPayment) || 0}
              advancePayment={Number(form.advancePayment) || 0}
              duePayment={summary.duePayment}
              paymentStatus={summary.paymentStatus}
            />
          </div>
        </div>

        {(previewError || generateError) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{previewError || generateError}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing || isGenerating}
            className="flex-1 rounded-xl border border-mme-pink/70 bg-white px-4 py-3 text-sm font-black text-mme-purple/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-mme-purple disabled:opacity-50"
          >
            {isPreviewing ? "Generating Preview..." : "Preview Receipt"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPreviewing || isGenerating}
            className="flex-1 rounded-xl bg-mme-purple px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Money Receipt"}
          </button>
        </div>
      </div>
    </MoneyReceiptGeneratorShell>
  );
}
