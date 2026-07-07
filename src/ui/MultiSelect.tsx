import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Checkbox multi-select — same portal/positioning as Dropdown, but rows toggle and the
// panel stays open. Used to let the viewer pick exactly which series a chart shows.
export function MultiSelect({
  options,
  selected,
  onToggle,
  minWidth = 180,
  ariaLabel,
  label = "Show",
  triggerText,
  maxSelected,
  format = (v) => v,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  minWidth?: number;
  ariaLabel?: string;
  label?: string;
  triggerText: string;
  maxSelected?: number;
  format?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: minWidth });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setRender(true); return; }
    if (!render) return;
    setEntered(false);
    const t = setTimeout(() => setRender(false), 160);
    return () => clearTimeout(t);
  }, [open, render]);

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
    const raf = requestAnimationFrame(() => setEntered(true));
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

  const atCap = maxSelected !== undefined && selected.size >= maxSelected;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      >
        <span className="truncate">{triggerText}</span>
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
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {selected.size}{maxSelected !== undefined ? `/${maxSelected}` : ` of ${options.length}`}
            </span>
          </div>

          <div className="flex max-h-72 flex-col gap-0.5 overflow-auto">
            {options.map((opt) => {
              const sel = selected.has(opt);
              const disabled = !sel && atCap; // can't add past the cap
              return (
                <button
                  key={opt}
                  onClick={() => { if (!disabled) onToggle(opt); }}
                  disabled={disabled}
                  className={
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition " +
                    (sel
                      ? "bg-orange-50 font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                      : disabled
                        ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border " +
                      (sel
                        ? "border-orange-500 bg-orange-500 text-white dark:border-orange-400 dark:bg-orange-500"
                        : "border-slate-300 dark:border-slate-600")
                    }
                  >
                    {sel && (
                      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
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
