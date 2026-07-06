# คู่มือฟังก์ชัน — ไฟล์ไหนทำอะไร

> โครงสร้าง: `src/data/` (ข้อมูล) → `src/App.tsx` (state กลาง) → `src/sections/` (การ์ดกราฟ) + `src/ui/` (ตัวกรอง)
> อัปเดตล่าสุด: 2026-07-02

## ภาพรวม data flow

```
CSV (upload) ──▶ normalize.ts ──▶ Dataset (ตัวเลขล้วน ประหยัด memory)
                                     │
                    App.tsx ถือ filter state (segment / hotel / date)
                                     │
                aggregate.ts รวมยอดตาม filter ──▶ HotelAgg[] ต่อโรงแรม
                                     │
        sections/* วาดกราฟจาก HotelAgg หรือคำนวณเองจาก Dataset.rows
```

---

## src/data/ — ชั้นข้อมูล

### normalize.ts — แปลง CSV ดิบเป็น Dataset (รันในเบราว์เซอร์)

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `normalizeCsv(input)` | ตัวหลัก — รับข้อความ CSV (ไฟล์เดียวหรือหลายไฟล์) หา header row เอง, ข้ามแถว "Total", ถอดรหัส rate code, รวมแถวซ้ำ (merge หลายเดือนได้), คืน `{ dataset, rowsRead, rowsKept, skippedTotals }` |
| `decode(code)` | ถอด rate code → `[Channel, Promo]` เช่น `gbbbarfr` → `["Goibibo", "BAR Flex"]` โครงสร้างรหัส = `[channel:3][type:3][refund:1][board:1]` รหัสพิเศษ: `open*`→Direct/Open, `hou*`→House Use, `comp*`→Complimentary, `corp*`→Corporate, ไม่รู้จัก→UNKNOWN_REVIEW |
| `promoCategory(typ, refund)` | ชื่อโปรจาก type+refund — `bar`/`bdr`/`pkg` แยกตาม refund flag (`f`=Flex, `n`=NRF), ที่เหลือดูจาก `TYPE_BASE` (mns=Min Stay S ฯลฯ) |
| `cleanCode(raw)` | ตัด quote/ช่องว่างหุ้ม rate code |
| `toISO(stay)` | `"Mon Jun 1, 2026"` → `"2026-06-01"` (คืน null ถ้า parse ไม่ได้ → แถวนั้นถูกข้าม) |
| `parseCSV(text)` | CSV parser ตาม RFC-4180 (รองรับ field มี comma/quote ซ้อน) เขียนเองเพื่อไม่ต้องพึ่ง library |
| `class Interner` | แปลง string ซ้ำๆ เป็นเลข index — ชื่อโรงแรม/segment/โปร เก็บครั้งเดียวใน list, แถวข้อมูลเก็บแค่ตัวเลข |
| ค่าคงที่ `CH_MAP` / `TYPE_BASE` / `TYPE_SPLIT` | ตาราง map รหัส → ชื่อ channel / ชื่อโปร (ต้อง sync กับ `scripts/normalize_csv.py`) |

### aggregate.ts — รวมยอดตาม filter

| ฟังก์ชัน / ค่า | หน้าที่ |
|---|---|
| `type Dataset` | รูปแบบข้อมูลกลาง: list ชื่อ (hotels/segments/plans/channels/dates/roomTypes) + `rows` เป็น array ตัวเลข `[hotelIdx, segIdx, planIdx, chanIdx, dateIdx, rooms, revenue, roomTypeIdx]` |
| `aggregate(ds, filters)` | ตัวหลัก — วนทุกแถว กรองตาม segment + ช่วงวันที่ แล้วรวมยอดต่อโรงแรม คืน `HotelAgg[]`: ยอดรวม, ADR, โปรที่ขายดีสุด, breakdown ต่อโปร/ต่อ channel/ต่อวัน (เรียง revenue มาก→น้อย) |
| `bump(map, key, rev, rooms)` | helper บวกยอดสะสมเข้า Map |
| `HOTEL_INVENTORY` | จำนวนห้องขายได้ต่อโรงแรม (hardcode 7 โรงแรม) — ใช้คิด RevPAR กับ Occupancy |
| `dataset` (export) | dataset.json ที่ bundle มากับเว็บ (ปกติเป็น placeholder ว่าง — รอ upload) |

### format.ts — ฟอร์แมตตัวเลข + สี

| ฟังก์ชัน / ค่า | หน้าที่ |
|---|---|
| `fmt(n)` | เงินเต็มจำนวน `-16919` → `"-$16,919"` |
| `fmtK(n)` | เงินย่อ `1234567` → `"$1.23M"`, `42000` → `"$42K"` (รองรับค่าลบ) |
| `PROMO_COLORS` | สีประจำแต่ละโปร (ใช้ในกราฟ Revenue by Promotion) |
| `CHANNEL_PALETTE` | ชุดสีสำหรับ channel |
| `scoreHex(p, dark)` | สี gauge วงกลม (ตอนนี้คืนสีส้มเดียว) |

---

