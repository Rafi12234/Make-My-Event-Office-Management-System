// ============================================================================
// IMPORTS
// In C/C++ terms, each `import` here is like a `#include` — it pulls in
// functions/values that were `export`-ed (like a public symbol) from another
// file (a "module", roughly like a .c/.h translation unit).
// ============================================================================

// React itself, plus 4 "hooks" (special built-in functions that only work
// inside components). Think of a component as a function that gets called
// over and over (every time the screen needs to redraw), and hooks are how
// that function keeps state "alive" between those calls instead of resetting
// every time (a plain local variable would reset to its initial value on
// every call, like a local variable in a C function that isn't `static`).
//   useState   -> a persistent variable + its setter function (like a
//                 static variable with a paired "set_value()" function that
//                 also triggers a UI redraw when called).
//   useEffect  -> "run this code automatically after the render, and again
//                 whenever these specific values change" — similar to
//                 registering a callback that fires after certain variables
//                 change (a poor-man's observer pattern).
//   useRef     -> a persistent "box" that holds a value (often a pointer to
//                 a real DOM element) WITHOUT causing a redraw when changed.
//                 Similar to a raw pointer/handle you keep around, as
//                 opposed to useState's "pointer + auto-notify" behaviour.
//   useCallback -> caches a function so it keeps the same identity/address
//                 across re-renders unless its dependencies change (like
//                 caching a function pointer instead of re-creating it).
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
// createPortal lets a component render its JSX somewhere else in the actual
// HTML tree (here: directly under <body>) instead of exactly where it sits
// in the component tree — used below for the full-screen image viewer.
import { createPortal } from "react-dom";
// Link = a clickable <a> tag that changes the page without a full browser
// reload. useNavigate = a function you call to change page programmatically
// (like `goto` to another route). useParams = reads the dynamic part of the
// URL, e.g. ":rowKey" in "/management/meetings/:rowKey".
import { Link, useNavigate, useParams } from "react-router";
// Every name below is one SVG icon component (a small reusable "draw this
// icon" function) coming from the lucide-react icon library.
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  UserRound,
  X,
  Plus,
  Calendar,
  ZoomIn,
} from "lucide-react";
// Reads the currently logged-in employee's info (id, name) that was saved
// in the browser's storage at login time.
import { loadCurrentEmployee } from "../services/managementStorage";
// A plain JS array of { key, label } objects — the fixed list of item names
// ("Stage", "LED", "Other", ...) used to build the dropdown further down.
import { CLIENT_REQUIREMENT_OPTIONS } from "../data/defaultSheet";
// All of these are functions from our own "API client" file — each one
// wraps one network call (fetch) to the backend server. Calling one of
// these is conceptually like calling a remote-procedure-call (RPC) stub in
// C — you call a local function, but it actually sends a request over the
// network and waits for a reply.
import {
  createMeeting,
  createMeetingItem,
  deleteMeeting,
  deleteMeetingItem,
  deleteMeetingItemImage,
  finalizeClient,
  loadClientMeetings,
  resolveImageUrl,
  toggleImageFinalSelection,
  toggleMeetingComplete,
  updateMeeting,
  updateMeetingItem,
  uploadMeetingItemImages,
} from "../services/meetingsStorage";

// ----------------------------------------------------------------------------
// toDatetimeLocalValue: converts whatever date format the DATABASE sends
// (e.g. "2026-08-01 14:30:00") into the exact text format the HTML
// <input type="datetime-local"> element needs ("2026-08-01T14:30").
// Think of this like a small formatting/parsing helper function in C that
// converts one struct/string representation into another.
// ----------------------------------------------------------------------------
function toDatetimeLocalValue(value) {
  // Guard clause: if value is null/undefined/empty string, return "" instead
  // of crashing — similar to checking `if (ptr == NULL) return "";` in C.
  if (!value) return "";
  // Force `value` to a real JS string (in case it arrives as something
  // else), then replace the FIRST space with the letter "T"
  // ("2026-08-01 14:30:00" -> "2026-08-01T14:30:00") because that's the
  // ISO-8601 format datetime-local inputs expect.
  const normalized = String(value).replace(" ", "T");
  // Keep only the first 16 characters: "2026-08-01T14:30" — the input
  // doesn't want seconds, so anything after minute is chopped off. Like
  // taking a substring / using strncpy with a fixed length in C.
  return normalized.slice(0, 16);
}

