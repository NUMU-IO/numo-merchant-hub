/**
 * Tiny TS mirror of `_bogo()` / `_tiered()` from
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
 * tiered). Min subtotal + max-discount cap match the Python.
 */

import type { DiscountRule } from "@/services/promotionApi";

export interface PreviewLine {
  /** Cents per unit. Whole-EGP UI multiplies by 100 before calling. */
  unit_price_cents: number;
  quantity: number;
}

export interface PreviewResult {
  discount_cents: number;
  free_shipping: boolean;
  /** Plain English (en) — the form renders this as a hint under the math. */
  explanation: string;
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
    };
  }

  const cap = (raw: number) => {
    let v = Math.max(0, raw);
    if (rule.max_discount_cents != null) v = Math.min(v, rule.max_discount_cents);
    return Math.min(v, subtotal);
  };

  switch (rule.kind) {
    case "free_shipping":
      return { discount_cents: 0, free_shipping: true, explanation: "free shipping" };
    case "percentage": {
      const pct = rule.value_percent ?? 0;
      const raw = Math.floor((subtotal * pct) / 100);
      return {
        discount_cents: cap(raw),
        free_shipping: false,
        explanation: `${pct}% off`,
      };
    }
    case "fixed": {
      const v = rule.value_cents ?? 0;
      return {
        discount_cents: cap(v),
        free_shipping: false,
        explanation: `${v} cents off`,
      };
    }
    case "bogo": {
      const buyQ = rule.buy_quantity ?? 0;
      const getQ = rule.get_quantity ?? 0;
      const pct = rule.get_discount_percent ?? 100;
      if (buyQ < 1 || getQ < 1) {
        return { discount_cents: 0, free_shipping: false, explanation: "bogo not configured" };
      }
      // Sort cheapest first — discount lands on cheapest qualifying units.
      const sorted = [...lines].sort(
        (a, b) => a.unit_price_cents - b.unit_price_cents,
      );
      const totalUnits = sorted.reduce((s, li) => s + li.quantity, 0);
      const bundleSize = buyQ + getQ;
      const bundles = Math.floor(totalUnits / bundleSize);
      if (bundles === 0) {
        return { discount_cents: 0, free_shipping: false, explanation: "bogo not met" };
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
      };
    }
    default:
      return {
        discount_cents: 0,
        free_shipping: false,
        explanation: "unknown rule kind",
      };
  }
}
