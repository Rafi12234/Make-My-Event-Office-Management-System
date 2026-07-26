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
    id: "last_meeting_time",
    name: "Last Meeting Time",
    type: "last_meeting_time",
    width: 205,
  },
  {
    id: "meeting_short_note",
    name: "Meeting Call Short Note",
    type: "meeting_manager",
    width: 220,
  },
  {
    id: "next_meeting_time",
    name: "Next Meeting Time",
    type: "next_meeting_time",
    width: 205,
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
    id: "guest_count",
    name: "Guest Count",
    type: "integer",
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

// The fixed checklist of client requirement categories shown in the
// Client Meeting Manager's "Client Requirements" section. "other" is a
// special free-form entry for anything not covered by the list above.
export const CLIENT_REQUIREMENT_OPTIONS = [
  { key: "stage", label: "Stage" },
  { key: "entry_gate", label: "Entry Gate" },
  { key: "head_table", label: "Head Table" },
  { key: "photo_booth", label: "Photo Booth" },
  { key: "truss_ceiling_decoration", label: "Truss Ceiling Decoration" },
  { key: "tent_ceiling_decoration", label: "Tent Ceiling Decoration" },
  { key: "walkway", label: "Walkway" },
  { key: "tunnel_walkway", label: "Tunnel Walkway" },
  { key: "mirror_ramp", label: "Mirror Ramp" },
  { key: "welcome_stand", label: "Welcome Stand" },
  { key: "centre_pieces", label: "Centre Pieces" },
  { key: "head_table_chair", label: "Head Table Chair" },
  { key: "photo_gallery", label: "Photo Gallery" },
  { key: "comments_board", label: "Comments Board" },
  { key: "sangeet_stage", label: "Sangeet Stage" },
  { key: "sound_system", label: "Sound System" },
  { key: "led", label: "LED" },
  { key: "other", label: "Other" },
];

export const COLUMN_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long note" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Whole number" },
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
