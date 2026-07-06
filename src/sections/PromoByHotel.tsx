import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from "chart.js";
import type { HotelAgg } from "../data/aggregate.ts";
import { fmt, fmtK } from "../data/format.ts";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// shorten long hotel names for axis labels
const shortName = (n: string) =>
  n.replace(/ Hotel & Residence| Hotel and Residence| Serviced Suites| Hotel/gi, "").trim();

// distinct line colors (orange accent first — it leads the palette)
const PALETTE = [
  "#ea580c", "#2563eb", "#16a34a", "#9333ea", "#db2777",
  "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#0d9488",
];

export function PromoByHotel({
  hotels,
  dark,
  onSelect,
}: {
  hotels: HotelAgg[];
  dark: boolean;
  onSelect: (name: string) => void;
}) {
  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";

  // promos worth plotting = those that are the #1 promo for at least one hotel
  const promoNames = [...new Set(hotels.map((h) => h.best_promo))].filter((p) => p && p !== "—");

  // revenue lookup: hotel × promo
  const revOf = (h: HotelAgg, plan: string) =>
    h.promos.find((p) => p.plan === plan)?.revenue ?? 0;

  const datasets = promoNames.map((plan, i) => {
    const color = PALETTE[i % PALETTE.length];
    return {
      label: plan,
      data: hotels.map((h) => revOf(h, plan)),
      borderColor: color,
      backgroundColor: color,
      // enlarge the marker where this promo is the hotel's own #1 (the "winner")
      pointRadius: hotels.map((h) => (h.best_promo === plan ? 6 : 3)),
      pointHoverRadius: hotels.map((h) => (h.best_promo === plan ? 8 : 5)),
      borderWidth: 2,
      tension: 0.3,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Top promotion by hotel — which promo each hotel sells best
        </h4>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        Each line is a promotion · the enlarged dot marks each hotel's #1 promo · click a point to drill in
      </p>
      <div className="relative h-[340px]">
        <Line
          data={{ labels: hotels.map((h) => shortName(h.name)), datasets }}
          options={{
            maintainAspectRatio: false,
            interaction: { mode: "nearest", intersect: true },
            onClick: (_e, els) => {
              if (els.length) onSelect(hotels[els[0].index].name);
            },
            onHover: (e, els) => {
              const t = e.native?.target as HTMLElement | undefined;
              if (t) t.style.cursor = els.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: label, usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  title: (items) => hotels[items[0].dataIndex].name,
                  label: (c) => {
                    const h = hotels[c.dataIndex];
                    const plan = c.dataset.label ?? "";
                    const rev = Number(c.raw) || 0;
                    const share = h.total_revenue ? ((rev / h.total_revenue) * 100).toFixed(1) : "0";
                    const win = h.best_promo === plan ? "  ★ best" : "";
                    return ` ${plan}: ${fmt(rev)} (${share}%)${win}`;
                  },
                },
              },
            },
            scales: {
              x: { ticks: { color: label, font: { weight: 600 } }, grid: { display: false } },
              y: {
                beginAtZero: true,
                ticks: { color: tick, callback: (v) => fmtK(Number(v)) },
                grid: { color: grid },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
