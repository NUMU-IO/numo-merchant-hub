/**
 * Dates in the merchant's language. Arabic uses ar-EG ordering («29 أغسطس
 * 2026») with Latin digits, matching money (see format-money.ts); a bare
 * toLocaleDateString() rendered "9/24/2026" inside Arabic tables.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLocale(lang: string): string {
  return lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
}

export function formatDate(
  value: string | number | Date,
  lang: string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(dateLocale(lang), opts);
}

/**
 * A chart's day label in the page language. The analytics API labels buckets
 * in English ("Aug 29"); the dashboard uses ISO days ("2026-08-29"). Anything
 * else (hours, weeks) passes through untouched.
 */
export function chartDayLabel(label: string, lang: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  const short = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(label);
  const date = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : short && MONTHS.includes(short[1])
      ? new Date(2000, MONTHS.indexOf(short[1]), Number(short[2]))
      : null;
  return date ? date.toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" }) : label;
}
