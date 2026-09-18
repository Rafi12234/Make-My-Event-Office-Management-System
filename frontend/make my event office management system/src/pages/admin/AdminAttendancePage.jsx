import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Clock,
  Eye,
  MapPin,
  X,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  Activity,
  Timer,
  LogIn,
  LogOut,
} from "lucide-react";

import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAdminAttendance } from "../../services/adminAttendanceService";

function formatDisplayTime(dbDateTime) {
  if (!dbDateTime) return "—";

  const [datePart, timePart] = dbDateTime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);

  if (Number.isNaN(date.getTime())) return dbDateTime;

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDisplayDate(dbDate) {
  if (!dbDate) return "—";
  const date = new Date(dbDate);
  if (Number.isNaN(date.getTime())) return dbDate;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWorkHours(minutes) {
  if (minutes === null || minutes === undefined) return "—";

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return "bg-slate-400";
  const colors = [
    "bg-gradient-to-br from-purple-500 to-pink-500",
    "bg-gradient-to-br from-blue-500 to-cyan-500",
    "bg-gradient-to-br from-emerald-500 to-teal-500",
    "bg-gradient-to-br from-orange-500 to-red-500",
    "bg-gradient-to-br from-indigo-500 to-purple-500",
    "bg-gradient-to-br from-pink-500 to-rose-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function getLocationLabel(insideOffice, hasLocation, actionCompleted = true) {
  if (!actionCompleted) return "Pending";
  if (!hasLocation) return "No GPS Data";
  if (insideOffice === true) return "In Office";
  if (insideOffice === false) return "Remote";
  return "Captured";
}

function getLocationBadgeClass(insideOffice, hasLocation, actionCompleted = true) {
  if (!actionCompleted) {
    return "border-slate-200 bg-slate-100 text-slate-500";
  }
  if (!hasLocation) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (insideOffice === true) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (insideOffice === false) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getLocationIcon(insideOffice, hasLocation, actionCompleted = true) {
  if (!actionCompleted) return <Clock size={11} />;
  if (!hasLocation) return <AlertCircle size={11} />;
  if (insideOffice === true) return <CheckCircle2 size={11} />;
  return <MapPin size={11} />;
}

function LocationCell({
  insideOffice,
  latitude,
  longitude,
  actionAt,
  actionCompleted = true,
  onView,
  actionLabel,
  icon: ActionIcon,
}) {
  const hasLocation =
    latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
  const label = getLocationLabel(insideOffice, hasLocation, actionCompleted);

  if (!actionCompleted) {
    return (
      <div className="flex min-w-[200px] items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <ActionIcon size={15} />
        </div>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <Clock size={10} />
            Pending
          </span>
          <p className="mt-1 text-[11px] font-bold text-slate-400">Not recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          insideOffice === true
            ? "bg-emerald-50 text-emerald-600"
            : insideOffice === false
            ? "bg-red-50 text-red-600"
            : "bg-mme-blush/30 text-mme-purple"
        }`}
      >
        <ActionIcon size={15} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black text-mme-purple">{formatDisplayTime(actionAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${getLocationBadgeClass(
              insideOffice,
              hasLocation,
              actionCompleted,
            )}`}
          >
            {getLocationIcon(insideOffice, hasLocation, actionCompleted)}
            {label}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onView}
        disabled={!hasLocation}
        title={hasLocation ? `View ${actionLabel.toLowerCase()} location` : "Location unavailable"}
        aria-label={`View ${actionLabel.toLowerCase()} location`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-mme-pink/60 bg-white text-mme-purple transition hover:border-mme-purple hover:bg-mme-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-mme-purple"
      >
        <Eye size={14} />
      </button>
    </div>
  );
}

function LocationModal({ location, onClose }) {
  if (!location) return null;

  const {
    title,
    employeeName,
    attendanceDate,
    actionAt,
    latitude,
    longitude,
    accuracy,
    distanceFromOffice,
    insideOffice,
  } = location;

  const hasCoordinates =
    latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="relative overflow-hidden bg-gradient-to-br from-mme-purple to-purple-700 px-6 py-5">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-mme-pink/20 blur-xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <MapPin size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">{title}</h2>
                <p className="mt-0.5 text-xs font-bold text-white/70">
                  {employeeName || "Unknown employee"} · {formatDisplayDate(attendanceDate)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div
            className={`rounded-2xl border-2 p-4 ${
              insideOffice === true
                ? "border-emerald-200 bg-emerald-50/50"
                : insideOffice === false
                ? "border-red-200 bg-red-50/50"
                : "border-amber-200 bg-amber-50/50"
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-mme-purple/50">
              Location Status
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${getLocationBadgeClass(
                  insideOffice,
                  hasCoordinates,
                  true,
                )}`}
              >
                {getLocationIcon(insideOffice, hasCoordinates, true)}
                {getLocationLabel(insideOffice, hasCoordinates, true)}
              </span>

              {distanceFromOffice !== null && distanceFromOffice !== undefined ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-mme-purple shadow-sm">
                  <Activity size={11} />
                  {distanceFromOffice} m from office
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-mme-pink/40 bg-gradient-to-br from-white to-mme-blush/10 p-4">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-mme-purple/60" />
                <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                  Action Time
                </p>
              </div>
              <p className="mt-1.5 text-base font-black text-mme-purple">
                {formatDisplayTime(actionAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-mme-pink/40 bg-gradient-to-br from-white to-mme-blush/10 p-4">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-mme-purple/60" />
                <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                  GPS Accuracy
                </p>
              </div>
              <p className="mt-1.5 text-base font-black text-mme-purple">
                {accuracy !== null && accuracy !== undefined ? `±${accuracy} m` : "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-mme-pink/40 bg-gradient-to-br from-white to-mme-blush/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                Latitude
              </p>
              <p className="mt-1.5 break-all font-mono text-xs font-black text-mme-purple">
                {latitude ?? "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-mme-pink/40 bg-gradient-to-br from-white to-mme-blush/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">
                Longitude
              </p>
              <p className="mt-1.5 break-all font-mono text-xs font-black text-mme-purple">
                {longitude ?? "—"}
              </p>
            </div>
          </div>

          {hasCoordinates ? (
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mme-purple to-purple-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
            >
              <MapPin size={15} className="transition-transform group-hover:scale-110" />
              Open Location in Google Maps
            </a>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-700">
              <AlertCircle size={14} className="mr-1 inline" />
              No GPS location was recorded for this action.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAttendancePage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

    fetchAllEmployees()
      .then((data) => setEmployees(data.filter((employee) => employee.isActive)))
      .catch((error) => setNotice({ type: "error", message: error.message }));
  }, [admin]);

  useEffect(() => {
    if (!admin) return;

    setIsLoading(true);

    fetchAdminAttendance({
      employeeId,
      date,
      from: date ? "" : dateFrom,
      to: date ? "" : dateTo,
    })
      .then(setRecords)
      .catch((error) => setNotice({ type: "error", message: error.message }))
      .finally(() => setIsLoading(false));
  }, [admin, employeeId, date, dateFrom, dateTo]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!selectedLocation) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape") setSelectedLocation(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedLocation]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const hasActiveFilters = useMemo(
    () => Boolean(employeeId || date || dateFrom || dateTo || searchQuery),
    [employeeId, date, dateFrom, dateTo, searchQuery],
  );

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter((record) =>
      (record.employeeName || "").toLowerCase().includes(query),
    );
  }, [records, searchQuery]);

  function clearFilters() {
    setEmployeeId("");
    setDate("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  }

  function showSignInLocation(record) {
    setSelectedLocation({
      title: "Sign In Location",
      employeeName: record.employeeName,
      attendanceDate: record.attendanceDate,
      actionAt: record.signInAt,
      latitude: record.signInLatitude,
      longitude: record.signInLongitude,
      accuracy: record.signInAccuracy,
      distanceFromOffice: record.signInDistanceFromOffice,
      insideOffice: record.signInInsideOffice,
    });
  }

  function showSignOutLocation(record) {
    setSelectedLocation({
      title: "Sign Out Location",
      employeeName: record.employeeName,
      attendanceDate: record.attendanceDate,
      actionAt: record.signOutAt,
      latitude: record.signOutLatitude,
      longitude: record.signOutLongitude,
      accuracy: record.signOutAccuracy,
      distanceFromOffice: record.signOutDistanceFromOffice,
      insideOffice: record.signOutInsideOffice,
    });
  }

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mme-purple to-purple-700 text-white shadow-lg shadow-mme-purple/20">
              <Clock size={22} />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-mme-purple">
              Attendance Management
            </h1>
            <p className="text-sm font-bold text-mme-plum/70">
              Track employee sign-ins, sign-outs, and work hours in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Notice */}
      {notice ? (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold shadow-sm animate-in slide-in-from-top duration-300 ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-mme-pink/50 bg-mme-blush/30 text-mme-purple"
          }`}
        >
          {notice.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {notice.message}
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-5 rounded-2xl border border-mme-pink/50 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mme-blush/30 text-mme-purple">
              <Filter size={14} />
            </div>
            <h3 className="text-sm font-black text-mme-purple">Filter Records</h3>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
            >
              <X size={12} />
              Clear All
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-mme-purple/60">
              Search
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-mme-purple/40"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by employee name..."
                className="w-full rounded-lg border border-mme-pink/60 bg-white py-2 pl-9 pr-3 text-sm font-medium text-mme-purple placeholder:text-mme-purple/30 transition focus:border-mme-purple focus:outline-none focus:ring-2 focus:ring-mme-purple/10"
              />
            </div>
          </div>

          {/* Employee */}
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-mme-purple/60">
              Employee
            </label>
            <div className="relative">
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full appearance-none rounded-lg border border-mme-pink/60 bg-white py-2 pl-3 pr-8 text-sm font-medium text-mme-purple transition focus:border-mme-purple focus:outline-none focus:ring-2 focus:ring-mme-purple/10"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/40"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-mme-purple/60">
              Specific Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-mme-pink/60 bg-white px-3 py-2 text-sm font-medium text-mme-purple transition focus:border-mme-purple focus:outline-none focus:ring-2 focus:ring-mme-purple/10"
            />
          </div>

          {/* Range */}
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-mme-purple/60">
              Date Range
            </label>
            <div className="flex gap-1">
              <input
                type="date"
                value={dateFrom}
                disabled={Boolean(date)}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-lg border border-mme-pink/60 bg-white px-2 py-2 text-xs font-medium text-mme-purple transition focus:border-mme-purple focus:outline-none focus:ring-2 focus:ring-mme-purple/10 disabled:cursor-not-allowed disabled:opacity-40"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                disabled={Boolean(date)}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-lg border border-mme-pink/60 bg-white px-2 py-2 text-xs font-medium text-mme-purple transition focus:border-mme-purple focus:outline-none focus:ring-2 focus:ring-mme-purple/10 disabled:cursor-not-allowed disabled:opacity-40"
                placeholder="To"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-2xl border border-mme-pink/40 bg-white px-4 py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-mme-pink/30 border-t-mme-purple" />
          <p className="text-sm font-bold text-mme-purple/60">Loading attendance records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-mme-pink/40 bg-white px-4 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mme-blush/30 text-mme-purple/60">
            <Calendar size={22} />
          </div>
          <p className="text-sm font-black text-mme-purple">No records found</p>
          <p className="mt-1 text-xs font-bold text-mme-purple/50">
            {hasActiveFilters
              ? "Try adjusting your filters to see more results."
              : "Attendance records will appear here."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-mme-purple px-4 py-2 text-xs font-black text-white transition hover:opacity-90"
            >
              Clear Filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mme-pink/50 bg-white shadow-sm">
          <div className="border-b border-mme-pink/30 bg-gradient-to-r from-mme-blush/20 to-mme-blush/5 px-5 py-3">
            <p className="text-xs font-black text-mme-purple">
              Showing{" "}
              <span className="font-black text-mme-purple">{filteredRecords.length}</span> record
              {filteredRecords.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="border-b-2 border-mme-pink/40 bg-mme-blush/30">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-mme-purple">
                    Employee
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-mme-purple">
                    <div className="flex items-center gap-2">
                      <LogIn size={14} className="stroke-[2.5]" />
                      <span>Sign In</span>
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-mme-purple">
                    <div className="flex items-center gap-2">
                      <LogOut size={14} className="stroke-[2.5]" />
                      <span>Sign Out</span>
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-mme-purple">
                    <div className="flex items-center gap-2">
                      <Timer size={14} className="stroke-[2.5]" />
                      <span>Work Hours</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-mme-pink/20">
                {filteredRecords.map((record) => {
                  const hasSignedIn = Boolean(record.signInAt);
                  const hasSignedOut = Boolean(record.signOutAt);
                  const inProgress = hasSignedIn && !hasSignedOut;

                  return (
                    <tr key={record.id} className="group transition hover:bg-mme-blush/10">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm ${getAvatarColor(
                              record.employeeName,
                            )}`}
                          >
                            {getInitials(record.employeeName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-mme-purple">
                              {record.employeeName || "Unknown employee"}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Calendar size={10} className="text-mme-purple/40" />
                              <p className="text-[11px] font-bold text-mme-purple/50">
                                {formatDisplayDate(record.attendanceDate)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <LocationCell
                          insideOffice={record.signInInsideOffice}
                          latitude={record.signInLatitude}
                          longitude={record.signInLongitude}
                          actionAt={record.signInAt}
                          actionCompleted={hasSignedIn}
                          actionLabel="Sign In"
                          icon={LogIn}
                          onView={() => showSignInLocation(record)}
                        />
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <LocationCell
                          insideOffice={record.signOutInsideOffice}
                          latitude={record.signOutLatitude}
                          longitude={record.signOutLongitude}
                          actionAt={record.signOutAt}
                          actionCompleted={hasSignedOut}
                          actionLabel="Sign Out"
                          icon={LogOut}
                          onView={() => showSignOutLocation(record)}
                        />
                      </td>

                      <td className="px-5 py-4 align-middle">
                        {inProgress ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                            </span>
                            In Progress
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-mme-purple/5 to-mme-blush/20 px-3 py-1.5">
                            <Timer size={12} className="text-mme-purple/60" />
                            <span className="text-sm font-black text-mme-purple">
                              {formatWorkHours(record.durationMinutes)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LocationModal location={selectedLocation} onClose={() => setSelectedLocation(null)} />
    </AdminLayout>
  );
}