// ----------------------------------------------------------------------------
// formatDisplayDatetime: turns a raw date value into a friendly, readable
// string for humans to read on screen, e.g. "Aug 1, 2026, 2:30 PM".
// ----------------------------------------------------------------------------
function formatDisplayDatetime(value) {
  // If there's no date at all, show a friendly placeholder instead of
  // an empty string or "undefined".
  if (!value) return "Not scheduled yet";
  // Build a real JS Date object (similar to constructing a `struct tm` in
  // C from a string) after normalizing the space-vs-T formatting again.
  const date = new Date(String(value).replace(" ", "T"));
  // If the string couldn't be parsed into a valid date, `getTime()` returns
  // NaN ("Not a Number") — this is JS's way of signalling a parse failure,
  // similar to strtol() returning 0 with errno set on invalid input in C.
  // In that failure case we just show the raw original value instead of
  // crashing or showing "Invalid Date".
  if (Number.isNaN(date.getTime())) return String(value);
  // toLocaleString formats the date using the browser's locale/timezone
  // rules — similar to calling strftime() with a format string in C, but
  // the browser picks sensible formatting for you based on `dateStyle`
  // ("medium" = e.g. "Aug 1, 2026") and `timeStyle` ("short" = e.g. "2:30 PM").
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ============================================================================
// ImageLightbox \u2014 the full-screen photo viewer (like a modal/popup window).
// Think of this "function" as similar to a C function that takes a struct of
// parameters (images, initialIndex, onClose) and returns a description of
// what to draw on screen (JSX) instead of actually drawing pixels itself.
// React takes that description and updates the real screen for you.
//
// Props (the parameters passed in, like function arguments):
//   images       -> array of image objects to flip through
//   initialIndex -> which photo to start on (an array index, 0-based)
//   onClose      -> a callback function to call when the user wants to close
// ============================================================================
function ImageLightbox({ images, initialIndex, onClose }) {
  // `index` is a persistent variable (see useState explanation above) that
  // remembers which photo is currently shown. `setIndex` is the function you
  // must call to change it (you can NEVER do `index = 5` directly in React).
  const [index, setIndex] = useState(initialIndex);

  // useEffect: "after this component is drawn on screen, run this setup code
  // once, and clean it up when the component disappears." Here we're
  // attaching a global keyboard listener, similar to registering a signal
  // handler in C (e.g. signal(SIGINT, handler)) that stays active until you
  // explicitly unregister it.
  useEffect(() => {
    // This inner function runs every time ANY key is pressed anywhere on the
    // page while the lightbox is open.
    function handleKeyDown(event) {
      // Escape key -> tell the parent component to close this viewer.
      if (event.key === "Escape") onClose();
      // Right arrow -> move to the next photo, wrapping back to 0 after the
      // last one. The "%" is the modulo operator, exactly like in C: it
      // wraps the number around instead of going out of bounds (like a
      // circular buffer / ring buffer index).
      if (event.key === "ArrowRight")
        setIndex((i) => (i + 1) % images.length);
      // Left arrow -> move to the previous photo. Adding `images.length`
      // before the modulo avoids getting a negative index when going
      // backwards from photo 0 (JS's % can return negative numbers, unlike
      // always-positive modulo in some other languages, so we correct it
      // manually \u2014 same trick you'd use in C to wrap a negative index).
      if (event.key === "ArrowLeft")
        setIndex((i) => (i - 1 + images.length) % images.length);
    }
    // Register the listener on the whole browser window (like subscribing
    // to a global event bus).
    window.addEventListener("keydown", handleKeyDown);
    // The function returned here is the "cleanup" function \u2014 React calls
    // this automatically when the component is removed from screen, so we
    // don't leave a dangling event listener behind (avoids a "memory leak"
    // equivalent \u2014 similar to freeing a resource you malloc'd/registered).
    return () => window.removeEventListener("keydown", handleKeyDown);
    // The dependency array: this effect only needs to be re-created if
    // images.length or onClose change. Empty behaviour would be "run once
    // ever"; this array says "re-run setup if these specific values change".
  }, [images.length, onClose]);

  // Look up the actual image object at the current index (like `array[i]`
  // in C, but JS won't crash on an out-of-range index \u2014 it just gives
  // `undefined` instead of undefined behaviour/segfault).
  const image = images[index];
  // If somehow there's no image at this index (e.g. empty list), render
  // nothing at all instead of crashing. Returning `null` from a component
  // is React's way of saying "draw nothing here".
  if (!image) return null;

  // createPortal(whatToRender, whereToAttachItInTheRealDOM):
  // Normally a component's JSX gets attached exactly where it sits in the
  // component tree. Here we force it to attach directly under <body>
  // instead, so this full-screen overlay always covers the ENTIRE browser
  // window no matter how deeply nested the button that opened it was.
  return createPortal(
    // Full-screen dark backdrop. "fixed inset-0" = pinned to all 4 edges of
    // the browser viewport (top/right/bottom/left all = 0), so it always
    // covers the whole screen regardless of scroll position.
    // onClick={onClose} on the OUTER div means "clicking the dark background
    // (anywhere that isn't the image or a button) closes the viewer".
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "fadeIn 0.2s ease" }}
    >
      {/* Raw CSS animation keyframes, injected directly as a <style> tag.
          Similar to embedding a small chunk of a stylesheet inline instead
          of a separate .css file. */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>

      {/* Close (X) button, top-right corner. Clicking it also calls onClose. */}
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-110"
      >
        <X size={20} />
      </button>

      {/* Left/"previous photo" arrow \u2014 only rendered at all when there is
          more than 1 image (no point showing arrows for a single photo).
          `condition && <jsx>` is JSX's version of `if (condition) { ...draw... }`
          \u2014 if condition is false/0/"", React renders nothing for that spot. */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            // stopPropagation prevents this click from "bubbling up" to the
            // outer div's onClick={onClose} \u2014 otherwise clicking the arrow
            // would also close the whole viewer. Similar to consuming/
            // swallowing an event so it doesn't propagate further.
            e.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
          className="absolute left-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:scale-110"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* The actual photo. resolveImageUrl() turns the short path stored in
          the database into a full clickable URL pointing at the backend. */}
      <img
        src={resolveImageUrl(image.url)}
        alt={image.originalFileName || "Meeting image"}
        className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.25s ease" }}
      />
      
      {/* Right/"next photo" arrow, same idea as the left one above. */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
          className="absolute right-5 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:scale-110"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Row of small dots at the bottom, one per photo, showing which one
          is active. `images.map(...)` loops over the array and builds one
          button per photo \u2014 exactly like a C `for` loop that builds up an
          array of widgets, just written in a more compact "map" style. */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 backdrop-blur-sm">
          {images.map((_, i) => (
            <button
              // `key` is a required, hidden prop React uses internally to
              // track which DOM element corresponds to which array item
              // across re-renders (like a stable ID/index for a linked-list
              // node) \u2014 it's not visible on screen.
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              // Template literal (backtick string) with an embedded
              // JS ternary \u2014 like sprintf("%s", cond ? "a" : "b") in C.
              // The currently active dot gets a wider/brighter pill shape.
              className={`rounded-full transition-all duration-200 ${
                i === index
                  ? "h-2 w-6 bg-white"
                  : "h-2 w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    // Second argument to createPortal: WHERE in the real HTML page this JSX
    // should actually be attached (here: the <body> tag itself).
    document.body
  );
}

// ============================================================================
// MeetingCard \u2014 one whole "card" box on the page, representing ONE meeting
// (date/time + its items table). The page renders one of these per meeting.
//
// Props (like a function's parameter struct):
//   meeting    -> the meeting object (id, datetime, items[], etc.) fetched
//                 from the backend
//   rowKey     -> which client this meeting belongs to (comes from the URL)
//   employeeId -> id of the currently logged-in employee (for "created by"/
//                 "updated by" tracking)
//   onChanged  -> callback to tell the PARENT component "something changed,
//                 please re-fetch the data from the server"
//   onDeleted  -> callback to tell the parent "this whole meeting was deleted"
// ============================================================================
function MeetingCard({ meeting, rowKey, employeeId, onChanged, onDeleted }) {
  // Local (persistent) copy of the date/time text shown in the input box.
  // Initialized once from the meeting's saved value, converted to the exact
  // string format the <input type="datetime-local"> element expects.
  const [meetingDatetime, setMeetingDatetime] = useState(
    toDatetimeLocalValue(meeting.meetingDatetime)
  );
  // Simple true/false "flags" (booleans) used purely to control the UI \u2014
  // e.g. show a spinner while a network request is in flight, similar to a
  // `bool isSaving` flag you'd toggle around a blocking function call in C.
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  // Whether the "add a new item" draft row is currently open/visible.
  const [isAddingItem, setIsAddingItem] = useState(false);
  // Whether we're mid-way through the network call that creates a new item
  // (used to disable buttons/show a spinner so the user can't double-submit).
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  // Which item the user has picked in the "add item" dropdown so far (empty
  // string = nothing picked yet). This is a DRAFT value, not yet saved.
  const [draftItemKey, setDraftItemKey] = useState("");
  // The free-text name typed in when draftItemKey === "other". Also just a
  // draft value until the user confirms it.
  const [draftCustomLabel, setDraftCustomLabel] = useState("");
  // Holds an error message string to show the user if a request fails.
  const [error, setError] = useState("");
  // Which item ids currently have unsaved description/quantity edits —
  // used to decide whether the card-level "Save" button is clickable.
  const [dirtyItemIds, setDirtyItemIds] = useState(() => new Set());
  // Whether the "Save all items" network request is in flight.
  const [isSavingItems, setIsSavingItems] = useState(false);
  // A plain mutable map { itemId: { save, isDirty } } filled in by each
  // rendered MeetingItemRow via its ref — a useRef (not useState) because
  // updating it should NOT by itself trigger a re-render.
  const itemRowRefs = useRef({});

  // --------------------------------------------------------------------
  // handleItemDirtyChange: called by a MeetingItemRow whenever its own
  // dirty status flips, so this card can track ALL rows at once.
  // --------------------------------------------------------------------
  const handleItemDirtyChange = useCallback((itemId, isItemDirty) => {
    setDirtyItemIds((prev) => {
      const next = new Set(prev);
      if (isItemDirty) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  // The Save button is only clickable once at least one item has an
  // unsaved description/quantity change.
  const hasDirtyItems = dirtyItemIds.size > 0;

  // --------------------------------------------------------------------
  // handleSaveAll: runs when the card-level "Save" button is clicked —
  // asks every currently-dirty MeetingItemRow to persist itself, all at
  // the same time, then refreshes once.
  // --------------------------------------------------------------------
  async function handleSaveAll() {
    setIsSavingItems(true);
    setError("");
    try {
      const idsToSave = Array.from(dirtyItemIds);
      // Promise.allSettled waits for EVERY save to finish (success or
      // failure) instead of stopping at the first failure, so one bad
      // row doesn't block the others from saving.
      const results = await Promise.allSettled(
        idsToSave.map((id) => itemRowRefs.current[id]?.save())
      );
      if (results.some((r) => r.status === "rejected")) {
        setError("Some items failed to save. Please check the highlighted rows.");
      }
      onChanged();
    } finally {
      setIsSavingItems(false);
    }
  }

  // "isDirty" = true if the date/time box currently shows something
  // DIFFERENT from what's actually saved in the database right now. Used to
  // decide whether to show the "OK" (save) button at all. This is computed
  // fresh on every render \u2014 not stored in state \u2014 because it's a pure
  // derived value (like a computed property, not something you need a
  // separate variable + setter for).
  const isDirty =
    meetingDatetime !== toDatetimeLocalValue(meeting.meetingDatetime);

  // "Other" always stays selectable since a meeting can have several
  // custom-named items; the fixed options can only be added once each.
  // .filter(...) walks the full fixed list and keeps only the options that
  // pass the test function \u2014 similar to writing a loop in C that copies
  // matching elements into a new array.
  const availableItemOptions = CLIENT_REQUIREMENT_OPTIONS.filter(
    (option) =>
      // Keep "other" no matter what, OR keep any option whose key ISN'T
      // already used by one of this meeting's existing items.
      // `.some(...)` returns true if ANY item in meeting.items matches \u2014
      // like a linear search that stops early once it finds a match.
      option.key === "other" || !meeting.items.some((item) => item.itemKey === option.key)
  );

  // --------------------------------------------------------------------
  // handleSave: called when the employee clicks the "OK" button next to
  // the date/time box \u2014 sends the new date/time to the backend to save.
  // --------------------------------------------------------------------
  async function handleSave() {
    // Show the spinner / disable the button while the request is running.
    setIsSaving(true);
    // Clear any old error message before trying again.
    setError("");
    // `try/catch` here works exactly like C++ try/catch: if anything inside
    // `try` throws (a rejected network Promise counts as "throwing" once
    // you `await` it), control jumps straight to `catch`.
    try {
      // `await` pauses THIS function (not the whole program/browser!) until
      // the network request finishes \u2014 similar to a blocking network call
      // in C, but under the hood JS keeps handling other events meanwhile.
      await updateMeeting(rowKey, meeting.id, {
        // If the box is empty, send `null` instead of an empty string, so
        // the backend clearly knows "no date set" vs. "empty text".
        meetingDatetime: meetingDatetime || null,
        employeeId,
      });
      // Tell the parent page to re-fetch the full meetings list from the
      // server, so the UI reflects the freshly saved value.
      onChanged();
    } catch (err) {
      // If the request failed, show a friendly message (fall back to a
      // generic one if the error has no message text at all).
      setError(err.message || "Failed to save meeting.");
    } finally {
      // `finally` ALWAYS runs, whether we succeeded or hit the catch block
      // \u2014 exactly like a C++ destructor/cleanup that runs no matter how
      // the function exits. Used here to always turn the spinner back off.
      setIsSaving(false);
    }
  }

  // --------------------------------------------------------------------
  // handleToggleComplete: flips the meeting between "Mark Complete" and
  // "Completed" when that header button is clicked.
  // --------------------------------------------------------------------
  async function handleToggleComplete() {
    setIsCompleting(true);
    setError("");
    try {
      // The backend itself decides the new value by flipping whatever the
      // current value is (see the PATCH .../complete route) \u2014 we just
      // tell it which meeting + which employee is doing the toggling.
      await toggleMeetingComplete(rowKey, meeting.id, employeeId);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to update meeting status.");
    } finally {
      setIsCompleting(false);
    }
  }

  // --------------------------------------------------------------------
  // handleDelete: deletes this ENTIRE meeting (and all its items/images)
  // after asking the user to confirm first.
  // --------------------------------------------------------------------
  async function handleDelete() {
    // window.confirm() shows the browser's native "OK / Cancel" popup and
    // blocks until the user answers \u2014 similar to a blocking prompt in a
    // console app. If the user clicks Cancel, we `return` early and do
    // nothing else (an early-return guard clause, same idea as in C).
    if (
      !window.confirm(
        "Delete this meeting and all its images? This cannot be undone."
      )
    )
      return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteMeeting(rowKey, meeting.id);
      // Different from the other handlers: this calls onDeleted() (not
      // onChanged()) because the whole meeting card needs to disappear
      // from the list, not just refresh its own data.
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete meeting.");
      // Only reset the spinner flag on FAILURE here \u2014 on success, the
      // whole card is about to be removed from the screen anyway once the
      // parent re-fetches, so there's no need to reset local state.
      setIsDeleting(false);
    }
  }

  // --------------------------------------------------------------------
  // handleAddItem: actually sends the "create a new item" request to the
  // backend. `customLabel` defaults to "" (empty string) if not passed \u2014
  // that default-parameter syntax works just like default arguments in
  // C++ function signatures.
  // --------------------------------------------------------------------
  async function handleAddItem(itemKey, customLabel = "") {
    // Guard clause: if nothing was picked yet, do nothing.
    if (!itemKey) return;
    setIsCreatingItem(true);
    setError("");
    try {
      await createMeetingItem(rowKey, meeting.id, {
        itemKey,
        customLabel,
        description: "",
        quantity: 1,
        employeeId,
      });
      // Close the draft row and reset the draft fields back to empty, now
      // that the item has actually been saved.
      setIsAddingItem(false);
      setDraftItemKey("");
      setDraftCustomLabel("");
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to add item.");
    } finally {
      setIsCreatingItem(false);
    }
  }

  // --------------------------------------------------------------------
  // handleStartAddItem: runs when the "Add Item" button is clicked \u2014
  // resets any leftover draft values and opens the draft row.
  // --------------------------------------------------------------------
  function handleStartAddItem() {
    setDraftItemKey("");
    setDraftCustomLabel("");
    setIsAddingItem(true);
  }

  // --------------------------------------------------------------------
  // handleCancelAddItem: runs when the "Cancel" button is clicked \u2014
  // closes the draft row and throws away whatever was typed/selected.
  // --------------------------------------------------------------------
  function handleCancelAddItem() {
    setIsAddingItem(false);
    setDraftItemKey("");
    setDraftCustomLabel("");
  }

  // --------------------------------------------------------------------
  // handleDraftItemKeyChange: runs every time the dropdown's selected
  // value changes.
  // --------------------------------------------------------------------
  function handleDraftItemKeyChange(value) {
    setDraftItemKey(value);
    // Always clear any previously typed custom name when the dropdown
    // selection changes, so leftover text from a previous "Other" attempt
    // doesn't get accidentally reused.
    setDraftCustomLabel("");
    // If they picked a NORMAL item (not empty, not "other"), we don't need
    // any extra typing from them \u2014 save it immediately.
    if (value && value !== "other") {
      handleAddItem(value);
    }
    // If they picked "other", we deliberately do NOT call handleAddItem
    // yet \u2014 the JSX below will show a text box, and saving only happens
    // once handleConfirmOtherItem() runs.
  }

  // --------------------------------------------------------------------
  // handleConfirmOtherItem: runs when the user presses Enter or clicks the
  // confirm button after typing a custom item name.
  // --------------------------------------------------------------------
  function handleConfirmOtherItem() {
    // .trim() removes leading/trailing whitespace \u2014 same idea as
    // stripping a C string of surrounding spaces before checking it.
    const trimmed = draftCustomLabel.trim();
    // Guard clause: don't save a blank/whitespace-only name.
    if (!trimmed) return;
    handleAddItem("other", trimmed);
  }

  // Everything from here down is JSX — a description of what to draw,
  // NOT actual drawing code. Think of it like building a tree of structs
  // (each with a "tag name" + "attributes" + "children") that React reads
  // afterwards and turns into real HTML elements on screen.
  return (
    // Outer card container — one rounded white box per meeting.
    <div
      className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5"
      style={{ animation: "slideUp 0.35s ease both" }}
    >
      {/* Card Header: shows the scheduled date/time + Mark Complete/Delete buttons.
          The header's background colour switches (green vs. neutral) based on
          meeting.isCompleted — a template literal with an embedded ternary,
          same trick as building a formatted string with a conditional value
          in C via sprintf + a ternary expression. */}
      <div
        className={`relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors duration-200 ${
          meeting.isCompleted
            ? "bg-linear-to-r from-emerald-50 to-green-50/50"
            : "bg-linear-to-r from-slate-50 to-white"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Small square icon badge — colour also depends on completed state. */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              meeting.isCompleted
                ? "bg-emerald-500 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            <Calendar size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Scheduled
            </p>
            {/* Calls our formatDisplayDatetime() helper to turn the raw
                database value into a human-friendly string. */}
            <p className="text-sm font-black text-slate-900">
              {formatDisplayDatetime(meeting.meetingDatetime)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mark Complete / Completed toggle button. `disabled={isCompleting}`
              greys the button out and blocks clicks while the request is
              in-flight, same idea as disabling a UI control during a
              blocking operation to prevent double-submission. */}
          <button
            onClick={handleToggleComplete}
            disabled={isCompleting}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 disabled:opacity-60 ${
              meeting.isCompleted
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600"
                : "bg-white text-slate-700 shadow-sm shadow-slate-200 hover:bg-slate-900 hover:text-white border border-slate-200"
            }`}
          >
            {/* Nested ternary: while saving show a spinner, else show a
                checkmark if already completed, else an empty circle icon.
                Same logic as `isCompleting ? A : (isCompleted ? B : C)` in
                a C conditional expression chain. */}
            {isCompleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : meeting.isCompleted ? (
              <CheckCircle2 size={14} />
            ) : (
              <Circle size={14} />
            )}
            {meeting.isCompleted ? "Completed" : "Mark Complete"}
          </button>

          {/* Delete (trash) button for the whole meeting. */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Completed-by banner: only rendered at all when the meeting is marked
          complete (`condition && <jsx>`, same "only draw if true" pattern
          used throughout this file). */}
      {meeting.isCompleted && (
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-6 py-2.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">
            Completed by{" "}
            {/* `|| "an employee"` = fallback text if the name is missing,
                exactly like `name != NULL ? name : "an employee"` in C. */}
            <span className="font-black">
              {meeting.completedByName || "an employee"}
            </span>
            {/* Ternary again: only show the "· <date>" suffix if there's an
                actual completedAt timestamp, otherwise show nothing. */}
            {meeting.completedAt
              ? ` · ${formatDisplayDatetime(meeting.completedAt)}`
              : ""}
          </p>
        </div>
      )}

      {/* Two-column responsive grid: fixed 280px-wide left column (date/time),
          flexible right column (items table) — on small screens they stack
          vertically instead (see the `lg:` responsive prefixes below). */}
      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        {/* Left Panel: the date/time editor */}
        <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
          <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Meeting Time
          </label>
          <div className="flex items-stretch gap-2">
            {/* Native HTML date+time picker. `value`/`onChange` together make
                this a "controlled input" — React fully owns what's displayed,
                same idea as always re-reading a variable from a single
                source of truth instead of letting the widget keep its own
                separate copy. Every keystroke updates `meetingDatetime`
                immediately, but nothing is SAVED to the server until the
                OK button below is clicked. */}
            <input
              type="datetime-local"
              value={meetingDatetime}
              onChange={(e) => setMeetingDatetime(e.target.value)}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />

            {/* The "OK" (save) button only appears at all while the value
                differs from what's saved (isDirty) — this is the fix that
                stops the picker from auto-saving/auto-closing on its own. */}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
                style={{ animation: "slideUp 0.2s ease" }}
                title="Confirm this meeting time"
              >
                {isSaving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                OK
              </button>
            )}
          </div>

          {/* "Created by" / "Updated by" info box — only rendered if at least
              one of the two names actually exists. */}
          {(meeting.createdByName || meeting.updatedByName) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-3.5">
              {meeting.createdByName && (
                <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <UserRound size={12} className="text-slate-400" />
                  Created by{" "}
                  <span className="font-black text-slate-700">
                    {meeting.createdByName}
                  </span>
                </p>
              )}
              {/* Only show "Updated by" as a SEPARATE line if it exists AND is
                  a different person than whoever created it — avoids showing
                  the same name twice for a meeting nobody has edited yet. */}
              {meeting.updatedByName &&
                meeting.updatedByName !== meeting.createdByName && (
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <UserRound size={12} className="text-slate-400" />
                    Updated by{" "}
                    <span className="font-black text-slate-700">
                      {meeting.updatedByName}
                    </span>
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Right Panel — Items table + "Add Item" controls */}
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Items
              </span>
              {/* Little pill showing how many items exist \u2014 just reads
                  the array's length, like `arr.size()`/`count` in C++. */}
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-black text-white">
                {meeting.items.length}
              </span>
            </div>

            <div className="relative flex items-center gap-2">
              {/* Card-level Save button: only clickable once at least one
                  item row below has an unsaved description/quantity edit. */}
              <button
                onClick={handleSaveAll}
                disabled={!hasDirtyItems || isSavingItems}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSavingItems ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Save
              </button>
              {/* This ONE button does double duty: while the draft row is
                  closed, clicking it opens it (handleStartAddItem); while
                  it's open, clicking the SAME button (now showing
                  "Cancel") closes it instead (handleCancelAddItem). The
                  ternary picks which handler to attach as onClick. */}
              <button
                onClick={isAddingItem ? handleCancelAddItem : handleStartAddItem}
                disabled={isCreatingItem || (!isAddingItem && availableItemOptions.length === 0)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {isCreatingItem ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isAddingItem ? (
                  <X size={13} />
                ) : (
                  <Plus size={13} />
                )}
                {isAddingItem ? "Cancel" : "Add Item"}
              </button>
            </div>
          </div>

          {/* Big ternary: if there are NO items yet AND we're not currently
              adding one, show a friendly empty-state message instead of an
              empty table. Otherwise, render the real items table (which may
              itself be showing just the "add item" draft row with zero
              real items underneath it). */}
          {meeting.items.length === 0 && !isAddingItem ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
              <ClipboardList size={28} className="mb-3 text-slate-300" />
              <p className="text-sm font-black text-slate-400">No items yet</p>
              <p className="mt-1 text-xs font-medium text-slate-300">
                Click "Add Item" to get started
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  {/* Column headers: Item / Description / Qty / Images */}
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="min-w-40 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      <th className="min-w-60 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Description
                      </th>
                      <th className="min-w-25 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Qty
                      </th>
                      <th className="min-w-60 border-b border-slate-200 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Images
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* The "draft row" for adding a new item \u2014 only shown
                        while isAddingItem is true. This is a plain, native
                        HTML <select> dropdown, chosen deliberately because
                        native dropdowns are drawn by the browser itself and
                        can NEVER be visually clipped/cut off, unlike a
                        custom-built floating panel. */}
                    {isAddingItem && (
                      <tr className="border-b border-slate-100 bg-slate-50/60 align-top">
                        <td className="border-r border-slate-100 px-3 py-2.5">
                          <select
                            autoFocus
                            value={draftItemKey}
                            onChange={(e) => handleDraftItemKeyChange(e.target.value)}
                            disabled={isCreatingItem}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all duration-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                          >
                            <option value="">Choose an item...</option>
                            {/* Loop over the remaining selectable options and
                                build one <option> tag per entry \u2014 same
                                pattern as building an array of choices with a
                                for loop in C. */}
                            {availableItemOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {/* Only shown once the user has picked "Other" in
                              the dropdown above \u2014 lets them type the
                              custom item name. */}
                          {draftItemKey === "other" && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <input
                                autoFocus
                                type="text"
                                value={draftCustomLabel}
                                onChange={(e) => setDraftCustomLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  // Pressing Enter confirms/saves the typed
                                  // name, same as hitting a "submit" button.
                                  if (e.key === "Enter") handleConfirmOtherItem();
                                }}
                                placeholder="Enter item name"
                                disabled={isCreatingItem}
                                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                              />
                              <button
                                onClick={handleConfirmOtherItem}
                                disabled={isCreatingItem || !draftCustomLabel.trim()}
                                title="Add this item"
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-40"
                              >
                                {isCreatingItem ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={13} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                        {/* colSpan={3} merges the remaining 3 columns into
                            one wide cell showing a placeholder hint, so the
                            draft row doesn't look broken/half-empty. */}
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 text-[11px] font-medium italic text-slate-300"
                        >
                          {draftItemKey === "other"
                            ? "Enter a name above, then confirm to add this item."
                            : "Select an item type to continue…"}
                        </td>
                      </tr>
                    )}
                    {/* Real, already-saved items: loop over meeting.items
                        and render one <MeetingItemRow> component per item
                        (defined further down in this file). Passing
                        `key={item.id}` gives React a stable identity for
                        each row across re-renders. */}
                    {meeting.items.map((item) => (
                      <MeetingItemRow
                        key={item.id}
                        ref={(el) => {
                          // Called with the real handle on mount/update, and
                          // with null right before unmount \u2014 we add/remove
                          // the entry from the map to match.
                          if (el) itemRowRefs.current[item.id] = el;
                          else delete itemRowRefs.current[item.id];
                        }}
                        rowKey={rowKey}
                        meetingId={meeting.id}
                        item={item}
                        employeeId={employeeId}
                        onChanged={onChanged}
                        onDirtyChange={handleItemDirtyChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error banner for THIS card only (e.g. save/delete/add-item
              failures) \u2014 only rendered when `error` is a non-empty string. */}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MeetingItemRow \u2014 one <tr> table row representing a SINGLE item inside a
// meeting's items table (e.g. "Banner", "Photographer", or a custom "Other"
// item). Handles its own description/quantity editing and image uploads.
//
// Props:
//   rowKey     -> which client (from the URL)
//   meetingId  -> which meeting this item belongs to
//   item       -> the item object itself (id, itemKey, customLabel,
//                 description, quantity, images[])
//   employeeId -> currently logged-in employee (for audit tracking)
//   onChanged  -> callback telling the parent to re-fetch fresh data
// ============================================================================
const MeetingItemRow = forwardRef(function MeetingItemRow(
  { rowKey, meetingId, item, employeeId, onChanged, onDirtyChange },
  ref
) {
  // Local editable copies of the description/quantity text boxes.
  // `item.description || ""` = "use item.description, but if it's null/
  // undefined/empty, fall back to an empty string" \u2014 same idea as
  // `str ? str : ""` in C to avoid working with a NULL pointer.
  const [description, setDescription] = useState(item.description || "");
  // `??` is the "nullish coalescing" operator: unlike `||`, it ONLY falls
  // back when the left side is null/undefined (not when it's simply 0 or
  // false) \u2014 important here because a quantity of 0 is a valid value that
  // `||` would have incorrectly overridden.
  const [quantity, setQuantity] = useState(item.quantity ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // `viewerIndex` is either `null` (lightbox closed) or a number (which
  // photo index to open the full-screen viewer on) \u2014 using null as a
  // sentinel value here, similar to using -1 or NULL as a "not set" marker
  // in C instead of a separate boolean flag.
  const [viewerIndex, setViewerIndex] = useState(null);
  const [error, setError] = useState("");
  // useRef gives us a persistent "box" that holds a reference to the real
  // hidden <input type="file"> DOM element once it's rendered, WITHOUT
  // causing a re-render when it's set. Think of it like a raw pointer/
  // handle to a widget, as opposed to useState's "value + triggers redraw"
  // behaviour.
  const fileInputRef = useRef(null);
  // Client-side-ONLY ordering of this item's photos, stored as a plain
  // array of image ids (left-to-right = priority order). Dragging a
  // thumbnail just rearranges this array \u2014 nothing here is ever sent to
  // the backend, exactly as requested ("maintain this from frontend").
  const [orderedImageIds, setOrderedImageIds] = useState(() =>
    item.images.map((image) => image.id)
  );
  // Remembers the image-id list we last reconciled against, so we can
  // tell whether item.images actually changed (upload/delete) since the
  // last render.
  const [prevImageIds, setPrevImageIds] = useState(() =>
    item.images.map((image) => image.id)
  );
  // Which thumbnail is currently mid-drag (its index), or null when
  // nothing is being dragged right now.
  const [dragIndex, setDragIndex] = useState(null);

  // Keep orderedImageIds in sync whenever the REAL image list changes
  // (upload/delete): keep any ids that still exist in their existing
  // custom order, and append any brand-new ids at the end. This means a
  // fresh upload never disturbs an order the employee already dragged
  // into place.
  // NOTE: this deliberately runs INLINE during render (not inside a
  // useEffect) — it's React's documented pattern for "adjust state when
  // a prop changes", comparing against a remembered previous value and
  // calling setState right here if it differs. Calling setState from
  // inside a normal function-call effect for this would cause an extra
  // unnecessary re-render pass.
  const currentImageIds = item.images.map((image) => image.id);
  if (
    currentImageIds.length !== prevImageIds.length ||
    currentImageIds.some((id, i) => id !== prevImageIds[i])
  ) {
    const stillPresent = orderedImageIds.filter((id) =>
      currentImageIds.includes(id)
    );
    const newlyAdded = currentImageIds.filter(
      (id) => !orderedImageIds.includes(id)
    );
    setOrderedImageIds([...stillPresent, ...newlyAdded]);
    setPrevImageIds(currentImageIds);
  }

  // The actual image objects, in the current drag-and-drop order.
  // `.filter(Boolean)` drops any `undefined` results from `.find()` just
  // in case an id briefly doesn't match (defensive, like checking a
  // lookup didn't return NULL before using it).
  const orderedImages = orderedImageIds
    .map((id) => item.images.find((image) => image.id === id))
    .filter(Boolean);

  // Look up this item's fixed-option metadata (icon/label) from the shared
  // options list, by matching on itemKey. `.find(...)` returns the first
  // matching element or `undefined` if none match \u2014 like a linear search
  // that can come back empty-handed instead of crashing.
  const option = CLIENT_REQUIREMENT_OPTIONS.find(
    (c) => c.key === item.itemKey
  );
  // Decide what text to actually show as this item's name:
  //   - if it's a custom "other" item, show the typed custom name (or the
  //     literal word "Other" if somehow no name was saved)
  //   - otherwise show the matching fixed option's label, or worst case
  //     just show the raw itemKey string as a last-resort fallback.
  // This is a ternary chained with `||` fallbacks \u2014 like a chain of
  // `cond ? a : (b ? b : c)` in C.
  const displayLabel =
    item.itemKey === "other" ? item.customLabel || "Other" : option?.label || item.itemKey;
  // True if either text box currently holds something different from what
  // was last saved to the database \u2014 now used to enable/disable the
  // CARD-LEVEL Save button (via onDirtyChange below) instead of an
  // onBlur auto-save.
  const isDirty =
    description !== (item.description || "") ||
    Number(quantity) !== (item.quantity ?? 1);

  // --------------------------------------------------------------------
  // handleSave: sends the description + quantity to the backend. No
  // longer called automatically \u2014 it's only invoked either through the
  // imperative handle below (when the parent card's Save button is
  // clicked) or directly by other handlers in this file.
  // --------------------------------------------------------------------
  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateMeetingItem(rowKey, meetingId, item.id, {
        description,
        quantity,
        employeeId,
      });
    } catch (err) {
      setError(err.message || "Failed to save item.");
      // Re-throw so the CALLER (MeetingCard's handleSaveAll, via
      // Promise.allSettled) can detect that this particular row failed,
      // similar to letting an exception propagate up to a caller in C++
      // instead of silently swallowing it here.
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  // useImperativeHandle: this is what lets the PARENT (MeetingCard) call
  // `itemRowRefs.current[item.id].save()` directly on this component
  // instance, sort of like exposing a small function-pointer table
  // through a handle/opaque struct in C, rather than exposing the whole
  // internal implementation.
  useImperativeHandle(ref, () => ({
    save: handleSave,
    isDirty,
  }));

  // Every time this row's dirty status changes, tell the parent card
  // about it, so the card can enable/disable its own Save button. The
  // returned cleanup function fires when this row unmounts (e.g. the
  // item was deleted) — that's what clears its entry out of the
  // parent's dirty set instead of a separate "prune stale ids" effect.
  useEffect(() => {
    onDirtyChange?.(item.id, isDirty);
    return () => {
      onDirtyChange?.(item.id, false);
    };
  }, [isDirty, item.id, onDirtyChange]);

  // --------------------------------------------------------------------
  // Drag-and-drop handlers for reordering photo priority (left-most =
  // highest priority). Purely a frontend/visual reorder \u2014 never sent to
  // the server.
  // --------------------------------------------------------------------
  function handleImageDragStart(index) {
    setDragIndex(index);
  }
  function handleImageDragOver(event) {
    // Browsers block dropping onto an element by default; calling
    // preventDefault() here is what tells the browser "yes, dropping is
    // allowed on this element".
    event.preventDefault();
  }
  function handleImageDrop(dropIndex) {
    // Guard clauses: nothing being dragged, or dropped onto itself.
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    setOrderedImageIds((prev) => {
      const next = [...prev];
      // .splice(dragIndex, 1) removes exactly one element at dragIndex and
      // returns it inside a 1-element array; destructuring pulls that
      // single value out, same idea as popping an element out of a C
      // array and shifting the rest down.
      const [movedId] = next.splice(dragIndex, 1);
      // .splice(dropIndex, 0, movedId) inserts movedId back in at
      // dropIndex WITHOUT removing anything (the 0), shifting later
      // elements up to make room.
      next.splice(dropIndex, 0, movedId);
      return next;
    });
    setDragIndex(null);
  }

  // --------------------------------------------------------------------
  // handleDeleteItem: deletes just THIS item (and its images) after
  // confirming with the user.
  // --------------------------------------------------------------------
  async function handleDeleteItem() {
    if (
      !window.confirm(
        `Remove "${displayLabel}" and its images? This cannot be undone.`
      )
    )
      return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteMeetingItem(rowKey, meetingId, item.id);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to remove item.");
      setIsDeleting(false);
    }
  }

  // --------------------------------------------------------------------
  // handleFilesSelected: runs when the user picks file(s) from the
  // hidden <input type="file"> after clicking the "Upload" button.
  // --------------------------------------------------------------------
  async function handleFilesSelected(e) {
    // `e.target.files` is a special browser FileList object (not a plain
    // array) \u2014 Array.from(...) converts it into a normal JS array so we
    // can use array methods like .length on it comfortably.
    const files = Array.from(e.target.files || []);
    // Reset the file input's value immediately so selecting the SAME file
    // again later still fires this handler (browsers otherwise skip the
    // change event if the exact same file is "re-selected").
    e.target.value = "";
    // Guard clause: if the user cancelled the file picker, do nothing.
    if (!files.length) return;
    setIsUploading(true);
    setError("");
    try {
      await uploadMeetingItemImages(
        rowKey,
        meetingId,
        item.id,
        files,
        employeeId
      );
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to upload images.");
    } finally {
      setIsUploading(false);
    }
  }

  // --------------------------------------------------------------------
  // handleDeleteImage: deletes ONE specific photo from this item.
  // --------------------------------------------------------------------
  async function handleDeleteImage(imageId) {
    try {
      await deleteMeetingItemImage(rowKey, meetingId, item.id, imageId);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to delete image.");
    }
  }

  return (
    // One table row per item, with 4 cells: name, description, quantity,
    // images.
    <tr className="border-b border-slate-100 align-top transition-colors duration-150 hover:bg-slate-50/50 last:border-b-0">
      {/* Cell 1: item name + its own delete button */}
      <td className="border-r border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-black text-slate-900 leading-tight">
            {displayLabel}
          </span>
          <button
            onClick={handleDeleteItem}
            disabled={isDeleting}
            title="Delete this item"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-all duration-150 hover:bg-red-500 hover:text-white disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        </div>
      </td>

      {/* Cell 2: free-text description box. Typing just updates local
          state now; nothing is saved until the card-level "Save" button
          up in MeetingCard is clicked (which calls this row's save()
          handle via useImperativeHandle). */}
      <td className="border-r border-slate-100 px-3 py-2">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this item..."
          className="w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-xs leading-5 text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
      </td>

      {/* Cell 3: quantity number box, same "just local state, no auto-save"
          pattern, plus a small inline spinner/error message underneath. */}
      <td className="border-r border-slate-100 px-3 py-2">
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
        {isSaving && (
          <Loader2 size={11} className="mt-1 animate-spin text-slate-300" />
        )}
        {error && <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>}
      </td>

      {/* Cell 4: Upload button + hidden real file input + thumbnail grid +
          full-screen viewer. */}
      <td className="px-3 py-2.5">
        {/* Clicking this visible styled button programmatically "clicks"
            the REAL (but invisible) file input below it via the ref \u2014
            `fileInputRef.current?.click()` is like calling a function
            through a pointer, but first checking the pointer isn't NULL
            (the `?.` is JS's null-safe member-access operator, similar to
            checking `if (ptr) ptr->click();` in C++). We do this because
            native file inputs are ugly/hard to style directly, so we hide
            the real one and trigger it from a pretty custom button instead. */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <ImagePlus size={11} />
          )}
          Upload
        </button>
        {/* The REAL file input, kept in the DOM but visually hidden
            (`className="hidden"`). `ref={fileInputRef}` is how React hands
            us the raw DOM element/handle to store in fileInputRef.current. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />

        {/* Ternary: show a placeholder message if there are no photos yet,
            otherwise render the thumbnail grid — note this maps over
            orderedImages (the drag-and-drop priority order), NOT the raw
            item.images array straight from the server. */}
        {orderedImages.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-300">
            No images yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {/* Loop over every photo for this item, in priority order, and
                render one square, DRAGGABLE thumbnail per photo.
                `imageIndex` (the loop counter) doubles as "which photo to
                open the viewer on" AND "this photo's current priority
                slot" for the drag handlers below. */}
            {orderedImages.map((image, imageIndex) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleImageDragStart(imageIndex)}
                onDragOver={handleImageDragOver}
                onDrop={() => handleImageDrop(imageIndex)}
                onDragEnd={() => setDragIndex(null)}
                title="Drag to reorder priority — left-most is 1st priority"
                className={`group relative aspect-square w-full max-w-18 cursor-grab overflow-hidden rounded-xl border bg-slate-100 transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:scale-105 active:cursor-grabbing ${
                  dragIndex === imageIndex
                    ? "opacity-40 border-slate-400"
                    : "border-slate-200"
                }`}
                onClick={() => setViewerIndex(imageIndex)}
              >
                {/* Small numbered badge showing this photo's current
                    priority position (1 = highest priority / left-most). */}
                <span className="absolute left-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-md bg-black/60 text-[9px] font-black text-white">
                  {imageIndex + 1}
                </span>
                <img
                  src={resolveImageUrl(image.url)}
                  alt={image.originalFileName || "Item image"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {/* Hover-only dark overlay + zoom icon, purely a visual hint
                    that the thumbnail is clickable. */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
                  <ZoomIn
                    size={14}
                    className="text-white opacity-0 transition-all duration-200 group-hover:opacity-100"
                  />
                </div>
                {/* Small delete (X) button in the corner of each thumbnail.
                    stopPropagation prevents this click from ALSO triggering
                    the parent div's onClick (which would open the viewer
                    instead of deleting). */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImage(image.id);
                  }}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-lg bg-black/70 text-white opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Only mounted while viewerIndex is a real number (not null) \u2014
            i.e. only while the full-screen viewer should be open. Passing
            `orderedImages` (instead of the raw `item.images`) lets the
            user arrow through this item's photos in the SAME left-to-right
            priority order they dragged them into. */}
        {viewerIndex !== null && (
          <ImageLightbox
            images={orderedImages}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        )}
      </td>
    </tr>
  );
});

// ============================================================================
// FinalizeItemRow \u2014 used ONLY inside the FinalizeReview modal below. Shows
// one item's name + an editable description/quantity + its own photos, all
// together in one card, so the employee can review/adjust the last
// meeting's items without leaving the "Confirm & Finalize" popup.
//
// Props:
//   rowKey     -> which client (from the URL)
//   meetingId  -> which meeting this item belongs to
//   item       -> the item object (id, itemKey, customLabel, description,
//                 quantity, images[])
//   employeeId -> currently logged-in employee (for audit tracking)
//   onSaved    -> callback to tell the parent page to re-fetch fresh data
//   onViewImage -> callback (images, index) to open the full-screen viewer
// ============================================================================
function FinalizeItemRow({
  rowKey,
  meetingId,
  item,
  employeeId,
  onSaved,
  onViewImage,
}) {
  // Same local-editable-copy pattern as MeetingItemRow, just simplified
  // (no image upload/delete/drag here — this is a review/edit surface,
  // not the main editing surface).
  const [description, setDescription] = useState(item.description || "");
  const [quantity, setQuantity] = useState(item.quantity ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const option = CLIENT_REQUIREMENT_OPTIONS.find(
    (c) => c.key === item.itemKey
  );
  const displayLabel =
    item.itemKey === "other" ? item.customLabel || "Other" : option?.label || item.itemKey;

  const isDirty =
    description !== (item.description || "") ||
    Number(quantity) !== (item.quantity ?? 1);

  // --------------------------------------------------------------------
  // handleSave: here it DOES auto-save onBlur (unlike the main
  // MeetingItemRow) — this modal is a focused, one-off review surface, so
  // there's no separate card-level Save button to wire up to.
  // --------------------------------------------------------------------
  async function handleSave() {
    if (!isDirty) return;
    setIsSaving(true);
    setError("");
    try {
      await updateMeetingItem(rowKey, meetingId, item.id, {
        description,
        quantity,
        employeeId,
      });
      await onSaved();
    } catch (err) {
      setError(err.message || "Failed to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{displayLabel}</p>
        {isSaving && <Loader2 size={13} className="animate-spin text-slate-300" />}
      </div>

      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={handleSave}
        placeholder="Describe this item..."
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white"
      />

      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Qty
        </label>
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={handleSave}
          className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white"
        />
      </div>

      {error && <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>}

      {/* This item's own photos, shown together with its description/
          quantity so the employee sees everything about this item at
          once, instead of hunting for its photos in a separate flat
          per-meeting gallery. */}
      {item.images.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {item.images.map((image, imageIndex) => (
            <div
              key={image.id}
              className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition-all duration-200 hover:border-slate-300 hover:scale-105"
              onClick={() => onViewImage(item.images, imageIndex)}
            >
              <img
                src={resolveImageUrl(image.url)}
                alt={image.originalFileName || "Item image"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FinalizeReview \u2014 a full-screen modal/popup where the employee reviews ALL
// photos across ALL meetings for this client, picks which ones are the
// "final selected" photos, and confirms the client as finalized.
//
// Props:
//   rowKey       -> which client (from the URL)
//   employeeId   -> currently logged-in employee
//   meetings     -> full array of this client's meetings (each with images[])
//   finalization -> existing finalization record, if this client was already
//                   finalized before (or null/undefined if never finalized)
//   onClose      -> callback to close this modal without necessarily saving
//   onFinalized  -> callback to tell the parent page to re-fetch fresh data
// ============================================================================
function FinalizeReview({
  rowKey,
  employeeId,
  meetings,
  finalization,
  onClose,
  onFinalized,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  // Tracks WHICH image is currently mid-toggle (its id), so we can show a
  // tiny spinner on just that one button instead of a whole page-wide
  // loading state. `null` = nothing currently toggling.
  const [togglingId, setTogglingId] = useState(null);
  // Holds { images, index } describing what the full-screen viewer should
  // show, or `null` when the viewer is closed. Grouped into one object
  // (instead of two separate state variables) because these two values
  // always change together \u2014 similar to bundling related fields into one
  // small struct instead of passing them around separately.
  const [viewer, setViewer] = useState(null);

  // Grab the most recently added meeting (last element of the array) \u2014
  // `meetings[meetings.length - 1]` is the standard "last element" pattern,
  // identical to `arr[n-1]` in C.
  const lastMeeting = meetings[meetings.length - 1];

  // --------------------------------------------------------------------
  // handleToggleFinal: flips one single photo between "selected as final"
  // and "not selected", when its checkmark button is clicked.
  // --------------------------------------------------------------------
  async function handleToggleFinal(imageId) {
    setTogglingId(imageId);
    setError("");
    try {
      await toggleImageFinalSelection(rowKey, imageId);
      // `await` here (not just calling onFinalized()) means we wait for the
      // PARENT's re-fetch to fully finish before moving on \u2014 keeps the
      // finally block below from clearing the spinner too early.
      await onFinalized();
    } catch (err) {
      setError(err.message || "Failed to update image selection.");
    } finally {
      setTogglingId(null);
    }
  }

  // --------------------------------------------------------------------
  // handleConfirm: runs when "Confirm & Finalize" is clicked \u2014 marks the
  // whole client as finalized. The modal deliberately STAYS OPEN
  // afterwards (no onClose() call) so the employee can keep tweaking
  // items/photos and click "Confirm & Finalize" again as many times as
  // needed, instead of having to reopen the popup each time.
  // --------------------------------------------------------------------
  async function handleConfirm() {
    setIsSaving(true);
    setError("");
    try {
      await finalizeClient(rowKey, employeeId);
      await onFinalized();
    } catch (err) {
      setError(err.message || "Failed to finalize client.");
    } finally {
      setIsSaving(false);
    }
  }

  // Count how many photos (across ALL meetings) are currently marked as
  // "final selected". `.reduce(...)` walks the array and keeps a running
  // accumulator (`acc`), exactly like writing:
  //   int total = 0;
  //   for (m in meetings) total += count_selected(m.images);
  // in C, just expressed as a single built-in function instead of a
  // hand-written loop.
  const totalSelected = meetings.reduce(
    (acc, m) => acc + m.images.filter((img) => img.isFinalSelected).length,
    0
  );

  return (
    // Full-screen modal overlay (dark backdrop + centered white panel).
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8"
      style={{ animation: "fadeIn 0.2s ease" }}
    >
      {/* Clicking the dark backdrop itself closes the modal. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/30"
        style={{ animation: "slideUp 0.3s ease" }}
      >
        {/* Header: title + "N selected" badge + close (X) button */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Review
              </p>
              <p className="text-base font-black text-slate-900">
                Finalize Client Selections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge only shown once at least 1 photo has been selected. */}
            {totalSelected > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-xs font-black text-emerald-700">
                  {totalSelected} selected
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body: finalization banner + per-meeting photo grids +
            final items (editable) + error banner. */}
        <div className="max-h-[72vh] overflow-y-auto px-7 py-6">
          {/* Only shown if this client was ALREADY finalized before \u2014 lets
              the employee know they can still change things and re-confirm. */}
          {finalization && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <BadgeCheck size={18} className="shrink-0 text-emerald-500" />
              <p className="text-xs font-semibold text-emerald-700">
                Finalized by{" "}
                <span className="font-black">
                  {finalization.finalizedByName || "an employee"}
                </span>
                {finalization.finalizedAt
                  ? ` on ${formatDisplayDatetime(finalization.finalizedAt)}`
                  : ""}
                &nbsp;— you can still make changes and confirm again.
              </p>
            </div>
          )}

          {/* Ternary: empty-state message if there are no meetings at all,
              otherwise loop through every meeting and render its photo grid. */}
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar size={36} className="mb-4 text-slate-200" />
              <p className="font-black text-slate-400">No meetings to review</p>
            </div>
          ) : (
            <div className="space-y-8">
              {meetings.map((meeting, index) => (
                <div key={meeting.id}>
                  {/* Small numbered badge (1, 2, 3...) + this meeting's
                      date/time, using the loop index + 1 since arrays are
                      0-based but we want to display a human-friendly
                      1-based count (same "off-by-one" adjustment you'd do
                      converting a C array index to a display number). */}
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Meeting {index + 1}
                      </p>
                      <p className="text-xs font-bold text-slate-600">
                        {formatDisplayDatetime(meeting.meetingDatetime)}
                      </p>
                    </div>
                  </div>

                  {/* Ternary again: no-photos message vs. the actual photo
                      grid for this specific meeting. */}
                  {meeting.images.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-6 text-center">
                      <p className="text-xs font-semibold text-slate-300">
                        No images from this meeting
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                      {/* Loop over every photo in THIS meeting and render one
                          thumbnail tile per photo. */}
                      {meeting.images.map((image, imageIndex) => (
                        <div
                          key={image.id}
                          onClick={() =>
                            setViewer({ images: meeting.images, index: imageIndex })
                          }
                          className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                            image.isFinalSelected
                              ? "border-emerald-400 shadow-md shadow-emerald-100"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <img
                            src={resolveImageUrl(image.url)}
                            alt={image.originalFileName || "Meeting image"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {/* Faint green tint overlay only on already-selected
                              photos, as a visual "this one is picked" cue. */}
                          {image.isFinalSelected && (
                            <div className="absolute inset-0 bg-emerald-500/10" />
                          )}
                          {/* The actual toggle-select button in the corner
                              of each thumbnail. stopPropagation stops this
                              click from ALSO opening the full-screen viewer
                              (which is what the parent div's onClick does). */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFinal(image.id);
                            }}
                            disabled={togglingId === image.id}
                            className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-60 ${
                              image.isFinalSelected
                                ? "bg-emerald-500 text-white shadow-md"
                                : "bg-black/50 text-white opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                            }`}
                          >
                            {togglingId === image.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* "Final Items" section — automatically shows the LAST meeting's
              items (name, description, quantity, and their own photos)
              together as the default "confirmed" set, per the requirement
              that the final meeting's items/images show up here
              automatically. Each one is still directly editable right in
              this popup (auto-saves onBlur, same as the main items
              table), and the employee can click "Confirm & Finalize"
              again afterwards since this modal no longer auto-closes. */}
          {lastMeeting && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <ClipboardList size={15} className="text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Final Items — Meeting {meetings.length}
                </p>
              </div>
              <div className="space-y-3 p-5">
                {lastMeeting.items?.length ? (
                  lastMeeting.items.map((item) => (
                    <FinalizeItemRow
                      key={item.id}
                      rowKey={rowKey}
                      meetingId={lastMeeting.id}
                      item={item}
                      employeeId={employeeId}
                      onSaved={onFinalized}
                      onViewImage={(images, index) =>
                        setViewer({ images, index })
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs font-semibold text-slate-300">
                    No items recorded yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error banner for this whole modal (e.g. finalize/toggle failures). */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer: Cancel (just closes) vs. Confirm & Finalize (saves) */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-7 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <BadgeCheck size={15} />
            )}
            Confirm & Finalize
          </button>
        </div>
      </div>

      {/* Only mounted while `viewer` holds a real { images, index } object
          (i.e. a thumbnail was clicked) \u2014 same pattern as the item-row
          lightbox above. */}
      {viewer && (
        <ImageLightbox
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// ClientMeetingsPage \u2014 the DEFAULT EXPORT of this file: the top-level page
// component that React Router renders when the browser visits
// "/management/meetings/:rowKey". `export default` is how this file exposes
// this ONE public symbol for other files to import, similar to how a C
// translation unit exposes a function via a header (.h) file for other .c
// files to #include and call.
// ============================================================================
export default function ClientMeetingsPage() {
  // useParams() reads the dynamic part of the URL (the ":rowKey" segment)
  // \u2014 e.g. visiting "/management/meetings/abc123" gives rowKey = "abc123".
  // Destructuring `{ rowKey }` pulls just that one field out of the bigger
  // params object, same idea as unpacking one field out of a returned
  // struct in C.
  const { rowKey } = useParams();
  // useNavigate() gives us a function we can call to programmatically send
  // the browser to a different page/URL (used below to redirect to /login).
  const navigate = useNavigate();
  // useState(() => loadCurrentEmployee()): passing a FUNCTION (instead of a
  // plain value) as the initial state is React's "lazy initializer" \u2014 the
  // function only runs ONCE, on the very first render, instead of being
  // re-computed on every re-render. Useful here because
  // loadCurrentEmployee() reads from browser storage, which we don't want
  // to repeat unnecessarily.
  const [employee] = useState(() => loadCurrentEmployee());
  // Name of the client this page is showing meetings for (fetched from the
  // server, starts blank).
  const [clientName, setClientName] = useState("");
  // The full list of meetings for this client (each with its own items[]
  // array) \u2014 starts as an empty array before the first fetch completes.
  const [meetings, setMeetings] = useState([]);
  // Finalization record (who/when this client was finalized), or null if
  // never finalized.
  const [finalization, setFinalization] = useState(null);
  // True while the initial page data is being fetched \u2014 controls whether
  // we show a loading spinner instead of the real content.
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  // Whether the FinalizeReview modal is currently open.
  const [showFinalize, setShowFinalize] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------------------------
  // refresh: (re-)fetches this client's full meetings data from the
  // backend and updates all the state above. Wrapped in useCallback so
  // React keeps the SAME function reference across re-renders as long as
  // `rowKey` hasn't changed \u2014 similar to caching a function pointer so its
  // address stays stable, which matters here because `refresh` is also
  // listed as a dependency of the useEffect below (and is passed down as
  // the onChanged/onDeleted/onFinalized prop to child components) \u2014
  // without useCallback, a brand-new function would be created on every
  // render, which would make the effect below re-run constantly.
  // --------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await loadClientMeetings(rowKey);
      setClientName(data.clientName || "");
      setMeetings(data.meetings || []);
      setFinalization(data.finalization || null);
    } catch (err) {
      setError(err.message || "Failed to load meetings.");
    } finally {
      setIsLoading(false);
    }
  }, [rowKey]);

  // useEffect here runs once when the component first mounts (and again
  // any time employee/navigate/refresh change, though in practice that's
  // effectively "just once" for this page). Two jobs:
  //   1. Security/redirect guard: if nobody is logged in, immediately send
  //      the browser to the login page instead of showing this page's data.
  //   2. Otherwise, kick off the initial data fetch.
  useEffect(() => {
    if (!employee) {
      // `{ replace: true }` swaps the current browser-history entry
      // instead of adding a new one, so clicking "Back" from /login won't
      // bounce the user right back to this page again.
      navigate("/login", { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [employee, navigate, refresh]);

  // --------------------------------------------------------------------
  // handleCreateMeeting: creates a brand-new (mostly empty) meeting for
  // this client when "Add New Meeting" is clicked.
  // --------------------------------------------------------------------
  async function handleCreateMeeting() {
    setIsCreating(true);
    setError("");
    try {
      await createMeeting(rowKey, {
        meetingDatetime: null,
        employeeId: employee?.id,
      });
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create meeting.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    // Full-page background wrapper.
    <div className="min-h-screen bg-[#f8f9fb] text-black">
      {/* Shared CSS animation keyframes used across this page's elements. */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      {/* Sticky top header bar: logo/title + "Back to sheet" link. */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/40 backdrop-blur-xl">
        <div className="flex min-h-17 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-black text-white shadow-lg shadow-slate-900/20">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-900 sm:text-lg">
                Make My Event
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Client Meeting Manager
              </p>
            </div>
          </div>

          {/* <Link> is react-router's version of an <a> tag \u2014 it changes
              the URL and swaps the page WITHOUT a full browser reload
              (unlike a normal HTML link). */}
          <Link
            to="/management"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to sheet
          </Link>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-none">
          {/* Page Hero card: client name, description, finalized banner,
              stats counters, and the two main action buttons. */}
          <div
            className="mb-8 overflow-hidden rounded-3xl bg-white p-7 shadow-sm shadow-slate-200/60 border border-slate-200/80"
            style={{ animation: "scaleIn 0.3s ease" }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarClock size={14} className="text-slate-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Client Meetings
                  </p>
                </div>
                {/* `|| "This client"` fallback text while clientName hasn't
                    loaded from the server yet. */}
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">
                  {clientName || "This client"}
                </h1>
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                  Schedule meetings, track client requirements, and upload the
                  images the client chose during each session.
                </p>

                {/* Only rendered if this client has been finalized before. */}
                {finalization && (
                  <div
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5"
                    style={{ animation: "slideUp 0.2s ease" }}
                  >
                    <BadgeCheck size={15} className="shrink-0 text-emerald-500" />
                    <p className="text-xs font-bold text-emerald-700">
                      Finalized by{" "}
                      <span className="font-black">
                        {finalization.finalizedByName || "an employee"}
                      </span>
                      {finalization.finalizedAt
                        ? ` · ${formatDisplayDatetime(finalization.finalizedAt)}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats: total meeting count + completed count. The second
                  counter uses `.filter(...).length` to count only the
                  meetings where isCompleted is true \u2014 same idea as a
                  counting loop in C: `for each meeting, if completed,
                  count++`. */}
              <div className="flex shrink-0 gap-3">
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 py-4 text-center border border-slate-100">
                  <span className="text-3xl font-black text-slate-900">
                    {meetings.length}
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Meetings
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 px-5 py-4 text-center border border-emerald-100">
                  <span className="text-3xl font-black text-emerald-600">
                    {meetings.filter((m) => m.isCompleted).length}
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Done
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons row: open the finalize modal / create a new
                meeting. The finalize button is disabled while there are
                zero meetings (nothing to review yet). */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              <button
                onClick={() => setShowFinalize(true)}
                disabled={meetings.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} className="text-amber-500" />
                {finalization ? "Review & Re-confirm" : "Complete & Finalize"}
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-slate-900/20 transition-all duration-200 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add New Meeting
              </button>
            </div>
          </div>

          {/* Page-level error banner (e.g. initial load or create-meeting
              failures). */}
          {error && (
            <div
              className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
              style={{ animation: "slideUp 0.2s ease" }}
            >
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Content: a 3-way branch (like an if/else-if/else chain) \u2014
              show a spinner while loading, an empty-state message if there
              truly are zero meetings, or the real list of meeting cards. */}
          {isLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl bg-white border border-slate-200">
              <Loader2
                size={28}
                className="animate-spin text-slate-300"
              />
              <p className="text-sm font-semibold text-slate-300">
                Loading meetings...
              </p>
            </div>
          ) : meetings.length === 0 ? (
            // Second branch: not loading anymore, but the array really is
            // empty \u2014 show a dashed-border empty state with a call to action.
            <div
              className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center"
              style={{ animation: "scaleIn 0.3s ease" }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50">
                <CalendarClock size={28} className="text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-400">
                  No meetings yet
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-slate-300">
                  Click "Add New Meeting" to schedule the first meeting with
                  this client.
                </p>
              </div>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Add New Meeting
              </button>
            </div>
          ) : (
            // Third branch: the real, non-empty list \u2014 loop over
            // `meetings` and render one <MeetingCard> per meeting, each
            // wrapped in its own <div> just to attach a slightly staggered
            // slide-up animation (`index * 0.06s` delay) so cards visually
            // cascade in one after another instead of all popping in at
            // once.
            <div className="space-y-5">
              {meetings.map((meeting, index) => (
                <div
                  key={meeting.id}
                  style={{ animation: `slideUp 0.3s ease ${index * 0.06}s both` }}
                >
                  <MeetingCard
                    meeting={meeting}
                    rowKey={rowKey}
                    employeeId={employee?.id}
                    onChanged={refresh}
                    onDeleted={refresh}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* The finalize-review modal is only mounted at all while
          showFinalize is true. Passing `refresh` as onFinalized means
          "after finalizing/toggling a selection, re-fetch the page's data
          so everything stays in sync". */}
      {showFinalize && (
        <FinalizeReview
          rowKey={rowKey}
          employeeId={employee?.id}
          meetings={meetings}
          finalization={finalization}
          onClose={() => setShowFinalize(false)}
          onFinalized={refresh}
        />
      )}
    </div>
  );
}