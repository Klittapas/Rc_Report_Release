import type { HotelAgg } from "./aggregate.ts";
import { fmt, fmtK, scoreHex } from "./format.ts";

export function HotelCard({
  hotel,
  active,
  dark,
  onClick,
}: {
  hotel: HotelAgg;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  const share = hotel.best_promo_share;
  const col = scoreHex(share, dark);
  const C = 2 * Math.PI * 34;
  const off = C * (1 - share / 100);
  const empty = hotel.total_revenue === 0;

  return (
    <button
      onClick={onClick}
      className={
        "group flex flex-col rounded-2xl border p-4 text-left transition " +
        "bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900 " +
        (active
          ? "border-orange-400 ring-2 ring-orange-400/40 dark:border-orange-400"
          : "border-slate-200 hover:border-orange-400 dark:border-slate-800 dark:hover:border-orange-500")
      }
    >
      <h3 className="h-9 text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">
        {hotel.name}
      </h3>

      <div className="my-2 flex items-center gap-3.5">
        <div className="relative h-[82px] w-[82px] shrink-0">
          <svg width="82" height="82" className="-rotate-90">
            <circle cx="41" cy="41" r="34" strokeWidth="7" fill="none" className="stroke-slate-200 dark:stroke-slate-700" />
            <circle
              cx="41" cy="41" r="34" strokeWidth="7" fill="none"
              stroke={col} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-xl font-extrabold" style={{ color: col }}>{empty ? "—" : share + "%"}</b>
            <span className="text-[9px] text-slate-400">of revenue</span>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Top Promotion</div>
          <div className="mt-0.5 text-base font-extrabold text-black-500 dark:text-white-400">{hotel.best_promo}</div>
          <div className="mt-1 text-xs text-slate-400">{fmtK(hotel.best_promo_rev)}</div>
        </div>
      </div>

      <div className="mt-3 flex justify-between border-t border-slate-200 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800">
        <span>Revenue<br /><b className="text-[13px] text-slate-700 dark:text-slate-200">{fmtK(hotel.total_revenue)}</b></span>
        <span>Rooms<br /><b className="text-[13px] text-slate-700 dark:text-slate-200">{hotel.total_rooms.toLocaleString()}</b></span>
        <span>ADR<br /><b className="text-[13px] text-slate-700 dark:text-slate-200">{fmt(hotel.adr)}</b></span>
      </div>
    </button>
  );
}
