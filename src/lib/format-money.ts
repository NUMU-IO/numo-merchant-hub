/**
 * Money formatting for the merchant hub.
 *
 * The hub renders the signed-in merchant's own figures, so there is a
 * single "home currency" per session — the current store's
 * `default_currency`. Rather than thread that code through every chart
 * tooltip, table cell, and KPI card, `StoreProvider` pushes it into a
 * module-level value once the store resolves, and `formatMoney` reads it.
 *
 * This is what lets a Saudi merchant see SAR everywhere while an Egyptian
 * merchant keeps the familiar "ج.م" / "EGP" rendering — without touching
 * the dozens of inline formatters that previously hardcoded EGP.
 */

let activeStoreCurrency = "EGP";

/** Set by StoreProvider when `currentStore` resolves/changes. */
export function setActiveStoreCurrency(code?: string | null): void {
  if (typeof code === "string" && code.trim().length > 0) {
    activeStoreCurrency = code.trim().toUpperCase();
  }
}

export function getActiveStoreCurrency(): string {
  return activeStoreCurrency;
}

interface FormatMoneyOptions {
  /** Override the active store currency (ISO 4217). */
  currency?: string | null;
  /** Locale flavour for digit grouping + symbol placement. */
  locale?: "ar" | "en";
  /** Treat `value` as integer minor units (cents/piasters) and divide by 100. */
  fromCents?: boolean;
}

/**
 * ISO 3166 region per currency, so number formatting matches the market
 * (Arabic-Saudi digits/grouping for SAR vs Arabic-Egypt for EGP). Falls
 * back to EG, the platform's first market.
 */
const REGION_BY_CURRENCY: Record<string, string> = {
  EGP: "EG",
  SAR: "SA",
  AED: "AE",
  KWD: "KW",
  QAR: "QA",
  BHD: "BH",
  OMR: "OM",
};

function localeFor(currency: string, isAr: boolean): string {
  const region = REGION_BY_CURRENCY[currency] || (isAr ? "EG" : "US");
  return `${isAr ? "ar" : "en"}-${region}`;
}

// New Saudi Riyal sign (Unicode 17.0, U+20C1), rendered via the
// self-hosted "saudi_riyal" webfont (@font-face in index.css).
const SAR_SYMBOL = "⃁";

/**
 * Format a numeric amount in the merchant's home currency.
 *
 * Preserves the existing Egyptian rendering exactly — "EGP 1,250" (en) /
 * "1,250 ج.م" (ar) — and falls back to the ISO code for every other
 * market, e.g. "SAR 1,250" / "1,250 SAR", with market-correct digit
 * grouping (ar-SA for a Saudi store).
 */
export function formatMoney(
  value: number | null | undefined,
  opts: FormatMoneyOptions = {},
): string {
  const ccy = (opts.currency || getActiveStoreCurrency()).toUpperCase();
  const isAr = opts.locale === "ar";
  const n = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const v = opts.fromCents ? n / 100 : n;
  const num = v.toLocaleString(localeFor(ccy, isAr));
  if (ccy === "EGP") return isAr ? `${num} ج.م` : `EGP ${num}`;
  if (ccy === "SAR") return isAr ? `${num} ${SAR_SYMBOL}` : `${SAR_SYMBOL} ${num}`;
  return isAr ? `${num} ${ccy}` : `${ccy} ${num}`;
}
