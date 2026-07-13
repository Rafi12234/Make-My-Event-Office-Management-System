import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  LayoutGrid,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const features = [
  {
    icon: LayoutGrid,
    title: "Smart Excel-Like Workspace",
    description:
      "Enter client details, notes, meetings and assignments using a familiar cell-based interface without formulas or Excel complexity.",
  },
  {
    icon: CalendarDays,
    title: "Automatic Office Calendar",
    description:
      "Meetings, follow-ups and deadlines entered in the workspace automatically appear in the shared office calendar.",
  },
  {
    icon: Users,
    title: "Employee Assignment",
    description:
      "Assign yourself or another employee to client meetings, follow-ups and important office tasks.",
  },
  {
    icon: BellRing,
    title: "Reminders and Notifications",
    description:
      "Employees receive reminders for upcoming meetings, changed schedules, overdue work and newly assigned responsibilities.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Employee Access",
    description:
      "Only registered and approved employees can log in and access shared office information.",
  },
  {
    icon: Database,
    title: "Centralized Client Records",
    description:
      "Keep client contact details, communication history and future actions securely organized in one shared system.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Enter information",
    description:
      "Add client details, current discussion notes and the next required action.",
  },
  {
    number: "02",
    title: "Assign responsibility",
    description:
      "Choose the employee responsible for the meeting, call or follow-up.",
  },
  {
    number: "03",
    title: "Follow the calendar",
    description:
      "The system automatically adds upcoming work to the shared calendar.",
  },
];

const calendarItems = [
  {
    time: "10:00 AM",
    title: "Client follow-up call",
    person: "ABC Corporation",
    color: "bg-mme-plum",
  },
  {
    time: "12:30 PM",
    title: "Wedding planning meeting",
    person: "Nusrat & Family",
    color: "bg-mme-mauve",
  },
  {
    time: "03:00 PM",
    title: "Send event proposal",
    person: "Rahman Group",
    color: "bg-mme-purple",
  },
];

