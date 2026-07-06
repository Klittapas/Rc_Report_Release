import { useState } from "react";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Tooltip, Legend, LineController, BarController,
} from "chart.js";
import type { HotelAgg } from "../data/aggregate.ts";
import { fmt, fmtK, PROMO_COLORS } from "../data/format.ts";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Tooltip, Legend, LineController, BarController,
);

export function HotelDetail({ hotel, dark }: { hotel: HotelAgg; dark: boolean }) {
  const [metric, setMetric] = useState<"revenue" | "rooms">("revenue");
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const accent2 = dark ? "#fb923c" : "#ea580c";
  const adrColor = dark ? "#60a5fa" : "#2563eb";
  // bars sorted by the active metric so the chart reads high -> low either way
  const promos = [...hotel.promos].sort((a, b) =>
    metric === "revenue" ? b.revenue - a.revenue : b.rooms - a.rooms,
  );
  const barVal = (p: (typeof promos)[number]) => (metric === "revenue" ? p.revenue : p.rooms);
  const maxVal = promos[0] ? barVal(promos[0]) : 0;
  const fmtBar = (v: number) => (metric === "revenue" ? fmtK(v) : v.toLocaleString());

  if (hotel.total_revenue === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 dark:border-slate-700">
        No data for <b>{hotel.name}</b> with the current segment / date filters.
      </div>
    );
  }

  const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{hotel.name}</h2>
          <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Best-selling promotion:{" "}
            <span className="rounded-md border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-300">
              {hotel.best_promo} · {fmtK(hotel.best_promo_rev)} ({hotel.best_promo_share}%)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Kpi k="Total Revenue" v={fmtK(hotel.total_revenue)} />
          <Kpi k="Rooms Sold" v={hotel.total_rooms.toLocaleString()} />
          <Kpi k="ADR" v={fmt(hotel.adr)} />
          <Kpi k="Top Promotion" v={hotel.best_promo} good />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className={box}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
              {metric === "revenue" ? "Revenue" : "Room Nights"} by Promotion
            </h4>
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
                  {m === "rooms" ? "Room Nights" : "Revenue"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2.5 text-[11px] text-slate-400">
            Bars = {metric === "revenue" ? "revenue" : "room nights"} (left) · line = ADR (right) · orange bar is the top {metric === "revenue" ? "earner" : "seller"}
          </p>
          <div className="relative h-75">
            <Chart
              type="bar"
              data={{
                labels: promos.map((p) => p.plan),
                datasets: [
                  {
                    type: "bar" as const,
                    label: metric === "revenue" ? "Revenue" : "Room Nights",
                    data: promos.map(barVal),
                    backgroundColor: promos.map((p) =>
                      barVal(p) === maxVal ? accent2 : (PROMO_COLORS[p.plan] || "#94a3b8") + "cc"),
                    borderRadius: 7, maxBarThickness: 46,
                    yAxisID: "y",
                    order: 2,
                  },
                  {
                    type: "line" as const,
                    label: "ADR",
                    data: promos.map((p) => p.adr),
                    borderColor: adrColor,
                    backgroundColor: adrColor,
                    borderWidth: 2,
                    pointRadius: 3.5,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: "y1",
                    order: 1,
                  },
                ],
              }}
              options={{
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { labels: { color: label, usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
                  tooltip: {
                    callbacks: {
                      label: (c) => {
                        const p = promos[c.dataIndex];
                        return c.dataset.label === "ADR"
                          ? ` ADR: ${fmt(p.adr)}`
                          : [` Revenue: ${fmt(p.revenue)}`, ` Room nights: ${p.rooms.toLocaleString()}`];
                      },
                    },
                  },
                },
                scales: {
                  x: { ticks: { color: label, font: { weight: 600, size: 10 }, maxRotation: 30 }, grid: { display: false } },
                  y: {
                    position: "left", beginAtZero: true,
                    ticks: { color: tick, callback: (v) => fmtBar(Number(v)) }, grid: { color: grid },
                  },
                  y1: {
                    position: "right", beginAtZero: true,
                    ticks: { color: adrColor, callback: (v) => fmt(Number(v)) }, grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="min-w-27.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</div>
      <div className={"mt-0.5 text-lg font-extrabold " + (good ? "text-orange-500 dark:text-orange-400" : "text-slate-800 dark:text-slate-100")}>{v}</div>
    </div>
  );
}
