import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Clock, MapPin } from "lucide-react";

import AdminLayout from "../../components/AdminLayout";
import { adminLogout, fetchAdminMe, fetchAllEmployees } from "../../services/adminService";
import { fetchAdminAttendance } from "../../services/adminAttendanceService";

function formatDisplayDateTime(dbDateTime) {
  if (!dbDateTime) return "—";
  const [datePart, timePart] = dbDateTime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDateTime;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

const STATUS_LABELS = {
  working: "Working",
  completed: "Completed",
  absent: "Absent",
};

// Guide section 34: this is the device's reported location at the moment of
// the action, not guaranteed proof of physical office presence — labels
// stick to "Sign In/Out Location" + "GPS Accuracy", never "Verified Presence".
function LocationDetail({ label, latitude, longitude, accuracy, distanceFromOffice, insideOffice }) {
  if (latitude === null || longitude === null) {
    return <p className="text-xs italic text-mme-purple/40">No {label.toLowerCase()} recorded.</p>;
  }
  return (
    <div className="rounded-xl border border-mme-pink/40 bg-[#fff9fc] p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-mme-purple/50">{label}</p>
      {insideOffice !== null && insideOffice !== undefined ? (
        <p
          className={`mt-1 text-xs font-black ${
            insideOffice ? "text-green-700" : "text-red-700"
          }`}
        >
          {insideOffice ? "Inside MakeMyEvent Office" : "Outside MakeMyEvent Office"}
          {distanceFromOffice !== null && distanceFromOffice !== undefined ? (
            <span className="ml-2 font-bold text-mme-purple/70">
              {"\u00b7"} Distance from Office: {distanceFromOffice} m
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-mme-purple/80">
        Latitude: <span className="font-bold">{latitude}</span> {"\u00b7"} Longitude:{" "}
        <span className="font-bold">{longitude}</span>
        {accuracy !== null ? (
          <>
            {" "}
            {"\u00b7"} GPS Accuracy: <span className="font-bold">{"\u00b1"}{accuracy} m</span>
          </>
        ) : null}
      </p>
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1 text-[11px] font-black text-mme-purple transition hover:bg-mme-blush/40"
      >
        <MapPin size={11} /> Open Map
      </a>
    </div>
  );
}

function AttendanceRow({ record }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-mme-pink/50 bg-white transition hover:border-mme-pink hover:shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-black text-mme-purple">{record.employeeName || "Unknown employee"}</p>
          <p className="text-xs text-mme-purple/60">{record.attendanceDate}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right text-xs text-mme-purple/70 sm:block">
            <p>In {formatDisplayDateTime(record.signInAt)} {"\u2192"} Out {formatDisplayDateTime(record.signOutAt)}</p>
            <p className="font-bold text-mme-purple">{formatDuration(record.durationMinutes)}</p>
          </div>
          <span className="rounded-full bg-mme-blush/50 px-2.5 py-1 text-[11px] font-black text-mme-purple">
            {STATUS_LABELS[record.status] || record.status}
          </span>
          <ChevronDown size={16} className={`text-mme-purple/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="grid gap-3 border-t border-mme-pink/30 px-4 py-3.5 sm:grid-cols-2">
          <LocationDetail
            label="Sign In Location"
            latitude={record.signInLatitude}
            longitude={record.signInLongitude}
            accuracy={record.signInAccuracy}
            distanceFromOffice={record.signInDistanceFromOffice}
            insideOffice={record.signInInsideOffice}
          />
          <LocationDetail
            label="Sign Out Location"
            latitude={record.signOutLatitude}
            longitude={record.signOutLongitude}
            accuracy={record.signOutAccuracy}
            distanceFromOffice={record.signOutDistanceFromOffice}
            insideOffice={record.signOutInsideOffice}
          />
        </div>
      )}
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
      .then((data) => setEmployees(data.filter((e) => e.isActive)))
      .catch((err) => setNotice({ type: "error", message: err.message }));
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    setIsLoading(true);
    fetchAdminAttendance({ employeeId, date, from: date ? "" : dateFrom, to: date ? "" : dateTo })
      .then(setRecords)
      .catch((err) => setNotice({ type: "error", message: err.message }))
      .finally(() => setIsLoading(false));
  }, [admin, employeeId, date, dateFrom, dateTo]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  const hasActiveFilters = useMemo(
    () => Boolean(employeeId || date || dateFrom || dateTo),
    [employeeId, date, dateFrom, dateTo],
  );

  function clearFilters() {
    setEmployeeId("");
    setDate("");
    setDateFrom("");
    setDateTo("");
  }

  if (checkingSession || !admin) return null;

  return (
    <AdminLayout admin={admin} onLogout={handleLogout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-purple text-white">
            <Clock size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-mme-purple">Attendance Management</h1>
            <p className="text-xs font-bold text-mme-plum">Employee Sign In / Sign Out records</p>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm font-bold ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-mme-pink/50 bg-mme-blush/30 text-mme-purple"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-mme-pink/50 bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-mme-purple/60">
            Employee
          </label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-lg border border-mme-pink/60 px-2.5 py-1.5 text-sm text-mme-purple"
          >
            <option value="">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-mme-purple/60">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-mme-pink/60 px-2.5 py-1.5 text-sm text-mme-purple"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-mme-purple/60">From</label>
          <input
            type="date"
            value={dateFrom}
            disabled={Boolean(date)}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-mme-pink/60 px-2.5 py-1.5 text-sm text-mme-purple disabled:opacity-40"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-mme-purple/60">To</label>
          <input
            type="date"
            value={dateTo}
            disabled={Boolean(date)}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-mme-pink/60 px-2.5 py-1.5 text-sm text-mme-purple disabled:opacity-40"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-mme-pink/70 bg-white px-3 py-1.5 text-xs font-black text-mme-purple transition hover:bg-mme-blush/40"
          >
            Clear Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-mme-purple/60">Loading attendance...</p>
      ) : records.length === 0 ? (
        <p className="text-sm italic text-mme-purple/40">No attendance records match these filters.</p>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <AttendanceRow key={record.id} record={record} />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
