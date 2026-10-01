import { normalizeArabic } from "@/lib/arabic-normalize";

// Egyptian-leaning spelling (ج → g). Short vowels aren't written in Arabic,
// so the result is a starting suggestion the merchant can still edit.
const LETTERS: Record<string, string> = {
  ا: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d",
  ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t",
  ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", و: "o", ي: "i", ء: "",
};

function transliterateWord(word: string): string {
  if (word.startsWith("ال") && word.length > 3) return `el-${transliterateWord(word.slice(2))}`;
  return [...word]
    .map((ch, i) => (i === 0 && ch === "و" ? "w" : i === 0 && ch === "ي" ? "y" : LETTERS[ch] ?? ch))
    .join("");
}

/** Store name (Arabic or Latin) → subdomain suggestion: `بيت الخزف` → `bit-el-khzf`. */
export function toStoreSlug(input: string): string {
  return normalizeArabic(input.replace(/ة/g, "a"))
    .split(/\s+/)
    .map(transliterateWord)
    .join("-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
    .replace(/-$/, "");
}
