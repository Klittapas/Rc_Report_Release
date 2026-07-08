/**
 * In-browser normalizer: parse a raw "ratecode" CSV export and build the same
 * compact Dataset the dashboard consumes (mirrors scripts/normalize_csv.py).
 *
 * Rate code = [channel:3][type:3][refund:1][board:1]  e.g.  bdc|mnm|n|r
 */
import type { Dataset } from "./aggregate.ts";

const CH_MAP: Record<string, string> = {
  ago: "Agoda", bdc: "Booking.com", bkg: "Booking.com", ctp: "Trip.com",
  exp: "Expedia", gbb: "Goibibo", hop: "Hopper", hws: "HWS Wholesale",
  khs: "Klook", tkt: "Tiket.com", trk: "Traveloka",
};
const TYPE_BASE: Record<string, string> = {
  pro: "Promotion", pos: "POS",
  mns: "Min Stay S", mnm: "Min Stay M", mnl: "Min Stay L",
  ebs: "Early Bird S", ebm: "Early Bird M", ebl: "Early Bird L",
};
const TYPE_SPLIT: Record<string, [string, string]> = {
  bar: ["BAR Flex", "BAR NRF"],
  bdr: ["Basic Deal Flex", "Basic Deal (NRF)"],
  pkg: ["Package Flex", "Package (NRF)"],
};

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function promoCategory(typ: string, refund: string): string {
  const split = TYPE_SPLIT[typ];
  if (split) return refund === "f" ? split[0] : split[1];
  return TYPE_BASE[typ] ?? "Open"; // unknown type (e.g. "old") -> Open
}

const EM = "—"; // em dash = board unknown / not applicable
// board = last char for 8-char codes: b -> RB (room+breakfast), r/o -> RO (room only)
const BOARD: Record<string, string> = { b: "RB", r: "RO", o: "RO" };
// refund = char[6] for 8-char codes: f -> Flex (refundable), n -> NRF (non-refundable)
const REFUND: Record<string, string> = { f: "Flex", n: "NRF" };

/** Board (RB / RO / —) for the special (non-8-char) code families, from their suffix. */
function boardOf(c: string): string {
  if (c === "oprb130" || c === "rmabf") return "RB";
  if (c === "rmonly" || c === "opro") return "RO";
  if (c.startsWith("open") || c.startsWith("comp")) return c.endsWith("b") ? "RB" : c.endsWith("o") || c.endsWith("r") ? "RO" : EM;
  return EM;
}

/** Raw code -> [Channel, Rate Plan, Board, Refund]. Refund (NRF/Flex/—) comes from char[6] of 8-char codes. */
function decode(code: string): [string, string, string, string] {
  const c = code.toLowerCase();
  if (c.startsWith("open") || ["oprb130", "rmabf", "rmonly", "opro"].includes(c)) return ["Direct", "Open", boardOf(c), EM];
  if (c.startsWith("hou") || c.startsWith("hsu") || c.startsWith("house")) return ["Internal", "House Use", EM, EM];
  if (c.startsWith("comp")) return ["Internal", "Complimentary", boardOf(c), EM];
  if (c.startsWith("corp")) return ["Corporate", "Corporate", EM, EM];
  if (c.length === 8) {
    const ch = CH_MAP[c.slice(0, 3)] ?? "UNKNOWN_REVIEW";
    return [ch, promoCategory(c.slice(3, 6), c[6]), BOARD[c[7]] ?? EM, REFUND[c[6]] ?? EM];
  }
  return [CH_MAP[c.slice(0, 3)] ?? "UNKNOWN_REVIEW", "Open", EM, EM];
}

