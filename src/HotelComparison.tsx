import { useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import type { HotelAgg } from "./aggregate.ts";
import { HOTEL_INVENTORY } from "./aggregate.ts";
import { fmt, fmtK } from "./format.ts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Metric = "revenue" | "revpar" | "occ" | "rooms" | "adr";
const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "revpar", label: "RevPAR" },
  { key: "occ", label: "Occupancy" },
  { key: "rooms", label: "Rooms Sold" },
  { key: "adr", label: "ADR" },
];

// shorten long hotel names for axis labels
const shortName = (n: string) =>
  n.replace(/ Hotel & Residence| Hotel and Residence| Serviced Suites| Hotel/gi, "").trim();

export function HotelComparison({
  hotels,
  nights,
  dark,
  selectedName,
  onSelect,
}: {
  hotels: HotelAgg[];
  nights: number; // number of days in the selected date range (available room-nights = inventory × nights)
  dark: boolean;
  selectedName?: string;
  onSelect: (name: string) => void;
}) {
  const [metric, setMetric] = useState<Metric>("revpar");

  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const accent = dark ? "#fb923c" : "#ea580c";
  const muted = dark ? "#475569" : "#cbd5e1";

  // available room-nights for a hotel over the selected range
  const avail = (h: HotelAgg) => (HOTEL_INVENTORY[h.name] || 0) * nights;
  const revpar = (h: HotelAgg) => (avail(h) ? h.total_revenue / avail(h) : 0);
  const occ = (h: HotelAgg) => (avail(h) ? h.total_rooms / avail(h) : 0);

  const VALUE: Record<Metric, (h: HotelAgg) => number> = {
    revenue: (h) => h.total_revenue,
    revpar,
    occ,
    rooms: (h) => h.total_rooms,
    adr: (h) => h.adr,
  };

  const fmtVal = (m: Metric, v: number) =>
    m === "revenue" ? fmtK(v)
      : m === "rooms" ? v.toLocaleString()
        : m === "occ" ? (v * 100).toFixed(1) + "%"
          : fmt(Math.round(v)); // adr, revpar

  const ranked = [...hotels].sort((a, b) => VALUE[metric](b) - VALUE[metric](a));
  const values = ranked.map((h) => VALUE[metric](h));
  const max = values[0] || 1;
  const leader = ranked[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Hotel Comparison — who sells best
        </h4>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                (metric === m.key
                  ? "bg-orange-600 text-white dark:bg-orange-500"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        Leader: <b className="text-orange-600 dark:text-orange-400">{leader?.name}</b>{" "}
        ({fmtVal(metric, VALUE[metric](leader))})
        {(metric === "revpar" || metric === "occ") && <> · over {nights} night{nights > 1 ? "s" : ""} · reflects current segment filter</>}
        {" "}· click a bar to drill in
      </p>
      <div className="relative h-[300px]">
        <Bar
          data={{
            labels: ranked.map((h) => shortName(h.name)),
            datasets: [{
              data: values,
              backgroundColor: ranked.map((h, i) =>
                selectedName ? (h.name === selectedName ? accent : muted) : (values[i] === max ? accent : muted)),
              borderRadius: 7,
              maxBarThickness: 40,
            }],
          }}
          options={{
            indexAxis: "y",
            maintainAspectRatio: false,
            onClick: (_e, els) => {
              if (els.length) onSelect(ranked[els[0].index].name);
            },
            onHover: (e, els) => {
              const t = e.native?.target as HTMLElement | undefined;
              if (t) t.style.cursor = els.length ? "pointer" : "default";
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (c) => {
                    const h = ranked[c.dataIndex];
                    return [
                      ` Revenue: ${fmt(h.total_revenue)}`,
                      ` RevPAR: ${fmt(Math.round(revpar(h)))}   Occ: ${(occ(h) * 100).toFixed(1)}%`,
                      ` Rooms: ${h.total_rooms.toLocaleString()}   ADR: ${fmt(h.adr)}`,
                      ` Inventory: ${HOTEL_INVENTORY[h.name] ?? "?"} rooms × ${nights} nights`,
                    ];
                  },
                },
              },
            },
            scales: {
              x: { ticks: { color: tick, callback: (v) => fmtVal(metric, Number(v)) }, grid: { color: grid } },
              y: { ticks: { color: label, font: { weight: 600 } }, grid: { display: false } },
            },
          }}
        />
      </div>
    </div>
  );
}
