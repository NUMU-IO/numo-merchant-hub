/**
 * Fold Arabic text for search matching.
 *
 * `toLowerCase()` is a no-op for Arabic, and merchants type search terms
 * without hamza / ta-marbuta / diacritic precision: "اعدادات" must match
 * "إعدادات", "المحفظه" must match "المحفظة", "مصرى" must match "مصري".
 * This collapses those orthographic variants (and Arabic-Indic digits) so
 * substring matching behaves the way a person expects. Latin text is
 * lower-cased as before.
 */

const TASHKEEL = /[ً-ْٰـ]/g; // harakat, dagger alif, tatweel
const ALEF_VARIANTS = /[آأإٱ]/g; // آ أ إ ٱ → ا
const ARABIC_INDIC_DIGITS = /[٠-٩]/g; // ٠-٩
const EASTERN_ARABIC_DIGITS = /[۰-۹]/g; // ۰-۹ (Persian/Urdu keyboards)

/**
 * ٠-٩ and ۰-۹ → 0-9, and the Arabic decimal/thousands marks (٫ ٬) → "." / "".
 * Arabic keyboards type these by default, and JS's `\d` (and
 * `<input type="number">`) only accept ASCII digits, so an unnormalized
 * field silently drops what the merchant typed.
 */
export function toLatinDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}

/** What a number field should hold: Latin digits, plus one kind of decimal
 *  point for money. "١٥٠٠" → "1500", "1,500" → "1500" (as type="number" did). */
export function toNumericInput(input: string, decimal = true): string {
  return toLatinDigits(input).replace(decimal ? /[^\d.]/g : /\D/g, "");
}

export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return "";
  return toLatinDigits(
    input
      .normalize("NFKC")
      .replace(TASHKEEL, "")
      .replace(ALEF_VARIANTS, "ا")
      .replace(/ة/g, "ه") // ة → ه
      .replace(/ى/g, "ي") // ى → ي
      .replace(/ؤ/g, "و") // ؤ → و
      .replace(/ئ/g, "ي"), // ئ → ي
  )
    .toLowerCase()
    .trim();
}

/** True when `haystack` contains `needle` after folding both sides. */
export function arabicIncludes(haystack: string, needle: string): boolean {
  const n = normalizeArabic(needle);
  if (!n) return true;
  return normalizeArabic(haystack).includes(n);
}
