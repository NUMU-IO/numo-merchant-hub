/**
 * Label / locale formatting for the picker trigger button and
 * the footer summary inside the popover.
 *
 * Arabic strings target Egyptian Modern Standard — natural to read
 * for an Egyptian merchant without being too colloquial for a
 * business UI. The literal "حق الآن" calque of "to date" was
 * confusing in usability testing, replaced here with the more
 * common "هذا الأسبوع / الشهر / …" form.
 */

import { format, isSameDay, isSameYear } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";

import type { DateRange, Granularity, PresetKey } from "./types";

const PRESET_LABELS_EN: Record<PresetKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-n": "Last",
  wtd: "Week to date",
  mtd: "Month to date",
  qtd: "Quarter to date",
  ytd: "Year to date",
  "last-week": "Last week",
  "last-month": "Last month",
  "last-quarter": "Last quarter",
  "last-year": "Last year",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  bfcm: "Black Friday Cyber Monday",
  "bfcm-prev": "BFCM last year",
  custom: "Custom",
};

const PRESET_LABELS_AR: Record<PresetKey, string> = {
  today: "اليوم",
  yesterday: "أمس",
  "last-n": "آخر",
  wtd: "هذا الأسبوع",
  mtd: "هذا الشهر",
  qtd: "هذا الربع",
  ytd: "هذه السنة",
  "last-week": "الأسبوع الماضي",
  "last-month": "الشهر الماضي",
  "last-quarter": "الربع الماضي",
  "last-year": "السنة الماضية",
  q1: "الربع الأول",
  q2: "الربع الثاني",
  q3: "الربع الثالث",
  q4: "الربع الرابع",
  bfcm: "بلاك فرايداي",
  "bfcm-prev": "بلاك فرايداي السنة الماضية",
  custom: "تاريخ مخصص",
};

const LAST_N_UNIT_EN = {
  hour: { one: "Hour", other: "Hours" },
  day: { one: "Day", other: "Days" },
  week: { one: "Week", other: "Weeks" },
  month: { one: "Month", other: "Months" },
  year: { one: "Year", other: "Years" },
} as const;

const LAST_N_UNIT_AR = {
  hour: { one: "ساعة", other: "ساعات" },
  day: { one: "يوم", other: "أيام" },
  week: { one: "أسبوع", other: "أسابيع" },
  month: { one: "شهر", other: "أشهر" },
  year: { one: "سنة", other: "سنوات" },
} as const;

export type Lang = "en" | "ar";

export function lastNUnitLabel(
  unit: keyof typeof LAST_N_UNIT_EN,
  n: number,
  lang: Lang,
): string {
  const table = lang === "ar" ? LAST_N_UNIT_AR : LAST_N_UNIT_EN;
  return n === 1 ? table[unit].one : table[unit].other;
}

export function presetLabel(preset: PresetKey, lang: Lang): string {
  return (lang === "ar" ? PRESET_LABELS_AR : PRESET_LABELS_EN)[preset];
}

function localeFor(lang: Lang) {
  return lang === "ar" ? arLocale : enUS;
}

/** Trigger-button label that mirrors Shopify's compact format. */
export function triggerLabel(range: DateRange, lang: Lang): string {
  if (range.preset === "today") return presetLabel("today", lang);
  if (range.preset === "yesterday") return presetLabel("yesterday", lang);
  if (range.preset === "last-n" && range.lastN) {
    const unit = lastNUnitLabel(range.lastN.unit, range.lastN.n, lang);
    const head = presetLabel("last-n", lang);
    return `${head} ${range.lastN.n} ${unit}`;
  }
  if (range.preset !== "custom") return presetLabel(range.preset, lang);
  return dateRangeSummary(range, lang);
}

function showsTime(range: DateRange): boolean {
  // Show time when granularity is hour OR when the endpoints aren't
  // already on day boundaries (00:00 / 23:59).
  if (range.granularity === "hour") return true;
  const startMidnight =
    range.start.getHours() === 0 && range.start.getMinutes() === 0;
  const endEndOfDay =
    range.end.getHours() === 23 && range.end.getMinutes() === 59;
  return !(startMidnight && endEndOfDay);
}

function formatDateTime(d: Date, lang: Lang, withTime: boolean): string {
  const loc = localeFor(lang);
  return format(d, withTime ? "MMM d, yyyy HH:mm" : "MMM d, yyyy", {
    locale: loc,
  });
}

/** Human-readable "Apr 16–May 16, 2026" / Arabic equivalent. Adds
 *  "HH:mm" when the range carries hour precision. */
export function dateRangeSummary(range: DateRange, lang: Lang): string {
  const loc = localeFor(lang);
  const withTime = showsTime(range);
  if (isSameDay(range.start, range.end) && !withTime) {
    return format(range.start, "MMM d, yyyy", { locale: loc });
  }
  if (isSameDay(range.start, range.end) && withTime) {
    const day = format(range.start, "MMM d, yyyy", { locale: loc });
    const s = format(range.start, "HH:mm", { locale: loc });
    const e = format(range.end, "HH:mm", { locale: loc });
    return `${day}, ${s} – ${e}`;
  }
  if (isSameYear(range.start, range.end) && !withTime) {
    return `${format(range.start, "MMM d", { locale: loc })} – ${format(range.end, "MMM d, yyyy", { locale: loc })}`;
  }
  return `${formatDateTime(range.start, lang, withTime)} – ${formatDateTime(range.end, lang, withTime)}`;
}

export function granularityLabel(g: Granularity, lang: Lang): string {
  if (lang === "ar") {
    return {
      hour: "بالساعة",
      day: "يومي",
      week: "أسبوعي",
      month: "شهري",
      quarter: "ربعي",
      year: "سنوي",
    }[g];
  }
  return {
    hour: "Hourly",
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
    quarter: "Quarterly",
    year: "Yearly",
  }[g];
}
