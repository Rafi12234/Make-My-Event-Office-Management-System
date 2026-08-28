import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, ArrowRight, Clock3, Search, Store, Wallet, X } from "lucide-react";
import mmeLogo from "../../../frontend/make my event office management system/src/assets/mme-logo-cropped.png";
import BackButton from "../../../frontend/make my event office management system/src/components/BackButton";
import EmployeeLayout from "../../../frontend/make my event office management system/src/components/EmployeeLayout";
import AccountsAnimations from "../components/AccountsAnimations";
import { loadVendors, formatTaka } from "../services/accountsService";

// Vendor directory — every employee can view + transact against any active
// vendor (creation/deactivation is Admin-only, via a page not built yet).
// Balance shown here is the shared, company-wide running ledger, not
// scoped to the current employee.
export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    let isMounted = true;
    loadVendors()
      .then((data) => {
        if (isMounted) setVendors(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Could not load vendors.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(vendors.map((vendor) => vendor.category).filter(Boolean))].sort(),
    [vendors],
  );

  const filtered = vendors.filter((vendor) => {
    if (activeCategory !== "all" && vendor.category !== activeCategory) return false;
    if (!searchText.trim()) return true;
    const needle = searchText.trim().toLowerCase();
    return (
      vendor.name.toLowerCase().includes(needle) ||
      (vendor.category || "").toLowerCase().includes(needle)
    );
  });

  const totalOwed = vendors.reduce(
    (sum, vendor) => (vendor.currentBalance < 0 ? sum + Math.abs(vendor.currentBalance) : sum),
    0,
  );
  const owedCount = vendors.filter((vendor) => vendor.currentBalance < 0).length;

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-[#F6F6F7]">
        <AccountsAnimations />

        <header className="sticky top-0 z-40 border-b border-black/8 bg-white/80 backdrop-blur-xl">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src={mmeLogo} alt="Make My Event" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
              <div className="min-w-0 border-l border-black/10 pl-3">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-black/70">Vendors</p>
                <p className="truncate text-[10px] text-black/55">Shared company ledger</p>
              </div>
            </div>
            <Link
              to="/accounts"
              className="group inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-black text-black/65 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:bg-[#0B0B0F] hover:text-white"
            >
              <Wallet size={14} /> My Wallet
            </Link>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
          <section className="mx-auto max-w-[1700px]">
            <div className="mm-fade mb-5 flex items-center gap-3">
              <BackButton to="/accounts" title="Back to Accounts" />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-black sm:text-3xl">Vendor Directory</h1>
                <p className="mt-0.5 text-sm text-black/45">
                  Balances are shared company-wide across every employee.
                </p>
              </div>
            </div>

            {!isLoading && !error && owedCount > 0 ? (
              <div className="mm-pop relative mb-5 overflow-hidden rounded-[30px] bg-[#0B0B0F] p-6 text-white shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)] ring-1 ring-white/10 sm:p-8">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="mm-drift absolute -left-24 -top-32 h-96 w-96 rounded-full bg-amber-500/45 blur-[110px]" />
                  <div
                    className="mm-drift absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-violet-600/40 blur-[110px]"
                    style={{ animationDelay: "-7s" }}
                  />
                  <div className="mm-dots absolute inset-0 opacity-30" />
                </div>
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-rose-400 ring-1 ring-white/15">
                      <Clock3 size={22} />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">
                        Total Outstanding
                      </p>
                      <p className="mt-1 text-4xl font-black tracking-tighter text-rose-400 sm:text-5xl">
                        −{formatTaka(totalOwed)}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10">
                    {owedCount} vendor{owedCount === 1 ? "" : "s"} awaiting payment
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mm-rise mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-3 transition-all duration-300 focus-within:border-black focus-within:ring-4 focus-within:ring-black/8 lg:w-80">
                <Search size={15} className="shrink-0 text-black/45" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search vendors…"
                  className="w-full text-sm font-bold outline-none placeholder:font-normal placeholder:text-black/45"
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="shrink-0 rounded-md p-0.5 text-black/45 transition-all duration-200 hover:rotate-90 hover:text-black"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              {categories.length > 0 ? (
                <div className="mm-scroll flex gap-1.5 overflow-x-auto pb-1">
                  {["all", ...categories].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`shrink-0 rounded-xl border px-4 py-2.5 text-[11px] font-black transition-all duration-300 hover:-translate-y-0.5 ${
                        activeCategory === category
                          ? "border-black bg-[#0B0B0F] text-white shadow-lg shadow-black/20"
                          : "border-black/10 bg-white text-black/45 hover:border-black/40 hover:text-black"
                      }`}
                    >
                      {category === "all" ? "All" : category}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <div key={n} className="mm-skeleton h-40 rounded-2xl" />
                ))}
              </div>
            ) : error ? (
              <div className="mm-pop rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-12 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                  <AlertCircle size={24} />
                </span>
                <p className="mt-3.5 text-sm font-black text-rose-600">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="mm-pop flex flex-col items-center rounded-2xl border border-dashed border-black/12 bg-white px-4 py-20 text-center">
                <span className="mm-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fafafa] text-black/40">
                  <Store size={22} />
                </span>
                <p className="mt-3.5 text-sm font-black text-black/55">
                  {vendors.length === 0 ? "No vendors added yet." : "No vendors match your filters."}
                </p>
                <p className="mt-1 max-w-xs text-xs text-black/55">
                  {vendors.length === 0
                    ? "Ask an admin to add vendors before logging vendor payments."
                    : "Try a different search or category."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((vendor, index) => {
                  const owes = vendor.currentBalance < 0;
                  const advanced = vendor.currentBalance > 0;
                  return (
                    <Link
                      key={vendor.id}
                      to={`/accounts/vendors/${vendor.id}`}
                      className="mm-rise group relative flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white p-5 transition-all duration-400 hover:-translate-y-1.5 hover:border-black/25 hover:shadow-[0_22px_48px_-18px_rgba(0,0,0,.35)]"
                      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-400 group-hover:scale-x-100 ${
                          owes
                            ? "bg-gradient-to-r from-amber-400 to-orange-500"
                            : advanced
                              ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                              : "bg-gradient-to-r from-zinc-400 to-zinc-600"
                        }`}
                      />
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B0B0F] text-white transition-all duration-400 group-hover:scale-110 group-hover:rotate-6">
                          <Store size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-black">{vendor.name}</p>
                          {vendor.category ? (
                            <span className="mt-1.5 inline-block rounded-md bg-black/5 px-2 py-0.5 text-[10px] font-black text-black/45">
                              {vendor.category}
                            </span>
                          ) : null}
                        </div>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-black/25 transition-all duration-400 group-hover:translate-x-1 group-hover:text-black"
                        />
                      </div>

                      <div className="mt-5 border-t border-black/6 pt-3.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/55">
                          {owes ? "You owe" : advanced ? "Advanced" : "Settled"}
                        </p>
                        <p
                          className={`mt-1 text-2xl font-black tracking-tight ${
                            owes ? "text-rose-600" : advanced ? "text-emerald-600" : "text-black/45"
                          }`}
                        >
                          {owes ? "−" : advanced ? "+" : ""}
                          {formatTaka(Math.abs(vendor.currentBalance))}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </EmployeeLayout>
  );
}
