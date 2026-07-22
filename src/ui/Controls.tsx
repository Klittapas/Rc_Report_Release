import { DateRangePicker } from "./DateRangePicker.tsx";
import { Dropdown } from "./Dropdown.tsx";

export function Controls({
  segments,
  activeSegments,
  toggleSegment,
  toggleAllSegments,
  dark,
  toggleTheme,
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
  dark: boolean;
  toggleTheme: () => void;
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
                  "rounded-full px-3 py-1 text-xs font-bold transition duration-150 hover:scale-105 active:scale-95 " +
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
                  "rounded-full px-3 py-1 text-xs font-semibold transition duration-150 hover:scale-105 active:scale-95 " +
                  (on
                    ? "bg-[#e0743f] text-white shadow-sm dark:bg-[#e0743f]"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                }
              >
                {s}
              </button>
            );
          })}

          {/* light / dark toggle — sits at the end of the segment row */}
          <button
            onClick={toggleTheme}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="ml-1 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition duration-150 hover:scale-110 hover:text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
          >
            {dark ? (
              // sun — click to go light
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
              </svg>
            ) : (
              // moon — click to go dark
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 14.6A8.5 8.5 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1z" />
              </svg>
            )}
          </button>
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
