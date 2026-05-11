/**
 * Plan-tier comparison helper for theme locks.
 *
 * Themes carry an optional ``required_plan`` set by platform admins. The
 * merchant's current plan comes from ``tenant.plan`` (auth response). This
 * module decides whether the merchant's tier meets a theme's threshold.
 *
 * Tier order: free < starter < pro < enterprise.
 *
 * ``trial`` and ``demo`` count as ``starter``-equivalent for unlock
 * purposes — merchants in the 30-day trial get to try Starter-tier themes,
 * but Pro-/Enterprise-gated themes still require an explicit upgrade. This
 * matches the trial UX everywhere else in the dashboard.
 */

export type Tier = "free" | "starter" | "pro" | "enterprise";

const TIER_ORDER: Record<string, number> = {
  free: 0,
  trial: 1,
  demo: 1,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function canUnlockTheme(
  merchantPlan: string | null | undefined,
  requiredPlan: Tier | undefined,
): boolean {
  if (!requiredPlan || requiredPlan === "free") return true;
  const m = TIER_ORDER[(merchantPlan ?? "free").toLowerCase()] ?? 0;
  const r = TIER_ORDER[requiredPlan] ?? 0;
  return m >= r;
}

/** Display label for a tier — English. */
export function tierLabel(tier: Tier | undefined): string {
  if (!tier || tier === "free") return "Free";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Display label for a tier — Arabic. */
export function tierLabelAr(tier: Tier | undefined): string {
  switch (tier) {
    case "starter":
      return "ستارتر";
    case "pro":
      return "برو";
    case "enterprise":
      return "إنتربرايز";
    default:
      return "مجاني";
  }
}
