/**
 * Human name for a tenant plan, in the merchant's language.
 *
 * Lived inside AppSidebar until the header needed the same names. Shared so
 * the two never drift — a merchant seeing "Pay as you Grow" in one corner of
 * the shell and "payg" in another is how a plan looks broken.
 */
const PLAN_LABELS: Record<string, { en: string; ar: string }> = {
  trial: { en: "Trial", ar: "تجربة مجانية" },
  demo: { en: "Trial", ar: "تجربة مجانية" },
  free: { en: "Free plan", ar: "الباقة المجانية" },
  beta: { en: "Beta", ar: "بيتا" },
  payg: { en: "Pay as you Grow", ar: "ادفع وأنت تنمو" },
  starter: { en: "Starter plan", ar: "باقة Starter" },
  pro: { en: "Pro plan", ar: "باقة Pro" },
  enterprise: { en: "Enterprise", ar: "إنتربرايز" },
};

/** Falls back to the raw key for a plan we have no copy for, and to an
 *  ellipsis while the session is still loading. */
export function planLabel(plan: string | null | undefined, isRTL: boolean): string {
  if (!plan) return "…";
  const entry = PLAN_LABELS[plan];
  if (!entry) return plan;
  return isRTL ? entry.ar : entry.en;
}
