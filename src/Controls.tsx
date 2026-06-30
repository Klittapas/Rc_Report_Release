import type { Theme } from "./useTheme.ts";
import { DateRangePicker } from "./DateRangePicker.tsx";

export function Controls({
  segments,
  activeSegments,
  toggleSegment,
  dates,
  startIdx,
  endIdx,
  setStartIdx,
  setEndIdx,
  theme,
  toggleTheme,
  onUpload,
  uploadMsg,
}: {
  segments: string[];
  activeSegments: Set<string>;
  toggleSegment: (s: string) => void;
  dates: string[];
  startIdx: number;
  endIdx: number;
  setStartIdx: (i: number) => void;
  setEndIdx: (i: number) => void;
  theme: Theme;
  toggleTheme: () => void;
  onUpload: (file: File) => void;
  uploadMsg: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      {/* Segment filter */}
      <div className="min-w-0">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Segment
        </div>
        <div className="flex flex-wrap gap-1.5">
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

      {/* Upload + theme toggle */}
      <div className="ml-auto flex items-end gap-2">
        <label className="cursor-pointer rounded-lg border border-orange-500 bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 dark:border-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600">
          ⬆ Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = ""; // allow re-uploading the same file
            }}
          />
        </label>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          title="Toggle light / dark"
        >
          {theme === "dark" ? " Light" : " Dark"}
        </button>
      </div>

      {uploadMsg && (
        <div className="w-full text-[11.5px] font-medium text-slate-500 dark:text-slate-400">{uploadMsg}</div>
      )}
    </div>
  );
}
