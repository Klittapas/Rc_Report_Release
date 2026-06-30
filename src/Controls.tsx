import { DateRangePicker } from "./DateRangePicker.tsx";

export function Controls({
  segments,
  activeSegments,
  toggleSegment,
  toggleAllSegments,
  hotels,
  selectedHotel,
  setSelectedHotel,
  dates,
  startIdx,
  endIdx,
  setStartIdx,
  setEndIdx,
}: {
  segments: string[];
  activeSegments: Set<string>;
  toggleSegment: (s: string) => void;
  toggleAllSegments: () => void;
  hotels: string[];
  selectedHotel: string;
  setSelectedHotel: (name: string) => void;
  dates: string[];
  startIdx: number;
  endIdx: number;
  setStartIdx: (i: number) => void;
  setEndIdx: (i: number) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      {/* Segment filter */}
      <div className="min-w-0">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Segment
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const allOn = activeSegments.size === segments.length && segments.length > 0;
            return (
              <button
                onClick={toggleAllSegments}
                className={
                  "rounded-full px-3 py-1 text-xs font-bold transition " +
                  (allOn
                    ? "bg-orange-600 text-white shadow-sm dark:bg-orange-500"
                    : "border border-orange-400 text-orange-600 hover:bg-orange-50 dark:border-orange-500 dark:text-orange-300 dark:hover:bg-orange-500/10")
                }
              >
                All
              </button>
            );
          })()}
          {segments.map((s) => {
            const on = activeSegments.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleSegment(s)}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition " +
                  (on
                    ? "bg-orange-600 text-white shadow-sm dark:bg-orange-500"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hotel focus */}
      <div className="min-w-0">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Hotel
        </div>
        <select
          value={selectedHotel}
          onChange={(e) => setSelectedHotel(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {hotels.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Date range
        </div>
        <DateRangePicker
          dates={dates}
          startIdx={startIdx}
          endIdx={endIdx}
          setStartIdx={setStartIdx}
          setEndIdx={setEndIdx}
        />
      </div>
    </div>
  );
}
