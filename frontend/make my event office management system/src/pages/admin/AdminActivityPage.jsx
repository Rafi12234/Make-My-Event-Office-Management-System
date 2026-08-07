import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Info,
  Phone,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";

function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = dbDatetime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Activity Row ────────────────────────────────────────────────────────────
// Two fully separate cards per client: the conducted meeting/call (who
// logged it + Details drill-down) and the upcoming schedule (when + who
// it's assigned to), each repeating the client name. Only the card matching
// the active filter type is shown — Completed → conducted card only,
// Next Meeting/Call → next-schedule card only, otherwise both.
function ActivityRow({ kind, entry, filterType }) {
  const navigate = useNavigate();
  const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
  const loggedDatetime = kind === "meeting" ? entry.meetingDatetime : entry.callDatetime;
  const nextDatetime = next ? (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime) : null;
  const showConducted = filterType !== "upcoming";
  const showNext = filterType !== "completed";

  return (
    <>
      {showConducted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
          <div className="min-w-0">
            <p className="truncate font-black text-mme-purple">{entry.clientName || "Unnamed client"}</p>
            <p className="mt-0.5 text-xs text-mme-purple/55">
              Conducted {kind}: {formatDisplay(loggedDatetime) || "—"} {"\u00b7"} Logged by{" "}
              <span className="font-bold text-mme-purple/75">{entry.createdByName || "—"}</span>
            </p>
          </div>
          <button
            onClick={() => navigate(`/admin/activity/${kind === "meeting" ? "meetings" : "calls"}/${entry.rowKey}`)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
          >
            <Info size={12} /> Details
          </button>
        </div>
      )}

      {showNext && (
        <div className="rounded-2xl border border-mme-pink/50 bg-white px-4 py-3.5 transition hover:border-mme-pink hover:shadow-sm">
          <p className="truncate font-black text-mme-purple">{entry.clientName || "Unnamed client"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <p className="text-xs">
              <span className="font-black uppercase tracking-wide text-mme-purple/40">Next {kind}: </span>
              <span className={`font-bold ${nextDatetime ? "text-mme-purple" : "italic text-mme-purple/35"}`}>
                {nextDatetime ? formatDisplay(nextDatetime) : `No upcoming ${kind}`}
              </span>
            </p>
            <p className="text-xs">
              <span className="font-black uppercase tracking-wide text-mme-purple/40">Assigned To: </span>
              <span className={`font-bold ${next?.assignedEmployeeName ? "text-mme-purple" : "italic text-mme-purple/35"}`}>
                {next?.assignedEmployeeName || "Unassigned"}
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminActivityPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("meetings");
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [filterType, setFilterType] = useState("all"); // "all" | "completed" | "upcoming"
  const [filterEmployees, setFilterEmployees] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null); // "completed" | "upcoming" | "date" | null
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        if (!me) return navigate("/admin/login", { replace: true });
        setAdmin(me);
      })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    Promise.all([fetchAllMeetings(), fetchAllCalls(), fetchAllEmployees()])
      .then(([meetingsData, callsData, employeesData]) => {
        setMeetings(meetingsData);
        setCalls(callsData);
        setEmployees(employeesData.filter((e) => e.isActive));
      })
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const kind = tab === "meetings" ? "meeting" : "call";
  const list = tab === "meetings" ? meetings : calls;

  // Switching tabs or the active category invalidates whichever employees
  // were previously checked (the two categories filter by a different
  // person — who logged it vs. who it's assigned to).
  useEffect(() => {
    setFilterEmployees(new Set());
  }, [tab, filterType]);

  // Close the dropdown on an outside click, same behavior as
  // ManagementPage.jsx's Filters dropdown.
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    }
    if (showFilters) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  const typeFiltered = useMemo(() => {
    if (filterType === "completed") return list.filter((e) => e.hasCompletedDetails);
    if (filterType === "upcoming") return list.filter((e) => Boolean(kind === "meeting" ? e.nextMeeting : e.nextCall));
    return list;
  }, [list, filterType, kind]);

  function employeeNameFor(entry) {
    if (filterType === "upcoming") {
      return (kind === "meeting" ? entry.nextMeeting?.assignedEmployeeName : entry.nextCall?.assignedEmployeeName) || null;
    }
    return entry.createdByName || null;
  }

  // Date Range filters against whichever date is being shown for the active
  // category — the next-schedule date under "Next Meeting/Call", otherwise
  // the conducted meeting/call date — same "YYYY-MM-DD" comparison
  // ManagementPage.jsx's date-range filter uses.
  function dateValueFor(entry) {
    let dt;
    if (filterType === "upcoming") {
      const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
      dt = next ? (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime) : null;
    } else {
      dt = kind === "meeting" ? entry.meetingDatetime : entry.callDatetime;
    }
    return dt ? dt.slice(0, 10) : null;
  }

  const employeeCounts = useMemo(() => {
    if (filterType === "all") return [];
    const counts = new Map();
    for (const entry of typeFiltered) {
      const name = employeeNameFor(entry);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    // Show every employee the admin created, not just those with a match —
    // the count is 0 for anyone with no completed/upcoming entries here.
    return employees
      .map((emp) => ({ name: emp.fullName, count: counts.get(emp.fullName) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [typeFiltered, filterType, kind, employees]);

  const filteredList = useMemo(() => {
    let result = typeFiltered;
    if (filterEmployees.size > 0) {
      result = result.filter((entry) => filterEmployees.has(employeeNameFor(entry)));
    }
    if (dateFrom || dateTo) {
      result = result.filter((entry) => {
        const date = dateValueFor(entry);
        if (!date) return false;
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date > dateTo) return false;
        return true;
      });
    }
    return result;
  }, [typeFiltered, filterEmployees, filterType, kind, dateFrom, dateTo]);

  function toggleFilterEmployee(name) {
    setFilterEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectCategory(key) {
    setFilterType(key);
    setHoveredSection(key);
  }

  function clearFilters() {
    setFilterType("all");
    setFilterEmployees(new Set());
    setDateFrom("");
    setDateTo("");
    setHoveredSection(null);
  }

  const activeFilterCount =
    (filterType !== "all" ? 1 : 0) + filterEmployees.size + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
        <div className="mb-5">
          <BackButton to="/admin-dashboard" title="Back to Admin Dashboard" />
        </div>

        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarClock size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Meeting &amp; Call Oversight</h1>
          
        </div>

        {notice && (
          <div className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-green-200 bg-green-50 text-green-700"
          }`}>
            {notice.message}
          </div>
        )}

        <div className="rounded-3xl border border-mme-pink/60 bg-white shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mme-pink/50 px-6 py-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab("meetings")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
                  tab === "meetings" ? "bg-mme-purple text-white" : "text-mme-purple/60 hover:bg-mme-blush/40"
                }`}
              >
                <CalendarClock size={13} /> Meetings ({meetings.length})
              </button>
              <button
                onClick={() => setTab("calls")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
                  tab === "calls" ? "bg-mme-purple text-white" : "text-mme-purple/60 hover:bg-mme-blush/40"
                }`}
              >
                <Phone size={13} /> Calls ({calls.length})
              </button>
            </div>

            {/* ── Filters dropdown (matches ManagementPage.jsx's Filters UI) ── */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => {
                  setShowFilters((v) => !v);
                  if (!showFilters) setHoveredSection(filterType !== "all" ? filterType : null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-mme-purple px-4 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/20 transition hover:bg-[#4b2c55]"
              >
                <SlidersHorizontal size={15} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-black text-white">{activeFilterCount}</span>
                )}
                <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 top-full z-50 mt-2 flex rounded-2xl border border-mme-pink/60 bg-white shadow-[0_20px_60px_rgba(91,55,101,0.18)]" style={{ minWidth: 480 }}>
                  {/* Left — category list */}
                  <div className="w-56 shrink-0 border-r border-mme-pink/40 py-2">
                    {[
                      { key: "completed", label: `Completed ${tab === "meetings" ? "Meetings" : "Calls"}`, hasValue: filterType === "completed" },
                      { key: "upcoming", label: `Next ${tab === "meetings" ? "Meetings" : "Calls"}`, hasValue: filterType === "upcoming" },
                    ].map(({ key, label, hasValue }) => (
                      <button
                        key={key}
                        onClick={() => selectCategory(key)}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition ${
                          hoveredSection === key ? "bg-mme-purple text-white" : "text-mme-purple hover:bg-mme-blush/40"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {label}
                          {hasValue && (
                            <span className={`h-2 w-2 rounded-full ${hoveredSection === key ? "bg-white" : "bg-mme-purple"}`} />
                          )}
                        </span>
                        <span className="text-xs opacity-60">{"\u203a"}</span>
                      </button>
                    ))}

                    <button
                      onClick={() => setHoveredSection("date")}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition ${
                        hoveredSection === "date" ? "bg-mme-purple text-white" : "text-mme-purple hover:bg-mme-blush/40"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        Date Range
                        {(dateFrom || dateTo) && (
                          <span className={`h-2 w-2 rounded-full ${hoveredSection === "date" ? "bg-white" : "bg-mme-purple"}`} />
                        )}
                      </span>
                      <span className="text-xs opacity-60">{"\u203a"}</span>
                    </button>

                    {activeFilterCount > 0 && (
                      <div className="mx-3 mt-2 border-t border-mme-pink/30 pt-2">
                        <button
                          onClick={clearFilters}
                          className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black text-red-500 transition hover:bg-red-50"
                        >
                          <X size={13} /> Clear all ({activeFilterCount})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right — employee options for the hovered/selected category */}
                  <div className="flex-1 p-5">
                    {hoveredSection === null && (
                      <div className="flex h-full min-h-32 items-center justify-center text-center">
                        <div>
                          <SlidersHorizontal size={26} className="mx-auto text-mme-mauve" />
                          <p className="mt-3 text-sm font-bold text-mme-purple/50">Choose a category to filter</p>
                        </div>
                      </div>
                    )}

                    {(hoveredSection === "completed" || hoveredSection === "upcoming") && (
                      <div>
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">
                          {hoveredSection === "completed" ? <CheckCircle2 size={12} /> : <CalendarClock size={12} />}
                          {hoveredSection === "completed" ? "Logged By" : "Assigned To"}
                        </p>
                        {employeeCounts.length === 0 ? (
                          <p className="text-sm font-bold text-mme-purple/40">No {tab} match this category yet.</p>
                        ) : (
                          <div className="max-h-64 space-y-1 overflow-y-auto">
                            {employeeCounts.map(({ name, count }) => (
                              <label key={name} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-mme-blush/30">
                                <input
                                  type="checkbox"
                                  checked={filterEmployees.has(name)}
                                  onChange={() => toggleFilterEmployee(name)}
                                  className="h-4 w-4 accent-mme-purple"
                                />
                                <span className="flex-1 text-sm font-bold text-mme-purple">{name}</span>
                                <span className="text-xs font-black text-mme-purple/50">{count}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {hoveredSection === "date" && (
                      <div>
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">
                          Date Range ({filterType === "upcoming" ? "Next" : "Conducted"} {tab === "meetings" ? "Meeting" : "Call"})
                        </p>
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-mme-purple/60">From</label>
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3 py-2 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-mme-purple/60">To</label>
                            <input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3 py-2 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {!isLoading && activeFilterCount > 0 && (
              <p className="mb-4 text-xs font-bold text-mme-purple/50">
                {filteredList.length} of {list.length} {tab}
              </p>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
              </div>
            ) : !filteredList.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UsersRound size={38} className="text-mme-mauve" />
                <p className="mt-4 font-black text-mme-purple">
                  {list.length ? "No results match this filter." : `No ${tab} logged yet`}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredList.map((entry) => (
                  <ActivityRow
                    key={entry.id}
                    kind={kind}
                    entry={entry}
                    filterType={filterType}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
    </AdminLayout>
  );
}
