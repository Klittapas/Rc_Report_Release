import { useMemo, useState } from "react";
import type { Dataset } from "./aggregate.ts";
import { fmt, fmtK } from "./format.ts";

const H = 0, S = 1, P = 2, C = 3, D = 4, ROOMS = 5, REV = 6, RT = 7;
const ALL_ROOMS = "All room types";

export function ChannelPromoHeatmap({
  dataset,
  segments,
  startIdx,
  endIdx,
  dark,
}: {
  dataset: Dataset;
  segments: Set<string>;
  startIdx: number;
  endIdx: number;
  dark: boolean;
}) {
  const [metric, setMetric] = useState<"revenue" | "rooms">("revenue");
  const [hotel, setHotel] = useState<string>("All hotels");
  const [room, setRoom] = useState<string>(ALL_ROOMS);
  const colIdx = metric === "revenue" ? REV : ROOMS;
  const hotelIdx = dataset.hotels.indexOf(hotel); // -1 when "All hotels"
  const roomTypes = dataset.roomTypes ?? [];
  const hasRooms = roomTypes.length > 0;

  // room codes available for the current hotel filter (drives the dropdown)
  const roomOptions = useMemo(() => {
    if (!hasRooms) return [];
    const set = new Set<string>();
    for (const r of dataset.rows) {
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      const code = roomTypes[r[RT]];
      if (code && code !== "—") set.add(code);
    }
    return [...set].sort();
  }, [dataset, hotelIdx, hasRooms]);

  // selected room is only applied when it still exists for the chosen hotel
  const roomActive = room !== ALL_ROOMS && roomOptions.includes(room);
  const roomIdx = roomActive ? roomTypes.indexOf(room) : -1;

  const { rows, cols, cell, chanTotal, planTotal, maxCell, grand, top } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const cell = new Map<string, number>(); // `${c}|${p}` -> value
    const chanTotal = new Map<number, number>();
    const planTotal = new Map<number, number>();
    let grand = 0;
    let maxCell = 0;
    let top = { c: -1, p: -1, v: 0 };

    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (roomIdx >= 0 && r[RT] !== roomIdx) continue;
      const v = r[colIdx];
      const key = r[C] + "|" + r[P];
      const nv = (cell.get(key) || 0) + v;
      cell.set(key, nv);
      chanTotal.set(r[C], (chanTotal.get(r[C]) || 0) + v);
      planTotal.set(r[P], (planTotal.get(r[P]) || 0) + v);
      grand += v;
      if (nv > maxCell) maxCell = nv;
      if (nv > top.v) top = { c: r[C], p: r[P], v: nv };
    }

    // channels (rows) and promos (cols) that have data, biggest first
    const rows = [...chanTotal.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const cols = [...planTotal.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    return { rows, cols, cell, chanTotal, planTotal, maxCell, grand, top };
  }, [dataset, segments, startIdx, endIdx, colIdx, hotelIdx, roomIdx]);

  const fmtVal = (v: number) => (metric === "revenue" ? fmtK(v) : v.toLocaleString());
  const fmtFull = (v: number) => (metric === "revenue" ? fmt(v) : v.toLocaleString() + " rooms");
  const fmtTotal = (v: number) => (metric === "revenue" ? fmt(v) : v.toLocaleString()); // exact integer, no K/M

  // orange intensity; sqrt so mid values stay visible
  const bg = (v: number) => {
    if (v <= 0) return "transparent";
    const t = Math.sqrt(v / (maxCell || 1));
    return dark
      ? `rgba(249,115,22,${(0.12 + 0.78 * t).toFixed(3)})`
      : `rgba(234,88,12,${(0.08 + 0.82 * t).toFixed(3)})`;
  };
  const txt = (v: number) => {
    const t = v > 0 ? Math.sqrt(v / (maxCell || 1)) : 0;
    if (v <= 0) return dark ? "#475569" : "#cbd5e1";
    return t > 0.55 ? "#fff" : dark ? "#e2e8f0" : "#334155";
  };

  const headCls = "px-2 py-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Channel × Promotion — which OTA drives which promo
        </h4>
        <div className="flex items-center gap-2">
          <select
            value={hotel}
            onChange={(e) => setHotel(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option>All hotels</option>
            {dataset.hotels.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          {hasRooms && (
            <select
              value={roomActive ? room : ALL_ROOMS}
              onChange={(e) => setRoom(e.target.value)}
              title="Filter by room type code"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option>{ALL_ROOMS}</option>
              {roomOptions.map((rc) => <option key={rc} value={rc}>{rc.toUpperCase()}</option>)}
            </select>
          )}
          <div className="flex gap-1">
            {(["revenue", "rooms"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                  (metric === m
                    ? "bg-orange-600 text-white dark:bg-orange-500"
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
        {top.c >= 0 ? (
          <>
            Hottest: <b className="text-orange-600 dark:text-orange-400">
              {dataset.plans[top.p]} via {dataset.channels[top.c]}
            </b>{" "}
            ({fmtFull(top.v)}) · darker = more {metric}
            {roomActive && <> · room <b className="text-slate-500 dark:text-slate-300">{room.toUpperCase()}</b></>}
            {" "}· reflects segment + date filters
          </>
        ) : (
          <>No data for this filter</>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-right">
          <thead>
            <tr>
              <th className={"sticky left-0 z-10 bg-white text-left dark:bg-slate-900 " + headCls}>
                Channel
              </th>
              {cols.map((p) => (
                <th key={p} className={headCls + " whitespace-nowrap"}>
                  {dataset.plans[p]}
                </th>
              ))}
              <th className={headCls + " border-l border-slate-200 dark:border-slate-700"}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c}>
                <td className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11.5px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200 whitespace-nowrap">
                  {dataset.channels[c]}
                </td>
                {cols.map((p) => {
                  const v = cell.get(c + "|" + p) || 0;
                  return (
                    <td
                      key={p}
                      title={`${dataset.channels[c]} · ${dataset.plans[p]}: ${fmtFull(v)}`}
                      className="px-2 py-1 text-[11px] font-semibold tabular-nums"
                      style={{ backgroundColor: bg(v), color: txt(v) }}
                    >
                      {v > 0 ? fmtVal(v) : "·"}
                    </td>
                  );
                })}
                <td className="border-l border-slate-200 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {fmtTotal(chanTotal.get(c) || 0)}
                </td>
              </tr>
            ))}
            {/* column totals */}
            <tr>
              <td className="sticky left-0 z-10 border-t border-slate-200 bg-white px-2 py-1 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                Total
              </td>
              {cols.map((p) => (
                <td key={p} className="border-t border-slate-200 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {fmtTotal(planTotal.get(p) || 0)}
                </td>
              ))}
              <td className="border-l border-t border-slate-200 px-2 py-1 text-[11px] font-extrabold tabular-nums text-orange-600 dark:border-slate-700 dark:text-orange-400 whitespace-nowrap">
                {fmtTotal(grand)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
