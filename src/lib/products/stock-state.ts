/**
 * Classify a product's stock level for display.
 *
 * The products page used three different thresholds in one file (`< 20`
 * in the list and mobile card, `<= 10` in the grid) and none of them
 * handled a NEGATIVE quantity — an oversold product rendered as a plain
 * neutral number. One helper, one threshold, four states.
 */

export type StockState = "oversold" | "out" | "low" | "ok";

export const LOW_STOCK_THRESHOLD = 10;

export function stockState(
  stock: number | null | undefined,
  lowThreshold: number = LOW_STOCK_THRESHOLD,
): StockState {
  const n = typeof stock === "number" && Number.isFinite(stock) ? stock : 0;
  if (n < 0) return "oversold";
  if (n === 0) return "out";
  if (n <= lowThreshold) return "low";
  return "ok";
}

/** Tailwind classes per state — text colour for the number, dot for the marker. */
export const STOCK_STATE_STYLE: Record<StockState, { text: string; dot: string; pill: string }> = {
  oversold: {
    text: "text-destructive font-bold",
    dot: "bg-destructive",
    pill: "bg-destructive/12 text-destructive border-destructive/30",
  },
  out: {
    text: "text-destructive",
    dot: "bg-destructive",
    pill: "bg-destructive/10 text-destructive border-destructive/20",
  },
  low: {
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
  },
  ok: {
    text: "",
    dot: "",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50",
  },
};
