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
    required: true,
  },
  {
    id: "shift",
    name: "Shift",
    type: "shift",
    width: 130,
    required: true,
  },
  {
    id: "client_phone",
    name: "Client Phone Number",
    type: "phone",
    width: 190,
    required: true,
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
    id: "floor",
    name: "Floor",
    type: "text",
    width: 150,
    required: true,
  },
  {
    id: "guest_count",
    name: "Guest Count",
    type: "integer",
    width: 150,
    required: true,
  },
  {
    id: "event_date",
    name: "Event Date",
    type: "text",
    width: 165,
    required: true,
  },
];

// Short labels shown in the sheet's column header (UI-only). The full
// Short labels shown in the sheet's column header (UI-only). The full
// `name` above is still the source of truth for Excel import matching,
// placeholders, and notices — only the header text rendered on screen
// uses this shorter label when one is defined for a column's name. Keyed
// by the column's display name (not id) so it still matches columns
// loaded from previously-saved workspaces, whose ids may not line up
// with the slugs used in DEFAULT_COLUMNS above.
export const Showed_Column_Name = {
  "Client Name": "Name",
  "Venue": "Venue",
  "Shift": "Shift",
  "Client Phone Number": "Phone",
  "Last Meeting Time": "LMT",
  "Meeting Call Short Note": "Details",
  "Next Meeting Time": "NMT",
  "Floor": "Floor",
  "Guest Count": "Guest",
  "Event Date": "Date",
  
};

// The exact set of column names that a mandatory Excel/CSV import must
// contain (case/whitespace-insensitive match). If any is missing, the whole
// import is rejected before the preview is even shown.
export const MANDATORY_EXCEL_COLUMNS = [
  "Client Name",
  "Venue",
  "Shift",
  "Client Phone Number",
  "Floor",
  "Guest Count",
  "Event Date",
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
