import datasetJson from "./dataset.json";

export type Dataset = {
  generated: string;
  hotels: string[];
  segments: string[];
  plans: string[];
  channels: string[];
  dates: string[];
  roomTypes?: string[]; // optional: index space for roomTypeIdx (column 7)
  boards?: string[];    // optional: index space for boardIdx (column 8) — RB / RO / —
  // [hotelIdx, segIdx, planIdx, chanIdx, dateIdx, rooms, revenue, roomTypeIdx?, boardIdx?]
  // roomTypeIdx then boardIdx are appended last so existing column indices stay stable.
  rows: number[][];
};

export const dataset = datasetJson as Dataset;

/** Room inventory (sellable rooms) per hotel — used for RevPAR & occupancy. */
export const HOTEL_INVENTORY: Record<string, number> = {
  "Altera Hotel & Residence Pattaya": 189,
  "Arbour Hotel and Residence": 224,
  "Arden Hotel & Residence Pattaya": 141,
  "Aster Hotel & Residence Pattaya": 110,
  "Hotel Amber Pattaya": 222,
  "Hotel Amber Sukhumvit 85": 142,
  "The Grass Serviced Suites": 280,
};

export type Promo = { plan: string; revenue: number; rooms: number; adr: number };
export type Channel = { channel: string; revenue: number; rooms: number };
export type TrendPt = { date: string; revenue: number; rooms: number };
export type HotelAgg = {
  name: string;
  total_revenue: number;
  total_rooms: number;
  adr: number;
  best_promo: string;
  best_promo_rev: number;
  best_promo_share: number;
  promos: Promo[];
  channels: Channel[];
  trend: TrendPt[];
};

const H = 0, S = 1, P = 2, C = 3, D = 4, ROOMS = 5, REV = 6;

export type Filters = {
  segments: Set<string>;
  startIdx: number; // inclusive index into dataset.dates
  endIdx: number; // inclusive
};

/** Aggregate all rows that match the active segment + date-range filters, per hotel. */
export function aggregate(ds: Dataset, f: Filters): HotelAgg[] {
  const segIdxSet = new Set(
    [...f.segments].map((s) => ds.segments.indexOf(s)).filter((i) => i >= 0),
  );

  // per hotel accumulators
  const acc = ds.hotels.map(() => ({
    rev: 0,
    rooms: 0,
    promo: new Map<number, { rev: number; rooms: number }>(),
    chan: new Map<number, { rev: number; rooms: number }>(),
    day: new Map<number, { rev: number; rooms: number }>(),
  }));

  for (const r of ds.rows) {
    if (!segIdxSet.has(r[S])) continue;
    if (r[D] < f.startIdx || r[D] > f.endIdx) continue;
    const a = acc[r[H]];
    a.rev += r[REV];
    a.rooms += r[ROOMS];
    bump(a.promo, r[P], r[REV], r[ROOMS]);
    bump(a.chan, r[C], r[REV], r[ROOMS]);
    bump(a.day, r[D], r[REV], r[ROOMS]);
  }

  return ds.hotels.map((name, hi) => {
    const a = acc[hi];
    const promos: Promo[] = [...a.promo.entries()]
      .map(([pi, v]) => ({
        plan: ds.plans[pi],
        revenue: v.rev,
        rooms: v.rooms,
        adr: v.rooms ? Math.round(v.rev / v.rooms) : 0,
      }))
      .sort((x, y) => y.revenue - x.revenue);

    const channels: Channel[] = [...a.chan.entries()]
      .map(([ci, v]) => ({ channel: ds.channels[ci], revenue: v.rev, rooms: v.rooms }))
      .sort((x, y) => y.revenue - x.revenue);

    const trend: TrendPt[] = [...a.day.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([di, v]) => ({ date: ds.dates[di], revenue: v.rev, rooms: v.rooms }));

    const best = promos[0] ?? { plan: "—", revenue: 0, rooms: 0, adr: 0 };
    return {
      name,
      total_revenue: a.rev,
      total_rooms: a.rooms,
      adr: a.rooms ? Math.round(a.rev / a.rooms) : 0,
      best_promo: best.plan,
      best_promo_rev: best.revenue,
      best_promo_share: a.rev ? Math.round((best.revenue / a.rev) * 1000) / 10 : 0,
      promos,
      channels,
      trend,
    };
  });
}

function bump(m: Map<number, { rev: number; rooms: number }>, k: number, rev: number, rooms: number) {
  const cur = m.get(k);
  if (cur) { cur.rev += rev; cur.rooms += rooms; }
  else m.set(k, { rev, rooms });
}
