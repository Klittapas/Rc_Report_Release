import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import type { Plugin } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Dataset } from "../data/aggregate.ts";
import { fmt, fmtK } from "../data/format.ts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const H = 0, S = 1, C = 3, D = 4, ROOMS = 5, REV = 6, RF = 9;

// NRF (non-refundable, committed) at bottom, then Flex, then everything else
const CLASS_ORDER = ["NRF", "Flex", "Other"];
const CLASS_COLOR: Record<string, string> = { NRF: "#e0743f", Flex: "#1e3050", Other: "#94a3b8" };
const CLASS_NAME: Record<string, string> = {
  NRF: "NRF (non-refundable)", Flex: "Flex (refundable)", Other: "Other (no refund flag)",
};

/** Classify the refund label (from the refundIdx column) into NRF / Flex / Other. */
function refundClass(refund: string): "NRF" | "Flex" | "Other" {
  if (refund === "NRF") return "NRF";
  if (refund === "Flex") return "Flex";
  return "Other";
}

export function NrfFlexByChannel({
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
  const [metric, setMetric] = useState<"rooms" | "revenue">("rooms");
  const colIdx = metric === "revenue" ? REV : ROOMS;
  const hotelIdx = dataset.hotels.indexOf(hotel);

  const refundLabels = dataset.refunds ?? [];

  const { channels, series, nrfShare, maxTotal } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    // channelIdx -> class label -> value
    const byChan = new Map<number, Map<string, number>>();
    const chanTotal = new Map<number, number>();
    let nrfTotal = 0, grand = 0;

    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      // drop UNKNOWN_REVIEW — junk codes (blank / total / dummy), not a real channel
      if (dataset.channels[r[C]] === "UNKNOWN_REVIEW") continue;
      const v = r[colIdx];
      const cls = refundClass(refundLabels[r[RF]] ?? "");
      let m = byChan.get(r[C]);
      if (!m) { m = new Map(); byChan.set(r[C], m); }
      m.set(cls, (m.get(cls) || 0) + v);
      chanTotal.set(r[C], (chanTotal.get(r[C]) || 0) + v);
      if (cls === "NRF") nrfTotal += v;
      grand += v;
    }

    // channels (X) with data, biggest first
    const chanKeys = [...chanTotal.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    // only classes that actually appear, in fixed order
    const present = new Set<string>();
    for (const m of byChan.values()) for (const k of m.keys()) present.add(k);
    const classKeys = CLASS_ORDER.filter((c) => present.has(c));

    return {
      channels: chanKeys.map((ci) => dataset.channels[ci]),
      series: classKeys.map((c) => ({
        cls: c,
        data: chanKeys.map((ci) => byChan.get(ci)!.get(c) || 0),
      })),
      nrfShare: grand ? Math.round((nrfTotal / grand) * 1000) / 10 : 0,
      // tallest bar total — used to hide labels on segments too short to hold text
      maxTotal: chanKeys.length ? chanTotal.get(chanKeys[0])! : 0,
    };
  }, [dataset, segments, startIdx, endIdx, colIdx, hotelIdx, refundLabels]);

  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const fmtVal = (v: number) => (metric === "revenue" ? fmtK(v) : v.toLocaleString());

  if (!channels.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">NRF vs Flex by channel</h4>
        <p className="mt-2 text-[11px] text-slate-400">No data for this hotel with the current segment / date filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          NRF vs Flex by channel — who commits to non-refundable
        </h4>
        <div className="flex gap-1">
          {(["rooms", "revenue"] as const).map((m) => (
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
      <p className="mb-3 text-[11px] text-slate-400">
        Stacked per channel · <b className="text-orange-600 dark:text-orange-400">{nrfShare}% NRF</b> (non-refundable) overall · reflects segment + date filters
      </p>
      <div className="relative h-[340px]">
        <Bar
          plugins={[ChartDataLabels as Plugin<"bar">]}
          data={{
            labels: channels,
            datasets: series.map((s, i) => {
              const R = 30, last = series.length - 1;
              const radius = series.length === 1
                ? R
                : i === 0 ? { bottomLeft: R, bottomRight: R, topLeft: 0, topRight: 0 }
                  : i === last ? { topLeft: R, topRight: R, bottomLeft: 0, bottomRight: 0 }
                    : 0;
              return {
                label: CLASS_NAME[s.cls] ?? s.cls,
                data: s.data,
                backgroundColor: CLASS_COLOR[s.cls] ?? "#94a3b8",
                borderRadius: radius,
                borderSkipped: false,
                maxBarThickness: 70,
                stack: "b",
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
                // only label segments tall enough to hold text (>= 4.5% of the tallest bar); rest read via tooltip
                display: (c) => Number(c.dataset.data[c.dataIndex]) >= maxTotal * 0.045,
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
