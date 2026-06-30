/**
 * Ingest: read data/Ratecode_NORMALIZED_Lastest.xlsx and emit a compact,
 * filter-ready dataset to src/dataset.json.
 *
 * Run with:  bun run ingest
 *
 * Output shape (dimension values are interned to keep the file small):
 *   {
 *     hotels:   string[],   // index space for rows[i][0]
 *     segments: string[],   // rows[i][1]
 *     plans:    string[],   // rows[i][2]  (Rate Plan = "promotion")
 *     channels: string[],   // rows[i][3]
 *     dates:    string[],   // rows[i][4]  ISO yyyy-mm-dd, sorted
 *     rows:     [hotelIdx, segIdx, planIdx, chanIdx, dateIdx, rooms, revenue][]
 *   }
 */
import * as XLSX from "xlsx";
import { resolve } from "path";

const XLSX_PATH = resolve(import.meta.dir, "../data/Ratecode_NORMALIZED_30days.xlsx");
const OUT_PATH = resolve(import.meta.dir, "../src/dataset.json");
const SHEET = "Daily Normalized";

type Raw = {
  Date: number | string;
  Hotel: string;
  Segment: string;
  "Rate Plan": string;
  Channel: string;
  Rooms: number;
  Revenue: number;
};

function toISO(v: number | string): string {
  if (typeof v === "number") {
    // Excel serial date -> JS date
    const d = XLSX.SSF.parse_date_code(v);
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  return String(v).slice(0, 10);
}

const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets[SHEET];
if (!ws) throw new Error(`Sheet "${SHEET}" not found. Found: ${wb.SheetNames.join(", ")}`);
const raw = XLSX.utils.sheet_to_json<Raw>(ws);

const hotels: string[] = [];
const segments: string[] = [];
const plans: string[] = [];
const channels: string[] = [];
const dates: string[] = [];
const intern = (arr: string[], v: string) => {
  let i = arr.indexOf(v);
  if (i === -1) { i = arr.length; arr.push(v); }
  return i;
};

const rows: number[][] = [];
for (const r of raw) {
  const rooms = Number(r.Rooms) || 0;
  const revenue = Number(r.Revenue) || 0;
  if (rooms === 0 && revenue === 0) continue;
  rows.push([
    intern(hotels, r.Hotel),
    intern(segments, r.Segment),
    intern(plans, r["Rate Plan"]),
    intern(channels, r.Channel),
    intern(dates, toISO(r.Date)),
    rooms,
    Math.round(revenue),
  ]);
}

// sort date index chronologically and remap row date pointers
const sortedDates = [...dates].sort();
const dateRemap = new Map(dates.map((d, i) => [i, sortedDates.indexOf(d)]));
for (const row of rows) row[4] = dateRemap.get(row[4])!;

// hotels/segments/plans/channels keep insertion order; the UI sorts as needed.
const out = {
  generated: new Date().toISOString().slice(0, 10),
  hotels,
  segments,
  plans,
  channels,
  dates: sortedDates,
  rows,
};

await Bun.write(OUT_PATH, JSON.stringify(out));
console.log(
  `Wrote ${OUT_PATH}\n  rows: ${rows.length}\n  hotels: ${hotels.length}` +
  `\n  segments: ${segments.join(", ")}\n  dates: ${sortedDates[0]} -> ${sortedDates.at(-1)}`,
);
