#!/usr/bin/env python3
"""
Normalize a raw "ratecode" CSV export into the same format as
Ratecode_NORMALIZED_Lastest.xlsx (sheets: "Daily Normalized" + "Hotel x Promo").

Usage:
    python3 scripts/normalize_csv.py <input.csv> <output.xlsx>

Rate code structure (authoritative legend)
-------------------------------------------
A full code = [channel:3][type:3][refund:1][board:1]   e.g.  bdc|mnm|n|r
  * channel : ago=Agoda, bdc/bkg=Booking.com, ctp=Trip.com, exp=Expedia,
              gbb=Goibibo, tkt=Tiket.com, trk=Traveloka, hws=HWS Wholesale,
              hop=Hopper, khs=Klook.
  * type    : bar=BAR, bdr=Basic Deal, pkg=PKG, pro=Promotion, pos=POS,
              mns/mnm/mnl=Min S/M/L Night, ebs/ebm/ebl=EB S/M/L.
  * refund  : f=Flex (refundable), n=NRF (non-refundable).
  * board   : r=RO (room only), b=RB (room + breakfast), o=room only.

Promotion category (column L) = type, split by Flex/NRF for BAR / Basic Deal / PKG.

Grain: one row per (Date, Hotel, Room Type, Segment, Raw Code); Rooms & Revenue
summed; 0-room rows dropped; ADR = round(Revenue / Rooms).
"""
import sys
import pandas as pd

CH_MAP = {
    "ago": "Agoda", "bdc": "Booking.com", "bkg": "Booking.com", "ctp": "Trip.com",
    "exp": "Expedia", "gbb": "Goibibo", "hop": "Hopper", "hws": "HWS Wholesale",
    "khs": "Klook", "tkt": "Tiket.com", "trk": "Traveloka",
}
GROUP_BY_CHANNEL = {
    "Agoda": "OTA", "Booking.com": "OTA", "Trip.com": "OTA", "Expedia": "OTA",
    "Goibibo": "OTA", "Tiket.com": "OTA", "Traveloka": "OTA",
    "Hopper": "OTA", "Klook": "OTA",
    "HWS Wholesale": "Wholesale", "UNKNOWN_REVIEW": "Review",
    "Direct": "Direct", "Corporate": "Corporate", "Internal": "Internal",
}
RF_MAP = {"f": "Yes", "n": "No"}            # Flex -> refundable Yes, NRF -> No
BF_MAP = {"b": "Yes", "r": "No", "o": "No"}  # RB -> breakfast Yes, RO -> No

# type -> base promotion label (refund-independent). Abbreviations spelled out, size kept.
TYPE_BASE = {
    "pro": "Promotion", "pos": "POS",
    "mns": "Min Stay S", "mnm": "Min Stay M", "mnl": "Min Stay L",
    "ebs": "Early Bird S", "ebm": "Early Bird M", "ebl": "Early Bird L",
}
# type -> (Flex label, NRF label) for the families that split by refund policy
TYPE_SPLIT = {
    "bar": ("BAR Flex", "BAR NRF"),
    "bdr": ("Basic Deal", "Basic Deal (NRF)"),
    "pkg": ("Package Flex", "Package (NRF)"),
}

# Display order for the Hotel x Promo pivot (extras appended automatically).
PROMO_ORDER = [
    "BAR Flex", "BAR NRF", "Basic Deal", "Basic Deal (NRF)", "Promotion", "POS",
    "Package Flex", "Package (NRF)", "Early Bird S", "Early Bird M", "Early Bird L",
    "Min Stay S", "Min Stay M", "Min Stay L", "Open",
]
INTERNAL_PLANS = {"House Use", "Complimentary", "Corporate"}


def clean_code(raw: str) -> str:
    return str(raw).strip().strip("'\"").strip()


def promo_category(typ: str, refund: str) -> str:
    if typ in TYPE_SPLIT:
        flex, nrf = TYPE_SPLIT[typ]
        return flex if refund == "f" else nrf
    return TYPE_BASE.get(typ, "Open")  # unknown type (e.g. "old") -> Open


def decode(code: str) -> tuple:
    """code -> (Channel, Group, Rate Plan, Refundable, Breakfast)."""
    c = code.lower()
    # special / direct / internal families
    if c.startswith("open") or c in ("oprb130", "rmabf", "rmonly", "opro"):
        explicit = {"oprb130": "Yes", "rmabf": "Yes", "rmonly": "No", "opro": "No"}
        if c in explicit:
            bf = explicit[c]
        else:
            bf = "Yes" if c.endswith(("rb", "b")) else ("No" if c.endswith(("ro", "o")) else None)
        return ("Direct", "Direct", "Open", None, bf)
    if c.startswith(("hou", "hsu", "house")):
        return ("Internal", "Internal", "House Use", None, None)
    if c.startswith("comp"):
        bf = "Yes" if c.endswith(("rb", "b")) else None
        return ("Internal", "Internal", "Complimentary", None, bf)
    if c.startswith("corp"):
        return ("Corporate", "Corporate", "Corporate", None, None)
    # standard 8-char OTA code
    if len(c) == 8:
        ch = CH_MAP.get(c[:3], "UNKNOWN_REVIEW")
        grp = GROUP_BY_CHANNEL.get(ch, "OTA")
        return (ch, grp, promo_category(c[3:6], c[6]), RF_MAP.get(c[6]), BF_MAP.get(c[7]))
    # dummy / placeholder codes (dmf, dummy, '-', ...) -> negligible
    ch = CH_MAP.get(c[:3], "UNKNOWN_REVIEW")
    return (ch, GROUP_BY_CHANNEL.get(ch, "Direct"), "Open", None, None)


