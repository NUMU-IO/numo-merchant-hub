/**
 * One human sentence for a discount rule — "17% off", "3 for EGP 650".
 *
 * Shared by the Discounts table and the offer detail page so both name the
 * same offer the same way. Money is rendered through `formatMoney` with the
 * STORE's currency: a Saudi merchant's offer must never read "EGP".
 */

import type { TFunction } from "i18next";

import { formatMoney } from "@/lib/format-money";
import type { DiscountRule } from "@/services/promotionApi";

export function describeDiscountRule(
  rule: DiscountRule | null | undefined,
  t: TFunction,
  opts: { locale: "ar" | "en"; currency?: string | null },
): string {
  const money = (cents: number | null | undefined) =>
    formatMoney(cents ?? 0, {
      fromCents: true,
      locale: opts.locale,
      currency: opts.currency ?? undefined,
    });

  if (!rule) return t("promotions.list.discount_none") as string;
  switch (rule.kind) {
    case "percentage":
      return t("promotions.list.discount_percent", {
        value: rule.value_percent ?? 0,
      }) as string;
    case "fixed":
      return t("promotions.list.discount_fixed", {
        value: money(rule.value_cents),
      }) as string;
    case "free_shipping":
      return t("promotions.list.discount_free_shipping") as string;
    case "bogo":
      // Spell the actual quantities out — "buy X get Y" told a merchant with
      // four BOGO offers nothing about which row is which.
      return t("promotions.list.discount_bogo_detail", {
        buy: rule.buy_quantity ?? 0,
        get: rule.get_quantity ?? 0,
        percent: rule.get_discount_percent ?? 100,
      }) as string;
    case "tiered":
      return t("promotions.list.discount_tiered_detail", {
        count: rule.tiers?.length ?? 0,
      }) as string;
    case "multibuy":
      // The value IS the offer here ("3 for EGP 650"), so show it rather
      // than a generic kind label.
      return t("promotions.list.discount_multibuy", {
        quantity: rule.multibuy_quantity ?? 0,
        price: money(rule.multibuy_price_cents),
      }) as string;
    default:
      return t("promotions.list.discount_none") as string;
  }
}
