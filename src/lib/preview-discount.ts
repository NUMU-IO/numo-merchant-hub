/**
 * Tiny TS mirror of `_bogo()` / `_tiered()` / `_multibuy()` from
 * `NUMU-api/src/core/value_objects/discount_rule.py`.
 *
 * Used ONLY for the merchant builder's live-preview pane so the
 * merchant sees the same number the storefront will charge as they
 * type. Customer-facing math always runs on the server — there is no
 * client-side discount source of truth in the storefront. If you find
 * yourself reaching for this on the storefront, stop and call the
 * `/cart/discounts` endpoint instead.
 *
 * Kept deliberately thin: only the arithmetic shapes the form can
 * configure today (percentage / fixed / free_shipping / bogo /
 * tiered / multibuy). Min subtotal + max-discount cap match the Python.
 *
 * ⚠️ When you add a rule kind to the engine, add it here too. The
 * `default` branch returns a 0 discount, so a missing kind doesn't error —
 * it quietly tells the merchant their offer saves nothing, which is worse
 * than an error because they'll believe it.
 *
 * Preview only ever runs on the fixed sample cart below; it never prices a
 * real one. Note it also can't see product/category targeting, so a scoped
 * offer previews as if every sample item qualified — the number is the
 * shape of the math, not a promise about a specific catalogue.
 */

import type { DiscountRule } from "@/services/promotionApi";

export interface PreviewLine {
  /** Minor units per unit. Callers convert with `majorToMinor` first. */
  unit_price_cents: number;
  quantity: number;
}

export interface PreviewResult {
  discount_cents: number;
  free_shipping: boolean;
  /**
   * Plain English, mirroring the Python rule's own `explanation` so the two
   * can be diffed. Kept as the render fallback, but prefer the localized
   * `explanation_key` — the dashboard's primary locale is Arabic, and on a
   * 0-discount preview this sentence is the ONLY thing telling the merchant
   * why their offer didn't fire.
   */
  explanation: string;
  /** i18n key under `promotions.preview.*` for the same sentence. */
  explanation_key: string;
  /**
   * Interpolation values for `explanation_key`.
   *
   * Any key ending in `_cents` holds integer MINOR units and must be run
   * through the store's money formatter before it reaches a merchant — the
   * render layer (`PromotionRulePreview`) maps `amount_cents` → `amount` and
   * `break_even_cents` → `breakEven`, both formatted in the store's own
   * currency. The `_cents` suffix is the contract: an unmapped raw number
   * reaching the UI reads as a 100x price.
   */
  explanation_params?: Record<string, string | number>;
}

/** Sample cart used by the preview pane when the merchant hasn't yet
 *  picked products. Four units at descending prices give the BOGO
 *  cheapest-unit logic something visible to compute on. */
export const SAMPLE_PREVIEW_CART: PreviewLine[] = [
  { unit_price_cents: 10000, quantity: 1 },
  { unit_price_cents: 8000, quantity: 1 },
  { unit_price_cents: 6000, quantity: 1 },
  { unit_price_cents: 4000, quantity: 1 },
];

/**
 * Break-even unit price for a multibuy rule: below this, N items already
 * cost less than the bundle, so the offer correctly refuses to apply.
 * Surfaced in the preview so "why is my discount 0?" answers itself.
 */
export function multibuyBreakEvenCents(rule: DiscountRule): number | null {
  const n = rule.multibuy_quantity ?? 0;
  const p = rule.multibuy_price_cents ?? 0;
  if (n < 2 || p <= 0) return null;
  return Math.floor(p / n);
}

/**
 * The cart the preview pane should price for a given rule.
 *
 * The fixed `SAMPLE_PREVIEW_CART` (100/80/60/40 EGP) was chosen to show off
 * BOGO's cheapest-unit rule, and it can never trigger a realistically-priced
 * multibuy — three sample items total EGP 240, so anything but a "3 for
 * EGP 200"-style offer previews as a flat 0. That makes the flagship
 * "3 for EGP 650" preset look broken the instant a merchant clicks it.
 *
 * So for multibuy we synthesize a cart FROM the rule: N+1 units priced a
 * comfortable 25% above the break-even, which demonstrates one complete
 * bundle plus one item left at full price — the two behaviours a merchant
 * actually needs to understand. Every other kind keeps the fixed cart.
 */
export function sampleCartFor(rule: DiscountRule): PreviewLine[] {
  if (rule.kind !== "multibuy") return SAMPLE_PREVIEW_CART;
  const n = rule.multibuy_quantity ?? 0;
  const breakEven = multibuyBreakEvenCents(rule);
  // `== null`, not falsy: a rule with P < N floors to a break-even of 0, which
  // is a valid (if absurd) offer. Treating 0 as "unconfigured" bailed to the
  // 4-item fixed cart, which can't even form a group when N >= 5.
  if (breakEven == null || n < 2) return SAMPLE_PREVIEW_CART;
  // Round to a whole pound so the preview reads like a real price tag — but
  // never below `breakEven + 1`, or the rounding swallows the margin and the
  // pane invents a cart it then declares too cheap (happens when the
  // break-even sits just above a whole pound).
  const unit = Math.max(
    100,
    breakEven + 1,
    Math.round((breakEven * 1.25) / 100) * 100,
  );
  return Array.from({ length: n + 1 }, () => ({
    unit_price_cents: unit,
    quantity: 1,
  }));
}

