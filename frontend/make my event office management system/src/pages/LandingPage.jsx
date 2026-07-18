import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Columns3,
  FileSpreadsheet,
  LayoutGrid,
  Menu,
  Sparkles,
  Upload,
  UsersRound,
  X,
} from "lucide-react";

const features = [
  {
    icon: LayoutGrid,
    title: "Easy Excel-Like Workspace",
    description:
      "Employees enter client, call, meeting and follow-up information directly in simple editable cells without formulas.",
  },
  {
    icon: Columns3,
    title: "Flexible Rows and Columns",
    description:
      "Create new rows for records and add custom columns whenever your office needs to capture extra information.",
  },
  {
    icon: FileSpreadsheet,
    title: "Full Excel Import",
    description:
      "Upload an existing .xlsx or CSV file. The system detects headings and adds the imported rows to the workspace.",
  },
  {
    icon: UsersRound,
    title: "Simple Employee Identity",
    description:
      "No login is required in the current phase. Employees only provide their name and email before working.",
  },
  {
    icon: CalendarDays,
    title: "Calendar Ready",
    description:
      "Meeting dates, follow-ups and deadlines will be connected with a shared calendar in the next development phase.",
  },
  {
    icon: Upload,
    title: "Centralized Office Information",
    description:
      "The final backend will store the same management information for every employee in one shared database.",
  },
];