## src/App.tsx — ศูนย์กลาง state

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `App()` | component ราก — ถือ state ทั้งหมด: `dataset`, `activeSegments`, `startIdx`/`endIdx` (ช่วงวันที่), `selected` (โรงแรมที่โฟกัส), theme แล้วส่งลงทุก section ถ้ายังไม่มีข้อมูลแสดงหน้า upload อย่างเดียว |
| `handleUpload(files)` | รับไฟล์ CSV (หลายไฟล์ได้) → `normalizeCsv` → set dataset ใหม่ + reset filter ทุกตัว + โชว์ข้อความสรุป (✓ กี่แถว / ✕ error) |
| `toggleSegment(s)` | เปิด/ปิด segment chip (กันปิดตัวสุดท้าย — ต้องเหลืออย่างน้อย 1) |
| `toggleAllSegments()` | ปุ่ม "All" — เลือกทุก segment หรือถ้าครบแล้วย่อกลับเหลือ OTA |
| `Pill({children})` | ป้ายกลมเล็กใน header (แสดง segment / ช่วงวัน / ยอดรวม) |

memo สำคัญ: `hotels = aggregate(dataset, filters)` — คำนวณใหม่เฉพาะเมื่อ dataset หรือ filter เปลี่ยน

---

## src/sections/ — การ์ดแต่ละ section

### ChannelPromoHeatmap.tsx — ตาราง Channel × Promotion

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `ChannelPromoHeatmap(props)` | ตาราง heatmap แถว×คอลัมน์ สลับแกนแถวได้ (**By channel / By room type**), สลับ metric (Revenue/Rooms), filter room type ได้ตอนอยู่โหมด channel คำนวณเองจาก `dataset.rows` (ไม่ใช้ HotelAgg) เรียงแถว/คอลัมน์จากยอดมาก→น้อย |
| `bg(v)` | สีพื้น cell — เข้มตามยอด (สเกล sqrt ให้ค่ากลางๆ ยังมองเห็น) ค่า ≤ 0 โปร่งใส |
| `txt(v)` | สีตัวอักษร cell — **ค่าลบเป็นสีแดง** (ยกเลิก > จอง), ค่าสูงเป็นขาว, ศูนย์เป็นเทา |
| `totStyle(v)` | สีแดงให้ช่อง Total เมื่อ net ติดลบ |
| `fmtVal / fmtFull / fmtTotal` | ฟอร์แมตค่าใน cell / tooltip / แถว Total ตาม metric |
| memo `roomOptions` | room code ที่มีข้อมูลจริงของโรงแรมที่เลือก (ตัวเลือก dropdown) |
| memo หลัก (`rows, cols, cell, ...`) | สแกน `dataset.rows` ครั้งเดียว สร้าง Map ยอดต่อ cell + total ต่อแถว/คอลัมน์ + หา "Hottest" |

หมายเหตุ: ตาราง remount ด้วย `key={rowDim}` → animation `.drill-in` เล่นทุกครั้งที่สลับแกน / cell ที่ค่าเป็นลบโชว์ตัวเลขแดง ไม่ซ่อนเป็นจุด (จุด "·" = ไม่มีข้อมูล)

### DailyTrend.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `DailyTrend({hotel, dark})` | กราฟรายวันของโรงแรมที่เลือก — revenue เป็นเส้น (แกนซ้าย) + rooms เป็นแท่ง (แกนขวา) จาก `hotel.trend` ถ้าไม่มีข้อมูลแสดงกล่องเปล่า |

### HotelComparison.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `HotelComparison(props)` | แท่งแนวนอนเทียบ 7 โรงแรม เลือก metric ได้ 5 แบบ (Revenue / RevPAR / Occupancy / Rooms / ADR) เรียงมาก→น้อย คลิกแท่ง = เลือกโรงแรมนั้นทั้ง dashboard |
| `avail(h)` | ห้องขายได้ในช่วง = `HOTEL_INVENTORY × nights` |
| `revpar(h)` / `occ(h)` | RevPAR = revenue/avail, Occupancy = rooms/avail (⚠️ มีความหมายเฉพาะ report แบบ Stay Date — Booking Date เกิน 100% ได้) |
| `fmtVal(m, v)` | ฟอร์แมตตาม metric (%, $, จำนวน) |
| `shortName(n)` | ย่อชื่อโรงแรมให้พอดีแกน |

### WeeklyBreakdown.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `WeeklyBreakdown(props)` | แท่ง stacked ต่อสัปดาห์ — top 4 โปร (หรือ channel) สลับ dimension Promo/Channel + metric Revenue/Rooms + dropdown filter channel/promo |
| `weekOf(iso)` | วันที่ → สัปดาห์ของเดือน (1-7=Wk1, 8-14=Wk2, 15-21=Wk3, 22-สิ้นเดือน=Wk4) |
| memo `chanOptions/promoOptions` | ตัวเลือก dropdown แบบ cascade — โชว์เฉพาะที่มีข้อมูลจริงภายใต้ filter อื่นที่เปิดอยู่ |
| memo `weeks/series` | รวมยอดต่อสัปดาห์ต่อ item เอาเฉพาะ top 4 (ยอด > 0) |

