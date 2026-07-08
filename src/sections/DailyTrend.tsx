import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Tooltip, Legend, Filler, LineController, BarController,
} from "chart.js";
import type { HotelAgg } from "../data/aggregate.ts";
import { fmt } from "../data/format.ts";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler, LineController, BarController,
);

export function DailyTrend({ hotel, dark }: { hotel: HotelAgg; dark: boolean }) {
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const accent2 = dark ? "#fb923c" : "#ea580c";

  const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  if (hotel.total_revenue === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 dark:border-slate-700">
        No data for <b>{hotel.name}</b> with the current segment / date filters.
      </div>
    );
  }

  return (
    <div className={box}>
      <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Daily Trend — {hotel.name}</h4>
      <p className="mb-2.5 text-[11px] text-slate-400">Daily ADR (line) and rooms sold (bars)</p>
      <div className="relative h-75">
        <Chart
          type="bar"
          data={{
            labels: hotel.trend.map((x) => x.date.slice(5)),
            datasets: [
              { type: "bar" as const, label: "Rooms", data: hotel.trend.map((x) => x.rooms),
                backgroundColor: dark ? "rgba(148,163,184,0.30)" : "rgba(148,163,184,0.35)", yAxisID: "y1", borderRadius: 4 },
              { type: "line" as const, label: "ADR", data: hotel.trend.map((x) => (x.rooms ? x.revenue / x.rooms : 0)),
                borderColor: accent2, backgroundColor: dark ? "rgba(251,146,60,0.15)" : "rgba(234,88,12,0.10)",
                fill: true, tension: 0.35, pointRadius: 2, yAxisID: "y", borderWidth: 2.5 },
            ],
          }}
          options={{
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { labels: { color: label } },
              tooltip: {
                callbacks: {
                  label: (c) => c.dataset.label === "ADR"
                    ? ` ADR: ${fmt(Math.round(Number(c.raw)))}` : ` Rooms: ${Number(c.raw).toLocaleString()}`,
                },
              },
            },
            scales: {
              x: { ticks: { color: tick, maxRotation: 0, font: { size: 10 } }, grid: { display: false } },
              y: { position: "left", ticks: { color: accent2, callback: (v) => fmt(Number(v)) }, grid: { color: grid } },
              y1: { position: "right", beginAtZero: true, ticks: { color: tick, callback: (v) => Number(v).toLocaleString() }, grid: { display: false } },
            },
          }}
        />
      </div>
    </div>
  );
}