function Logo() {
  return (
    <a href="#home" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mme-purple text-lg font-black text-white shadow-lg shadow-mme-purple/20">
        M
      </div>

      <div>
        <p className="text-lg font-extrabold leading-none text-mme-purple">
          Make My Event
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-mme-plum">
          Office Management
        </p>
      </div>
    </a>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    { label: "Workflow", href: "#workflow" },
    { label: "About", href: "#about" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-mme-pink/40 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Logo />

        <div className="hidden items-center gap-8 lg:flex">
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-semibold text-mme-purple/70 transition hover:text-mme-plum"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="/login"
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-mme-purple transition hover:bg-mme-blush/45"
          >
            Log in
          </a>

          <a
            href="/register"
            className="rounded-xl bg-mme-purple px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-mme-purple/20 transition hover:-translate-y-0.5 hover:bg-[#4b2c55]"
          >
            Register
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="rounded-xl border border-mme-pink/70 p-2.5 text-mme-purple lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="border-t border-mme-pink/40 bg-white px-5 py-5 shadow-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-mme-purple transition hover:bg-mme-blush/40"
              >
                {item.label}
              </a>
            ))}

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-mme-pink/40 pt-4">
              <a
                href="/login"
                className="rounded-xl border border-mme-purple/20 px-4 py-3 text-center font-bold text-mme-purple"
              >
                Log in
              </a>

              <a
                href="/register"
                className="rounded-xl bg-mme-purple px-4 py-3 text-center font-bold text-white"
              >
                Register
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-mme-blush/70 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-mme-mauve/35 blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/90 p-4 shadow-[0_30px_80px_rgba(91,55,101,0.18)] backdrop-blur-xl sm:p-5">
        <div className="mb-5 flex items-center justify-between border-b border-mme-pink/40 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-mme-plum">
              Office overview
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-mme-purple">
              Today's schedule
            </h3>
          </div>

          <div className="rounded-2xl bg-mme-blush/55 p-3 text-mme-purple">
            <CalendarDays size={23} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl bg-[#FFF7FB] p-3 sm:p-4">
            <p className="text-xl font-black text-mme-purple sm:text-2xl">08</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-mme-plum sm:text-xs">
              Meetings
            </p>
          </div>

          <div className="rounded-2xl bg-mme-blush/40 p-3 sm:p-4">
            <p className="text-xl font-black text-mme-purple sm:text-2xl">14</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-mme-plum sm:text-xs">
              Tasks
            </p>
          </div>

          <div className="rounded-2xl bg-mme-pink/35 p-3 sm:p-4">
            <p className="text-xl font-black text-mme-purple sm:text-2xl">03</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-mme-plum sm:text-xs">
              Follow-ups
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {calendarItems.map((item) => (
            <div
              key={`${item.time}-${item.title}`}
              className="group flex items-center gap-3 rounded-2xl border border-mme-pink/30 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-mme-mauve/60 hover:shadow-lg"
            >
              <div
                className={`h-11 w-1.5 shrink-0 rounded-full ${item.color}`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-mme-plum">
                  <Clock3 size={13} />
                  {item.time}
                </div>

                <p className="mt-1 truncate text-sm font-extrabold text-mme-purple sm:text-base">
                  {item.title}
                </p>

                <p className="truncate text-xs text-mme-purple/60">
                  {item.person}
                </p>
              </div>

              <ChevronRight
                size={18}
                className="text-mme-mauve transition group-hover:translate-x-1"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-mme-purple p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-mme-blush">
                Completion progress
              </p>
              <p className="mt-1 text-lg font-black">72% completed</p>
            </div>

            <ClipboardCheck size={28} className="text-mme-blush" />
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-[72%] rounded-full bg-mme-blush" />
          </div>
        </div>
      </div>

      <div className="absolute -left-5 bottom-16 hidden items-center gap-3 rounded-2xl border border-mme-pink/50 bg-white px-4 py-3 shadow-xl sm:flex">
        <div className="rounded-full bg-mme-blush p-2 text-mme-purple">
          <BellRing size={18} />
        </div>

        <div>
          <p className="text-xs font-black text-mme-purple">Meeting reminder</p>
          <p className="text-[11px] text-mme-purple/60">Starting in 30 minutes</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF9FC] text-mme-purple">
      <Navbar />

      <main>
        {/* Hero */}
        <section
          id="home"
          className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:px-10 lg:pb-28"
        >
          <div className="absolute left-[-130px] top-24 h-80 w-80 rounded-full bg-mme-blush/60 blur-3xl" />
          <div className="absolute right-[-130px] top-40 h-96 w-96 rounded-full bg-mme-mauve/25 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-mme-pink bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.15em] text-mme-plum shadow-sm">
                <Sparkles size={15} />
                Smarter office collaboration
              </div>

              <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-mme-purple sm:text-5xl lg:text-6xl">
                Organize every client, meeting and task in{" "}
                <span className="relative inline-block text-mme-plum">
                  one place.
                  <span className="absolute bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-mme-blush" />
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-mme-purple/70 sm:text-lg">
                Make My Event Office Management System gives your employees a
                simple Excel-like workspace connected directly with a shared
                calendar, task assignments and automatic reminders.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-mme-purple px-7 py-4 text-sm font-extrabold text-white shadow-xl shadow-mme-purple/20 transition hover:-translate-y-1 hover:bg-[#4b2c55]"
                >
                  Create employee account
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </a>

                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-mme-purple/20 bg-white px-7 py-4 text-sm font-extrabold text-mme-purple transition hover:-translate-y-1 hover:border-mme-plum hover:bg-mme-blush/25"
                >
                  Employee login
                </a>
              </div>

              <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  "No Excel formulas",
                  "Shared office data",
                  "Admin-approved access",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm font-semibold text-mme-purple/75"
                  >
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-mme-plum"
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        {/* Statistics */}
        <section className="px-5 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[26px] border border-mme-pink/50 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["One", "Shared workspace"],
              ["100%", "Centralized records"],
              ["24/7", "Schedule visibility"],
              ["Zero", "Excel formulas needed"],
            ].map(([value, label], index) => (
              <div
                key={label}
                className={`p-7 text-center ${
                  index !== 3 ? "border-b border-mme-pink/40 lg:border-b-0 lg:border-r" : ""
                } ${
                  index === 1 ? "sm:border-b-0 sm:border-r" : ""
                }`}
              >
                <p className="text-3xl font-black text-mme-purple">{value}</p>
                <p className="mt-1 text-sm font-semibold text-mme-purple/60">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="px-5 py-24 sm:px-8 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-plum">
                Core features
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-mme-purple sm:text-4xl lg:text-5xl">
                Everything employees need for organized daily work
              </h2>

              <p className="mt-5 text-base leading-8 text-mme-purple/65">
                Information is entered once and automatically connected with
                meetings, employee assignments, tasks and reminders.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="group rounded-[24px] border border-mme-pink/50 bg-white p-7 transition duration-300 hover:-translate-y-2 hover:border-mme-mauve/70 hover:shadow-[0_22px_60px_rgba(91,55,101,0.13)]"
                  >
                    <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-mme-blush/65 text-mme-purple transition group-hover:bg-mme-purple group-hover:text-white">
                      <Icon size={24} />
                    </div>

                    <h3 className="mt-6 text-xl font-black text-mme-purple">
                      {feature.title}
                    </h3>

                    <p className="mt-3 leading-7 text-mme-purple/65">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section
          id="workflow"
          className="relative overflow-hidden bg-mme-purple px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-mme-mauve/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-mme-pink/15 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-pink">
                  Simple workflow
                </p>

                <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                  Enter once. The system organizes the rest.
                </h2>

                <p className="mt-5 max-w-xl leading-8 text-white/70">
                  Employees do not need to repeatedly search the Excel-like
                  workspace. Upcoming information becomes visible in the
                  calendar automatically.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {workflow.map((step) => (
                  <div
                    key={step.number}
                    className="rounded-[22px] border border-white/15 bg-white/10 p-6 backdrop-blur-md"
                  >
                    <p className="text-sm font-black text-mme-pink">
                      {step.number}
                    </p>
                    <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* About / Security */}
        <section
          id="about"
          className="px-5 py-24 sm:px-8 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="rounded-[30px] bg-gradient-to-br from-mme-blush via-mme-pink to-mme-mauve p-5 sm:p-8">
                <div className="rounded-[24px] border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-mme-purple p-3 text-white">
                      <ShieldCheck size={25} />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-mme-plum">
                        Secure access
                      </p>
                      <h3 className="mt-2 text-xl font-black text-mme-purple">
                        Registration requires administrator approval
                      </h3>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {[
                      "Employee completes the registration form",
                      "Administrator reviews the application",
                      "Approved employee receives system access",
                      "All important actions remain traceable",
                    ].map((item, index) => (
                      <div key={item} className="flex items-center gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mme-blush text-xs font-black text-mme-purple">
                          {index + 1}
                        </div>

                        <p className="font-semibold text-mme-purple/75">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-mme-plum">
                Built for your office
              </p>

              <h2 className="mt-4 text-3xl font-black leading-tight text-mme-purple sm:text-4xl lg:text-5xl">
                Shared information without losing responsibility
              </h2>

              <p className="mt-6 text-base leading-8 text-mme-purple/65">
                Every approved employee can access shared client and schedule
                information. At the same time, assignments clearly identify
                who is responsible for each client, meeting and task.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "One shared source of updated office information",
                  "Individual employee assignments and task ownership",
                  "Communication history for every client",
                  "Upcoming meetings visible directly from the calendar",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      size={20}
                      className="mt-0.5 shrink-0 text-mme-plum"
                    />
                    <p className="font-semibold text-mme-purple/75">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="get-started" className="px-5 pb-24 sm:px-8 lg:px-10">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-gradient-to-r from-mme-plum to-mme-purple px-6 py-14 text-center text-white shadow-[0_25px_80px_rgba(91,55,101,0.25)] sm:px-12 lg:py-20">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-mme-pink/20 blur-2xl" />
            <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-mme-blush/15 blur-2xl" />

            <div className="relative mx-auto max-w-3xl">
              <h2 className="text-3xl font-black sm:text-4xl lg:text-5xl">
                Start organizing your office work today
              </h2>

              <p className="mx-auto mt-5 max-w-2xl leading-8 text-white/75">
                Register as an employee and wait for administrator approval to
                access the Make My Event Office Management System.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-mme-purple transition hover:-translate-y-1 hover:bg-mme-blush"
                >
                  Register now
                  <ArrowRight size={18} />
                </a>

                <a
                  href="/login"
                  className="rounded-2xl border border-white/25 bg-white/10 px-7 py-4 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-white/20"
                >
                  Employee login
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mme-pink/45 bg-white px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Logo />

          <p className="text-sm text-mme-purple/55">
            © {new Date().getFullYear()} Make My Event. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;