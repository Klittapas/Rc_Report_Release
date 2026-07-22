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

/**
 * Streaming RFC-4180 CSV parser (quoted fields with commas/quotes).
 *
 * Rows are handed to a callback as soon as they complete, so the caller never
 * materialises the whole file as string[][]. State survives across `push` calls,
 * so a quoted field may straddle a chunk boundary.
 */
class CsvRowParser {
  private row: string[] = [];
  private field = "";
  private inQuotes = false;
  private quoteSeen = false; // inside quotes and just read a `"` — next char decides

  push(chunk: string, onRow: (row: string[]) => void): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (this.quoteSeen) {
        this.quoteSeen = false;
        if (ch === '"') { this.field += '"'; continue; } // "" -> literal quote
        this.inQuotes = false;                            // closing quote; fall through
      }
      if (this.inQuotes) {
        if (ch === '"') this.quoteSeen = true;
        else this.field += ch;
      } else if (ch === '"') this.inQuotes = true;
      else if (ch === ",") { this.row.push(this.field); this.field = ""; }
      else if (ch === "\n") { this.row.push(this.field); onRow(this.row); this.row = []; this.field = ""; }
      else if (ch === "\r") { /* skip */ }
      else this.field += ch;
    }
  }

  /** Flush the trailing row when the input has no final newline. */
  end(onRow: (row: string[]) => void): void {
    this.quoteSeen = false;
    this.inQuotes = false;
    if (this.field.length || this.row.length) { this.row.push(this.field); onRow(this.row); }
    this.row = [];
    this.field = "";
  }
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

/**
 * Incremental normalizer: feed one file's text at a time with `addText`, then
 * call `finish()`. Keeping files separate lets callers read them one by one so
 * only a single file's text is ever held in memory (see normalizeClient.ts).
 */
export function createNormalizer() {
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

  // ---- per-file state: header lookup, then row-by-row folding ----
  let parser: CsvRowParser | null = null;
  let cols: { iStay: number; iRate: number; iHotel: number; iRoom: number; iSeg: number; iRooms: number; iRev: number } | null = null;

  /** Called once per completed CSV row while the file streams in. */
  function consumeRow(r: string[]) {
    if (!cols) {
      // still hunting for the header row: first col is "Stay Date" or "Booking Date"
      if (!/^(stay|booking) date$/i.test(r[0] ?? "")) return;
      // map columns by header name (resilient to renames)
      const find = (re: RegExp) => r.findIndex((h) => re.test(h));
      const c = {
        iStay: find(/date/i),           // "Stay Date" or "Booking Date"
        iRate: find(/rate code/i),
        iHotel: r.indexOf("Hotel"),
        iRoom: find(/room type code/i), // optional; -1 when absent
        iSeg: find(/market segment/i),
        iRooms: find(/rooms/i),         // "Rooms (Commit)" or "Rooms (Booked)"
        iRev: find(/revenue/i),         // "Total Revenue" or "Room Revenue (Commit|Booked)"
      };
      if (c.iRev < 0 || c.iRooms < 0 || c.iStay < 0 || c.iHotel < 0 || c.iSeg < 0) {
        throw new Error("Unexpected format: could not find Date / Hotel / Segment / Rooms / Revenue columns.");
      }
      cols = c;
      return;
    }

    const { iStay, iRate, iHotel, iRoom, iSeg, iRooms, iRev } = cols;
    if (r.length <= iRev) return;
    const stay = r[iStay], hotel = r[iHotel], segment = r[iSeg];
    if (stay === "Total" || hotel === "Total" || segment === "Total") { skippedTotals++; return; }
    rowsRead++;
    const rooms = Number(r[iRooms]) || 0;
    const rev = Number(r[iRev]) || 0;
    if (rooms <= 0 && rev === 0) return; // drop empty rows; keep 0-room rows that carry revenue
    const iso = toISO(stay);
    if (!iso) return;

    const [channel, plan, board, refund] = decode(cleanCode(r[iRate]));
    const room = iRoom >= 0 ? (cleanCode(r[iRoom] ?? "").toLowerCase() || "\u2014") : "\u2014";
    const key = `${hotel} ${segment} ${plan} ${channel} ${room} ${board} ${refund} ${iso}`;
    const cur = acc.get(key);
    if (cur) { cur.rooms += rooms; cur.rev += rev; }
    else acc.set(key, { h: hotels.idx(hotel), s: segments.idx(segment), p: plans.idx(plan), c: channels.idx(channel), rt: roomTypes.idx(room), bd: boards.idx(board), rf: refunds.idx(refund), d: iso, rooms, rev });
    dateSet.add(iso);
  }

  /** Start a new file. */
  function beginFile() {
    parser = new CsvRowParser();
    cols = null;
  }
  /** Feed the next slice of that file's text (any size, may split mid-field). */
  function pushChunk(chunk: string) {
    parser!.push(chunk, consumeRow);
  }
  /** Close the file: flush a trailing row and verify the header was found. */
  function endFile() {
    parser!.end(consumeRow);
    parser = null;
    if (!cols) throw new Error('Unexpected format: missing "Stay Date"/"Booking Date" header row.');
  }

  /** Whole-file convenience: same streaming path, one chunk. */
  function addText(text: string) {
    beginFile();
    pushChunk(text);
    endFile();
  }

  function finish(): NormalizeResult {
    const sortedDates = [...dateSet].sort();
    const dateIdx = new Map(sortedDates.map((d, i) => [d, i]));

    const rows: number[][] = [];
    for (const e of acc.values()) {
      // roomTypeIdx (col 7), boardIdx (col 8), then refundIdx (col 9) appended last so existing column indices stay stable
      rows.push([e.h, e.s, e.p, e.c, dateIdx.get(e.d)!, e.rooms, Math.round(e.rev), e.rt, e.bd, e.rf]);
    }
    acc.clear(); // release the accumulator before the dataset is handed back

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

  return { addText, beginFile, pushChunk, endFile, finish };
}

/** One-shot convenience wrapper (kept for callers that already hold the text). */
export function normalizeCsv(input: string | string[]): NormalizeResult {
  const texts = Array.isArray(input) ? input : [input];
  const n = createNormalizer();
  for (const text of texts) n.addText(text);
  return n.finish();
}
