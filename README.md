# OTA Promotion Dashboard (Bun + React + TypeScript + Tailwind)

Interactive dashboard that shows **which promotion sells best for each hotel** — with
**segment**, **date-range**, **room-type** and **channel** breakdowns, plus **light / dark mode**.

> **No data ships with this site.** The public build is empty. Drop in a raw ratecode CSV
> export and it is decoded + aggregated **entirely in your browser** — nothing is uploaded to
> any server, stored, or sent to GitHub. Close the tab and the data is gone.

## Run locally

```bash
bun install
bun run dev      # hot-reload dev server -> http://localhost:3000
bun run build    # minified static bundle -> ./dist
```

Open the site, click **Upload CSV**, and pick a ratecode export (`Stay Date` or `Booking Date`
report). The dashboard builds itself from the file.

### Changing the dev port

The dev/start server reads the `PORT` env var (default `3000`); if busy it falls back to the
next free port. (`bun ./index.html --port <n>` ignores the flag, which is why the dev server
runs through `scripts/serve.ts`.)

```bash
PORT=4000 bun run dev
```

## Data & privacy

- **Nothing real is committed.** `data/` and all `*.csv` / `*.xlsx` are git-ignored, and the
  bundled `src/dataset.json` is an empty placeholder.
- **Upload is 100% client-side** — `src/normalize.ts` parses the CSV in the browser
  (`file.text()` → in-memory `Dataset`). No network request leaves the page.
- Access control is **whoever holds the CSV**: the public page is useless without a file.
- See `RATECODE.md` for how raw rate codes decode into Channel / Promotion / Refundable / Breakfast.

> ⚠️ **Stay Date vs Booking Date.** Occupancy is only meaningful on a **Stay Date** report
> (rooms occupied per night). A **Booking Date** report counts rooms by when they were *booked*,
> so the "occupancy" bars can exceed 100% and daily revenue can go negative (cancellations).

## Deploy (GitHub Pages)

This repo's history is clean (no real data was ever committed), so it is safe to make **public**
and use free GitHub Pages. `.github/workflows/deploy.yml` builds with Bun and publishes `./dist`.

One-time setup:

1. Repo → **Settings → General** → make the repo **Public**.
2. Repo → **Settings → Pages** → **Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or re-run the workflow) → site goes live at
   `https://<user>.github.io/<repo>/`.

Asset paths are relative, so it works under that sub-path with no extra config.

> Alternative — **Netlify / Vercel**: import the repo; settings come from `netlify.toml` /
> `vercel.json` (`bun run build` → `dist`). These also deploy a *private* repo on the free tier.

## Features

- **Top promotion by hotel** — line chart, one line per top promo, click a point to drill in.
- **Channel × Promotion heatmap** — which OTA drives which promo; filter by hotel & room type.
- **Hotel comparison** — Revenue / RevPAR / Occupancy / Rooms / ADR, ranked.
- **Weekly breakdown** — stacked top promos per week.
- **Daily trend** — daily revenue (line) + occupancy/booking-pace (bars) for the selected hotel.
- **Per-hotel detail** — KPIs + revenue-by-promotion.
- **Filters** — segment (multi-select), date range, light / dark mode (persisted).

## Structure

| File | Purpose |
|------|---------|
| `src/normalize.ts` | In-browser CSV → compact `Dataset` (mirrors `scripts/normalize_csv.py`) |
| `scripts/normalize_csv.py` | Offline Python normalizer (raw CSV → dataset) |
| `scripts/build.ts` | Production build with the Tailwind plugin |
| `index.html` | Bun entry point |
| `src/aggregate.ts` | Filter + aggregate rows into per-hotel metrics; rate inventory |
| `src/App.tsx` | Layout, filter state, theme, empty/upload landing |
| `src/Controls.tsx` · `DateRangePicker.tsx` | Segment chips, date range, upload, theme |
| `src/PromoByHotel.tsx` · `ChannelPromoHeatmap.tsx` · `HotelComparison.tsx` · `WeeklyBreakdown.tsx` · `DailyTrend.tsx` · `HotelDetail.tsx` | Charts |
| `src/format.ts` | Formatters + color palettes |
| `RATECODE.md` | Rate-code decoding reference |

`legacy/` holds the original single-file HTML prototype.
