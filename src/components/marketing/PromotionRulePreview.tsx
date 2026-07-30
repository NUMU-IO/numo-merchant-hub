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
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney } from "@/lib/format-money";
import {
  multibuyBreakEvenCents,
  previewDiscount,
  sampleCartFor,
  SAMPLE_PREVIEW_CART,
  type PreviewLine,
} from "@/lib/preview-discount";

export function PromotionRulePreview({ rule }: { rule: DiscountRule }) {
  const { t, i18n } = useTranslation();
  const { currentStore } = useDashboardStore();
  const isAr = i18n.language === "ar";
  const locale = isAr ? "ar" : "en";
  // ONE currency source for the whole promotions surface: the loaded store.
  // `formatMoney`'s module-level fallback is a frame behind on a store switch
  // (StoreProvider pushes it from an effect), so a SAR store would paint EGP
  // once before correcting. Read the store directly and there is no window.
  const currency = currentStore?.default_currency;

  /**
   * Every figure in this pane, in the STORE's currency — never a hardcoded
   * "EGP", never raw minor units. Whole units for readability, but a real
   * amount is never rounded away to zero: "−EGP 0" tells the merchant their
   * offer saves nothing when it saves a few piasters, which is the exact lie
   * this pane exists to prevent.
   */
  const money = (cents: number): string => {
    const major = cents / 100;
    const shown =
      cents !== 0 && Math.abs(major) < 1
        ? Number(major.toFixed(2))
        : Math.round(major);
    return formatMoney(shown, { locale, currency });
  };

  /**
   * Money the COPY makes a precise, checkable claim about — a break-even
   * threshold, a minimum-subtotal gate, the bundle price the merchant typed.
   * These print exactly; `money()`'s whole-unit rounding is for the sample
   * cart's own figures, where readability wins and nothing is promised.
   *
   * Rounding a threshold makes the sentence name a price that behaves
   * differently from the price it names — regression F24 in a different coat.
   * Both directions bite: floor(65000/3) = 216.66 rounds UP to "above EGP 217",
   * excluding 216.67–216.99, which genuinely qualify; a break-even of 216.30
   * rounds DOWN to "above EGP 216", naming 216.10 as qualifying when it does
   * not. The guard sentence and the break-even line share this formatter, so
   * the two figures the pane prints can never disagree either.
   */
  const moneyExact = (cents: number): string =>
    formatMoney(Number((cents / 100).toFixed(2)), { locale, currency });

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

  // Format the explanation's money params. `previewDiscount` names them with a
  // `_cents` suffix precisely so this mapping can't be forgotten silently — an
  // unmapped one would print "65000" where the merchant expects "EGP 650".
  const explainParams: Record<string, string | number> = {
    ...(result.explanation_params ?? {}),
  };
  for (const [from, to] of [
    ["amount_cents", "amount"],
    ["break_even_cents", "breakEven"],
  ] as const) {
    const raw = explainParams[from];
    if (typeof raw === "number") {
      explainParams[to] = moneyExact(raw);
      delete explainParams[from];
    }
  }

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
            <span>{money(li.unit_price_cents)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-xs border-t border-border/60 pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {t("promotions.form.preview_subtotal")}
          </span>
          <span className="font-medium">{money(subtotal)}</span>
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
            −{money(result.discount_cents)}
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
          <span>{money(total)}</span>
        </div>
      </div>

      {/* Localized, with the engine's English sentence as the fallback so a
          missing key degrades to something true rather than to a raw key.
          Money params arrive as minor units under a `*_cents` name and are
          formatted here — the copy interpolates `{{amount}}`/`{{breakEven}}`,
          never a raw figure. */}
      <p className="text-[11px] text-muted-foreground italic">
        {t(`promotions.form.preview_explain.${result.explanation_key}`, {
          ...explainParams,
          defaultValue: result.explanation,
        })}
      </p>
      {breakEvenCents != null && (
        <p className="text-[11px] text-muted-foreground">
          {t("promotions.form.preview_break_even", {
            price: moneyExact(breakEvenCents),
          })}
        </p>
      )}
    </div>
  );
}

/** Optional — exported in case callers want to feed real cart data. */
export type { PreviewLine };
