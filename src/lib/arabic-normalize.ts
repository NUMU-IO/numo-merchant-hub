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

export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .replace(TASHKEEL, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .trim();
}

/** True when `haystack` contains `needle` after folding both sides. */
export function arabicIncludes(haystack: string, needle: string): boolean {
  const n = normalizeArabic(needle);
  if (!n) return true;
  return normalizeArabic(haystack).includes(n);
}