def normalize(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, skiprows=2)

    # flexible column matching: Stay Date/Booking Date, Rooms (Commit)/(Booked), Total/Room Revenue
    def find(pat):
        c = next((c for c in df.columns if pat in c.lower()), None)
        if c is None:
            raise ValueError(f"No '{pat}' column. Columns: {list(df.columns)}")
        return c
    date_col, rooms_col, rev_col = find("date"), find("rooms"), find("revenue")

    df = df[(df[date_col] != "Total") & (df["Hotel"] != "Total")
            & (df["Market Segment"] != "Total")].copy()

    df["Rooms"] = pd.to_numeric(df[rooms_col], errors="coerce").fillna(0)
    df["Revenue"] = pd.to_numeric(df[rev_col], errors="coerce").fillna(0)
    df["Date"] = pd.to_datetime(df[date_col], format="%a %b %d, %Y")
    df["Hotel"] = df["Hotel"].astype(str)
    df["Room Type"] = df["Room Type Code"].astype(str)
    df["Segment"] = df["Market Segment"].astype(str)
    df["Raw Code"] = df["Rate Code"].map(clean_code)

    key = ["Date", "Hotel", "Room Type", "Segment", "Raw Code"]
    g = df.groupby(key, as_index=False).agg(Rooms=("Rooms", "sum"), Revenue=("Revenue", "sum"))
    g = g[(g["Rooms"] > 0) | (g["Revenue"] != 0)].copy()  # keep 0-room rows that carry revenue

    attrs = g["Raw Code"].map(decode)
    g["Channel"] = attrs.map(lambda t: t[0])
    g["Group"] = attrs.map(lambda t: t[1])
    g["Rate Plan"] = attrs.map(lambda t: t[2])
    g["Refundable"] = attrs.map(lambda t: t[3])
    g["Breakfast"] = attrs.map(lambda t: t[4])

    g["Revenue"] = g["Revenue"].round().astype(int)
    g["ADR"] = g.apply(lambda r: round(r["Revenue"] / r["Rooms"]) if r["Rooms"] > 0 else 0, axis=1).astype(int)
    g["Rooms"] = g["Rooms"].astype(int)
    g["DOW"] = g["Date"].dt.strftime("%a")

    out = g[["Date", "DOW", "Hotel", "Room Type", "Segment", "Raw Code", "Channel",
             "Group", "Rate Plan", "Refundable", "Breakfast", "Rooms", "ADR", "Revenue"]]
    return out.sort_values(["Date", "Hotel", "Room Type", "Raw Code"]).reset_index(drop=True)


def hotel_x_promo(daily: pd.DataFrame) -> pd.DataFrame:
    """Rooms pivot: Hotel x Promotion category (excludes internal plans)."""
    sub = daily[~daily["Rate Plan"].isin(INTERNAL_PLANS)]
    piv = sub.pivot_table(index="Hotel", columns="Rate Plan", values="Rooms",
                          aggfunc="sum", fill_value=0)
    present = list(piv.columns)
    cols = [c for c in PROMO_ORDER if c in present] + [c for c in present if c not in PROMO_ORDER]
    piv = piv[cols]
    piv["Grand Total"] = piv.sum(axis=1)
    piv = piv.reset_index()
    total = piv.drop(columns="Hotel").sum()
    total["Hotel"] = "TOTAL"
    piv = pd.concat([piv, pd.DataFrame([total])[piv.columns]], ignore_index=True)
    return piv


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    csv_path, out_path = sys.argv[1], sys.argv[2]
    daily = normalize(csv_path)
    promo = hotel_x_promo(daily)
    with pd.ExcelWriter(out_path, engine="openpyxl", datetime_format="yyyy-mm-dd") as xw:
        daily.to_excel(xw, sheet_name="Daily Normalized", index=False)
        promo.to_excel(xw, sheet_name="Hotel x Promo", index=False)
    print(f"Wrote {out_path}")
    print(f"  Daily Normalized: {len(daily)} rows, "
          f"{daily['Date'].dt.date.min()} -> {daily['Date'].dt.date.max()} "
          f"({daily['Date'].nunique()} days)")
    print(f"  Promotion categories: {sorted(daily['Rate Plan'].unique())}")
    print(f"  Total rooms: {daily['Rooms'].sum():,}  Total revenue: {daily['Revenue'].sum():,}")


if __name__ == "__main__":
    main()
