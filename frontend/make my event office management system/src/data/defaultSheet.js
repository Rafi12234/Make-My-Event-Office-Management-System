export const DEFAULT_COLUMNS = [
  {
    id: "client_name",
    name: "Client Name",
    type: "text",
    width: 210,
    required: true,
  },
  {
    id: "venue",
    name: "Venue",
    type: "venue",
    width: 220,
  },
  {
    id: "shift",
    name: "Shift",
    type: "shift",
    width: 130,
  },
  {
    id: "client_email",
    name: "Client Email",
    type: "email",
    width: 220,
  },
  {
    id: "client_phone",
    name: "Client Phone Number",
    type: "phone",
    width: 190,
  },
  {
    id: "current_meeting_time",
    name: "Current Meeting Time",
    type: "datetime",
    width: 205,
  },
  {
    id: "meeting_short_note",
    name: "Meeting Call Short Note",
    type: "long_text",
    width: 300,
  },
  {
    id: "next_meeting_time",
    name: "Next Meeting Time",
    type: "datetime",
    width: 205,
  },
  {
    id: "next_meeting_discussion",
    name: "Next Meeting Discussion",
    type: "long_text",
    width: 300,
  },
  {
    id: "assigned_employee",
    name: "Assigned Employee",
    type: "employee",
    width: 210,
  },
  {
    id: "status",
    name: "Status",
    type: "status",
    width: 175,
  },
  {
    id: "priority",
    name: "Priority",
    type: "priority",
    width: 135,
  },
  {
    id: "floor",
    name: "Floor/Hall",
    type: "text",
    width: 150,
  },
  {
    id: "estimated_budget",
    name: "Estimated Budget",
    type: "currency",
    width: 185,
  },
];

export const VENUE_OPTIONS = [
  "Sena Prangan",
  "Sena Malancha",
  "Army Officers Club",
  "Butterfly Garden",
  "Elite Convention Hall",
  "Dhaka Ladies Club",
];

export const SHIFT_OPTIONS = ["Day", "Night"];

export const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Meeting Scheduled",
  "Follow-up Required",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

export const COLUMN_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long note" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date and time" },
  { value: "employee", label: "Employee" },
  { value: "venue", label: "Venue" },
  { value: "shift", label: "Shift" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "currency", label: "Currency / Budget" },
  { value: "checkbox", label: "Checkbox" },
];

export function createEmptyRow(columns, rowNumber) {
  return {
    id: crypto.randomUUID(),
    rowNumber,
    values: Object.fromEntries(columns.map((column) => [column.id, ""])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
