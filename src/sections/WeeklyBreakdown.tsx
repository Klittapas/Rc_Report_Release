import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import type { Plugin } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Dataset } from "../data/aggregate.ts";
import { fmt, fmtK } from "../data/format.ts";
import { Dropdown } from "../ui/Dropdown.tsx";

const ALL_CHAN = "All channels";
const ALL_PROMO = "All promos";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const H = 0, S = 1, P = 2, C = 3, D = 4, ROOMS = 5, REV = 6;
const TOP_N = 4; // stacked segments per week (keep it readable)
// stack bottom -> top: navy, dark red, red-orange, coral (rank 1..4)
const REDS = ["#1e3050", "#b1333f", "#d6473c", "#ea5c43"];

// continuous week-of-year: 4 weeks per month, so Jan = 1-4, Feb = 5-8, … Jun = 21-24
// within a month: 1-7=Wk1, 8-14=Wk2, 15-21=Wk3, 22-end=Wk4
const weekOf = (iso: string) => {
  const month = parseInt(iso.slice(5, 7), 10);
  const weekInMonth = Math.min(Math.floor((parseInt(iso.slice(8, 10), 10) - 1) / 7) + 1, 4);
  return (month - 1) * 4 + weekInMonth;
};

export function WeeklyBreakdown({
  dataset,
  segments,
  hotel,
  startIdx,
  endIdx,
  dark,
}: {
  dataset: Dataset;
  segments: Set<string>;
  hotel: string;
  startIdx: number;
  endIdx: number;
  dark: boolean;
}) {
  const [metric, setMetric] = useState<"revenue" | "rooms">("revenue");
  const [dim, setDim] = useState<"promo" | "channel">("promo");
  const [chanF, setChanF] = useState<string>(ALL_CHAN);
  const [promoF, setPromoF] = useState<string>(ALL_PROMO);
  const colIdx = metric === "revenue" ? REV : ROOMS;
  const dimIdx = dim === "promo" ? P : C;
  const names = dim === "promo" ? dataset.plans : dataset.channels;
  const hotelIdx = dataset.hotels.indexOf(hotel); // follows top hotel selection
  const chanFIdx = chanF === ALL_CHAN ? -1 : dataset.channels.indexOf(chanF);
  const promoFIdx = promoF === ALL_PROMO ? -1 : dataset.plans.indexOf(promoF);

  // cascading options: only list channels/promos that actually have data given the
  // other active filters (segment, date, hotel, and the opposite dropdown)
  const { chanOptions, promoOptions } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const chSet = new Set<number>();
    const prSet = new Set<number>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (promoFIdx < 0 || r[P] === promoFIdx) chSet.add(r[C]); // channels for the chosen promo
      if (chanFIdx < 0 || r[C] === chanFIdx) prSet.add(r[P]);   // promos for the chosen channel
    }
    const chans = dataset.channels.filter((_, i) => chSet.has(i));
    const promos = dataset.plans.filter((_, i) => prSet.has(i));
    // keep the current selection visible even if the opposite filter excluded it
    if (chanF !== ALL_CHAN && !chans.includes(chanF)) chans.push(chanF);
    if (promoF !== ALL_PROMO && !promos.includes(promoF)) promos.push(promoF);
    return { chanOptions: [ALL_CHAN, ...chans], promoOptions: [ALL_PROMO, ...promos] };
  }, [dataset, segments, startIdx, endIdx, hotelIdx, chanFIdx, promoFIdx, chanF, promoF]);

  const { weeks, series } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const byWeek = new Map<number, Map<number, number>>();
    const itemTotal = new Map<number, number>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (chanFIdx >= 0 && r[C] !== chanFIdx) continue;
      if (promoFIdx >= 0 && r[P] !== promoFIdx) continue;
      const wk = weekOf(dataset.dates[r[D]]);
      let m = byWeek.get(wk);
      if (!m) { m = new Map(); byWeek.set(wk, m); }
      m.set(r[dimIdx], (m.get(r[dimIdx]) || 0) + r[colIdx]);
      itemTotal.set(r[dimIdx], (itemTotal.get(r[dimIdx]) || 0) + r[colIdx]);
    }
    const weekKeys = [...byWeek.keys()].sort((a, b) => a - b);
    const topItems = [...itemTotal.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map((e) => e[0]);
    return {
      weeks: weekKeys.map((w) => `Week ${w}`),
      series: topItems.map((ii) => ({
        plan: names[ii],
        data: weekKeys.map((wk) => byWeek.get(wk)!.get(ii) || 0),
      })),
    };
  }, [dataset, segments, startIdx, endIdx, colIdx, dimIdx, hotelIdx, chanFIdx, promoFIdx]);

  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const fmtVal = (v: number) => (metric === "revenue" ? fmtK(v) : v.toLocaleString());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Weekly Breakdown — top {dim === "promo" ? "promos" : "channels"} by week
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            value={chanF}
            options={chanOptions}
            onChange={setChanF}
            minWidth={140}
            ariaLabel="Filter by channel"
            label="Channel"
          />
          <Dropdown
            value={promoF}
            options={promoOptions}
            onChange={setPromoF}
            minWidth={140}
            ariaLabel="Filter by promo"
            label="Promotion"
          />
          <div className="flex gap-1">
            {(["promo", "channel"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDim(d)}
                className={
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                  (dim === d
                    ? "bg-[#e0743f] text-white dark:bg-[#e0743f]"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                }
              >
                {d === "promo" ? "Promo" : "Channel"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["revenue", "rooms"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                  (metric === m
                    ? "bg-[#e0743f] text-white dark:bg-[#e0743f]"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                }
              >
                {m === "rooms" ? "Rooms" : "Revenue"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        Top {TOP_N} {dim === "promo" ? "promos" : "channels"} · stacked per week · week-of-year, 4 per month (Jan 1-4 … Jun 21-24)
      </p>
      <div className="relative h-[340px]">
        <Bar
          plugins={[ChartDataLabels as Plugin<"bar">]}
          data={{
            labels: weeks,
            datasets: series.map((s, i) => {
              const R = 35, last = series.length - 1; // half of maxBarThickness = full capsule ends
              const radius = series.length === 1
                ? R
                : i === 0 ? { bottomLeft: R, bottomRight: R, topLeft: 0, topRight: 0 }
                  : i === last ? { topLeft: R, topRight: R, bottomLeft: 0, bottomRight: 0 }
                    : 0;
              return {
                label: s.plan,
                data: s.data,
                backgroundColor: REDS[i] ?? REDS[REDS.length - 1],
                borderRadius: radius,
                borderSkipped: false,
                maxBarThickness: 70,
                stack: "w",
              };
            }),
          }}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "top", align: "start", labels: { color: label, usePointStyle: true, boxWidth: 8, font: { size: 11.5, weight: 600 }, padding: 14 } },
              tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${metric === "revenue" ? fmt(Number(c.raw)) : Number(c.raw).toLocaleString()}` } },
              datalabels: {
                anchor: "center",
                align: "center",
                color: "#fff",
                font: { size: 9.5, weight: 700 },
                formatter: (v: number) => (v > 0 ? fmtVal(v) : ""),
              },
            },
            scales: {
              x: { stacked: true, ticks: { color: label, font: { weight: 600 } }, grid: { display: false } },
              y: { stacked: true, beginAtZero: true, ticks: { color: tick, callback: (v) => fmtVal(Number(v)) }, grid: { color: grid } },
            },
          }}
        />
      </div>
    </div>
  );
}
