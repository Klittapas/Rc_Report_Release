import { useMemo, useState } from "react";
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
  const [k, setK] = useState(3);
  const hotelIdx = dataset.hotels.indexOf(selectedHotel);
  const boards = dataset.boards ?? [];
  const refunds = dataset.refunds ?? [];

  // 1 row per date (portfolio-wide, respects segment + date filters)
  const days = useMemo<DayRow[]>(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const agg = new Map<number, { rooms: number; rev: number; ota: number; nrf: number; rb: number }>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (dataset.channels[r[C]] === "UNKNOWN_REVIEW") continue; // junk codes
      let a = agg.get(r[D]);
      if (!a) { a = { rooms: 0, rev: 0, ota: 0, nrf: 0, rb: 0 }; agg.set(r[D], a); }
      const rm = r[ROOMS];
      a.rooms += rm; a.rev += r[REV];
      if (!NON_OTA.has(dataset.channels[r[C]])) a.ota += rm;
      if (refunds[r[RF]] === "NRF") a.nrf += rm;
      if (boards[r[BD]] === "RB") a.rb += rm;
    }
    return [...agg.entries()]
      .filter(([, a]) => a.rooms > 0)
      .sort((x, y) => x[0] - y[0])
      .map(([di, a]) => ({
        di, date: dataset.dates[di],
        rooms: a.rooms,
        adr: a.rev / a.rooms,
        ota: a.ota / a.rooms,
        nrf: a.nrf / a.rooms,
        rb: a.rb / a.rooms,
        wknd: [0, 6].includes(new Date(dataset.dates[di] + "T00:00:00").getDay()) ? 1 : 0,
      }));
  }, [dataset, segments, startIdx, endIdx, hotelIdx, boards, refunds]);

  // 2. standardize features + run k-means
  const { assignments, rankOf, clusters } = useMemo(() => {
    if (days.length < k) return { assignments: [] as number[], rankOf: [] as number[], clusters: [] as ClusterCard[] };
    const raw = days.map((d) => [d.rooms, d.adr, d.ota, d.nrf, d.rb, d.wknd]);
    const { z } = standardize(raw);
    const { assignments } = kmeans(z, k);

    // real-unit average per raw cluster
    const info: ClusterInfo[] = Array.from({ length: k }, () => ({ n: 0, rooms: 0, adr: 0, ota: 0, nrf: 0, rb: 0, wknd: 0 }));
    days.forEach((d, i) => {
      const c = info[assignments[i]];
      c.n++; c.rooms += d.rooms; c.adr += d.adr; c.ota += d.ota; c.nrf += d.nrf; c.rb += d.rb; c.wknd += d.wknd;
    });
    for (const c of info) if (c.n) { c.rooms /= c.n; c.adr /= c.n; c.ota /= c.n; c.nrf /= c.n; c.rb /= c.n; c.wknd /= c.n; }

    // rank clusters by demand (avg rooms) desc -> stable color/name
    const order = info.map((_, i) => i).sort((a, b) => info[b].rooms - info[a].rooms);
    const rankOf = new Array(k).fill(0);
    order.forEach((cl, rank) => (rankOf[cl] = rank));
    const clusters: ClusterCard[] = order.map((cl) => ({ ...info[cl], cluster: cl, rank: rankOf[cl] }));
    return { assignments, rankOf, clusters };
  }, [days, k]);

  const label = dark ? "#e2e8f0" : "#334155";
  const muted = dark ? "#94a3b8" : "#64748b";

  if (days.length < k) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Day-type clusters</h4>
        <p className="mt-2 text-[11px] text-slate-400">Not enough days ({days.length}) for k={k}. Widen the date range.</p>
      </div>
    );
  }

  // group day cells by month for the calendar strip
  const byMonth = new Map<string, DayRow[]>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(d);
  }

  const traitTag = (c: ClusterInfo & { rank: number }) => {
    if (c.wknd >= 0.6) return "weekend";
    if (c.wknd <= 0.05) return "weekday";
    return "";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Day-type clusters — unsupervised (k-means) Maintain.... Not ready to use
        </h4>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">clusters</span>
          {[2, 3, 4].map((kk) => (
            <button
              key={kk}
              onClick={() => setK(kk)}
              className={
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                (k === kk
                  ? "bg-[#ea580c] text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
              }
            >
              {kk}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        Groups {days.length} days by <b>rooms · ADR · %OTA · %NRF · %RB · weekend</b> (z-scored). Color = cluster · {selectedHotel || "—"} · reflects segment + date filters.
      </p>

      {/* calendar strip */}
      <div className="mb-4 space-y-2">
        {[...byMonth.entries()].map(([m, ds]) => (
          <div key={m} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-14 shrink-0 text-[10px] font-semibold text-slate-400">{m}</span>
            {ds.map((d) => {
              const rank = rankOf[assignments[days.indexOf(d)]];
              return (
                <div
                  key={d.di}
                  title={`${d.date} · ${RANK_NAME[rank]} · ${d.rooms.toLocaleString()} rooms · ADR ${fmt(Math.round(d.adr))}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundColor: RANK_COLOR[rank] }}
                >
                  {d.date.slice(8)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* cluster profile cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {clusters.map((c) => (
          <div key={c.cluster} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: RANK_COLOR[c.rank] }} />
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{RANK_NAME[c.rank]}</span>
            </div>
            <div className="mb-2 text-[10px] font-semibold text-slate-400">
              {c.n} day{c.n > 1 ? "s" : ""}{traitTag(c) ? ` · ${traitTag(c)}` : ""}
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
