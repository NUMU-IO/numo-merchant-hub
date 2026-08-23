const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** "١٢٠٫٥" / "120,5" / " 120.50 " → 12050. Never NaN. */
export function parseMoneyToCents(raw: string): number {
  let s = raw.trim();
  for (let i = 0; i < 10; i++) s = s.split(ARABIC_DIGITS[i]).join(String(i));
  s = s.replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // + EPSILON guards 1.005 * 100 = 100.49999 → 100 instead of 101.
  return Math.max(0, Math.round((n + Number.EPSILON) * 100));
}
