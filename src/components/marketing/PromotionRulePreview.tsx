/**
 * PromotionRulePreview — live discount math next to the rule fields.
 *
 * Renders a small fake cart and the computed discount as the merchant
 * types. Shopify shows nothing here — this is one of NUMU's deliberate
 * UX edges. The math comes from `previewDiscount()`, a slim TS port of
 * the Python `_bogo()` / `_tiered()` calculators, so the number the
 * merchant sees is the same number the storefront will charge.
 *
 * Read-only — no inputs, no state. Updates whenever `rule` changes.
 * The sample cart is fixed (4 items at 100 / 80 / 60 / 40 EGP) so the
 * merchant can quickly intuit "OK, the cheapest unit goes free" without
 * having to mentally model their actual catalog.
 */

import { useTranslation } from "react-i18next";

import type { DiscountRule } from "@/services/promotionApi";
import {
  previewDiscount,
  SAMPLE_PREVIEW_CART,
  type PreviewLine,
} from "@/lib/preview-discount";

export function PromotionRulePreview({ rule }: { rule: DiscountRule }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const result = previewDiscount(rule, SAMPLE_PREVIEW_CART);
  const subtotal = SAMPLE_PREVIEW_CART.reduce(
    (s, li) => s + li.unit_price_cents * li.quantity,
    0,
  );
  const total = Math.max(0, subtotal - result.discount_cents);

  return (
    <div
      className="rounded-md border border-border bg-muted/30 p-4 space-y-3"
      data-testid="promotion-rule-preview"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("promotions.form.preview_title")}
        </h4>
        <span className="text-[10px] text-muted-foreground">
          {t("promotions.form.preview_sample_label")}
        </span>
      </div>

      <ul className="space-y-1 text-xs font-mono text-muted-foreground">
        {SAMPLE_PREVIEW_CART.map((li, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {isAr ? "وحدة" : "Item"} {i + 1} × {li.quantity}
            </span>
            <span>{(li.unit_price_cents / 100).toFixed(0)} EGP</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-xs border-t border-border/60 pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {t("promotions.form.preview_subtotal")}
          </span>
          <span className="font-medium">
            {(subtotal / 100).toFixed(0)} EGP
          </span>
        </div>
        <div
          className={
            result.discount_cents > 0
              ? "flex justify-between text-emerald-600"
              : "flex justify-between text-muted-foreground"
          }
        >
          <span>{t("promotions.form.preview_discount")}</span>
          <span className="font-medium">
            −{(result.discount_cents / 100).toFixed(0)} EGP
          </span>
        </div>
        {result.free_shipping && (
          <div className="flex justify-between text-emerald-600">
            <span>{t("promotions.form.preview_free_shipping")}</span>
            <span className="font-medium">✓</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1">
          <span>{t("promotions.form.preview_total")}</span>
          <span>{(total / 100).toFixed(0)} EGP</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        {result.explanation}
      </p>
    </div>
  );
}

/** Optional — exported in case callers want to feed real cart data. */
export type { PreviewLine };
