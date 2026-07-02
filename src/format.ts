export const fmt = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");

export const fmtK = (n: number) => {
  const sign = n < 0 ? "-$" : "$";
  const a = Math.abs(n);
  return a >= 1e6 ? sign + (a / 1e6).toFixed(2) + "M" : a >= 1000 ? sign + Math.round(a / 1000) + "K" : sign + a;
};

// Muted, cohesive cool palette for a clean look (blues / slate / teal / indigo).
export const PROMO_COLORS: Record<string, string> = {
  Promotion: "#f50000",
  POS: "#f50000",
  // Min Stay tiers (blues)
  "Min Stay S": "#93c5fd", "Min Stay M": "#3b82f6", "Min Stay L": "#1e40af",
  // Early Bird tiers (teals)
  "Early Bird S": "#99f6e4", "Early Bird M": "#2dd4bf", "Early Bird L": "#0f766e",
  // Basic Deal (indigos)
  "Basic Deal": "#a5b4fc", "Basic Deal (NRF)": "#6366f1",
  // Package (sky)
  "Package Flex": "#bae6fd", "Package (NRF)": "#0ea5e9",
  // BAR (slate-blue)
  "BAR Flex": "#cbd5e1", "BAR NRF": "#475569",
  // non-OTA / direct / internal
  Open: "#94a3b8", "House Use": "#64748b", Complimentary: "#cbd5e1", Corporate: "#334155",
};

export const CHANNEL_PALETTE = [
  "#2563eb", "#0ea5e9", "#14b8a6", "#6366f1",
  "#64748b", "#0891b2", "#3b82f6", "#94a3b8",
  "#1e40af", "#5eead4", "#818cf8", "#334155",
];

/** Clean single-accent gauge color (revenue share no longer color-coded by tier). */
export const scoreHex = (_p: number, dark: boolean) => (dark ? "#f7913f" : "#f7913f");
