import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MON = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// dates: contiguous sorted YYYY-MM-DD strings. idx-based range.
export function DateRangePicker({
  dates,
  startIdx,
  endIdx,
  setStartIdx,
  setEndIdx,
}: {
  dates: string[];
  startIdx: number;
  endIdx: number;
  setStartIdx: (i: number) => void;
  setEndIdx: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  // pending start while picking the second endpoint (null = idle)
  const [pending, setPending] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // month shown in the calendar, as a Date on day 1
  const [view, setView] = useState(() => new Date(dates[startIdx] + "T00:00:00"));
  // popover position (fixed, portal-rendered to escape backdrop-blur stacking context)
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const lastIdx = dates.length - 1;

  // idx -> Date, and a map date-string -> idx for O(1) lookup
  const idxOf = useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  const minD = new Date(dates[0] + "T00:00:00");
  const maxD = new Date(dates[lastIdx] + "T00:00:00");

  // close on outside click / Esc; reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const reposition = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, left: r.left });
    };
    reposition();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setPending(null);
    setHover(null);
  }

  function openCal() {
    setView(new Date(dates[startIdx] + "T00:00:00"));
    setOpen(true);
  }

  function pick(idx: number) {
    if (pending === null) {
      setPending(idx);
      setHover(idx);
    } else {
      const a = Math.min(pending, idx);
      const b = Math.max(pending, idx);
      setStartIdx(a);
      setEndIdx(b);
      close();
    }
  }

  function applyPreset(start: number) {
    setStartIdx(start);
    setEndIdx(lastIdx);
    close();
  }

  // selection bounds for highlighting (live preview while picking)
  const [selA, selB] =
    pending === null
      ? [startIdx, endIdx]
      : [Math.min(pending, hover ?? pending), Math.max(pending, hover ?? pending)];

  // build the visible month grid
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const canPrev = new Date(year, month, 1) > minD;
  const canNext = new Date(year, month + 1, 1) <= maxD;

  const presets = [
    { label: "7d", start: Math.max(0, lastIdx - 6) },
    { label: "30d", start: Math.max(0, lastIdx - 29) },
    { label: "All", start: 0 },
  ];

  const triggerCls =
    "flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm " +
    "text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-orange-300/40 " +
    "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  return (
    <div className="relative">
      <button ref={triggerRef} className={triggerCls} onClick={() => (open ? close() : openCal())}>
        <span className="text-slate-400"></span>
        <span className="font-medium">{dates[startIdx]}</span>
        <span className="text-slate-400">→</span>
        <span className="font-medium">{dates[endIdx]}</span>
        <span className="ml-1 text-[10px] text-slate-400">▾</span>
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[100] w-[20rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {/* presets */}
          <div className="mb-2 flex gap-1.5">
            {presets.map((p) => {
              const active = startIdx === p.start && endIdx === lastIdx && pending === null;
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.start)}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition " +
                    (active
                      ? "bg-[#e0743f] text-white dark:bg-[#e0743f]"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                  }
                >
                  {p.label}
                </button>
              );
            })}
            <span className="ml-auto self-center text-[11px] font-medium text-slate-400">
              {pending === null ? "เลือกวันเริ่ม" : "เลือกวันสิ้นสุด"}
            </span>
          </div>

          {/* month nav */}
          <div className="mb-2 flex items-center justify-between">
            <button
              disabled={!canPrev}
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {MON[month]} {year}
            </span>
            <button
              disabled={!canNext}
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ›
            </button>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase text-slate-400">
            {WD.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* day grid */}
          <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-sm">
            {cells.map((d, i) => {
              if (d === null) return <div key={"e" + i} />;
              const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const idx = idxOf.get(ds);
              const disabled = idx === undefined;
              const inRange = !disabled && idx! >= selA && idx! <= selB;
              const isStart = idx === selA;
              const isEnd = idx === selB;
              const edge = isStart || isEnd;

              return (
                <div
                  key={ds}
                  className={
                    "py-0.5 " +
                    (inRange && !edge ? "bg-orange-100 dark:bg-[#e0743f]/20 " : "") +
                    (inRange && isStart ? "rounded-l-full bg-orange-100 dark:bg-[#e0743f]/20 " : "") +
                    (inRange && isEnd ? "rounded-r-full bg-orange-100 dark:bg-[#e0743f]/20 " : "")
                  }
                >
                  <button
                    disabled={disabled}
                    onClick={() => !disabled && pick(idx!)}
                    onMouseEnter={() => !disabled && pending !== null && setHover(idx!)}
                    className={
                      "mx-auto flex h-8 w-8 items-center justify-center rounded-full transition " +
                      (disabled
                        ? "cursor-default text-slate-300 dark:text-slate-700"
                        : edge
                          ? "bg-[#e0743f] font-semibold text-white dark:bg-[#e0743f]"
                          : inRange
                            ? "text-orange-700 dark:text-orange-300"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                    }
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
