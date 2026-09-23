import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Phone,
  Users,
  X,
} from "lucide-react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/AdminLayout";

import {
  adminLogout,
  fetchAdminMe,
  fetchAllEmployees,
} from "../../services/adminService";

import {
  fetchAdminCalendarMonth,
} from "../../services/adminCalendarService";

import {
  updateNextCallSchedule,
  updateNextMeetingSchedule,
} from "../../services/adminActivityService";

const EVENT_LABELS = {
  meeting: "Meeting",
  call: "Call",
  next_meeting: "Next Meeting",
  next_call: "Next Call",
};

function pad(n) {
  return String(n).padStart(
    2,
    "0",
  );
}

function to12h(t) {
  if (!t) {
    return null;
  }

  const [h, m] =
    t.split(":").map(Number);

  return `${h % 12 || 12}:${pad(
    m,
  )} ${
    h >= 12
      ? "PM"
      : "AM"
  }`;
}

function formatDisplay(
  dbDatetime,
) {
  if (!dbDatetime) {
    return null;
  }

  const [
    datePart,
    timePart,
  ] =
    dbDatetime.split(" ");

  const date =
    new Date(
      `${datePart}T${
        timePart ||
        "00:00:00"
      }`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dbDatetime;
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function formatColValue(
  type,
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const s =
    String(value);

  if (!s.trim()) {
    return null;
  }

  if (
    type ===
      "datetime" ||
    type ===
      "last_meeting_time" ||
    type ===
      "next_meeting_time"
  ) {
    const clean =
      s.replace(
        "T",
        " ",
      );

    const [
      datePart,
      timePart,
    ] =
      clean.split(" ");

    if (timePart) {
      const [h, m] =
        timePart
          .split(":")
          .map(Number);

      return `${datePart} · ${to12h(
        `${pad(h)}:${pad(m)}`,
      )}`;
    }

    return (
      datePart ||
      s
    );
  }

  if (
    type === "date"
  ) {
    return s.slice(
      0,
      10,
    );
  }

  if (
    type === "time"
  ) {
    return to12h(
      s.slice(
        0,
        5,
      ),
    );
  }

  if (
    type ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  return s;
}

function formatDisplayDate(
  iso,
) {
  if (!iso) {
    return "";
  }

  const [
    y,
    mo,
    d,
  ] =
    iso
      .split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday:
        "long",

      year:
        "numeric",

      month:
        "long",

      day:
        "numeric",
    },
  ).format(
    new Date(
      y,
      mo - 1,
      d,
    ),
  );
}

function shiftDate(
  iso,
  delta,
) {
  const d =
    new Date(
      `${iso}T00:00:00`,
    );

  d.setDate(
    d.getDate() +
      delta,
  );

  return `${d.getFullYear()}-${pad(
    d.getMonth() +
      1,
  )}-${pad(
    d.getDate(),
  )}`;
}

function toDatetimeLocalValue(
  dbDatetime,
) {
  if (!dbDatetime) {
    return "";
  }

  return dbDatetime
    .replace(
      " ",
      "T",
    )
    .slice(
      0,
      16,
    );
}

function getEditContext(
  ev,
) {
  if (
    ev.source ===
    "meeting"
  ) {
    return {
      kind:
        "meeting",

      id:
        ev.meetingId,

      datetime:
        ev.nextMeetingDatetime,

      assignedEmployeeId:
        ev.nextMeetingAssignedEmployeeId,
    };
  }

  if (
    ev.source ===
    "next_meeting"
  ) {
    return {
      kind:
        "meeting",

      id:
        ev.meetingId,

      datetime:
        `${ev.date} ${
          ev.time ||
          "00:00"
        }:00`,

      assignedEmployeeId:
        ev.assignedEmployeeIdRaw,
    };
  }

  if (
    ev.source ===
    "call"
  ) {
    return {
      kind:
        "call",

      id:
        ev.callId,

      datetime:
        ev.nextCallDatetime,

      assignedEmployeeId:
        ev.nextCallAssignedEmployeeId,
    };
  }

  if (
    ev.source ===
    "next_call"
  ) {
    return {
      kind:
        "call",

      id:
        ev.callId,

      datetime:
        `${ev.date} ${
          ev.time ||
          "00:00"
        }:00`,

      assignedEmployeeId:
        ev.assignedEmployeeIdRaw,
    };
  }

  return null;
}

function EditScheduleModal({
  label,
  initialDatetime,
  initialAssignedEmployeeId,
  employees,
  onClose,
  onSave,
}) {
  const [
    datetime,
    setDatetime,
  ] =
    useState(
      toDatetimeLocalValue(
        initialDatetime,
      ),
    );

  const [
    assignedEmployeeId,
    setAssignedEmployeeId,
  ] =
    useState(
      initialAssignedEmployeeId !=
        null
        ? String(
            initialAssignedEmployeeId,
          )
        : "",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);

  async function handleSubmit(
    e,
  ) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      await onSave({
        datetime,

        assignedEmployeeId:
          assignedEmployeeId
            ? Number(
                assignedEmployeeId,
              )
            : null,
      });
    } catch (
      err
    ) {
      setError(
        err.message,
      );

      setLoading(
        false,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-mme-pink/60 bg-white shadow-[0_30px_100px_rgba(91,55,101,0.25)]">
        <div className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-blush text-mme-purple">
            <Pencil
              size={
                18
              }
            />
          </div>

          <h2 className="mt-4 text-lg font-black text-mme-purple">
            Edit{" "}
            {label}
          </h2>

          <p className="mt-1 text-sm text-mme-purple/55">
            Update the
            scheduled
            date/time and
            who is
            responsible
            for it.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-5 space-y-4"
          >
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                <X
                  size={
                    15
                  }
                  className="mt-0.5 shrink-0"
                />

                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                {label}{" "}
                Date &amp;
                Time
              </label>

              <input
                type="datetime-local"
                value={
                  datetime
                }
                onChange={(
                  e,
                ) =>
                  setDatetime(
                    e.target
                      .value,
                  )
                }
                className="w-full rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              />

              <p className="mt-1 text-xs text-mme-purple/40">
                Leave empty
                to clear the
                schedule.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-mme-plum">
                Assigned
                Employee
              </label>

              <div className="relative">
                <select
                  value={
                    assignedEmployeeId
                  }
                  onChange={(
                    e,
                  ) =>
                    setAssignedEmployeeId(
                      e.target
                        .value,
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] px-4 py-2.5 text-sm text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {employees.map(
                    (
                      emp,
                    ) => (
                      <option
                        key={
                          emp.id
                        }
                        value={
                          emp.id
                        }
                      >
                        {
                          emp.fullName
                        }
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={
                    15
                  }
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mme-purple/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={
                  onClose
                }
                className="flex-1 rounded-2xl border border-mme-pink/70 bg-white px-5 py-2.5 text-sm font-black text-mme-purple transition hover:bg-mme-blush/30"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  loading
                }
                className="flex-1 rounded-2xl bg-mme-purple px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#4b2c55] disabled:opacity-60"
              >
                {loading
                  ? "Saving…"
                  : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
const CALENDAR_COLUMN_WIDTH_STORAGE_KEY =
  "mme-admin-calendar-day-column-widths";

function normalizeColumnWeights(weights) {
  const total =
    weights.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) || 1;

  return weights.map(
    (value) =>
      (value / total) *
      100,
  );
}

function loadCalendarColumnWeights(
  columns,
) {
  const defaults =
    normalizeColumnWeights(
      columns.map(
        (column) =>
          column.defaultWeight,
      ),
    );

  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          CALENDAR_COLUMN_WIDTH_STORAGE_KEY,
        ),
      );

    if (
      !saved ||
      typeof saved !==
        "object" ||
      Array.isArray(saved)
    ) {
      return defaults;
    }

    const weights =
      columns.map(
        (
          column,
          index,
        ) => {
          const savedValue =
            Number(
              saved[
                column.key
              ],
            );

          return Number.isFinite(
            savedValue,
          ) &&
            savedValue > 0
            ? savedValue
            : defaults[
                index
              ];
        },
      );

    return normalizeColumnWeights(
      weights,
    );
  } catch {
    return defaults;
  }
}

function saveCalendarColumnWeights(
  columns,
  weights,
) {
  if (
    columns.length !==
    weights.length
  ) {
    return;
  }

  try {
    let existing = {};

    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(
            CALENDAR_COLUMN_WIDTH_STORAGE_KEY,
          ),
        );

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        !Array.isArray(
          parsed,
        )
      ) {
        existing =
          parsed;
      }
    } catch {
      existing = {};
    }

    for (
      let index = 0;
      index <
      columns.length;
      index += 1
    ) {
      existing[
        columns[
          index
        ].key
      ] =
        weights[
          index
        ];
    }

    localStorage.setItem(
      CALENDAR_COLUMN_WIDTH_STORAGE_KEY,
      JSON.stringify(
        existing,
      ),
    );
  } catch {
    // Ignore inaccessible localStorage.
  }
}
/*
|--------------------------------------------------------------------------
| Compact activity table
|--------------------------------------------------------------------------
|
| This replaces the old large cards.
|
| All client information still comes dynamically from worksheetColumns.
| Columns which contain no values in the current section are hidden.
|
*/
function EventTable({
  events,
  rowData,
  worksheetColumns,
  onEdit,
  onViewHistory,
}) {
  /*
  |--------------------------------------------------------------------------
  | Dynamic Management-sheet columns
  |--------------------------------------------------------------------------
  */

  const detailColumns =
    useMemo(
      () =>
        (
          worksheetColumns ||
          []
        )
          .filter(
            (col) =>
              col.name !==
                "Client Name" &&
              col.type !==
                "meeting_manager",
          )
          .filter(
            (col) =>
              col.type !==
                "last_meeting_time" &&
              col.type !==
                "next_meeting_time",
          )
          .filter(
            (col) =>
              events.some(
                (ev) => {
                  const value =
                    rowData?.[
                      ev.rowKey
                    ]?.[
                      col.key
                    ];

                  return (
                    value !=
                      null &&
                    String(
                      value,
                    ).trim() !==
                      ""
                  );
                },
              ),
          ),
      [
        events,
        rowData,
        worksheetColumns,
      ],
    );

  const showNotesColumn =
    useMemo(
      () =>
        events.some(
          (ev) =>
            (
              ev.source ===
                "meeting" &&
              ev
                .requirements
                ?.length >
                0
            ) ||
            Boolean(
              ev.notes,
            ),
        ),
      [events],
    );

  /*
  |--------------------------------------------------------------------------
  | Column definitions
  |--------------------------------------------------------------------------
  |
  | This works like ExpenseItemsTable on /accounts/log-cost.
  |
  | defaultWeight = starting width
  | minWeight     = minimum width while dragging
  |
  */

  const columns =
    useMemo(
      () => [
        {
          key:
            "activity",

          label:
            "Activity",

          defaultWeight:
            8,

          minWeight:
            4,
        },

        {
          key:
            "client",

          label:
            "Client",

          defaultWeight:
            14,

          minWeight:
            7,
        },

        {
          key:
            "employee",

          label:
            "Employee",

          defaultWeight:
            10,

          minWeight:
            5,
        },

        ...detailColumns.map(
          (column) => ({
            key:
              `worksheet-${column.key}`,

            label:
              column.name,

            defaultWeight:
              9,

            minWeight:
              4,
          }),
        ),

        {
          key:
            "status",

          label:
            "Status",

          defaultWeight:
            11,

          minWeight:
            5,
        },

        {
          key:
            "follow-up",

          label:
            "Next Follow-up",

          defaultWeight:
            15,

          minWeight:
            7,
        },

        ...(showNotesColumn
          ? [
              {
                key:
                  "notes",

                label:
                  "Notes / Requirements",

                defaultWeight:
                  16,

                minWeight:
                  7,
              },
            ]
          : []),

        {
          key:
            "actions",

          label:
            "Actions",

          defaultWeight:
            15,

          minWeight:
            7,
        },
      ],
      [
        detailColumns,
        showNotesColumn,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Resizable column state
  |--------------------------------------------------------------------------
  */

  const columnSignature =
    useMemo(
      () =>
        columns
          .map(
            (column) =>
              column.key,
          )
          .join("|"),
      [columns],
    );

  const [
    colWeights,
    setColWeights,
  ] =
    useState(() =>
      loadCalendarColumnWeights(
        columns,
      ),
    );

  const tableRef =
    useRef(null);

  const resizeRef =
    useRef(null);

  /*
  |--------------------------------------------------------------------------
  | Rebuild widths if visible columns change
  |--------------------------------------------------------------------------
  |
  | Example:
  |
  | One day has Floor + Guest Count.
  | Another day does not.
  |
  */

  useEffect(() => {
    setColWeights(
      loadCalendarColumnWeights(
        columns,
      ),
    );
  }, [
    columnSignature,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Persist width changes
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      colWeights.length !==
      columns.length
    ) {
      return;
    }

    saveCalendarColumnWeights(
      columns,
      colWeights,
    );
  }, [
    colWeights,
    columnSignature,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Drag column divider
  |--------------------------------------------------------------------------
  |
  | Exactly like /accounts/log-cost:
  |
  | resizing one column steals/gives width to its right-hand neighbour,
  | so overall table width remains unchanged.
  |
  */

  function startColumnResize(
    index,
    event,
  ) {
    event.preventDefault();

    if (
      index >=
      columns.length -
        1
    ) {
      return;
    }

    const tableWidth =
      tableRef.current
        ?.getBoundingClientRect()
        .width || 1;

    const totalWeight =
      colWeights.reduce(
        (sum, width) =>
          sum + width,
        0,
      );

    const startLeft =
      colWeights[
        index
      ];

    const startRight =
      colWeights[
        index + 1
      ];

    resizeRef.current =
      {
        index,
        tableWidth,
        totalWeight,
        startX:
          event.clientX,
        startLeft,
        startRight,
      };

    document.body.style.cursor =
      "col-resize";

    document.body.style.userSelect =
      "none";

    function handleMouseMove(
      moveEvent,
    ) {
      const state =
        resizeRef.current;

      if (!state) {
        return;
      }

      const deltaPixels =
        moveEvent.clientX -
        state.startX;

      const deltaWeight =
        (
          deltaPixels /
          state.tableWidth
        ) *
        state.totalWeight;

      const minLeft =
        columns[
          state.index
        ].minWeight;

      const minRight =
        columns[
          state.index +
            1
        ].minWeight;

      const clampedDelta =
        Math.min(
          Math.max(
            deltaWeight,
            minLeft -
              state.startLeft,
          ),

          state.startRight -
            minRight,
        );

      setColWeights(
        (current) => {
          const next =
            [
              ...current,
            ];

          next[
            state.index
          ] =
            state.startLeft +
            clampedDelta;

          next[
            state.index +
              1
          ] =
            state.startRight -
            clampedDelta;

          return next;
        },
      );
    }

    function handleMouseUp() {
      resizeRef.current =
        null;

      document.body.style.cursor =
        "";

      document.body.style.userSelect =
        "";

      document.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      document.removeEventListener(
        "mouseup",
        handleMouseUp,
      );
    }

    document.addEventListener(
      "mousemove",
      handleMouseMove,
    );

    document.addEventListener(
      "mouseup",
      handleMouseUp,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Status
  |--------------------------------------------------------------------------
  */

  const tagStyles = {
    early:
      "bg-emerald-100 text-emerald-700",

    on_time:
      "bg-blue-100 text-blue-700",

    late:
      "bg-amber-100 text-amber-700",
  };

  function statusFor(
    ev,
  ) {
    if (ev.missed) {
      return (
        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
          Missed
        </span>
      );
    }

    if (
      ev.completionTag
    ) {
      return (
        <span
          title={
            ev
              .completionTag
              .expectedLabel
              ? `Originally due ${formatDisplay(
                  ev
                    .completionTag
                    .expectedLabel,
                )}`
              : undefined
          }
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
            tagStyles[
              ev
                .completionTag
                .status
            ] ||
            tagStyles
              .on_time
          }`}
        >
          {
            ev
              .completionTag
              .label
          }
        </span>
      );
    }

    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
          ev.done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-mme-blush text-mme-purple"
        }`}
      >
        {ev.done
          ? "Completed"
          : "Due"}
      </span>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Next follow-up
  |--------------------------------------------------------------------------
  */

  function nextFollowUp(
    ev,
  ) {
    if (
      ev.source ===
      "meeting"
    ) {
      return (
        <div className="space-y-1">
          <p className="font-bold text-mme-purple/80">
            {formatDisplay(
              ev.nextMeetingDatetime,
            ) ||
              "Not scheduled yet"}
          </p>

          {ev.nextMeetingAssignedEmployeeName && (
            <p className="text-[10px] font-semibold text-mme-purple/50">
              Assigned to{" "}
              {
                ev.nextMeetingAssignedEmployeeName
              }
            </p>
          )}

          {ev.nextMeetingTag && (
            <span
              title={
                ev
                  .nextMeetingTag
                  .expectedLabel
                  ? `Originally due ${formatDisplay(
                      ev
                        .nextMeetingTag
                        .expectedLabel,
                    )}`
                  : undefined
              }
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
                tagStyles[
                  ev
                    .nextMeetingTag
                    .status
                ] ||
                tagStyles
                  .on_time
              }`}
            >
              {
                ev
                  .nextMeetingTag
                  .label
              }
            </span>
          )}
        </div>
      );
    }

    if (
      ev.source ===
      "call"
    ) {
      return (
        <div className="space-y-1">
          <p className="font-bold text-mme-purple/80">
            {formatDisplay(
              ev.nextCallDatetime,
            ) ||
              "Not scheduled yet"}
          </p>

          {ev.nextCallAssignedEmployeeName && (
            <p className="text-[10px] font-semibold text-mme-purple/50">
              Assigned to{" "}
              {
                ev.nextCallAssignedEmployeeName
              }
            </p>
          )}

          {ev.nextCallTag && (
            <span
              title={
                ev
                  .nextCallTag
                  .expectedLabel
                  ? `Originally due ${formatDisplay(
                      ev
                        .nextCallTag
                        .expectedLabel,
                    )}`
                  : undefined
              }
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
                tagStyles[
                  ev
                    .nextCallTag
                    .status
                ] ||
                tagStyles
                  .on_time
              }`}
            >
              {
                ev
                  .nextCallTag
                  .label
              }
            </span>
          )}
        </div>
      );
    }

    return (
      <span className="text-mme-purple/35">
        —
      </span>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-mme-pink/50 bg-white shadow-[0_6px_24px_rgba(91,55,101,0.05)]">
      <table
        ref={tableRef}
        className="w-full min-w-[1180px] table-fixed border-collapse text-left"
      >
        {/*
        |--------------------------------------------------------------------------
        | Dynamic column widths
        |--------------------------------------------------------------------------
        */}

        <colgroup>
          {columns.map(
            (
              column,
              index,
            ) => (
              <col
                key={
                  column.key
                }
                style={{
                  width: `${
                    colWeights[
                      index
                    ] || 0
                  }%`,
                }}
              />
            ),
          )}
        </colgroup>

        <thead className="bg-[#fff5fa]">
          <tr className="border-b border-mme-pink/50">
            {columns.map(
              (
                column,
                index,
              ) => (
                <th
                  key={
                    column.key
                  }
                  className="relative px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-mme-purple/55"
                >
                  <span className="block overflow-hidden text-ellipsis">
                    {
                      column.label
                    }
                  </span>

                  {index <
                  columns.length -
                    1 ? (
                    <span
                      onMouseDown={(
                        event,
                      ) =>
                        startColumnResize(
                          index,
                          event,
                        )
                      }
                      title="Drag to resize column"
                      className="group absolute -right-1 top-0 z-20 flex h-full w-2.5 cursor-col-resize touch-none select-none items-center justify-center"
                    >
                      <span className="h-5 w-px bg-mme-purple/15 transition-colors duration-200 group-hover:bg-mme-purple/70" />
                    </span>
                  ) : null}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {events.map(
            (ev) => {
              const clientRowData =
                rowData?.[
                  ev.rowKey
                ] ||
                {};

              const isCallEvent =
                ev.source ===
                  "call" ||
                ev.source ===
                  "next_call";

              const editContext =
                getEditContext(
                  ev,
                );

              return (
                <tr
                  key={
                    ev.id
                  }
                  className={`border-b border-mme-pink/25 align-top last:border-b-0 ${
                    ev.missed
                      ? "bg-red-50/80"
                      : "bg-white hover:bg-[#fffafd]"
                  }`}
                >
                  {/* Activity */}
                  <td className="overflow-hidden px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mme-blush/70 text-mme-purple">
                        {isCallEvent ? (
                          <Phone
                            size={
                              13
                            }
                          />
                        ) : (
                          <CalendarDays
                            size={
                              13
                            }
                          />
                        )}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-mme-purple">
                          {EVENT_LABELS[
                            ev.source
                          ] ||
                            ev.source}
                        </p>

                        <p className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-mme-purple/55">
                          {ev.time
                            ? to12h(
                                ev.time,
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Client */}
                  <td className="overflow-hidden px-3 py-2.5">
                    <p
                      title={
                        ev.clientName ||
                        ""
                      }
                      className="truncate text-xs font-black leading-5 text-mme-purple"
                    >
                      {ev.clientName ||
                        "Unnamed client"}
                    </p>
                  </td>

                  {/* Employee */}
                  <td className="overflow-hidden px-3 py-2.5">
                    {ev.employeeName ? (
                      <span
                        title={
                          ev.employeeName
                        }
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#fff5fa] px-2 py-1 text-[10px] font-black text-mme-purple/75 ring-1 ring-mme-pink/40"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              ev.employeeColor ||
                              "#9ca3af",
                          }}
                        />

                        <span className="truncate">
                          {
                            ev.employeeName
                          }
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-mme-purple/35">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Dynamic Management columns */}
                  {detailColumns.map(
                    (col) => {
                      const value =
                        formatColValue(
                          col.type,
                          clientRowData[
                            col.key
                          ],
                        );

                      return (
                        <td
                          key={
                            col.key
                          }
                          title={
                            value ||
                            undefined
                          }
                          className="overflow-hidden px-3 py-2.5 text-xs font-semibold leading-5 text-mme-purple/75"
                        >
                          <div className="break-words">
                            {value || (
                              <span className="text-mme-purple/25">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    },
                  )}

                  {/* Status */}
                  <td className="overflow-hidden px-3 py-2.5">
                    <div className="space-y-1.5">
                      {statusFor(
                        ev,
                      )}

                      {ev
                        .completionTag
                        ?.expectedLabel && (
                        <p className="text-[10px] font-semibold leading-4 text-mme-purple/45">
                          Originally
                          due:{" "}
                          {formatDisplay(
                            ev
                              .completionTag
                              .expectedLabel,
                          )}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Follow-up */}
                  <td className="overflow-hidden px-3 py-2.5 text-xs leading-5">
                    {nextFollowUp(
                      ev,
                    )}
                  </td>

                  {/* Notes */}
                  {showNotesColumn && (
                    <td className="overflow-hidden px-3 py-2.5">
                      <div className="space-y-1 break-words text-xs leading-5 text-mme-purple/65">
                        {ev.source ===
                          "meeting" &&
                        ev
                          .requirements
                          ?.length >
                          0
                          ? ev.requirements.map(
                              (
                                req,
                                index,
                              ) => (
                                <p
                                  key={
                                    req.key ||
                                    index
                                  }
                                >
                                  <span className="font-black text-mme-purple/80">
                                    {
                                      req.label
                                    }
                                    :{" "}
                                  </span>

                                  {
                                    req.details
                                  }
                                </p>
                              ),
                            )
                          : null}

                        {ev.notes ? (
                          <p>
                            {
                              ev.notes
                            }
                          </p>
                        ) : null}

                        {!(
                          ev.source ===
                            "meeting" &&
                          ev
                            .requirements
                            ?.length >
                            0
                        ) &&
                        !ev.notes ? (
                          <span className="text-mme-purple/25">
                            —
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )}

                  {/* Actions */}
                  <td className="overflow-hidden px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() =>
                          onViewHistory(
                            ev,
                          )
                        }
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1.5 text-[10px] font-black text-mme-purple transition hover:bg-mme-blush/40"
                      >
                        <History
                          size={
                            11
                          }
                        />

                        History
                      </button>

                      {editContext && (
                        <button
                          onClick={() =>
                            onEdit(
                              editContext,
                            )
                          }
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-mme-pink/70 bg-white px-2.5 py-1.5 text-[10px] font-black text-mme-purple transition hover:bg-mme-blush/40"
                        >
                          <Pencil
                            size={
                              11
                            }
                          />

                          Edit Next{" "}
                          {isCallEvent
                            ? "Call"
                            : "Meeting"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCalendarDayPage() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const { date } =
    useParams();

  const [
    admin,
    setAdmin,
  ] =
    useState(null);

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);

  const [
    events,
    setEvents,
  ] =
    useState([]);

  const [
    rowData,
    setRowData,
  ] =
    useState({});

  const [
    worksheetColumns,
    setWorksheetColumns,
  ] =
    useState([]);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    notice,
    setNotice,
  ] =
    useState(null);

  const [
    editing,
    setEditing,
  ] =
    useState(null);

  useEffect(
    () => {
      fetchAdminMe()
        .then(
          (
            me,
          ) => {
            if (!me) {
              return navigate(
                "/admin/login",
                {
                  replace:
                    true,
                },
              );
            }

            setAdmin(
              me,
            );
          },
        )
        .finally(
          () =>
            setCheckingSession(
              false,
            ),
        );
    },
    [navigate],
  );

  const fetchMonth =
    useCallback(
      () => {
        if (!date) {
          return Promise.resolve();
        }

        const [
          year,
          month,
        ] =
          date
            .split(
              "-",
            )
            .map(
              Number,
            );

        setIsLoading(
          true,
        );

        return fetchAdminCalendarMonth(
          year,
          month,
        )
          .then(
            (
              data,
            ) => {
              setEvents(
                data.events ||
                  [],
              );

              setRowData(
                data.rowData ||
                  {},
              );

              setWorksheetColumns(
                data.worksheetColumns ||
                  [],
              );
            },
          )
          .catch(
            (
              err,
            ) =>
              setNotice(
                {
                  type:
                    "error",

                  message:
                    err.message,
                },
              ),
          )
          .finally(
            () =>
              setIsLoading(
                false,
              ),
          );
      },
      [date],
    );

  useEffect(
    () => {
      if (!admin) {
        return;
      }

      fetchMonth();

      fetchAllEmployees()
        .then(
          (
            data,
          ) =>
            setEmployees(
              data.filter(
                (
                  e,
                ) =>
                  e.isActive,
              ),
            ),
        )
        .catch(
          () => {},
        );
    },
    [
      admin,
      fetchMonth,
    ],
  );

  const dayEvents =
    useMemo(
      () =>
        events.filter(
          (
            ev,
          ) =>
            ev.date ===
            date,
        ),
      [
        events,
        date,
      ],
    );

  const employeesToday =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const ev of
          dayEvents
        ) {
          if (
            ev.employeeId ==
            null
          ) {
            continue;
          }

          if (
            !map.has(
              ev.employeeId,
            )
          ) {
            map.set(
              ev.employeeId,
              {
                id:
                  ev.employeeId,

                name:
                  ev.employeeName,

                color:
                  ev.employeeColor,
              },
            );
          }
        }

        return [
          ...map.values(),
        ].sort(
          (
            a,
            b,
          ) =>
            (
              a.name ||
              ""
            ).localeCompare(
              b.name ||
                "",
            ),
        );
      },
      [dayEvents],
    );

  const [
    employeeFilter,
    setEmployeeFilter,
  ] =
    useState("");

  useEffect(
    () => {
      if (
        employeeFilter &&
        !employeesToday.some(
          (
            e,
          ) =>
            String(
              e.id,
            ) ===
            employeeFilter,
        )
      ) {
        setEmployeeFilter(
          "",
        );
      }
    },
    [
      employeeFilter,
      employeesToday,
    ],
  );

  const filteredEvents =
    useMemo(
      () =>
        employeeFilter
          ? dayEvents.filter(
              (
                ev,
              ) =>
                String(
                  ev.employeeId,
                ) ===
                employeeFilter,
            )
          : dayEvents,
      [
        dayEvents,
        employeeFilter,
      ],
    );

  const doneEvents =
    useMemo(
      () =>
        [
          ...filteredEvents.filter(
            (
              ev,
            ) =>
              ev.done,
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            (
              b.time ||
              ""
            ).localeCompare(
              a.time ||
                "",
            ),
        ),
      [filteredEvents],
    );

  const dueEvents =
    useMemo(
      () =>
        [
          ...filteredEvents.filter(
            (
              ev,
            ) =>
              !ev.done,
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            (
              a.time ||
              ""
            ).localeCompare(
              b.time ||
                "",
            ),
        ),
      [filteredEvents],
    );

  const missedEvents =
    useMemo(
      () =>
        dueEvents.filter(
          (
            ev,
          ) =>
            ev.missed,
        ),
      [dueEvents],
    );

  async function handleLogout() {
    await adminLogout();

    navigate(
      "/admin/login",
      {
        replace:
          true,
      },
    );
  }

  function viewClientHistory(
    ev,
  ) {
    navigate(
      `/admin-dashboard/clients/${ev.rowKey}`,
      {
        state: {
          from:
            location.pathname,

          fromLabel:
            "Back to Calendar Day",
        },
      },
    );
  }

  async function handleSave({
    datetime,
    assignedEmployeeId,
  }) {
    const {
      kind,
      id,
    } =
      editing;

    if (
      kind ===
      "meeting"
    ) {
      await updateNextMeetingSchedule(
        id,
        {
          nextMeetingDatetime:
            datetime,

          assignedEmployeeId,
        },
      );
    } else {
      await updateNextCallSchedule(
        id,
        {
          nextCallDatetime:
            datetime,

          assignedEmployeeId,
        },
      );
    }

    setEditing(
      null,
    );

    setNotice({
      type:
        "success",

      message:
        `Next ${kind} updated successfully.`,
    });

    await fetchMonth();
  }

  if (
    checkingSession ||
    !admin
  ) {
    return null;
  }

  return (
    <AdminLayout
      admin={
        admin
      }
      onLogout={
        handleLogout
      }
    >
      <div className="mb-5">
        <BackButton
          to="/admin/calendar"
          title="Back to calendar"
        />
      </div>

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-mme-plum">
            <CalendarDays
              size={
                14
              }
            />

            Admin Control
          </div>

          <h1 className="mt-2 text-2xl font-black text-mme-purple sm:text-3xl">
            {formatDisplayDate(
              date,
            )}
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              navigate(
                `/admin/calendar/day/${shiftDate(
                  date,
                  -1,
                )}`,
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-mme-pink/70 bg-white text-mme-purple transition hover:bg-mme-blush/40"
          >
            <ChevronLeft
              size={
                18
              }
            />
          </button>

          <button
            onClick={() =>
              navigate(
                `/admin/calendar/day/${shiftDate(
                  date,
                  1,
                )}`,
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-mme-pink/70 bg-white text-mme-purple transition hover:bg-mme-blush/40"
          >
            <ChevronRight
              size={
                18
              }
            />
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type ===
            "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {
            notice.message
          }
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-3 border-mme-pink border-t-mme-purple" />
        </div>
      ) : dayEvents.length ===
        0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
          <CalendarDays
            size={
              38
            }
            className="text-mme-mauve"
          />

          <p className="mt-4 font-black text-mme-purple">
            Nothing
            scheduled for
            this day
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-mme-pink/60 bg-white px-5 py-3.5 shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
            <Users
              size={
                15
              }
              className="shrink-0 text-mme-purple/50"
            />

            <span className="text-xs font-black uppercase tracking-wide text-mme-purple/50">
              Employee
            </span>

            <div className="relative">
              <select
                value={
                  employeeFilter
                }
                onChange={(
                  e,
                ) =>
                  setEmployeeFilter(
                    e.target
                      .value,
                  )
                }
                className="appearance-none rounded-xl border border-mme-pink/70 bg-[#fff9fc] py-1.5 pl-3 pr-8 text-xs font-black text-mme-purple outline-none focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/20"
              >
                <option value="">
                  All
                  employees (
                  {
                    dayEvents.length
                  }
                  )
                </option>

                {employeesToday.map(
                  (
                    emp,
                  ) => (
                    <option
                      key={
                        emp.id
                      }
                      value={
                        emp.id
                      }
                    >
                      {
                        emp.name
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                size={
                  13
                }
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mme-purple/40"
              />
            </div>

            {employeeFilter && (
              <span className="ml-auto text-xs font-bold text-mme-purple/50">
                {
                  filteredEvents.length
                }{" "}
                activit
                {filteredEvents.length !==
                1
                  ? "ies"
                  : "y"}{" "}
                today
              </span>
            )}
          </div>

          {filteredEvents.length ===
          0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-mme-pink/60 bg-white py-16 text-center shadow-[0_8px_30px_rgba(91,55,101,0.07)]">
              <CalendarDays
                size={
                  38
                }
                className="text-mme-mauve"
              />

              <p className="mt-4 font-black text-mme-purple">
                No
                activities
                for this
                employee
                today
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wide text-mme-purple/70">
                    Due Today
                  </h2>

                  <span className="rounded-full bg-mme-blush px-2.5 py-0.5 text-xs font-black text-mme-purple">
                    {
                      dueEvents.length
                    }
                  </span>

                  {missedEvents.length >
                    0 && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-600">
                      {
                        missedEvents.length
                      }{" "}
                      missed
                    </span>
                  )}
                </div>

                {dueEvents.length ===
                0 ? (
                  <p className="rounded-2xl border border-dashed border-mme-pink/40 bg-white px-5 py-6 text-center text-sm font-bold text-mme-purple/50">
                    Nothing due
                    today.
                  </p>
                ) : (
                  <EventTable
                    events={
                      dueEvents
                    }
                    rowData={
                      rowData
                    }
                    worksheetColumns={
                      worksheetColumns
                    }
                    onEdit={(
                      context,
                    ) =>
                      setEditing(
                        context,
                      )
                    }
                    onViewHistory={
                      viewClientHistory
                    }
                  />
                )}
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wide text-mme-purple/70">
                    Completed
                    Today
                  </h2>

                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-700">
                    {
                      doneEvents.length
                    }
                  </span>
                </div>

                {doneEvents.length ===
                0 ? (
                  <p className="rounded-2xl border border-dashed border-mme-pink/40 bg-white px-5 py-6 text-center text-sm font-bold text-mme-purple/50">
                    Nothing
                    completed
                    yet today.
                  </p>
                ) : (
                  <EventTable
                    events={
                      doneEvents
                    }
                    rowData={
                      rowData
                    }
                    worksheetColumns={
                      worksheetColumns
                    }
                    onEdit={(
                      context,
                    ) =>
                      setEditing(
                        context,
                      )
                    }
                    onViewHistory={
                      viewClientHistory
                    }
                  />
                )}
              </section>
            </div>
          )}
        </>
      )}

      {editing && (
        <EditScheduleModal
          label={
            editing.kind ===
            "meeting"
              ? "Next Meeting"
              : "Next Call"
          }
          initialDatetime={
            editing.datetime
          }
          initialAssignedEmployeeId={
            editing.assignedEmployeeId
          }
          employees={
            employees
          }
          onClose={() =>
            setEditing(
              null,
            )
          }
          onSave={
            handleSave
          }
        />
      )}
    </AdminLayout>
  );
}