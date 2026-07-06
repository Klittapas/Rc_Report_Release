import { DateRangePicker } from "./DateRangePicker.tsx";
import { Dropdown } from "./Dropdown.tsx";

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
    <div className="sticky top-0 z-20 mb-5 flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
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
                    ? "bg-[#e0743f] text-white shadow-sm dark:bg-[#e0743f]"
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
                    ? "bg-[#e0743f] text-white shadow-sm dark:bg-[#e0743f]"
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
        <Dropdown
          value={selectedHotel}
          options={hotels}
          onChange={setSelectedHotel}
          minWidth={240}
          ariaLabel="Select hotel"
        />
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
