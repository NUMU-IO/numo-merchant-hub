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
 * The sample cart comes from `sampleCartFor(rule)`: a fixed 4 items at
 * 100 / 80 / 60 / 40 EGP for most kinds, so the merchant can intuit "OK,
 * the cheapest unit goes free" without modelling their catalog — but
 * DERIVED from the rule for multibuy, because the fixed cart is too cheap
 * to trigger any realistic bundle and would preview the offer as −0.
 */

import { useTranslation } from "react-i18next";

import type { DiscountRule } from "@/services/promotionApi";
import {
  multibuyBreakEvenCents,
  previewDiscount,
  sampleCartFor,
  SAMPLE_PREVIEW_CART,
  type PreviewLine,
} from "@/lib/preview-discount";

/**
 * Whole pounds for readability, but never round a real amount away to zero.
 * A small discount (a few piasters) rendered as "−0 EGP" tells the merchant
 * their offer saves nothing when it actually saves something — the exact lie
 * the preview pane exists to prevent. Show piasters only when we'd otherwise
 * print a misleading 0.
 */
function egp(cents: number): string {
  const major = cents / 100;
  return cents !== 0 && Math.abs(major) < 1
    ? major.toFixed(2)
    : major.toFixed(0);
}

export function PromotionRulePreview({ rule }: { rule: DiscountRule }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Multibuy gets a cart derived from its own rule — the fixed sample cart
  // is too cheap to ever trigger a realistic bundle, so the flagship
  // "3 for EGP 650" preset would preview as a flat 0 and read as broken.
  const cart = sampleCartFor(rule);
  const result = previewDiscount(rule, cart);
  const breakEvenCents =
    rule.kind === "multibuy" ? multibuyBreakEvenCents(rule) : null;
  const subtotal = cart.reduce(
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
          {/* Item count is dynamic now — multibuy derives its own cart, so a
              hardcoded "4-item" label would lie for any N other than 3. */}
          {t("promotions.form.preview_sample_label", { count: cart.length })}
        </span>
      </div>

      <ul className="space-y-1 text-xs font-mono text-muted-foreground">
        {cart.map((li, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {isAr ? "وحدة" : "Item"} {i + 1} × {li.quantity}
            </span>
            <span>{egp(li.unit_price_cents)} EGP</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-xs border-t border-border/60 pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {t("promotions.form.preview_subtotal")}
          </span>
          <span className="font-medium">
            {egp(subtotal)} EGP
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
            −{egp(result.discount_cents)} EGP
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
          <span>{egp(total)} EGP</span>
        </div>
      </div>

      {/* Localized, with the engine's English sentence as the fallback so a
          missing key degrades to something true rather than to a raw key. */}
      <p className="text-[11px] text-muted-foreground italic">
        {t(`promotions.form.preview_explain.${result.explanation_key}`, {
          ...(result.explanation_params ?? {}),
          defaultValue: result.explanation,
        })}
      </p>
      {breakEvenCents != null && (
        <p className="text-[11px] text-muted-foreground">
          {t("promotions.form.preview_break_even", {
            price: (breakEvenCents / 100).toFixed(2),
          })}
        </p>
      )}
    </div>
  );
}

/** Optional — exported in case callers want to feed real cart data. */
export type { PreviewLine };
