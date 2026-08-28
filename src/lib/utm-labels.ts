/**
 * Human labels for UTM attribution values.
 *
 * Attribution rows key on the raw UTM value a link carried — `ig`, `fb`,
 * `cpc`. The LTV table was rendering those verbatim, so an Egyptian merchant
 * looking at where their customers came from read a column of lowercase
 * two-letter codes. `ig` is not a word in either of the hub's languages.
 *
 * Deliberately NOT applied to campaign names: those are typed by the merchant
 * and mean whatever they meant when they typed them. Mapping there would
 * rewrite their own words back at them.
 */

interface Label {
  en: string;
  ar: string;
}

/** utm_source — where the click came from. */
const SOURCES: Record<string, Label> = {
  ig: { en: "Instagram", ar: "إنستجرام" },
  instagram: { en: "Instagram", ar: "إنستجرام" },
  fb: { en: "Facebook", ar: "فيسبوك" },
  facebook: { en: "Facebook", ar: "فيسبوك" },
  meta: { en: "Meta", ar: "ميتا" },
  tiktok: { en: "TikTok", ar: "تيك توك" },
  google: { en: "Google", ar: "جوجل" },
  youtube: { en: "YouTube", ar: "يوتيوب" },
  snapchat: { en: "Snapchat", ar: "سناب شات" },
  x: { en: "X (Twitter)", ar: "إكس (تويتر)" },
  twitter: { en: "X (Twitter)", ar: "إكس (تويتر)" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  wa: { en: "WhatsApp", ar: "واتساب" },
  telegram: { en: "Telegram", ar: "تليجرام" },
  email: { en: "Email", ar: "إيميل" },
  newsletter: { en: "Newsletter", ar: "النشرة البريدية" },
  sms: { en: "SMS", ar: "رسائل نصية" },
  direct: { en: "Direct", ar: "مباشر" },
  referral: { en: "Referral", ar: "إحالة" },
  organic: { en: "Organic", ar: "طبيعي" },
};

/** utm_medium — how it was delivered. */
const MEDIUMS: Record<string, Label> = {
  cpc: { en: "Paid search", ar: "بحث مدفوع" },
  ppc: { en: "Paid search", ar: "بحث مدفوع" },
  paid: { en: "Paid", ar: "مدفوع" },
  paid_social: { en: "Paid social", ar: "سوشيال مدفوع" },
  social: { en: "Social", ar: "سوشيال" },
  organic: { en: "Organic", ar: "طبيعي" },
  email: { en: "Email", ar: "إيميل" },
  referral: { en: "Referral", ar: "إحالة" },
  affiliate: { en: "Affiliate", ar: "تسويق بالعمولة" },
  display: { en: "Display", ar: "إعلانات مصوّرة" },
  none: { en: "Direct", ar: "مباشر" },
  direct: { en: "Direct", ar: "مباشر" },
};

/** Title-case an unmapped value so it at least reads as a word. */
function humanize(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function lookup(table: Record<string, Label>, raw: string, isAr: boolean): string {
  const key = raw.trim().toLowerCase();
  if (!key) return isAr ? "غير محدد" : "Unknown";
  const hit = table[key];
  if (hit) return isAr ? hit.ar : hit.en;
  return humanize(raw);
}

export function utmSourceLabel(raw: string, isAr: boolean): string {
  return lookup(SOURCES, raw, isAr);
}

export function utmMediumLabel(raw: string, isAr: boolean): string {
  return lookup(MEDIUMS, raw, isAr);
}

/**
 * Label an attribution row by what it is grouped on. Campaign values pass
 * through untouched — see the note at the top of this file.
 */
export function attributionLabel(
  raw: string,
  groupBy: "source" | "medium" | "campaign",
  isAr: boolean,
): string {
  if (groupBy === "source") return utmSourceLabel(raw, isAr);
  if (groupBy === "medium") return utmMediumLabel(raw, isAr);
  return raw.trim() || (isAr ? "غير محدد" : "Unknown");
}
