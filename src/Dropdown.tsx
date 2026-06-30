import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
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
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
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
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-[100] max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((opt) => {
            const sel = opt === value;
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition " +
                  (sel
                    ? "bg-orange-500 font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                }
              >
                <svg
                  className={"h-3.5 w-3.5 shrink-0 " + (sel ? "opacity-100" : "opacity-0")}
                  viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M2.5 7.5 6 11l5.5-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
