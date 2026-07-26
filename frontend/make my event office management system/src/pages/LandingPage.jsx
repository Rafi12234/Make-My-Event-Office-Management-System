import { useState } from "react";
import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import mmeLogo from "../assets/mme_logo.jpg";

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d6d6d6] bg-white">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <img src={mmeLogo} alt="Make My Event" className="h-14 w-14 rounded-full object-cover shadow-sm" />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          <Link
            to="/calendar"
            className="text-sm font-semibold text-[#a9a9a9] transition hover:text-black"
          >
            Calendar
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to="/management"
            className="rounded-lg bg-black px-5 py-2 text-sm font-bold text-white transition hover:bg-[#222]"
          >
            Log In
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-[#d6d6d6] p-2.5 text-black lg:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-[#d6d6d6] bg-white px-5 py-4 shadow-lg lg:hidden">
          <div className="flex flex-col gap-1">
            <Link
              to="/calendar"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-semibold text-black hover:bg-[#f4f4f4]"
            >
              Calendar
            </Link>
            <Link
              to="/management"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-black px-4 py-2.5 text-center text-sm font-bold text-white"
            >
              Log In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-black">
      <Navbar />

      <main>
        {/* Hero */}
        <section
          id="home"
          className="border-b border-[#d6d6d6] px-5 pb-24 pt-36 sm:px-8 sm:pt-44 lg:px-10"
        >
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-5xl font-bold tracking-tight text-black sm:text-6xl lg:text-8xl">
              Make My Event
            </h1>
            <p className="mt-3 text-lg font-semibold italic tracking-widest text-[#a9a9a9] sm:text-xl">
              Enchant Your Dream
            </p>

            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a9a9a9] mt-12">
              Office Management System
            </p>

            <h2 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight text-black sm:text-4xl lg:text-5xl">
              Manage your office work,
              <br className="hidden sm:block" /> simply and together.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#a9a9a9] sm:text-lg">
              Make My Event gives your team a shared workspace to track clients,
              meetings, follow-ups, and schedules — without spreadsheet complexity.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/management"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-8 py-4 text-sm font-bold text-white transition hover:bg-[#222] sm:w-auto"
              >
                Log In
              </Link>
              <Link
                to="/calendar"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[#d6d6d6] bg-white px-8 py-4 text-sm font-bold text-black transition hover:bg-[#f4f4f4] sm:w-auto"
              >
                View Calendar
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
