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

/**
 * The store's currency as it should appear in a LABEL — "Bundle price (EGP)"
 * in English, "سعر الباقة (ج.م)" in Arabic.
 *
 * `formatMoney` already renders amounts with the market-correct mark; this is
 * the same mark without a number, for the places that name a currency rather
 * than print a figure. Interpolating the raw ISO code into Arabic copy would
 * leave the only Latin token on an otherwise Arabic form.
 */
export function currencyLabel(
  code?: string | null,
  locale: "ar" | "en" = "en",
): string {
  const ccy = (code || getActiveStoreCurrency()).toUpperCase();
  if (locale !== "ar") return ccy === "SAR" ? SAR_SYMBOL : ccy;
  if (ccy === "EGP") return "ج.م";
  if (ccy === "SAR") return SAR_SYMBOL;
  return ccy;
}

/* ───────────────────────────────────────────────────────────────────────────
   Major ⇄ minor units, for money the merchant TYPES.

   The engine stores money as integer minor units and divides by 100 for every
   currency it supports (see `formatMoney`'s `fromCents`). Merchant-facing
   inputs must never ask for those minor units: a merchant setting up a bundle
   thinks "650", not "65000", and a form that asks for piasters is one
   mistyped zero away from a 100x mispriced offer.

   So: inputs hold MAJOR units, the API keeps taking minor units, and the
   conversion happens at exactly two boundaries per form — parse on submit,
   render on hydrate. Same discipline as the storefront SDK's single
   cents→major boundary.
   ─────────────────────────────────────────────────────────────────────────── */

/** Minor units per major unit — 100 platform-wide, matching the engine. */
export const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Parse a merchant-typed major-unit amount into integer minor units.
 *
 * Accepts "650", "650.5", "650.50", " 1,250 " and 650. Returns `null` for
 * blank or unparseable input so callers can tell "left empty" (omit the
 * field) from "typed zero" (send 0) — a distinction `Number("") === 0`
 * destroys.
 */
export function majorToMinor(
  input: string | number | null | undefined,
): number | null {
  if (input == null) return null;
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (raw === "") return null;
  // Strip grouping separators (both ASCII and Arabic-Indic thousands marks).
  const n = Number(raw.replace(/[,٬\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  // Round rather than truncate: 6.505 → 651, not 650. Half-piaster inputs are
  // not representable, and rounding down would silently under-price.
  return Math.round(n * MINOR_UNITS_PER_MAJOR);
}

/**
 * Render integer minor units as the plain major-unit string a number input
 * expects — no currency symbol, no grouping (`<input type="number">` rejects
 * both). Trailing ".00" is dropped so a whole amount hydrates as "650".
 */
export function minorToMajorInput(
  cents: number | null | undefined,
): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  const major = cents / MINOR_UNITS_PER_MAJOR;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}
