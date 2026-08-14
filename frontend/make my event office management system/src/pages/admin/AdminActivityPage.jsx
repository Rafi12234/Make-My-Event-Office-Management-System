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

// ─── Client Group Row ────────────────────────────────────────────────────────
// One row per client with a dropdown: expanding it reveals exactly two
// subrows — every completed meeting/call for that client (date-wise, with a
// single Details button opening the full history) and every currently
// scheduled next-meeting/next-call (each meeting/call can carry its own
// independent next-schedule, so more than one may be active at once). Any
// newly logged meeting/call or newly scheduled next-date for the same
// client folds into these same two subrows automatically (grouped by
// rowKey), never creating new ones.
function ClientGroupRow({ kind, group }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const label = kind === "meeting" ? "Meeting" : "Call";
  const loggedDatetimeKey = kind === "meeting" ? "meetingDatetime" : "callDatetime";

  return (
    <div className="rounded-2xl border border-mme-pink/50 bg-white transition hover:border-mme-pink hover:shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <p className="truncate font-black text-mme-purple">{group.clientName || "Unnamed client"}</p>
        <ChevronDown size={16} className={`shrink-0 text-mme-purple/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-mme-pink/30 px-4 py-3.5">
          {group.completed.length > 0 && (
            <div className="rounded-xl border border-mme-pink/40 bg-[#fff9fc] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                  Completed {label}s ({group.completed.length})
                </p>
                <button
                  onClick={() => navigate(`/admin/activity/${kind === "meeting" ? "meetings" : "calls"}/${group.rowKey}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
                >
                  <Info size={11} /> Details
                </button>
              </div>
              <ul className="space-y-1">
                {group.completed.map((entry) => (
                  <li key={entry.id} className="text-xs text-mme-purple/70">
                    {formatDisplay(entry[loggedDatetimeKey]) || "—"} {"\u00b7"} Logged by{" "}
                    <span className="font-bold text-mme-purple/85">{entry.createdByName || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {group.nextEntries.length > 0 && (
            <div className="rounded-xl border border-mme-pink/40 bg-[#fff9fc] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                Next {label}{group.nextEntries.length !== 1 ? "s" : ""} ({group.nextEntries.length})
              </p>
              <ul className="mt-1 space-y-1">
                {group.nextEntries.map((next, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-bold text-mme-purple">{formatDisplay(next.datetime) || "Not scheduled yet"}</span>
                    <span className="ml-2 font-normal text-mme-purple/60">
                      Assigned To <span className="font-bold text-mme-purple">{next.assignedEmployeeName || "Unassigned"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {group.completed.length === 0 && group.nextEntries.length === 0 && (
            <p className="text-xs italic text-mme-purple/40">No completed or upcoming {kind} for this client.</p>
          )}
        </div>
      )}
    </div>
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
  // Completed and Next are independent toggles (both on by default) so an
  // admin can see both at once for the same employee/date range — they are
  // no longer a single mutually-exclusive category choice.
  const [showCompleted, setShowCompleted] = useState(true);
  const [showNext, setShowNext] = useState(true);
  const [filterEmployees, setFilterEmployees] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null); // "employees" | "date" | null
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

  // Switching tabs invalidates whichever employees were previously checked —
  // a name checked on the Meetings tab may not even appear on the Calls tab.
  useEffect(() => {
    setFilterEmployees(new Set());
  }, [tab]);

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

  function passesEmployeeFilter(name) {
    return filterEmployees.size === 0 || (name && filterEmployees.has(name));
  }

  function passesDateFilter(dateOnly) {
    if (!dateFrom && !dateTo) return true;
    if (!dateOnly) return false;
    if (dateFrom && dateOnly < dateFrom) return false;
    if (dateTo && dateOnly > dateTo) return false;
    return true;
  }

  // The employee list applies to BOTH categories at once, matched against
  // whichever role is relevant to that subrow — who logged the completed
  // entry, or who the next-schedule is assigned to — so picking one employee
  // and a date range surfaces their completed AND next entries together,
  // instead of forcing an either/or category choice first.
  const employeeCounts = useMemo(() => {
    const counts = new Map();
    for (const entry of list) {
      if (showCompleted && entry.hasCompletedDetails) {
        const loggedDate = (kind === "meeting" ? entry.meetingDatetime : entry.callDatetime)?.slice(0, 10) || null;
        if (entry.createdByName && passesDateFilter(loggedDate)) {
          counts.set(entry.createdByName, (counts.get(entry.createdByName) || 0) + 1);
        }
      }
      const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
      if (showNext && next) {
        const nextDate = (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime)?.slice(0, 10) || null;
        if (next.assignedEmployeeName && passesDateFilter(nextDate)) {
          counts.set(next.assignedEmployeeName, (counts.get(next.assignedEmployeeName) || 0) + 1);
        }
      }
    }
    // Show every employee the admin created, not just those with a match —
    // the count is 0 for anyone with no completed/upcoming entries here.
    return employees
      .map((emp) => ({ name: emp.fullName, count: counts.get(emp.fullName) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [list, kind, showCompleted, showNext, dateFrom, dateTo, employees]);

  // Groups every meeting/call by client (rowKey) into two independent
  // subrows — completed history and scheduled next-meeting/next-call — each
  // filtered on its own terms (Completed matches by who logged it, Next
  // matches by who it's assigned to) so the SAME employee + date range can
  // surface both at once for a client instead of one excluding the other.
  const clientGroups = useMemo(() => {
    const groups = new Map();
    for (const entry of list) {
      const loggedDate = (kind === "meeting" ? entry.meetingDatetime : entry.callDatetime)?.slice(0, 10) || null;
      const isCompletedMatch =
        showCompleted && entry.hasCompletedDetails && passesEmployeeFilter(entry.createdByName) && passesDateFilter(loggedDate);

      const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
      const nextDatetime = next ? (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime) : null;
      const nextDate = nextDatetime?.slice(0, 10) || null;
      const isNextMatch = showNext && Boolean(next) && passesEmployeeFilter(next?.assignedEmployeeName) && passesDateFilter(nextDate);

      if (!isCompletedMatch && !isNextMatch) continue;

      if (!groups.has(entry.rowKey)) {
        groups.set(entry.rowKey, { rowKey: entry.rowKey, clientName: entry.clientName, completed: [], nextEntries: [] });
      }
      const group = groups.get(entry.rowKey);
      if (!group.clientName && entry.clientName) group.clientName = entry.clientName;
      if (isCompletedMatch) group.completed.push(entry);
      if (isNextMatch) group.nextEntries.push({ datetime: nextDatetime, assignedEmployeeName: next.assignedEmployeeName });
    }
    for (const group of groups.values()) {
      group.nextEntries.sort((a, b) => (a.datetime || "").localeCompare(b.datetime || ""));
    }
    // A logged meeting/call with no discussion/items and no upcoming
    // follow-up carries nothing worth showing the admin — drop those empty
    // client cards instead of rendering a group with no content at all.
    return [...groups.values()].filter((group) => group.completed.length > 0 || group.nextEntries.length > 0);
  }, [list, kind, showCompleted, showNext, filterEmployees, dateFrom, dateTo]);

  const totalClientCount = useMemo(() => new Set(list.map((e) => e.rowKey)).size, [list]);

  function toggleFilterEmployee(name) {
    setFilterEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearFilters() {
    setShowCompleted(true);
    setShowNext(true);
    setFilterEmployees(new Set());
    setDateFrom("");
    setDateTo("");
    setHoveredSection(null);
  }

  const activeFilterCount =
    (showCompleted ? 0 : 1) + (showNext ? 0 : 1) + filterEmployees.size + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

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
                  if (!showFilters) setHoveredSection("employees");
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
                  {/* Left — category toggles + section nav */}
                  <div className="w-56 shrink-0 border-r border-mme-pink/40 py-2">
                    {/* Completed/Next are checkboxes, not a single category
                        choice — both can stay checked so an employee's
                        completed AND next entries show together. */}
                    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-mme-purple transition hover:bg-mme-blush/40">
                      <input
                        type="checkbox"
                        checked={showCompleted}
                        onChange={() => setShowCompleted((v) => !v)}
                        className="h-4 w-4 accent-mme-purple"
                      />
                      <CheckCircle2 size={14} className="shrink-0 text-mme-purple/60" />
                      Completed {tab === "meetings" ? "Meetings" : "Calls"}
                    </label>
                    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-mme-purple transition hover:bg-mme-blush/40">
                      <input
                        type="checkbox"
                        checked={showNext}
                        onChange={() => setShowNext((v) => !v)}
                        className="h-4 w-4 accent-mme-purple"
                      />
                      <CalendarClock size={14} className="shrink-0 text-mme-purple/60" />
                      Next {tab === "meetings" ? "Meetings" : "Calls"}
                    </label>

                    <div className="my-1.5 border-t border-mme-pink/30" />

                    <button
                      onClick={() => setHoveredSection("employees")}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition ${
                        hoveredSection === "employees" ? "bg-mme-purple text-white" : "text-mme-purple hover:bg-mme-blush/40"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        Employees
                        {filterEmployees.size > 0 && (
                          <span className={`h-2 w-2 rounded-full ${hoveredSection === "employees" ? "bg-white" : "bg-mme-purple"}`} />
                        )}
                      </span>
                      <span className="text-xs opacity-60">{"\u203a"}</span>
                    </button>

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

                  {/* Right — employee list / date range for the selected section */}
                  <div className="flex-1 p-5">
                    {hoveredSection === "employees" && (
                      <div>
                        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-mme-plum">
                          <UsersRound size={12} /> Logged By / Assigned To
                        </p>
                        {employeeCounts.length === 0 ? (
                          <p className="text-sm font-bold text-mme-purple/40">No {tab} match the categories above yet.</p>
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
                          Date Range ({tab === "meetings" ? "Meeting" : "Call"} conducted or scheduled)
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
                {clientGroups.length} of {totalClientCount} clients match these filters
              </p>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
              </div>
            ) : !clientGroups.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UsersRound size={38} className="text-mme-mauve" />
                <p className="mt-4 font-black text-mme-purple">
                  {list.length ? "No results match this filter." : `No ${tab} logged yet`}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {clientGroups.map((group) => (
                  <ClientGroupRow key={group.rowKey} kind={kind} group={group} />
                ))}
              </div>
            )}
          </div>
        </div>
    </AdminLayout>
  );
}
