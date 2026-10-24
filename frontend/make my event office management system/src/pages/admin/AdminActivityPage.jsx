import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Info,
  Layers3,
  Phone,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAllCalls, fetchAllMeetings } from "../../services/adminActivityService";

function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = String(dbDatetime).split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactDateTime(dbDatetime) {
  if (!dbDatetime) return "—";
  const [datePart, timePart] = String(dbDatetime).split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return String(dbDatetime);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLoggedDatetime(entry, kind) {
  return kind === "meeting" ? entry.meetingDatetime : entry.callDatetime;
}

function getGroupPeople(group) {
  return [
    ...new Set(
      [
        ...group.completed.map((entry) => entry.createdByName),
        ...group.nextEntries.map((entry) => entry.assignedEmployeeName),
      ].filter(Boolean),
    ),
  ];
}

function StatCard({ icon: Icon, label, value, caption, tone = "purple" }) {
  const tones = {
    purple: "bg-mme-purple text-white shadow-mme-purple/15",
    rose: "border-mme-pink/70 bg-white text-mme-purple",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-2xl border border-transparent p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${tone === "purple" ? "text-white/65" : "opacity-55"}`}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-black leading-none">{value}</p>
          {caption ? (
            <p className={`mt-2 text-[11px] font-semibold ${tone === "purple" ? "text-white/65" : "opacity-60"}`}>
              {caption}
            </p>
          ) : null}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === "purple" ? "bg-white/12" : "bg-white/70"}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function ActivityStatus({ hasCompleted, hasNext }) {
  if (hasNext) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
        <Clock3 size={11} /> Upcoming
      </span>
    );
  }

  if (hasCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
        <CheckCircle2 size={11} /> Completed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
      No activity
    </span>
  );
}

function ClientActivityTableRow({ kind, group, index }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const label = kind === "meeting" ? "Meeting" : "Call";
  const detailsPath = `/admin/activity/${kind === "meeting" ? "meetings" : "calls"}/${group.rowKey}`;
  const people = getGroupPeople(group);
  const latestCompleted = group.completed[0] || null;
  const nextEntry = group.nextEntries[0] || null;

  return (
    <>
      <tr
        className="group border-b border-mme-pink/35 bg-white transition-colors hover:bg-[#fff9fc]"
        style={{ animation: `fadeInUp 0.25s ease ${Math.min(index * 0.025, 0.25)}s both` }}
      >
        <td className="min-w-[250px] px-4 py-4 align-top">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex max-w-full items-start gap-3 text-left"
          >
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${expanded ? "border-mme-purple bg-mme-purple text-white" : "border-mme-pink/60 bg-mme-blush/35 text-mme-purple"}`}>
              <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-mme-purple" title={group.clientName || "Unnamed client"}>
                {group.clientName || "Unnamed client"}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-mme-purple/40">
                {group.completed.length + group.nextEntries.length} visible record{group.completed.length + group.nextEntries.length === 1 ? "" : "s"}
              </span>
            </span>
          </button>
        </td>

        <td className="min-w-[130px] px-4 py-4 align-top">
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            <CheckCircle2 size={14} />
            <span className="text-sm font-black">{group.completed.length}</span>
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-mme-purple/40">completed {label.toLowerCase()}{group.completed.length === 1 ? "" : "s"}</p>
        </td>

        <td className="min-w-[190px] px-4 py-4 align-top">
          {latestCompleted ? (
            <>
              <p className="text-xs font-black text-mme-purple">
                {compactDateTime(getLoggedDatetime(latestCompleted, kind))}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-mme-purple/45">
                <UserRound size={10} /> {latestCompleted.createdByName || "Unknown employee"}
              </p>
            </>
          ) : (
            <span className="text-xs font-semibold italic text-mme-purple/35">No completed activity</span>
          )}
        </td>

        <td className="min-w-[220px] px-4 py-4 align-top">
          {nextEntry ? (
            <div>
              <p className="text-xs font-black text-amber-700">{compactDateTime(nextEntry.datetime)}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-mme-purple/45">
                <UsersRound size={10} /> {nextEntry.assignedEmployeeName || "Unassigned"}
              </p>
              {group.nextEntries.length > 1 ? (
                <p className="mt-1 text-[10px] font-black text-amber-600">+{group.nextEntries.length - 1} more scheduled</p>
              ) : null}
            </div>
          ) : (
            <span className="text-xs font-semibold italic text-mme-purple/35">Nothing scheduled</span>
          )}
        </td>

        <td className="min-w-[190px] px-4 py-4 align-top">
          <div className="flex max-w-[220px] flex-wrap gap-1.5">
            {people.length ? (
              <>
                {people.slice(0, 2).map((name) => (
                  <span key={name} className="max-w-[150px] truncate rounded-full border border-mme-pink/55 bg-mme-blush/25 px-2.5 py-1 text-[10px] font-bold text-mme-purple" title={name}>
                    {name}
                  </span>
                ))}
                {people.length > 2 ? (
                  <span className="rounded-full bg-mme-purple px-2 py-1 text-[10px] font-black text-white">+{people.length - 2}</span>
                ) : null}
              </>
            ) : (
              <span className="text-xs font-semibold italic text-mme-purple/35">—</span>
            )}
          </div>
        </td>

        <td className="min-w-[130px] px-4 py-4 align-top">
          <ActivityStatus hasCompleted={group.completed.length > 0} hasNext={group.nextEntries.length > 0} />
        </td>

        <td className="sticky right-0 min-w-[150px] border-l border-mme-pink/25 bg-white px-4 py-4 align-top transition-colors group-hover:bg-[#fff9fc]">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-mme-pink/60 bg-white text-mme-purple transition hover:border-mme-purple hover:bg-mme-blush/35"
              title={expanded ? "Collapse row" : "Expand row"}
            >
              <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => navigate(detailsPath)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mme-purple px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-[#4b2c55] hover:shadow-md"
            >
              Details <ArrowUpRight size={12} />
            </button>
          </div>
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-mme-pink/35 bg-[#fffafd]">
          <td colSpan={7} className="px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-mme-pink/45 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-mme-pink/35 bg-emerald-50/60 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Completed {label}s</p>
                    <p className="mt-0.5 text-xs font-semibold text-mme-purple/50">Full visible history for this client</p>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">{group.completed.length}</span>
                </div>
                {group.completed.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left">
                      <thead>
                        <tr className="border-b border-mme-pink/30 bg-[#fffdfd]">
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">#</th>
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">Date &amp; time</th>
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">Logged by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.completed.map((entry, itemIndex) => (
                          <tr key={entry.id} className="border-b border-mme-pink/20 last:border-0">
                            <td className="px-4 py-2.5 text-xs font-black text-mme-purple/35">{itemIndex + 1}</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-mme-purple">{formatDisplay(getLoggedDatetime(entry, kind)) || "—"}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-mme-purple/65">{entry.createdByName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-5 text-xs font-semibold italic text-mme-purple/35">No completed {label.toLowerCase()} in the current filter.</p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-mme-pink/45 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-mme-pink/35 bg-amber-50/70 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Next {label}{group.nextEntries.length === 1 ? "" : "s"}</p>
                    <p className="mt-0.5 text-xs font-semibold text-mme-purple/50">Upcoming schedules and assignees</p>
                  </div>
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white">{group.nextEntries.length}</span>
                </div>
                {group.nextEntries.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left">
                      <thead>
                        <tr className="border-b border-mme-pink/30 bg-[#fffdfd]">
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">#</th>
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">Scheduled for</th>
                          <th className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-mme-purple/45">Assigned to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.nextEntries.map((next, itemIndex) => (
                          <tr key={`${next.datetime || "none"}-${next.assignedEmployeeName || "none"}-${itemIndex}`} className="border-b border-mme-pink/20 last:border-0">
                            <td className="px-4 py-2.5 text-xs font-black text-mme-purple/35">{itemIndex + 1}</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-amber-700">{formatDisplay(next.datetime) || "Not scheduled yet"}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-mme-purple/65">{next.assignedEmployeeName || "Unassigned"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-5 text-xs font-semibold italic text-mme-purple/35">No upcoming {label.toLowerCase()} in the current filter.</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

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
  const [showCompleted, setShowCompleted] = useState(true);
  const [showNext, setShowNext] = useState(true);
  const [filterEmployees, setFilterEmployees] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
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
        setEmployees(employeesData.filter((employee) => employee.isActive));
      })
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [admin]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const kind = tab === "meetings" ? "meeting" : "call";
  const list = tab === "meetings" ? meetings : calls;

  useEffect(() => {
    setFilterEmployees(new Set());
    setSearchText("");
  }, [tab]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
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

  const employeeCounts = useMemo(() => {
    const counts = new Map();
    for (const entry of list) {
      if (showCompleted && entry.hasCompletedDetails) {
        const loggedDate = getLoggedDatetime(entry, kind)?.slice(0, 10) || null;
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

    return employees
      .map((employee) => ({ name: employee.fullName, count: counts.get(employee.fullName) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [list, kind, showCompleted, showNext, dateFrom, dateTo, employees]);

  const clientGroups = useMemo(() => {
    const groups = new Map();

    for (const entry of list) {
      const loggedDatetime = getLoggedDatetime(entry, kind);
      const loggedDate = loggedDatetime?.slice(0, 10) || null;
      const isCompletedMatch =
        showCompleted &&
        entry.hasCompletedDetails &&
        passesEmployeeFilter(entry.createdByName) &&
        passesDateFilter(loggedDate);

      const next = kind === "meeting" ? entry.nextMeeting : entry.nextCall;
      const nextDatetime = next ? (kind === "meeting" ? next.nextMeetingDatetime : next.nextCallDatetime) : null;
      const nextDate = nextDatetime?.slice(0, 10) || null;
      const isNextMatch =
        showNext &&
        Boolean(next) &&
        passesEmployeeFilter(next?.assignedEmployeeName) &&
        passesDateFilter(nextDate);

      if (!isCompletedMatch && !isNextMatch) continue;

      if (!groups.has(entry.rowKey)) {
        groups.set(entry.rowKey, {
          rowKey: entry.rowKey,
          clientName: entry.clientName,
          completed: [],
          nextEntries: [],
        });
      }

      const group = groups.get(entry.rowKey);
      if (!group.clientName && entry.clientName) group.clientName = entry.clientName;
      if (isCompletedMatch) group.completed.push(entry);
      if (isNextMatch) {
        group.nextEntries.push({
          datetime: nextDatetime,
          assignedEmployeeName: next.assignedEmployeeName,
        });
      }
    }

    for (const group of groups.values()) {
      group.completed.sort((a, b) => String(getLoggedDatetime(b, kind) || "").localeCompare(String(getLoggedDatetime(a, kind) || "")));
      group.nextEntries.sort((a, b) => String(a.datetime || "").localeCompare(String(b.datetime || "")));
    }

    return [...groups.values()].filter((group) => group.completed.length > 0 || group.nextEntries.length > 0);
  }, [list, kind, showCompleted, showNext, filterEmployees, dateFrom, dateTo]);

  const totalClientCount = useMemo(() => new Set(list.map((entry) => entry.rowKey)).size, [list]);

  const visibleGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return clientGroups;

    return clientGroups.filter((group) => {
      if (String(group.clientName || "").toLowerCase().includes(query)) return true;
      return getGroupPeople(group).some((name) => String(name).toLowerCase().includes(query));
    });
  }, [clientGroups, searchText]);

  const visibleCompletedCount = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.completed.length, 0),
    [visibleGroups],
  );

  const visibleNextCount = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.nextEntries.length, 0),
    [visibleGroups],
  );

  function toggleFilterEmployee(name) {
    setFilterEmployees((previous) => {
      const next = new Set(previous);
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
    (showCompleted ? 0 : 1) +
    (showNext ? 0 : 1) +
    filterEmployees.size +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mb-5">
        <BackButton to="/admin-dashboard" title="Back to Admin Dashboard" />
      </div>

      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarClock size={14} /> Admin Control
          </div>
          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">Meeting &amp; Call Oversight</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-mme-purple/50">
            Review completed client activity, upcoming schedules and responsible employees from one operational table.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-2xl border border-mme-pink/60 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("meetings")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              tab === "meetings"
                ? "bg-mme-purple text-white shadow-md shadow-mme-purple/20"
                : "text-mme-purple/55 hover:bg-mme-blush/35 hover:text-mme-purple"
            }`}
          >
            <CalendarClock size={14} /> Meetings
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === "meetings" ? "bg-white/15" : "bg-mme-blush/60"}`}>
              {meetings.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("calls")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              tab === "calls"
                ? "bg-mme-purple text-white shadow-md shadow-mme-purple/20"
                : "text-mme-purple/55 hover:bg-mme-blush/35 hover:text-mme-purple"
            }`}
          >
            <Phone size={14} /> Calls
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === "calls" ? "bg-white/15" : "bg-mme-blush/60"}`}>
              {calls.length}
            </span>
          </button>
        </div>
      </div>

      {notice ? (
        <div className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-green-200 bg-green-50 text-green-700"
        }`}>
          {notice.message}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers3}
          label={tab === "meetings" ? "Meeting records" : "Call records"}
          value={list.length}
          caption={`${totalClientCount} clients in this activity type`}
          tone="purple"
        />
        <StatCard
          icon={UsersRound}
          label="Visible clients"
          value={visibleGroups.length}
          caption={activeFilterCount || searchText ? `Filtered from ${totalClientCount} clients` : "Current client coverage"}
          tone="rose"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={visibleCompletedCount}
          caption="Matching completed activities"
          tone="emerald"
        />
        <StatCard
          icon={Clock3}
          label="Upcoming"
          value={visibleNextCount}
          caption="Matching future schedules"
          tone="amber"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_12px_35px_rgba(91,55,101,0.08)]">
        <div className="flex flex-col gap-3 border-b border-mme-pink/45 bg-gradient-to-r from-white via-[#fffafd] to-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-mme-purple">Client activity table</p>
            <p className="mt-1 text-xs font-semibold text-mme-purple/45">
              Expand a client row for detailed history, or open the full activity record.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mme-purple/35" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search client or employee..."
                className="w-full rounded-xl border border-mme-pink/65 bg-white py-2.5 pl-9 pr-9 text-sm font-semibold text-mme-purple outline-none transition focus:border-mme-purple focus:ring-4 focus:ring-mme-pink/20"
              />
              {searchText ? (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-mme-purple/35 transition hover:bg-mme-blush hover:text-mme-purple"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>

            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowFilters((value) => !value);
                  if (!showFilters) setHoveredSection("employees");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mme-purple px-4 py-2.5 text-sm font-black text-white shadow-md shadow-mme-purple/20 transition hover:bg-[#4b2c55] sm:w-auto"
              >
                <SlidersHorizontal size={15} />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-black text-white">{activeFilterCount}</span>
                ) : null}
                <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`} />
              </button>

              {showFilters ? (
                <div className="absolute right-0 top-full z-50 mt-2 flex rounded-2xl border border-mme-pink/60 bg-white shadow-[0_20px_60px_rgba(91,55,101,0.18)]" style={{ minWidth: 480 }}>
                  <div className="w-56 shrink-0 border-r border-mme-pink/40 py-2">
                    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-mme-purple transition hover:bg-mme-blush/40">
                      <input
                        type="checkbox"
                        checked={showCompleted}
                        onChange={() => setShowCompleted((value) => !value)}
                        className="h-4 w-4 accent-mme-purple"
                      />
                      <CheckCircle2 size={14} className="shrink-0 text-mme-purple/60" />
                      Completed {tab === "meetings" ? "Meetings" : "Calls"}
                    </label>
                    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-mme-purple transition hover:bg-mme-blush/40">
                      <input
                        type="checkbox"
                        checked={showNext}
                        onChange={() => setShowNext((value) => !value)}
                        className="h-4 w-4 accent-mme-purple"
                      />
                      <CalendarClock size={14} className="shrink-0 text-mme-purple/60" />
                      Next {tab === "meetings" ? "Meetings" : "Calls"}
                    </label>

                    <div className="my-1.5 border-t border-mme-pink/30" />

                    <button
                      type="button"
                      onClick={() => setHoveredSection("employees")}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition ${
                        hoveredSection === "employees" ? "bg-mme-purple text-white" : "text-mme-purple hover:bg-mme-blush/40"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        Employees
                        {filterEmployees.size > 0 ? (
                          <span className={`h-2 w-2 rounded-full ${hoveredSection === "employees" ? "bg-white" : "bg-mme-purple"}`} />
                        ) : null}
                      </span>
                      <span className="text-xs opacity-60">›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHoveredSection("date")}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold transition ${
                        hoveredSection === "date" ? "bg-mme-purple text-white" : "text-mme-purple hover:bg-mme-blush/40"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        Date Range
                        {dateFrom || dateTo ? (
                          <span className={`h-2 w-2 rounded-full ${hoveredSection === "date" ? "bg-white" : "bg-mme-purple"}`} />
                        ) : null}
                      </span>
                      <span className="text-xs opacity-60">›</span>
                    </button>

                    {activeFilterCount > 0 ? (
                      <div className="mx-3 mt-2 border-t border-mme-pink/30 pt-2">
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-black text-red-500 transition hover:bg-red-50"
                        >
                          <X size={13} /> Clear all ({activeFilterCount})
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex-1 p-5">
                    {hoveredSection === "employees" ? (
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
                    ) : null}

                    {hoveredSection === "date" ? (
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
                              onChange={(event) => setDateFrom(event.target.value)}
                              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3 py-2 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-mme-purple/60">To</label>
                            <input
                              type="date"
                              value={dateTo}
                              onChange={(event) => setDateTo(event.target.value)}
                              className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-3 py-2 text-sm text-mme-purple outline-none transition focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {(activeFilterCount > 0 || searchText) && !isLoading ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mme-pink/35 bg-mme-blush/15 px-5 py-2.5">
            <p className="text-xs font-bold text-mme-purple/55">
              Showing <span className="font-black text-mme-purple">{visibleGroups.length}</span> of {totalClientCount} clients
            </p>
            <div className="flex items-center gap-2">
              {searchText ? (
                <button type="button" onClick={() => setSearchText("")} className="text-[11px] font-black text-mme-purple/55 hover:text-mme-purple">
                  Clear search
                </button>
              ) : null}
              {activeFilterCount > 0 ? (
                <button type="button" onClick={clearFilters} className="text-[11px] font-black text-red-500 hover:text-red-600">
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
            <p className="text-xs font-bold text-mme-purple/40">Loading activity...</p>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-mme-blush/45 text-mme-mauve">
              <UsersRound size={28} />
            </div>
            <p className="mt-4 text-lg font-black text-mme-purple">
              {list.length ? "No activity matches this view" : `No ${tab} logged yet`}
            </p>
            <p className="mt-1 max-w-md text-sm font-semibold text-mme-purple/40">
              {list.length ? "Try clearing the search, employee selection, date range or activity-status filters." : "New employee activity will appear here automatically."}
            </p>
            {list.length && (activeFilterCount > 0 || searchText) ? (
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setSearchText("");
                }}
                className="mt-5 rounded-xl bg-mme-purple px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#4b2c55]"
              >
                Reset view
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead>
                <tr className="border-b border-mme-pink/45 bg-[#fff9fc]">
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Client</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Completed</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Latest activity</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Next schedule</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Employees</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Status</th>
                  <th className="sticky right-0 border-l border-mme-pink/25 bg-[#fff9fc] px-4 py-3 text-right text-[9px] font-black uppercase tracking-[0.16em] text-mme-purple/45">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group, index) => (
                  <ClientActivityTableRow key={group.rowKey} kind={kind} group={group} index={index} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-mme-purple/40">
        <span className="inline-flex items-center gap-1.5"><Info size={12} /> Expand a row for quick history.</span>
        <span className="inline-flex items-center gap-1.5"><ArrowUpRight size={12} /> Details opens the complete client activity page.</span>
      </div>
    </AdminLayout>
  );
}