const previewItems = [
  { time: "10:00 AM", title: "Client follow-up", company: "ABC Corporation" },
  { time: "12:30 PM", title: "Wedding planning meeting", company: "Nusrat & Family" },
  { time: "03:00 PM", title: "Proposal deadline", company: "Rahman Group" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-purple text-lg font-black text-white shadow-lg shadow-mme-purple/20">
        M
      </div>
      <div>
        <p className="text-lg font-extrabold leading-none text-mme-purple">Make My Event</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-mme-plum">Office Management</p>
      </div>
    </Link>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const links = [
    ["Home", "#home"],
    ["Features", "#features"],
    ["How it works", "#workflow"],
    ["About", "#about"],
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-mme-pink/40 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Brand />

        <div className="hidden items-center gap-8 lg:flex">
          {links.map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-semibold text-mme-purple/70 transition hover:text-mme-plum">
              {label}
            </a>
          ))}
        </div>

        <Link
          to="/management"
          className="hidden items-center gap-2 rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-mme-purple/20 transition hover:-translate-y-0.5 hover:bg-[#4b2c55] lg:inline-flex"
        >
          Open management <ArrowRight size={17} />
        </Link>

        <button onClick={() => setOpen((current) => !current)} className="rounded-xl border border-mme-pink/70 p-2.5 text-mme-purple lg:hidden" aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-mme-pink/40 bg-white px-5 py-5 shadow-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {links.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-mme-purple hover:bg-mme-blush/40">
                {label}
              </a>
            ))}
            <Link to="/management" className="mt-3 rounded-xl bg-mme-purple px-4 py-3 text-center font-bold text-white">
              Open management
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-mme-blush/70 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-mme-mauve/35 blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_30px_80px_rgba(91,55,101,0.18)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-mme-pink/50 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mme-plum">Meeting management</p>
            <h3 className="mt-1 text-xl font-black text-mme-purple">Shared workspace</h3>
          </div>
          <div className="rounded-2xl bg-mme-blush p-3 text-mme-purple"><LayoutGrid size={23} /></div>
        </div>

        <div className="overflow-hidden p-4 sm:p-5">
          <div className="overflow-hidden rounded-2xl border border-mme-pink/60">
            <div className="grid grid-cols-[42px_1.2fr_1fr_1fr] bg-mme-purple text-[10px] font-black uppercase tracking-wide text-white sm:text-xs">
              <div className="border-r border-white/15 px-2 py-3 text-center">#</div>
              <div className="border-r border-white/15 px-3 py-3">Client</div>
              <div className="border-r border-white/15 px-3 py-3">Next meeting</div>
              <div className="px-3 py-3">Employee</div>
            </div>
            {[
              ["1", "ABC Corporation", "20 Jul, 10 AM", "Rahim"],
              ["2", "Nusrat & Family", "21 Jul, 12:30 PM", "Nabila"],
              ["3", "Rahman Group", "22 Jul, 3 PM", "Karim"],
            ].map((row) => (
              <div key={row[0]} className="grid grid-cols-[42px_1.2fr_1fr_1fr] border-t border-mme-pink/45 text-[10px] text-mme-purple sm:text-xs">
                <div className="bg-[#fff9fc] px-2 py-3 text-center font-black text-mme-purple/45">{row[0]}</div>
                {row.slice(1).map((value) => <div key={value} className="truncate border-l border-mme-pink/45 px-3 py-3 font-semibold">{value}</div>)}
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-mme-blush/45 p-4">
              <FileSpreadsheet className="text-mme-plum" size={21} />
              <p className="mt-3 text-sm font-black text-mme-purple">Import Excel</p>
              <p className="mt-1 text-xs leading-5 text-mme-purple/55">Detect columns and rows automatically.</p>
            </div>
            <div className="rounded-2xl bg-mme-pink/35 p-4">
              <Columns3 className="text-mme-plum" size={21} />
              <p className="mt-3 text-sm font-black text-mme-purple">Add any column</p>
              <p className="mt-1 text-xs leading-5 text-mme-purple/55">Choose text, date, employee, status and more.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-4 bottom-10 hidden items-center gap-3 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3 shadow-xl sm:flex">
        <div className="rounded-full bg-mme-blush p-2 text-mme-purple"><CheckCircle2 size={18} /></div>
        <div><p className="text-xs font-black text-mme-purple">Auto-saved</p><p className="text-[11px] text-mme-purple/55">No formula needed</p></div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fff9fc] text-mme-purple">
      <Navbar />
      <main>
        <section id="home" className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:px-10 lg:pb-28">
          <div className="absolute left-[-130px] top-24 h-80 w-80 rounded-full bg-mme-blush/60 blur-3xl" />
          <div className="absolute right-[-130px] top-40 h-96 w-96 rounded-full bg-mme-mauve/25 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-mme-pink bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.15em] text-mme-plum shadow-sm">
                <Sparkles size={15} /> Management-first development
              </div>
              <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-mme-purple sm:text-5xl lg:text-6xl">
                Manage office information with an <span className="relative inline-block text-mme-plum">easier spreadsheet.<span className="absolute bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-mme-blush" /></span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-mme-purple/70 sm:text-lg">
                Employees enter meeting and client details using familiar rows and cells, add custom columns, and import complete Excel files without formulas or complicated setup.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/management" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-mme-purple px-7 py-4 text-sm font-extrabold text-white shadow-xl shadow-mme-purple/20 transition hover:-translate-y-1 hover:bg-[#4b2c55]">
                  Open management workspace <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                </Link>
                <a href="#features" className="inline-flex items-center justify-center rounded-2xl border border-mme-purple/20 bg-white px-7 py-4 text-sm font-extrabold text-mme-purple transition hover:-translate-y-1 hover:bg-mme-blush/25">
                  Explore features
                </a>
              </div>

              <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
                {["No login for now", "No Excel formulas", "Upload .xlsx or CSV"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-semibold text-mme-purple/75">
                    <CheckCircle2 size={17} className="shrink-0 text-mme-plum" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <WorkspacePreview />
          </div>
        </section>

        <section className="px-5 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[26px] border border-mme-pink/50 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {[["1", "Shared management sheet"], ["Any", "Number of rows"], ["Flexible", "Custom columns"], ["Zero", "Formulas required"]].map(([value, label], index) => (
              <div key={label} className={`p-7 text-center ${index < 3 ? "border-b border-mme-pink/40 lg:border-b-0 lg:border-r" : ""}`}>
                <p className="text-3xl font-black text-mme-purple">{value}</p>
                <p className="mt-1 text-sm font-semibold text-mme-purple/60">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-plum">Current priority</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-mme-purple sm:text-4xl lg:text-5xl">A complete management workspace before authentication</h2>
              <p className="mt-5 leading-8 text-mme-purple/65">The registration code remains in the project, but its route is disabled while the main office workflow is developed.</p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="group rounded-[24px] border border-mme-pink/50 bg-white p-7 transition duration-300 hover:-translate-y-2 hover:border-mme-mauve/70 hover:shadow-[0_22px_60px_rgba(91,55,101,0.13)]">
                    <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-mme-blush/65 text-mme-purple transition group-hover:bg-mme-purple group-hover:text-white"><Icon size={24} /></div>
                    <h3 className="mt-6 text-xl font-black text-mme-purple">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-mme-purple/65">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="relative overflow-hidden bg-mme-purple px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-28">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-mme-mauve/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-pink">How employees work</p>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Identify, enter, and manage.</h2>
              <p className="mt-5 max-w-xl leading-8 text-white/70">Employees provide only a name and email, then work directly inside the shared Excel-like page.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["01", "Provide identity", "Enter employee name and email without a password."],
                ["02", "Add information", "Create rows, columns, meeting notes and assignments."],
                ["03", "Import existing data", "Upload Excel and confirm the detected preview."],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-[22px] border border-white/15 bg-white/10 p-6 backdrop-blur-md">
                  <p className="text-sm font-black text-mme-pink">{number}</p>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
            <div className="rounded-[30px] bg-gradient-to-br from-mme-blush via-mme-pink to-mme-mauve p-5 sm:p-8">
              <div className="rounded-[24px] border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:p-8">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.18em] text-mme-plum">Upcoming schedule</p><h3 className="mt-2 text-xl font-black text-mme-purple">Calendar-ready records</h3></div>
                  <CalendarDays className="text-mme-purple" size={28} />
                </div>
                <div className="mt-7 space-y-3">
                  {previewItems.map((item) => (
                    <div key={item.time} className="flex items-center gap-3 rounded-2xl border border-mme-pink/50 bg-white p-4">
                      <Clock3 size={18} className="text-mme-plum" />
                      <div className="min-w-0 flex-1"><p className="text-xs font-black text-mme-plum">{item.time}</p><p className="truncate font-black text-mme-purple">{item.title}</p><p className="truncate text-xs text-mme-purple/50">{item.company}</p></div>
                      <ChevronRight size={18} className="text-mme-mauve" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-plum">Development sequence</p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-mme-purple sm:text-4xl lg:text-5xl">Build the core workflow first</h2>
              <p className="mt-6 leading-8 text-mme-purple/65">The management page comes first. Database APIs and the calendar will follow. Login and registration can be restored later by adding their routes again.</p>
              <Link to="/management" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-mme-purple px-7 py-4 text-sm font-black text-white shadow-xl shadow-mme-purple/20 hover:bg-[#4b2c55]">
                Start managing data <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mme-pink/45 bg-white px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Brand />
          <p className="text-sm text-mme-purple/55">© {new Date().getFullYear()} Make My Event. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
