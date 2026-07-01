import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// first letters of the first two words, e.g. "Arbour Hotel and Residence" -> "AH"
function initials(s: string): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Styled single-select dropdown — replaces the native <select> so we control the look.
// Portal-rendered (fixed) to escape ancestor backdrop-blur / overflow clipping.
export function Dropdown({
  value,
  options,
  onChange,
  minWidth = 180,
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  minWidth?: number;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false); // drives the open transition
  const [pos, setPos] = useState({ top: 0, left: 0, width: minWidth });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, minWidth) });
    };
    place();
    const raf = requestAnimationFrame(() => setEntered(true)); // trigger enter transition
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      setEntered(false);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, minWidth]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      >
        <span className="truncate">{value}</span>
        <svg
          className={"h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform " + (open ? "rotate-180" : "")}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top + 24, left: pos.left, width: Math.max(pos.width, 232) }}
          className={
            "relative z-[100] origin-top-right rounded-tl-[16px] rounded-tr-[46px] rounded-b-[20px] bg-gradient-to-b from-[#c2653c] via-slate-700 to-slate-800 p-2 pt-6 shadow-2xl ring-1 ring-black/5 transition duration-200 ease-out " +
            (entered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0")
          }
        >
          {/* avatar protrudes at the top-right, seated in the stretched curved corner */}
          <div className="absolute -top-4 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#eaa079] to-[#d97742] text-xs font-bold text-white shadow-md ring-2 ring-white/40">
            {initials(value)}
          </div>
          <div className="mb-1.5 px-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-white/60">Hotel</div>
            <div className="truncate pr-12 text-[12.5px] font-bold text-white">{value}</div>
          </div>

          <div className="flex max-h-64 flex-col gap-1 overflow-auto pr-0.5">
            {options.map((opt) => {
              const sel = opt === value;
              return (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={
                    "flex w-full items-center gap-2 rounded-full px-2.5 py-1.5 text-left text-[12.5px] transition " +
                    (sel
                      ? "bg-white font-semibold text-[#c2571f] shadow"
                      : "bg-white/90 text-slate-700 hover:bg-white")
                  }
                >
                  <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full " + (sel ? "bg-[#c2571f]/12 text-[#c2571f]" : "bg-slate-400/15 text-slate-500")}>
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 14V3.5A1.5 1.5 0 0 1 4.5 2h5A1.5 1.5 0 0 1 11 3.5V6h1.5A1.5 1.5 0 0 1 14 7.5V14h-3v-2.5h-2V14H3Zm2-8h1.5V4.5H5V6Zm2.75 0H9.5V4.5H7.75V6ZM5 9.25h1.5V7.75H5v1.5Zm2.75 0H9.5V7.75H7.75v1.5Z" />
                    </svg>
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
