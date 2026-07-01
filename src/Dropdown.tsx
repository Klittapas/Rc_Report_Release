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
  label = "Hotel",
  format = (v) => v,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  minWidth?: number;
  ariaLabel?: string;
  label?: string;
  format?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false); // stays true through the fade-out
  const [entered, setEntered] = useState(false); // drives enter/exit transition
  const [pos, setPos] = useState({ top: 0, left: 0, width: minWidth });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // mount on open; on close, fade out first then unmount after the transition
  useEffect(() => {
    if (open) { setRender(true); return; }
    if (!render) return;
    setEntered(false);
    const t = setTimeout(() => setRender(false), 160);
    return () => clearTimeout(t);
  }, [open, render]);

  // once mounted, place it, trigger the enter transition, wire the listeners
  useEffect(() => {
    if (!render) return;
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
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [render, minWidth]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      >
        <span className="truncate">{format(value)}</span>
        <svg
          className={"h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform " + (open ? "rotate-180" : "")}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {render && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 264) }}
          className={
            "z-[100] origin-top overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 transition duration-150 ease-out dark:border-slate-700 dark:bg-slate-900 " +
            (entered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.98] opacity-0")
          }
        >
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {label}
          </div>

          <div className="flex max-h-72 flex-col gap-0.5 overflow-auto">
            {options.map((opt) => {
              const sel = opt === value;
              return (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition " +
                    (sel
                      ? "bg-orange-50 font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                  }
                >
                  <span className="flex w-4 shrink-0 justify-center text-orange-600 dark:text-orange-400">
                    {sel && (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{format(opt)}</span>
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
