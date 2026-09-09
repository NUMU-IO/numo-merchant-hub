/**
 * Arabic plural agreement for counted nouns.
 *
 * Arabic does not have English's two-way singular/plural split. A count
 * selects between five forms, and getting it wrong reads as broken copy to a
 * native speaker — the hub was shipping "٣ عميل" (3 customer) and "٤ مرة"
 * (4 time) because every call site interpolated one hardcoded noun.
 *
 * The categories follow CLDR for `ar`:
 *
 *   0            zero   ٠ عملاء
 *   1            one    عميل واحد
 *   2            two    عميلين
 *   n%100 3–10   few    ٥ عملاء
 *   n%100 11–99  many   ١٥ عميل
 *   otherwise    other  ١٠١ عميل
 *
 * Forms are written in the Egyptian register the rest of the hub uses
 * (عميلين, not the MSA dual عميلان), because that is the voice merchants
 * read everywhere else in the product.
 */

export interface ArabicPluralForms {
  /** n = 1 — also the fallback for `other` when unset. */
  one: string;
  /** n = 2. */
  two: string;
  /** n % 100 in 3–10. */
  few: string;
  /** n % 100 in 11–99. */
  many: string;
  /** n = 0. Defaults to `few`, the natural reading for "no customers". */
  zero?: string;
  /** n % 100 in 0–2 above 100 (101, 102, …). Defaults to `one`. */
  other?: string;
}

/** Pick the Arabic noun form that agrees with `count`. */
export function pluralAr(count: number, forms: ArabicPluralForms): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 0) return forms.zero ?? forms.few;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return forms.few;
  if (mod100 >= 11 && mod100 <= 99) return forms.many;
  return forms.other ?? forms.one;
}

/**
 * `count` + its agreeing noun, e.g. `٣ عملاء`.
 *
 * The number is rendered with Arabic-Indic digits to match the rest of the
 * Arabic UI, which formats through `toLocaleString("ar-EG")`.
 */
export function countAr(count: number, forms: ArabicPluralForms): string {
  return `${count.toLocaleString("ar-EG")} ${pluralAr(count, forms)}`;
}

/**
 * Relative-past phrasing: `منذ دقيقة` / `منذ دقيقتين` / `منذ ٥ دقائق`.
 *
 * One and two are carried by the noun form itself in Arabic — "منذ ١ دقيقة"
 * is wrong the way "1 minute ago" is right, so the numeral is dropped there.
 */
export function agoAr(count: number, forms: ArabicPluralForms): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1 || n === 2) return `منذ ${pluralAr(n, forms)}`;
  return `منذ ${countAr(n, forms)}`;
}

/* Shared noun tables — declared once so two screens counting the same thing
   cannot drift into disagreeing about how to say it. */

export const AR_CUSTOMERS: ArabicPluralForms = {
  one: "عميل",
  two: "عميلين",
  few: "عملاء",
  many: "عميل",
};

export const AR_TIMES_USED: ArabicPluralForms = {
  one: "مرة",
  two: "مرتين",
  few: "مرات",
  many: "مرة",
};

export const AR_MEMBERS: ArabicPluralForms = {
  one: "عضو",
  two: "عضوين",
  few: "أعضاء",
  many: "عضو",
};

export const AR_MINUTES: ArabicPluralForms = {
  one: "دقيقة",
  two: "دقيقتين",
  few: "دقائق",
  many: "دقيقة",
};

export const AR_HOURS: ArabicPluralForms = {
  one: "ساعة",
  two: "ساعتين",
  few: "ساعات",
  many: "ساعة",
};

export const AR_DAYS: ArabicPluralForms = {
  one: "يوم",
  two: "يومين",
  few: "أيام",
  many: "يوم",
};

export const AR_PARCELS: ArabicPluralForms = {
  one: "شحنة",
  two: "شحنتين",
  few: "شحنات",
  many: "شحنة",
};
