import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Dataset } from "../data/aggregate.ts";
import { fmt, fmtK } from "../data/format.ts";
import { Dropdown } from "../ui/Dropdown.tsx";

const H = 0, S = 1, P = 2, C = 3, D = 4, ROOMS = 5, REV = 6, RT = 7;
const ALL_ROOMS = "All room types";
const ALL_CHANNELS = "All channels";
type RR = { rev: number; rooms: number }; // revenue + rooms kept per cell so ADR (rev/rooms) is derivable

export function ChannelPromoHeatmap({
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
  const [metric, setMetric] = useState<"revenue" | "rooms" | "adr">("revenue");
  const [tip, setTip] = useState<{ x: number; y: number; place: "above" | "below"; text: string } | null>(null);
  // anchor the tooltip to the hovered cell (centered, caret pointing at it), flipping below near the top edge
  const showTip = (e: ReactMouseEvent<HTMLTableCellElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    const above = r.top > 78; // enough room above? else flip below
    setTip({ x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, place: above ? "above" : "below", text });
  };
  const [room, setRoom] = useState<string>(ALL_ROOMS);
  const [rowDim, setRowDim] = useState<"channel" | "room">("channel");
  const [colDim, setColDim] = useState<"promo" | "room">("promo");
  const [chan, setChan] = useState<string>(ALL_CHANNELS);
  const hotelIdx = dataset.hotels.indexOf(hotel); // follows top hotel selection
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

  // channel codes present for the current hotel filter (drives the channel dropdown)
  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dataset.rows) {
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      set.add(dataset.channels[r[C]]);
    }
    return [...set].sort();
  }, [dataset, hotelIdx]);

  // selected room is only applied when it still exists for the chosen hotel
  // (never when room type is an axis — the axis already splits by room)
  const roomActive = rowDim === "channel" && colDim !== "room" && room !== ALL_ROOMS && roomOptions.includes(room);
  const roomIdx = roomActive ? roomTypes.indexOf(room) : -1;

  // channel filter drills into one OTA (e.g. "Agoda sells which room on which promo").
  // never applied while channel is the row axis — the axis already splits by channel.
  const chanActive = rowDim === "room" && chan !== ALL_CHANNELS && channelOptions.includes(chan);
  const chanIdx = chanActive ? dataset.channels.indexOf(chan) : -1;

  // row axis is switchable: channel/segment hybrid or room type code
  const byRoom = rowDim === "room" && hasRooms;
  // col axis is switchable: promotion (default) or room type code
  const byColRoom = colDim === "room" && hasRooms;
  // row and col can't both be room type — guarded in the toggle handlers
  // hybrid rows: OTA-segment bookings split by rate-code channel; everything else
  // groups under its market segment (rate-code channels are only reliable for OTA)
  const otaSegIdx = dataset.segments.indexOf("OTA");
  // rate-code channels that are NOT real OTAs — when these show up inside the OTA
  // segment it's a miscoded booking, so flag the row as "OTA · <channel>"
  const NON_OTA_CHANNELS = new Set(["Direct", "Internal", "Corporate", "UNKNOWN_REVIEW"]);
  // row keys are strings: "c<idx>" = channel, "o<idx>" = OTA-segment w/ non-OTA code,
  // "s<idx>" = segment, "r<idx>" = room type
  const rowLabel = (k: string) => {
    const i = Number(k.slice(1));
    if (k[0] === "c") return dataset.channels[i];
    if (k[0] === "o") return "OTA · " + dataset.channels[i] + " code";
    if (k[0] === "s") return dataset.segments[i];
    return (roomTypes[i] || "").toUpperCase();
  };
  // the market segment a row rolls up to — shown on hover so a channel row
  // (Agoda) reads as "OTA", a room-type row as "Room type"
  const rowSegment = (k: string) => {
    if (k[0] === "c" || k[0] === "o") return "OTA";
    if (k[0] === "s") return dataset.segments[Number(k.slice(1))];
    return "Room type";
  };
  // column label: promotion name, or room-type code when the col axis is room type
  const colLabel = (i: number) => (byColRoom ? (roomTypes[i] || "").toUpperCase() : dataset.plans[i]);

  // display value for the active metric; ADR = weighted rev/rooms so it works for
  // cells AND totals (a total's ADR is its own revenue over its own rooms, not a sum)
  const cellVal = (rr?: RR): number =>
    !rr ? 0 : metric === "revenue" ? rr.rev : metric === "rooms" ? rr.rooms : rr.rooms ? Math.round(rr.rev / rr.rooms) : 0;

  const { rows, cols, cell, rowTotal, planTotal, maxCell, grand, top } = useMemo(() => {
    const segIdx = new Set([...segments].map((s) => dataset.segments.indexOf(s)).filter((i) => i >= 0));
    const cell = new Map<string, RR>(); // `${rowKey}|${col}` -> { rev, rooms }
    const rowTotal = new Map<string, RR>();
    const planTotal = new Map<number, RR>();
    const grand: RR = { rev: 0, rooms: 0 };
    const add = (m: Map<string | number, RR>, k: string | number, rev: number, rooms: number) => {
      const c = m.get(k);
      if (c) { c.rev += rev; c.rooms += rooms; } else m.set(k, { rev, rooms });
    };

    for (const r of dataset.rows) {
      if (!segIdx.has(r[S]) || r[D] < startIdx || r[D] > endIdx) continue;
      if (hotelIdx >= 0 && r[H] !== hotelIdx) continue;
      if (roomIdx >= 0 && r[RT] !== roomIdx) continue;
      if (chanIdx >= 0 && r[C] !== chanIdx) continue;
      const rev = r[REV], rooms = r[ROOMS];
      const rk = byRoom
        ? "r" + r[RT]
        : r[S] === otaSegIdx
          ? (NON_OTA_CHANNELS.has(dataset.channels[r[C]]) ? "o" : "c") + r[C]
          : "s" + r[S];
      const ck = byColRoom ? r[RT] : r[P];
      add(cell as Map<string | number, RR>, rk + "|" + ck, rev, rooms);
      add(rowTotal as Map<string | number, RR>, rk, rev, rooms);
      add(planTotal as Map<string | number, RR>, ck, rev, rooms);
      grand.rev += rev; grand.rooms += rooms;
    }

    // color scale + hottest cell measured on the active metric's display value
    let maxCell = 0;
    let top = { c: "", p: -1, v: 0 };
    for (const [k, rr] of cell) {
      const dv = cellVal(rr);
      if (dv > maxCell) maxCell = dv;
      if (dv > top.v) { const bar = k.indexOf("|"); top = { c: k.slice(0, bar), p: Number(k.slice(bar + 1)), v: dv }; }
    }

    // order rows/cols by revenue magnitude (stable when toggling metric); drop fully-empty
    // (net 0 rev + 0 rooms) but keep net-negative (cancellations outweigh bookings)
    const nonEmpty = (rr: RR) => rr.rev !== 0 || rr.rooms !== 0;
    const rows = [...rowTotal.entries()].filter(([, rr]) => nonEmpty(rr)).sort((a, b) => b[1].rev - a[1].rev).map((e) => e[0]);
    const cols = [...planTotal.entries()].filter(([, rr]) => nonEmpty(rr)).sort((a, b) => b[1].rev - a[1].rev).map((e) => e[0]);
    return { rows, cols, cell, rowTotal, planTotal, maxCell, grand, top };
  }, [dataset, segments, startIdx, endIdx, metric, hotelIdx, roomIdx, chanIdx, byRoom, byColRoom, otaSegIdx]);

  // revenue is big -> K/M; rooms are counts; ADR is a compact rate -> show exact baht
  const fmtVal = (v: number) => (metric === "revenue" ? fmtK(v) : metric === "rooms" ? v.toLocaleString() : fmt(v));
  const fmtFull = (v: number) =>
    metric === "rooms" ? v.toLocaleString() + " rooms" : metric === "adr" ? fmt(v) + " ADR" : fmt(v);
  const fmtTotal = (v: number) => (metric === "rooms" ? v.toLocaleString() : fmt(v)); // exact, no K/M
  // part B: always-on tooltip with the full breakdown regardless of active metric
  const cellTip = (rowLbl: string, colLbl: string, rr?: RR) => {
    const rooms = rr?.rooms ?? 0, rev = rr?.rev ?? 0;
    const adr = rooms ? Math.round(rev / rooms) : 0;
    return `${rowLbl} · ${colLbl}: ${rooms.toLocaleString()} rooms · ${fmt(rev)} · ADR ${fmt(adr)}`;
  };

  // orange intensity; sqrt so mid values stay visible
  const bg = (v: number) => {
    if (v <= 0) return "transparent";
    const t = Math.sqrt(v / (maxCell || 1));
    return dark
      ? `rgba(249,115,22,${(0.12 + 0.78 * t).toFixed(3)})`
      : `rgba(234,88,12,${(0.08 + 0.82 * t).toFixed(3)})`;
  };
  const txt = (v: number) => {
    if (v < 0) return dark ? "#f87171" : "#dc2626";
    const t = v > 0 ? Math.sqrt(v / (maxCell || 1)) : 0;
    if (v <= 0) return dark ? "#475569" : "#cbd5e1";
    return t > 0.55 ? "#fff" : dark ? "#e2e8f0" : "#334155";
  };
  // totals go red when net-negative (cancellations outweigh bookings)
  const totStyle = (v: number) => (v < 0 ? { color: dark ? "#f87171" : "#dc2626" } : undefined);

  const headCls = "px-2 py-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h4 className="mb-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">
        {(byRoom ? "Room type" : "Channel") + " × " + (byColRoom ? "Room type" : "Promotion")}
        {chanActive && <span className="font-normal text-slate-400"> — {chan}: which room on which promo</span>}
        {!chanActive && byColRoom && !byRoom && <span className="font-normal text-slate-400"> — which room each channel sells</span>}
      </h4>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasRooms && (
            <div className="flex gap-1">
              {(["channel", "room"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setRowDim(d); if (d === "room" && colDim === "room") setColDim("promo"); }}
                  className={
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                    (rowDim === d
                      ? "bg-slate-700 text-white dark:bg-slate-600"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                  }
                >
                  {d === "channel" ? "By channel" : "By room type"}
                </button>
              ))}
            </div>
          )}
          {hasRooms && (
            <div className="flex gap-1">
              {(["promo", "room"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setColDim(d); if (d === "room" && rowDim === "room") setRowDim("channel"); }}
                  className={
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
                    (colDim === d
                      ? "bg-slate-700 text-white dark:bg-slate-600"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700")
                  }
                >
                  {d === "promo" ? "× Promo" : "× Room"}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            {(["revenue", "rooms", "adr"] as const).map((m) => (
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
                {m === "rooms" ? "Rooms" : m === "adr" ? "ADR" : "Revenue"}
              </button>
            ))}
          </div>
          {/* filter sits after the toggles (last item) so appearing/disappearing never shifts the buttons to its left */}
          {hasRooms && ((!byRoom && !byColRoom) || byRoom) && (
            <div className="ml-1 flex items-center border-l border-slate-200 pl-2 dark:border-slate-700">
              {!byRoom && !byColRoom && (
                <Dropdown
                  value={roomActive ? room : ALL_ROOMS}
                  options={[ALL_ROOMS, ...roomOptions]}
                  onChange={setRoom}
                  minWidth={132}
                  ariaLabel="Filter by room type code"
                  label="Room type"
                  format={(v) => (v === ALL_ROOMS ? v : v.toUpperCase())}
                />
              )}
              {byRoom && (
                <Dropdown
                  value={chanActive ? chan : ALL_CHANNELS}
                  options={[ALL_CHANNELS, ...channelOptions]}
                  onChange={setChan}
                  minWidth={132}
                  ariaLabel="Filter by channel"
                  label="Channel"
                />
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        {top.c !== "" ? (
          <>
            Hottest: <b className="text-orange-600 dark:text-orange-400">
              {colLabel(top.p)} {byColRoom ? "in" : byRoom ? "on" : "via"} {rowLabel(top.c)}
            </b>{" "}
            ({fmtFull(top.v)}) · darker = {metric === "adr" ? "higher ADR" : "more " + metric}
            {roomActive && <> · room <b className="text-slate-500 dark:text-slate-300">{room.toUpperCase()}</b></>}
            {chanActive && <> · channel <b className="text-slate-500 dark:text-slate-300">{chan}</b></>}
            {" "}· reflects segment + date filters
          </>
        ) : (
          <>No data for this filter</>
        )}
      </p>

      {/* keyed remount so the drill-in animation replays when either axis flips */}
      <div key={rowDim + colDim} className="drill-in overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-right">
          <thead>
            <tr>
              <th className={"sticky left-0 z-10 bg-white text-left dark:bg-slate-900 " + headCls}>
                {byRoom ? "Room type" : "Channel"}
              </th>
              {cols.map((p) => (
                <th key={p} className={headCls + " whitespace-nowrap"}>
                  {colLabel(p)}
                </th>
              ))}
              <th className={headCls + " border-l border-slate-200 dark:border-slate-700"}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c}>
                <td
                  title={`Segment: ${rowSegment(c)}`}
                  className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11.5px] font-semibold text-slate-700 whitespace-nowrap dark:bg-slate-900 dark:text-slate-200"
                >
                  {rowLabel(c)}
                </td>
                {cols.map((p) => {
                  const rr = cell.get(c + "|" + p);
                  const v = cellVal(rr);
                  return (
                    <td
                      key={p}
                      onMouseEnter={(e) => showTip(e, cellTip(rowLabel(c), colLabel(p), rr))}
                      onMouseLeave={() => setTip(null)}
                      className="hm-cell cursor-default px-2 py-1 text-[11px] font-semibold tabular-nums"
                      style={{ backgroundColor: bg(v), color: txt(v) }}
                    >
                      {v !== 0 ? fmtVal(v) : "·"}
                    </td>
                  );
                })}
                <td
                  className="border-l border-slate-200 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap"
                  style={totStyle(cellVal(rowTotal.get(c)))}
                >
                  {fmtTotal(cellVal(rowTotal.get(c)))}
                </td>
              </tr>
            ))}
            {/* column totals */}
            <tr>
              <td className="sticky left-0 z-10 border-t border-slate-200 bg-white px-2 py-1 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                Total
              </td>
              {cols.map((p) => (
                <td
                  key={p}
                  className="border-t border-slate-200 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap"
                  style={totStyle(cellVal(planTotal.get(p)))}
                >
                  {fmtTotal(cellVal(planTotal.get(p)))}
                </td>
              ))}
              <td
                className="border-l border-t border-slate-200 px-2 py-1 text-[11px] font-extrabold tabular-nums text-orange-600 dark:border-slate-700 dark:text-orange-400 whitespace-nowrap"
                style={totStyle(cellVal(grand))}
              >
                {fmtTotal(cellVal(grand))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {tip && (
        <div
          className={"hm-tip" + (tip.place === "below" ? " hm-tip--below" : "")}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