### HotelDetail.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `HotelDetail({hotel, dark})` | การ์ดรายละเอียดโรงแรมที่เลือก: แถบ KPI + กราฟ Revenue by Promotion (แท่งแนวนอน แท่งส้ม = ขายดีสุด) |
| `Kpi({k, v, good})` | กล่อง KPI เล็ก (Total Revenue / Rooms / ADR / Top Promotion) |

### PromoByHotel.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `PromoByHotel(props)` | กราฟเส้น overview — แต่ละเส้นคือโปรที่เป็นที่ 1 ของอย่างน้อย 1 โรงแรม จุดใหญ่ = โปรนั้นเป็นแชมป์ของโรงแรมนั้น คลิกจุด = drill-in |
| `revOf(h, plan)` | revenue ของโปรใดโปรหนึ่งในโรงแรมนั้น |
| `shortName(n)` | ย่อชื่อโรงแรม |

### HotelCard.tsx ⚠️ dead code

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `HotelCard(props)` | การ์ดโรงแรมมี gauge วงกลมแสดง % ของโปรอันดับ 1 — **ไม่มีไฟล์ไหน import แล้ว** เหลือจากดีไซน์เก่า ลบได้ |

---

## src/ui/ — ชิ้นส่วน UI ใช้ร่วม

### Controls.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `Controls(props)` | แถบ filter ลอยติดบนจอ (sticky): segment chips + ปุ่ม All, dropdown เลือกโรงแรม, date range picker — เป็น "stateless" รับค่า/callback จาก App ทั้งหมด |

### DateRangePicker.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `DateRangePicker(props)` | ปุ่มช่วงวันที่ + ปฏิทิน popover (portal-render กัน backdrop-blur บัง) เลือก 2 คลิก = start,end มี preset 7d/30d/All กดได้เฉพาะวันที่มีข้อมูล |
| `pick(idx)` | logic เลือก 2 จังหวะ — คลิกแรกจำไว้ (pending) คลิกสองสรุปช่วง (สลับให้เองถ้าเลือกย้อนหลัง) |
| `applyPreset(start)` | ตั้งช่วงจาก preset (start → วันสุดท้าย) |
| `openCal()` / `close()` | เปิดปฏิทินที่เดือนของวันเริ่ม / ปิดพร้อมเคลียร์สถานะค้าง |
| effect ใน component | ปิดเมื่อคลิกนอก/กด Esc, ขยับตำแหน่ง popover ตอน scroll/resize |

### Dropdown.tsx

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `Dropdown(props)` | dropdown แต่งเอง (แทน `<select>`) — portal-render, มี fade in/out, ติ๊กถูกตัวที่เลือก, prop `format` แปลงข้อความ (เช่น uppercase room code) ใช้ใน Controls / Heatmap / WeeklyBreakdown |

---

## src/hooks/

### useTheme.ts

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `useTheme()` | คืน `[theme, toggle]` — อ่านค่าเริ่มจาก localStorage หรือ system preference, sync class `dark` บน `<html>` + จำค่าไว้ |

---

## src/frontend.tsx — จุดเริ่ม

mount `<App />` เข้า `#root` + import styles.css (ถูกอ้างจาก index.html)

---

## scripts/ — เครื่องมือฝั่ง dev

| ไฟล์ | หน้าที่ |
|---|---|
| `serve.ts` | dev/prod server (`bun run dev` / `start`) — หา port ว่างอัตโนมัติถ้า 3000 ไม่ว่าง |
| `build.ts` | build production → `dist/` (Bun.build + Tailwind plugin, minify) ใช้โดย GitHub Actions deploy |
| `ingest.ts` | แปลง CSV เป็น `src/data/dataset.json` แบบ offline (ทางเลือกแทน upload ในเบราว์เซอร์ — ระวังข้อมูลจริงติดเข้า repo) |
| `normalize_csv.py` | เวอร์ชัน Python ของ normalize.ts — logic ต้องตรงกัน ถ้าแก้ mapping ต้องแก้ทั้งคู่ |

## กติกาที่ต้องรู้ตอนแก้โค้ด

- **ลำดับคอลัมน์ใน `rows` ห้ามสลับ** — ทุกไฟล์อ้าง index ตรงๆ (`H=0, S=1, P=2, C=3, D=4, ROOMS=5, REV=6, RT=7`) คอลัมน์ใหม่ต้องต่อท้ายเท่านั้น
- **ค่าลบ = การยกเลิก** (report เป็น Booking Date) — UI แสดงเป็นตัวแดง ห้ามซ่อน ไม่งั้น Total จะดูไม่ตรงกับ cell
- **เพิ่ม channel/โปรใหม่** → แก้ `CH_MAP`/`TYPE_BASE`/`TYPE_SPLIT` ทั้งใน `normalize.ts` และ `scripts/normalize_csv.py` + อัปเดต RATECODE.md
- **เพิ่มโรงแรมใหม่** → ต้องเพิ่ม `HOTEL_INVENTORY` ไม่งั้น RevPAR/Occupancy เป็น 0
