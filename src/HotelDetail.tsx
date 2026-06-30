import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import type { HotelAgg } from "./aggregate.ts";
import { fmt, fmtK, PROMO_COLORS } from "./format.ts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export function HotelDetail({ hotel, dark }: { hotel: HotelAgg; dark: boolean }) {
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const accent2 = dark ? "#fb923c" : "#ea580c";
  const promos = hotel.promos;
  const maxRev = promos[0]?.revenue ?? 0;

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
          <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Revenue by Promotion</h4>
          <p className="mb-2.5 text-[11px] text-slate-400">Sorted high → low — orange bar is the top earner</p>
          <div className="relative h-75">
            <Bar
              data={{
                labels: promos.map((p) => p.plan),
                datasets: [{
                  data: promos.map((p) => p.revenue),
                  backgroundColor: promos.map((p) =>
                    p.revenue === maxRev ? accent2 : (PROMO_COLORS[p.plan] || "#94a3b8") + "cc"),
                  borderRadius: 7, maxBarThickness: 46,
                }],
              }}
              options={{
                indexAxis: "y", maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (c) => {
                        const p = promos[c.dataIndex];
                        return [` Revenue: ${fmt(p.revenue)}`, ` Rooms: ${p.rooms}  ADR: ${fmt(p.adr)}`];
                      },
                    },
                  },
                },
                scales: {
                  x: { ticks: { color: tick, callback: (v) => fmtK(Number(v)) }, grid: { color: grid } },
                  y: { ticks: { color: label, font: { weight: 600 } }, grid: { display: false } },
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
