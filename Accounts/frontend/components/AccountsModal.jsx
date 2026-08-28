import { useEffect } from "react";
import { X } from "lucide-react";

// Focused overlay for the Money In / New Cost flows. Locks body scroll and
// closes on Escape so a half-filled form is never stranded behind the page.
export default function AccountsModal({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  maxWidthClass = "max-w-3xl",
}) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-5">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        role="presentation"
        onClick={onClose}
        style={{ animation: "mm-fade .3s ease-out both" }}
      />

      <div
        className={`relative flex max-h-[93vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_50px_120px_-24px_rgba(0,0,0,.7)] ring-1 ring-black/10 sm:rounded-[30px]`}
        style={{ animation: "mm-modal .45s cubic-bezier(.22,1,.36,1) both" }}
      >
        <div className="relative flex items-center justify-between gap-4 overflow-hidden bg-[#0B0B0F] px-5 py-4 text-white sm:px-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="mm-drift absolute -left-16 -top-20 h-52 w-52 rounded-full bg-violet-600/60 blur-[60px]" />
            <div
              className="mm-drift absolute -right-10 -bottom-24 h-52 w-52 rounded-full bg-cyan-500/40 blur-[70px]"
              style={{ animationDelay: "-7s" }}
            />
            <div className="mm-dots absolute inset-0 opacity-30" />
          </div>

          <div className="relative flex min-w-0 items-center gap-3">
            {Icon ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon size={19} />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight">{title}</p>
              {subtitle ? <p className="truncate text-xs text-white/45">{subtitle}</p> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-all duration-400 hover:rotate-90 hover:bg-white hover:text-black"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mm-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