export function previewDiscount(
  rule: DiscountRule,
  lines: PreviewLine[] = SAMPLE_PREVIEW_CART,
): PreviewResult {
  const subtotal = lines.reduce(
    (sum, li) => sum + li.unit_price_cents * li.quantity,
    0,
  );
  if (
    rule.min_subtotal_cents != null &&
    subtotal < rule.min_subtotal_cents
  ) {
    return {
      discount_cents: 0,
      free_shipping: false,
      explanation: `subtotal below minimum (${rule.min_subtotal_cents} cents)`,
      explanation_key: "below_minimum",
      explanation_params: { amount_cents: rule.min_subtotal_cents },
    };
  }

  const cap = (raw: number) => {
    let v = Math.max(0, raw);
    if (rule.max_discount_cents != null) v = Math.min(v, rule.max_discount_cents);
    return Math.min(v, subtotal);
  };

  switch (rule.kind) {
    case "free_shipping":
      return {
        discount_cents: 0,
        free_shipping: true,
        explanation: "free shipping",
        explanation_key: "free_shipping",
      };
    case "percentage": {
      const pct = rule.value_percent ?? 0;
      const raw = Math.floor((subtotal * pct) / 100);
      return {
        discount_cents: cap(raw),
        free_shipping: false,
        explanation: `${pct}% off`,
        explanation_key: "percent_off",
        explanation_params: { percent: pct },
      };
    }
    case "fixed": {
      const v = rule.value_cents ?? 0;
      return {
        discount_cents: cap(v),
        free_shipping: false,
        explanation: `${v} cents off`,
        explanation_key: "fixed_off",
        explanation_params: { amount_cents: v },
      };
    }
    case "bogo": {
      const buyQ = rule.buy_quantity ?? 0;
      const getQ = rule.get_quantity ?? 0;
      const pct = rule.get_discount_percent ?? 100;
      if (buyQ < 1 || getQ < 1) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: "bogo not configured",
          explanation_key: "bogo_not_configured",
        };
      }
      // Sort cheapest first — discount lands on cheapest qualifying units.
      const sorted = [...lines].sort(
        (a, b) => a.unit_price_cents - b.unit_price_cents,
      );
      const totalUnits = sorted.reduce((s, li) => s + li.quantity, 0);
      const bundleSize = buyQ + getQ;
      const bundles = Math.floor(totalUnits / bundleSize);
      if (bundles === 0) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: "bogo not met",
          explanation_key: "bogo_not_met",
        };
      }
      let remaining = bundles * getQ;
      let total = 0;
      for (const li of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(li.quantity, remaining);
        const unitOff = Math.floor((li.unit_price_cents * pct) / 100);
        total += unitOff * take;
        remaining -= take;
      }
      return {
        discount_cents: cap(total),
        free_shipping: false,
        explanation: `buy ${buyQ} get ${getQ} @ ${pct}% off — ${bundles} bundle(s)`,
        explanation_key: "bogo_applied",
        explanation_params: { buy: buyQ, get: getQ, percent: pct, bundles },
      };
    }
    case "multibuy": {
      // Mirrors `_multibuy()`: expand to units, group MOST EXPENSIVE first
      // (customer-optimal), and stop at the first group that isn't cheaper
      // than regular price — descending order proves no later group can be.
      const n = rule.multibuy_quantity ?? 0;
      const groupPrice = rule.multibuy_price_cents ?? 0;
      if (n < 2 || groupPrice <= 0) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: "multibuy not configured",
          explanation_key: "multibuy_not_configured",
        };
      }
      const units: number[] = [];
      for (const li of lines) {
        for (let i = 0; i < li.quantity; i++) units.push(li.unit_price_cents);
      }
      units.sort((a, b) => b - a);
      const groups = Math.floor(units.length / n);
      if (groups === 0) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: `multibuy needs ${n} eligible items, cart has ${units.length}`,
          explanation_key: "multibuy_needs",
          explanation_params: { quantity: n, have: units.length },
        };
      }
      let total = 0;
      let complete = 0;
      for (let g = 0; g < groups; g++) {
        const chunk = units.slice(g * n, (g + 1) * n);
        const groupSum = chunk.reduce((s, p) => s + p, 0);
        if (groupSum <= groupPrice) break;
        total += groupSum - groupPrice;
        complete += 1;
      }
      if (total <= 0) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: `multibuy price (${groupPrice} cents) is not below the regular price of ${n} items`,
          explanation_key: "multibuy_not_below",
          explanation_params: {
            amount_cents: groupPrice,
            quantity: n,
            // Must FLOOR, matching `multibuyBreakEvenCents` — rounding here
            // made the pane print two different figures two lines apart
            // (216.67 vs 216.66) and, worse, named a price that actually
            // qualifies as one that doesn't.
            break_even_cents: Math.floor(groupPrice / n),
          },
        };
      }
      return {
        discount_cents: cap(total),
        free_shipping: false,
        explanation: `${n} for ${groupPrice} cents — ${complete} group(s)`,
        explanation_key: "multibuy_applied",
        explanation_params: { quantity: n, amount_cents: groupPrice, groups: complete },
      };
    }
    case "tiered": {
      const eligible = (rule.tiers ?? []).filter(
        (t) => subtotal >= t.threshold_cents,
      );
      if (eligible.length === 0) {
        return {
          discount_cents: 0,
          free_shipping: false,
          explanation: "no tier threshold met",
          explanation_key: "tiered_none",
        };
      }
      const winner = eligible.reduce((best, t) =>
        t.threshold_cents > best.threshold_cents ? t : best,
      );
      const raw = Math.floor((subtotal * winner.percent) / 100);
      return {
        discount_cents: cap(raw),
        free_shipping: false,
        explanation: `${winner.percent}% off (tier ≥ ${winner.threshold_cents} cents)`,
        explanation_key: "tiered_applied",
        explanation_params: {
          percent: winner.percent,
          amount_cents: winner.threshold_cents,
        },
      };
    }
    default:
      return {
        discount_cents: 0,
        free_shipping: false,
        explanation: "unknown rule kind",
        explanation_key: "unknown",
      };
  }
}
