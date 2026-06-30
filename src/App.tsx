import { useMemo, useState } from "react";
import { dataset as bundledDataset, aggregate } from "./aggregate.ts";
import type { Dataset } from "./aggregate.ts";
import { normalizeCsv } from "./normalize.ts";
import { PromoByHotel } from "./PromoByHotel.tsx";
import { DailyTrend } from "./DailyTrend.tsx";
import { ChannelPromoHeatmap } from "./ChannelPromoHeatmap.tsx";
import { HotelComparison } from "./HotelComparison.tsx";
import { WeeklyBreakdown } from "./WeeklyBreakdown.tsx";
import { HotelDetail } from "./HotelDetail.tsx";
import { Controls } from "./Controls.tsx";
import { useTheme } from "./useTheme.ts";
import { fmtK } from "./format.ts";

export function App() {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === "dark";

  const [dataset, setDataset] = useState<Dataset>(bundledDataset);
  const [source, setSource] = useState<string>("no data loaded");
  const [uploadMsg, setUploadMsg] = useState<string>("");

  const [activeSegments, setActiveSegments] = useState<Set<string>>(new Set(["OTA"]));
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(dataset.dates.length - 1);
  const [selected, setSelected] = useState(0);

  const hotels = useMemo(
    () => aggregate(dataset, { segments: activeSegments, startIdx, endIdx }),
    [dataset, activeSegments, startIdx, endIdx],
  );

  const handleUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const n = list.length;
    setUploadMsg(n > 1 ? `Normalizing ${n} files…` : "Normalizing…");
    try {
      const texts = await Promise.all(list.map((f) => f.text()));
      const { dataset: ds, rowsRead, rowsKept } = normalizeCsv(texts);
      if (!ds.rows.length) throw new Error("No usable rows found.");
      // reset filters to fit the merged data
      setDataset(ds);
      setSource(n > 1 ? `uploaded · ${n} files merged` : `uploaded · ${list[0].name}`);
      setActiveSegments(new Set(ds.segments.includes("OTA") ? ["OTA"] : [ds.segments[0]]));
      setStartIdx(0);
      setEndIdx(ds.dates.length - 1);
      setSelected(0);
      const label = n > 1 ? `${n} files` : list[0].name;
      setUploadMsg(`✓ ${label} — ${rowsKept.toLocaleString()} rows from ${rowsRead.toLocaleString()} read · ${ds.dates.length} days`);
    } catch (e) {
      setUploadMsg(`✕ ${(e as Error).message}`);
    }
  };

  const toggleSegment = (s: string) => {
    setActiveSegments((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { if (next.size > 1) next.delete(s); }
      else next.add(s);
      return next;
    });
  };

  const grandRev = hotels.reduce((a, h) => a + h.total_revenue, 0);
  const segLabel = activeSegments.size === dataset.segments.length
    ? "All segments" : [...activeSegments].join(" + ");

  // no data bundled — wait for the user to upload their (private) ratecode CSV
  const isEmpty = dataset.dates.length === 0 || hotels.length === 0;

  if (isEmpty) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            OTA Promotion Performance Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No data is bundled with this site. Upload a raw ratecode CSV export to build the
            dashboard — the file is processed <b className="text-slate-700 dark:text-slate-200">entirely in your browser</b> and
            never uploaded anywhere.
          </p>
          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-orange-500 bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600">
            ⬆ Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-3 text-[11px] text-slate-400">Select multiple months at once to merge them.</p>
          {uploadMsg && (
            <div className="mt-4 text-[12px] font-medium text-slate-500 dark:text-slate-400">{uploadMsg}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-7">
        <header className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
             OTA Promotion Performance Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Pill>{segLabel}</Pill>
            <Pill>{dataset.dates[startIdx]} → {dataset.dates[endIdx]}</Pill>
            <Pill>{fmtK(grandRev)} total</Pill>
            Click a point to see <b className="text-orange-600 dark:text-orange-400">which promotion earns the most</b>.
          </p>
        </header>

        <Controls
          segments={dataset.segments}
          activeSegments={activeSegments}
          toggleSegment={toggleSegment}
          hotels={hotels.map((h) => h.name)}
          selectedHotel={hotels[selected]?.name ?? ""}
          setSelectedHotel={(name) => setSelected(Math.max(0, hotels.findIndex((h) => h.name === name)))}
          dates={dataset.dates}
          startIdx={startIdx}
          endIdx={endIdx}
          setStartIdx={setStartIdx}
          setEndIdx={setEndIdx}
          theme={theme}
          toggleTheme={toggleTheme}
          onUpload={handleUpload}
          uploadMsg={uploadMsg}
        />

        <div className="mb-3.5 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Daily trend
        </div>
        <DailyTrend hotel={hotels[selected]} dark={dark} />

        <div className="mb-3.5 mt-8 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Promotion source · which OTA channel drives each promo
        </div>
        <ChannelPromoHeatmap
          dataset={dataset}
          segments={activeSegments}
          startIdx={startIdx}
          endIdx={endIdx}
          dark={dark}
        />

        <div className="mb-3.5 mt-8 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Compare all 7 hotels
        </div>
        <HotelComparison
          hotels={hotels}
          nights={endIdx - startIdx + 1}
          dark={dark}
          selectedName={hotels[selected]?.name ?? ""}
          onSelect={(name) => setSelected(hotels.findIndex((h) => h.name === name))}
        />

        <div className="mb-3.5 mt-8 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Weekly breakdown
        </div>
        <WeeklyBreakdown
          dataset={dataset}
          segments={activeSegments}
          startIdx={startIdx}
          endIdx={endIdx}
          dark={dark}
        />

        <div className="mb-3.5 mt-8 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Hotel detail
        </div>
        <HotelDetail hotel={hotels[selected]} dark={dark} />

        <div className="mb-3.5 mt-8 text-[13px] font-bold uppercase tracking-wider text-slate-400">
          Overview · click a point to drill in
        </div>
        <PromoByHotel
          hotels={hotels}
          dark={dark}
          onSelect={(name) => setSelected(hotels.findIndex((h) => h.name === name))}
        />

        <p className="mt-10 text-center text-[11.5px] text-slate-400">
          Data source: {source} · generated {dataset.generated} · upload a raw ratecode CSV to normalize it in the browser
        </p>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1.5 inline-block rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-orange-600 dark:border-slate-700 dark:bg-slate-800 dark:text-orange-300">
      {children}
    </span>
  );
}
