# Rate Code Reference

How raw rate codes are decoded into Channel / Promotion / Refundable / Breakfast.
Source of truth: [src/normalize.ts](src/normalize.ts) (browser) + [scripts/normalize_csv.py](scripts/normalize_csv.py) (offline).

---

## 1. Code structure

Standard OTA code = **8 chars** = `[channel:3][type:3][refund:1][board:1]`

```
b d c | m n m | n | r
 chan | type  |rf |bd
```

Example `bdcmnmnr` → Booking.com · Min Stay M · NRF · Room-only.

Special codes (open / house / comp / corp / dummy) don't follow this — see §6.

---

## 2. Channel (chars 1-3)

| prefix | Channel | Group |
|--------|---------|-------|
| `ago` | Agoda | OTA |
| `bdc` / `bkg` | Booking.com | OTA |
| `ctp` | Trip.com | OTA |
| `exp` | Expedia | OTA |
| `gbb` | Goibibo | OTA |
| `tkt` | Tiket.com | OTA |
| `trk` | Traveloka | OTA |
| `hop` | Hopper | OTA |
| `khs` | Klook | OTA |
| `hws` | HWS Wholesale | Wholesale |

Unknown prefix → `UNKNOWN_REVIEW` (Review — needs manual mapping).

---

## 3. Type → Promotion (chars 4-6)

The promotion category. For **BAR / Basic Deal / Package** it also splits by refund (Flex vs NRF).

| type | Flex (refund `f`) | NRF (refund `n`) |
|------|-------------------|------------------|
| `bar` | BAR Flex | BAR NRF |
| `bdr` | Basic Deal | Basic Deal (NRF) |
| `pkg` | Package Flex | Package (NRF) |

Refund-independent types:

| type | Promotion |
|------|-----------|
| `pro` | Promotion |
| `pos` | POS |
| `mns` / `mnm` / `mnl` | Min Stay S / M / L |
| `ebs` / `ebm` / `ebl` | Early Bird S / M / L |

Unknown type (e.g. `old`) → **Open**.

> S / M / L = min-stay or early-bird tier (short / medium / long).

---

## 4. Refund (char 7)

| char | meaning | Refundable |
|------|---------|------------|
| `f` | Flex | Yes |
| `n` | NRF (non-refundable) | No |

---

## 5. Board (char 8)

| char | meaning | Breakfast |
|------|---------|-----------|
| `b` | RB (room + breakfast) | Yes |
| `r` | RO (room only) | No |
| `o` | room only | No |

---

## 6. Special / non-OTA codes

| code pattern | Channel | Group | Promotion |
|--------------|---------|-------|-----------|
| `open*`, `rmonly`, `rmabf`, `oprb130`, `opro` | Direct | Direct | **Open** |
| `hou`, `hsu`, `house` | Internal | Internal | House Use |
| `comp*` | Internal | Internal | Complimentary |
| `corp*` | Corporate | Corporate | Corporate |
| `dmf`, `dummy`, `'-'`, other | UNKNOWN_REVIEW | Direct | Open |

**Open** = open/flexible rate sold direct (walk-in / hotel sales), not an OTA promo.

---

## 7. Segment

Segment comes **straight from the `Market Segment` column** in the report — NOT decoded from the code.
Values: OTA, HOUSE, HWS, CORP, TA, FIT, GROUP, COMP, OTHER.

---

## 8. Worked examples

| code | Channel | Promotion | Refund | Board |
|------|---------|-----------|--------|-------|
| `agomnmnb` | Agoda | Min Stay M | NRF | + breakfast |
| `bdcbarfr` | Booking.com | BAR Flex | Flex | room only |
| `ctppkgnr` | Trip.com | Package (NRF) | NRF | room only |
| `trkebsnb` | Traveloka | Early Bird S | NRF | + breakfast |
| `rmonly` | Direct | Open | — | room only |
| `house` | Internal | House Use | — | — |

---

## 9. Report parsing notes

- Report is a **nested pivot**: rows with `Total` in Stay/Booking Date, Hotel, or Market Segment are **subtotals** — dropped (only leaf rows where Segment is a real value are kept). No double-counting.
- Column names vary by export — matched flexibly:
  - date: `Stay Date` **or** `Booking Date`
  - rooms: `Rooms (Commit)` **or** `Rooms (Booked)`
  - revenue: `Total Revenue` **or** `Room Revenue (Commit|Booked)`
- **0-room rows that carry revenue are kept** (no-show / adjustment / room-move). Only fully empty (0 rooms + 0 revenue) rows are dropped.
- `Total Revenue` in these exports ≈ `Room Revenue` (room charge only) — excludes F&B / extras.
- Revenue may differ from a report's own subtotal by a few baht = the report rounds each pivot level independently.
