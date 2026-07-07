import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import type { Plugin } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Dataset } from "../data/aggregate.ts";
import { fmt, fmtK, PROMO_COLORS, CHANNEL_PALETTE } from "../data/format.ts";
import { Dropdown } from "../ui/Dropdown.tsx";
import { MultiSelect } from "../ui/MultiSelect.tsx";

const ALL_CHAN = "All channels";
const ALL_PROMO = "All promos";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const H = 0, S = 1, P = 2, C = 3, D = 4, ROOMS = 5, REV = 6;
const DEFAULT_SHOWN = 4; 
const BAR_THICK = 40; 
const OTHER_COLOR = "#94a3b8"; 

const weekOf = (iso: string) => {
  const y = parseInt(iso.slice(0, 4), 10);
  const mo = parseInt(iso.slice(5, 7), 10);
  const da = parseInt(iso.slice(8, 10), 10);
  const jan1 = Date.UTC(y, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(y, mo - 1, da) - jan1) / 86400000); 
  const jan1Dow = new Date(jan1).getUTCDay(); 
  return Math.floor((dayOfYear + jan1Dow) / 7) + 1;
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
  const [pickedByDim, setPickedByDim] = useState<{ promo: string[]; channel: string[] }>({ promo: [], channel: [] });
  const [chanF, setChanF] = useState<string>(ALL_CHAN);
  const [promoF, setPromoF] = useState<string>(ALL_PROMO);
  const colIdx = metric === "revenue" ? REV : ROOMS;
  const dimIdx = dim === "promo" ? P : C;
  const names = dim === "promo" ? dataset.plans : dataset.channels;

  const colorFor = (name: string) =>
    dim === "promo"
      ? PROMO_COLORS[name] ?? OTHER_COLOR
      : CHANNEL_PALETTE[Math.max(0, dataset.channels.indexOf(name)) % CHANNEL_PALETTE.length];
  
  const hotelIdx = dataset.hotels.indexOf(hotel); 
  const chanFIdx = chanF === ALL_CHAN ? -1 : dataset.channels.indexOf(chanF);
  const promoFIdx = promoF === ALL_PROMO ? -1 : dataset.plans.indexOf(promoF);

  const { chanOptions, promoOptions } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const chSet = new Set<number>();
    const prSet = new Set<number>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (promoFIdx < 0 || r[P] === promoFIdx) chSet.add(r[C]); 
      if (chanFIdx < 0 || r[C] === chanFIdx) prSet.add(r[P]);   
    }
    const chans = dataset.channels.filter((_, i) => chSet.has(i));
    const promos = dataset.plans.filter((_, i) => prSet.has(i));
    if (chanF !== ALL_CHAN && !chans.includes(chanF)) chans.push(chanF);
    if (promoF !== ALL_PROMO && !promos.includes(promoF)) promos.push(promoF);
    return { chanOptions: [ALL_CHAN, ...chans], promoOptions: [ALL_PROMO, ...promos] };
  }, [dataset, segments, startIdx, endIdx, hotelIdx, chanFIdx, promoFIdx, chanF, promoF]);

  const universe = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const total = new Map<number, number>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (chanFIdx >= 0 && r[C] !== chanFIdx) continue;
      if (promoFIdx >= 0 && r[P] !== promoFIdx) continue;
      total.set(r[dimIdx], (total.get(r[dimIdx]) || 0) + r[colIdx]);
    }
    return [...total.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([i]) => names[i]);
  }, [dataset, segments, startIdx, endIdx, colIdx, dimIdx, hotelIdx, chanFIdx, promoFIdx, names]);

  const pickedNames = pickedByDim[dim];
  const chosen = pickedNames.length ? pickedNames.filter((n) => universe.includes(n)) : universe.slice(0, DEFAULT_SHOWN);
  const chosenKey = chosen.join("|");
  const isCustom = pickedNames.length > 0;

  // 🚀 จุดที่ปรับปรุง: จำกัดให้เลือกได้สูงสุด 7 อัน
  const togglePick = (name: string) =>
    setPickedByDim((prev) => {
      const base = prev[dim].length ? prev[dim] : universe.slice(0, DEFAULT_SHOWN);
      const isAlreadyPicked = base.includes(name);
      
      // ถ้าแตะเพื่อเอาออก -> ยอมให้ทำได้เสมอ
      if (isAlreadyPicked) {
        return { ...prev, [dim]: base.filter((n) => n !== name) };
      }
      
      // ถ้าแตะเพื่อเพิ่มอันใหม่ -> ต้องเช็คก่อนว่าครบ 7 หรือยัง
      if (base.length >= 7) {
        return prev; // เกิน 7 อันแล้ว ไม่ยอมให้อัปเดตสเตต (กดเพิ่มไม่ได้)
      }
      
      return { ...prev, [dim]: [...base, name] };
    });

  const { weeks, series, otherItems } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const byWeek = new Map<number, Map<number, number>>();
    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (chanFIdx >= 0 && r[C] !== chanFIdx) continue;
      if (promoFIdx >= 0 && r[P] !== promoFIdx) continue;
      const wk = weekOf(dataset.dates[r[D]]);
      let m = byWeek.get(wk);
      if (!m) { m = new Map(); byWeek.set(wk, m); }
      m.set(r[dimIdx], (m.get(r[dimIdx]) || 0) + r[colIdx]);
    }
    const weekKeys = [...byWeek.keys()].sort((a, b) => a - b);
    const topItems = chosen.map((n) => names.indexOf(n)).filter((i) => i >= 0);
    const topSet = new Set(topItems);
    
    const otherData = weekKeys.map((wk) => {
      let sum = 0;
      for (const [ii, v] of byWeek.get(wk)!) if (!topSet.has(ii)) sum += v;
      return sum;
    });
    const hasOther = otherData.some((v) => v !== 0);
    const series = topItems.map((ii) => ({
      label: names[ii],
      color: colorFor(names[ii]),
      data: weekKeys.map((wk) => byWeek.get(wk)!.get(ii) || 0),
    }));
    if (hasOther) series.push({ label: "Other", color: OTHER_COLOR, data: otherData });

    const otherItems = weekKeys.map((wk) => {
      const list: { label: string; value: number }[] = [];
      for (const [ii, v] of byWeek.get(wk)!) if (!topSet.has(ii) && v !== 0) list.push({ label: names[ii], value: v });
      return list.sort((a, b) => b.value - a.value);
    });
    return { weeks: weekKeys.map((w) => `Week ${w}`), series, otherItems };
  }, [dataset, segments, startIdx, endIdx, colIdx, dimIdx, hotelIdx, chanFIdx, promoFIdx, chosenKey, names]);

  const tick = dark ? "#94a3b8" : "#64748b";
  const label = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
  const surface = dark ? "#0f172a" : "#ffffff"; 
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
          <div className="border-l border-slate-200 pl-2 dark:border-slate-700">
            <MultiSelect
              options={universe}
              selected={new Set(chosen)}
              onToggle={togglePick}
              minWidth={150}
              ariaLabel={`Pick which ${dim === "promo" ? "promotions" : "channels"} to show`}
              label={`Show ${dim === "promo" ? "promotions" : "channels"}`}
              triggerText={`Showing ${chosen.length}`}
            />
          </div>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        {isCustom ? "Your picks" : `Top ${chosen.length}`} {dim === "promo" ? "promos" : "channels"} + Other · tick any to choose · max 7 items · stacked per week · calendar week-of-year (Power BI WEEKNUM, weeks start Sunday)
      </p>
      
      <div className="relative h-[500px]">
        <Bar
          plugins={[ChartDataLabels as Plugin<"bar">]}
          data={{
            labels: weeks,
            datasets: series.map((s, i) => {
              const R = BAR_THICK / 2, last = series.length - 1; 
              const radius = series.length === 1
                ? R
                : i === 0 ? { bottomLeft: R, bottomRight: R, topLeft: 0, topRight: 0 }
                  : i === last ? { topLeft: R, topRight: R, bottomLeft: 0, bottomRight: 0 }
                    : 0;
              return {
                label: s.label,
                data: s.data,
                backgroundColor: s.color,
                borderColor: surface,
                borderWidth: { top: 2, bottom: 2, left: 0, right: 0 }, 
                borderRadius: radius,
                borderSkipped: false,
                maxBarThickness: BAR_THICK,
                stack: "w",
              };
            }),
          }}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "top", align: "start", labels: { color: label, usePointStyle: true, boxWidth: 8, font: { size: 11.5, weight: 600 }, padding: 14 } },
              tooltip: {
                callbacks: {
                  label: (c) => {
                    const f = (v: number) => (metric === "revenue" ? fmt(v) : v.toLocaleString());
                    const base = ` ${c.dataset.label}: ${f(Number(c.raw))}`;
                    if (c.dataset.label !== "Other") return base;
                    const items = otherItems[c.dataIndex] ?? [];
                    const shown = items.slice(0, 8).map((it) => `   • ${it.label}: ${f(it.value)}`);
                    if (items.length > 8) shown.push(`   +${items.length - 8} more`);
                    return [base, ...shown];
                  },
                },
              },
              datalabels: {
                anchor: "center",
                align: "center",
                color: "#fff",
                font: { size: 9.5, weight: 700 },
                display: (ctx) => {
                  const v = Number(ctx.dataset.data[ctx.dataIndex]) || 0;
                  if (v <= 0) return false;
                  const y = ctx.chart.scales.y;
                  return Math.abs(y.getPixelForValue(0) - y.getPixelForValue(v)) >= 12;
                },
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