function cleanCode(raw: string): string {
  return raw.trim().replace(/^['"]+|['"]+$/g, "").trim();
}

function toISO(stay: string): string | null {
  // "Mon Jun 1, 2026"
  const m = stay.match(/^\w+\s+(\w+)\s+(\d+),\s+(\d+)$/);
  if (!m) return null;
  const mm = MONTHS[m[1]];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas/quotes). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

class Interner {
  list: string[] = [];
  private map = new Map<string, number>();
  idx(v: string): number {
    let i = this.map.get(v);
    if (i === undefined) { i = this.list.length; this.list.push(v); this.map.set(v, i); }
    return i;
  }
}

export type NormalizeResult = { dataset: Dataset; rowsRead: number; rowsKept: number; skippedTotals: number };

export function normalizeCsv(input: string | string[]): NormalizeResult {
  const texts = Array.isArray(input) ? input : [input];

  const hotels = new Interner();
  const segments = new Interner();
  const plans = new Interner();
  const channels = new Interner();
  const roomTypes = new Interner();
  const boards = new Interner();
  const refunds = new Interner();
  const dateSet = new Set<string>();

  // accumulate across ALL files by hotel|seg|plan|chan|roomType|board|refund|dateISO (merges + dedupes overlap)
  const acc = new Map<string, { h: number; s: number; p: number; c: number; rt: number; bd: number; rf: number; d: string; rooms: number; rev: number }>();
  let rowsRead = 0, skippedTotals = 0;

  for (const text of texts) {
    const all = parseCSV(text);
    // find header row: first col is "Stay Date" or "Booking Date"
    const headerIdx = all.findIndex((r) => /^(stay|booking) date$/i.test(r[0] ?? ""));
    if (headerIdx < 0) throw new Error('Unexpected format: missing "Stay Date"/"Booking Date" header row.');

    // map columns by header name (resilient to renames)
    const head = all[headerIdx];
    const find = (re: RegExp) => head.findIndex((h) => re.test(h));
    const iStay = find(/date/i);            // "Stay Date" or "Booking Date"
    const iRate = find(/rate code/i);
    const iHotel = head.indexOf("Hotel");
    const iRoom = find(/room type code/i);  // optional; -1 when absent
    const iSeg = find(/market segment/i);
    const iRooms = find(/rooms/i);          // "Rooms (Commit)" or "Rooms (Booked)"
    const iRev = find(/revenue/i);          // "Total Revenue" or "Room Revenue (Commit|Booked)"
    if (iRev < 0 || iRooms < 0 || iStay < 0 || iHotel < 0 || iSeg < 0) {
      throw new Error('Unexpected format: could not find Date / Hotel / Segment / Rooms / Revenue columns.');
    }

    const data = all.slice(headerIdx + 1).filter((r) => r.length > iRev);

    for (const r of data) {
      const stay = r[iStay], hotel = r[iHotel], segment = r[iSeg];
      if (stay === "Total" || hotel === "Total" || segment === "Total") { skippedTotals++; continue; }
      rowsRead++;
      const rooms = Number(r[iRooms]) || 0;
      const rev = Number(r[iRev]) || 0;
      if (rooms <= 0 && rev === 0) continue; // drop empty rows; keep 0-room rows that carry revenue
      const iso = toISO(stay);
      if (!iso) continue;

      const [channel, plan, board, refund] = decode(cleanCode(r[iRate]));
      const room = iRoom >= 0 ? (cleanCode(r[iRoom] ?? "").toLowerCase() || "\u2014") : "\u2014";
      const key = `${hotel} ${segment} ${plan} ${channel} ${room} ${board} ${refund} ${iso}`;
      const cur = acc.get(key);
      if (cur) { cur.rooms += rooms; cur.rev += rev; }
      else acc.set(key, { h: hotels.idx(hotel), s: segments.idx(segment), p: plans.idx(plan), c: channels.idx(channel), rt: roomTypes.idx(room), bd: boards.idx(board), rf: refunds.idx(refund), d: iso, rooms, rev });
      dateSet.add(iso);
    }
  }

  const sortedDates = [...dateSet].sort();
  const dateIdx = new Map(sortedDates.map((d, i) => [d, i]));

  const rows: number[][] = [];
  for (const e of acc.values()) {
    // roomTypeIdx (col 7), boardIdx (col 8), then refundIdx (col 9) appended last so existing column indices stay stable
    rows.push([e.h, e.s, e.p, e.c, dateIdx.get(e.d)!, e.rooms, Math.round(e.rev), e.rt, e.bd, e.rf]);
  }

  const dataset: Dataset = {
    generated: new Date().toISOString().slice(0, 10),
    hotels: hotels.list,
    segments: segments.list,
    plans: plans.list,
    channels: channels.list,
    roomTypes: roomTypes.list,
    boards: boards.list,
    refunds: refunds.list,
    dates: sortedDates,
    rows,
  };
  return { dataset, rowsRead, rowsKept: rows.length, skippedTotals };
}
