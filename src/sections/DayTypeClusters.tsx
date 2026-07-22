import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Dataset } from "../data/aggregate.ts";
import { standardize, kmeans } from "../data/cluster.ts";
import { fmt } from "../data/format.ts";

const H = 0, S = 1, C = 3, D = 4, ROOMS = 5, REV = 6, BD = 8, RF = 9;

// channels that are NOT OTA — used to compute the %OTA feature
const NON_OTA = new Set(["Direct", "Internal", "Corporate", "UNKNOWN_REVIEW"]);

// cluster colors by demand rank (peak first). Supports up to k=4.
const RANK_COLOR = ["#ea580c", "#1e3050", "#0d9488", "#64748b"];
const RANK_NAME = ["Peak demand", "High demand", "Steady", "Quiet"];

const FEATURES = ["rooms", "ADR", "%OTA", "%NRF", "%RB", "weekend"] as const;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DayRow = { di: number; date: string; rooms: number; adr: number; ota: number; nrf: number; rb: number; wknd: number };

export function DayTypeClusters({
  dataset,
  segments,
  startIdx,
  endIdx,
  selectedHotel,
  dark,
}: {
  dataset: Dataset;
  segments: Set<string>;
  startIdx: number;
  endIdx: number;
  selectedHotel: string; // driven by the top HOTEL selector
  dark: boolean;
}) {
  const k = 4; // fixed: elbow + silhouette both point to k=4
  const [tip, setTip] = useState<{ x: number; y: number; place: "above" | "below"; lines: string[] } | null>(null);
  // anchor the tooltip to the hovered element (centered, caret pointing at it), flipping below near the top edge
  const showTip = (e: ReactMouseEvent<HTMLElement>, lines: string[]) => {
    const r = e.currentTarget.getBoundingClientRect();
    const above = r.top > 96; // enough room above? else flip below
    setTip({ x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, place: above ? "above" : "below", lines });
  };
  const hotelIdx = dataset.hotels.indexOf(selectedHotel);
  const boards = dataset.boards ?? [];
  const refunds = dataset.refunds ?? [];

  // 1 row per date across the WHOLE dataset — the date filter is deliberately not
  // applied here so a day keeps the same cluster (and colour) no matter which
  // period is on screen. Segment + hotel still filter, since those change what
  // "a day" even means.
  const allDays = useMemo<DayRow[]>(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    // `gross` counts only positive rooms so cancellations can't shrink the
    // denominator and push a share above 100% (or negative).
    const agg = new Map<number, { rooms: number; gross: number; rev: number; ota: number; nrf: number; rb: number }>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S])) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (dataset.channels[r[C]] === "UNKNOWN_REVIEW") continue; // junk codes
      let a = agg.get(r[D]);
      if (!a) { a = { rooms: 0, gross: 0, rev: 0, ota: 0, nrf: 0, rb: 0 }; agg.set(r[D], a); }
      const rm = r[ROOMS];
      a.rooms += rm; a.rev += r[REV];
      if (rm > 0) {
        a.gross += rm;
        if (!NON_OTA.has(dataset.channels[r[C]])) a.ota += rm;
        if (refunds[r[RF]] === "NRF") a.nrf += rm;
        if (boards[r[BD]] === "RB") a.rb += rm;
      }
    }
    return [...agg.entries()]
      .filter(([, a]) => a.rooms > 0)
      .sort((x, y) => x[0] - y[0])
      .map(([di, a]) => {
        const g = a.gross || 1; // shares are always out of gross bookings
        return {
          di, date: dataset.dates[di],
          rooms: a.rooms,
          adr: a.rev / a.rooms,
          ota: a.ota / g,
          nrf: a.nrf / g,
          rb: a.rb / g,
          wknd: [0, 6].includes(new Date(dataset.dates[di] + "T00:00:00").getDay()) ? 1 : 0,
        };
      });
  }, [dataset, segments, hotelIdx, boards, refunds]);

  // 2. standardize features + run k-means over every day, once
  const { rankByDi, clusters } = useMemo(() => {
    if (allDays.length < k) return { rankByDi: new Map<number, number>(), clusters: [] as ClusterCard[] };
    const raw = allDays.map((d) => [d.rooms, d.adr, d.ota, d.nrf, d.rb, d.wknd]);
    const { z } = standardize(raw);
    const { assignments } = kmeans(z, k);

    // real-unit average per raw cluster
    const info: ClusterInfo[] = Array.from({ length: k }, () => ({ n: 0, rooms: 0, adr: 0, ota: 0, nrf: 0, rb: 0, wknd: 0 }));
    allDays.forEach((d, i) => {
      const c = info[assignments[i]];
      c.n++; c.rooms += d.rooms; c.adr += d.adr; c.ota += d.ota; c.nrf += d.nrf; c.rb += d.rb; c.wknd += d.wknd;
    });
    for (const c of info) if (c.n) { c.rooms /= c.n; c.adr /= c.n; c.ota /= c.n; c.nrf /= c.n; c.rb /= c.n; c.wknd /= c.n; }

    // rank clusters by demand (avg rooms) desc -> stable color/name
    const order = info.map((_, i) => i).sort((a, b) => info[b].rooms - info[a].rooms);
    const rankOf = new Array(k).fill(0);
    order.forEach((cl, rank) => (rankOf[cl] = rank));
    const clusters: ClusterCard[] = order.map((cl) => ({ ...info[cl], cluster: cl, rank: rankOf[cl] }));
    // di -> rank, so lookups don't depend on the visible slice
    const rankByDi = new Map(allDays.map((d, i) => [d.di, rankOf[assignments[i]]]));
    return { rankByDi, clusters };
  }, [allDays, k]);

  // only the selected period is drawn; clustering above already happened
  const days = useMemo(() => allDays.filter((d) => d.di >= startIdx && d.di <= endIdx), [allDays, startIdx, endIdx]);
  const visibleByRank = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of days) { const r = rankByDi.get(d.di) ?? 0; m.set(r, (m.get(r) ?? 0) + 1); }
    return m;
  }, [days, rankByDi]);

  const label = dark ? "#e2e8f0" : "#334155";
  const muted = dark ? "#94a3b8" : "#64748b";

  if (allDays.length < k || !days.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Day-type clusters</h4>
        <p className="mt-2 text-[11px] text-slate-400">
          {allDays.length < k
            ? `Not enough days (${allDays.length}) for k=${k}. Upload a wider export.`
            : "No days in the selected range."}
        </p>
      </div>
    );
  }

  // group day cells by month for the calendar strip (one row per month)
  const byMonth = new Map<string, DayRow[]>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(d);
  }
  // "2026-01" -> "Jan"; append a 2-digit year only when the range spans more than one year
  const multiYear = new Set([...byMonth.keys()].map((m) => m.slice(0, 4))).size > 1;
  const monthLabel = (m: string) => {
    const abbr = MONTH_ABBR[Number(m.slice(5, 7)) - 1] ?? m;
    return multiYear ? `${abbr} '${m.slice(2, 4)}` : abbr;
  };
  // cell size adapts to how many months are on screen: few months keep the roomy
  // original squares, long ranges shrink so each month still fits one row
  const nMonths = byMonth.size;
  const cal =
    nMonths <= 2
      ? { size: 32, gap: 6, fs: 10, label: 42, labelFs: 11, showNum: true }
      : nMonths <= 6
        ? { size: 24, gap: 4, fs: 9, label: 36, labelFs: 10, showNum: true }
        : nMonths <= 12
          ? { size: 18, gap: 3, fs: 8, label: 32, labelFs: 9.5, showNum: false }
          : { size: 14, gap: 2, fs: 7, label: 30, labelFs: 9, showNum: false };

  const traitTag = (c: ClusterInfo & { rank: number }) => {
    if (c.wknd >= 0.6) return "weekend";
    if (c.wknd <= 0.05) return "weekday";
    return "";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Day-type clusters — unsupervised (k-means)
        </h4>
        <div className="flex items-center gap-1">
          {/* <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">clusters</span>
          <span className="rounded-full bg-[#ea580c] px-2.5 py-0.5 text-[11px] font-semibold text-white">{k}</span> */}
        </div>
      </div>
      
      <p className="mb-3 text-[11px] text-slate-400">
        Clusters all <b>{allDays.length}</b> days by <b>rooms · ADR · %OTA · %NRF · %RB · weekend</b> (z-scored), then shows the{" "}
        <b>{days.length}</b> in range — so a day keeps its colour whatever period you pick. {selectedHotel || "—"} · follows segment + hotel.
      </p>
      
       <p className="mb-1 text-[13px] text-red-600 font-bold ">
        Maintain.... Not ready to use.
      </p>

     
      {/* calendar strip — one row per month, days aligned in day-of-month columns.
          Cells shrink as the range grows so every month still fits on a single row. */}
      <div className="mb-4 overflow-x-auto pb-1">
        <div className="min-w-max" style={{ display: "flex", flexDirection: "column", gap: cal.gap }}>
          {[...byMonth.entries()].map(([m, ds]) => {
            const byDom = new Map(ds.map((d) => [Number(d.date.slice(8)), d]));
            return (
              <div key={m} className="flex items-center" style={{ gap: cal.gap }}>
                <span
                  className="shrink-0 font-semibold text-slate-400"
                  style={{ width: cal.label, fontSize: cal.labelFs }}
                >
                  {monthLabel(m)}
                </span>
                {Array.from({ length: 31 }, (_, i) => {
                  const d = byDom.get(i + 1);
                  if (!d) return <span key={i} className="shrink-0" style={{ width: cal.size, height: cal.size }} />;
                  const rank = rankByDi.get(d.di) ?? 0;
                  return (
                    <div
                      key={i}
                      onMouseEnter={(e) =>
                        showTip(e, [
                          `${d.date}${d.wknd ? " · weekend" : ""}`,
                          `${RANK_NAME[rank]}`,
                          `${d.rooms.toLocaleString()} rooms · ADR ${fmt(Math.round(d.adr))}`,
                          `OTA ${Math.round(d.ota * 100)}% · NRF ${Math.round(d.nrf * 100)}% · RB ${Math.round(d.rb * 100)}%`,
                        ])
                      }
                      onMouseLeave={() => setTip(null)}
                      className="dt-cell flex shrink-0 cursor-default items-center justify-center rounded font-bold text-white"
                      style={{
                        width: cal.size,
                        height: cal.size,
                        fontSize: cal.fs,
                        backgroundColor: RANK_COLOR[rank],
                      }}
                    >
                      {cal.showNum ? d.date.slice(8) : ""}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* cluster profile cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {clusters.map((c) => (
          <div
            key={c.cluster}
            onMouseEnter={(e) =>
              showTip(e, [
                `${RANK_NAME[c.rank]} — ${c.n} day${c.n > 1 ? "s" : ""} overall`,
                `${visibleByRank.get(c.rank) ?? 0} of them fall in the selected range`,
                `${Math.round(c.wknd * 100)}% of these days are weekends`,
                `avg ${Math.round(c.rooms).toLocaleString()} rooms/day · ADR ${fmt(Math.round(c.adr))}`,
                `OTA ${Math.round(c.ota * 100)}% · NRF ${Math.round(c.nrf * 100)}% · RB ${Math.round(c.rb * 100)}%`,
              ])
            }
            onMouseLeave={() => setTip(null)}
            className="dt-card cursor-default rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: RANK_COLOR[c.rank] }} />
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{RANK_NAME[c.rank]}</span>
            </div>
            <div className="mb-2 text-[10px] font-semibold text-slate-400">
              {visibleByRank.get(c.rank) ?? 0} of {c.n} day{c.n > 1 ? "s" : ""} in view
              {traitTag(c) ? ` · ${traitTag(c)}` : ""}
            </div>
            <dl className="space-y-0.5 text-[10.5px]">
              <Row k="rooms/day" v={Math.round(c.rooms).toLocaleString()} />
              <Row k="ADR" v={fmt(Math.round(c.adr))} />
              <Row k="OTA" v={`${Math.round(c.ota * 100)}%`} />
              <Row k="NRF" v={`${Math.round(c.nrf * 100)}%`} />
              <Row k="RB" v={`${Math.round(c.rb * 100)}%`} />
            </dl>
          </div>
        ))}
      </div>

      {tip && (
        <div
          className={"hm-tip hm-tip--multi" + (tip.place === "below" ? " hm-tip--below" : "")}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-bold" : "opacity-75"}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

type ClusterInfo = { n: number; rooms: number; adr: number; ota: number; nrf: number; rb: number; wknd: number };
type ClusterCard = ClusterInfo & { cluster: number; rank: number };

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-bold text-slate-700 dark:text-slate-200">{v}</dd>
    </div>
  );
}
