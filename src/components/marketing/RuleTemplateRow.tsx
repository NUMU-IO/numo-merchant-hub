/**
 * RuleTemplateRow — one-click presets for the most common discount shapes.
 *
 * Sits at the top of the discount-rule card in the promotion form.
 * Each chip prefills the rule kind + the relevant numeric fields so a
 * first-time merchant can ship "Buy 3 Get 1 Free" without learning
 * what `get_discount_percent` means. Tweaks after a prefill are still
 * possible — the chips don't lock the form.
 *
 * Templates are deliberately narrow: 6 shapes that cover ~90% of
 * Egyptian-market campaigns we've seen. Adding more is cheap; the
 * data structure is defined in one array below.
 */

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import type { DiscountRuleKind } from "@/services/promotionApi";

/** A preset configuration that the form can apply with one click. */
export interface RuleTemplate {
  /** Stable id used as React key + i18n suffix. */
  id: string;
  ruleKind: DiscountRuleKind;
  /** Pre-fill values for the matching kind's fields. Strings to match
   *  the form's `FormState` shape exactly; the form's `buildDiscountRule`
   *  parses to numbers.
   *
   *  Money fields are MAJOR units (650, not 65000) — the same units the
   *  form's inputs hold. `buildDiscountRule` converts to the API's minor
   *  units at its single boundary. */
  buyQuantity?: string;
  getQuantity?: string;
  getDiscountPercent?: string;
  valuePercent?: string;
  valueAmount?: string;
  tiers?: { threshold: string; percent: string }[];
  multibuyQuantity?: string;
  multibuyPrice?: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "bogo_2_1_free",
    ruleKind: "bogo",
    buyQuantity: "2",
    getQuantity: "1",
    getDiscountPercent: "100",
  },
  {
    id: "bogo_3_1_free",
    ruleKind: "bogo",
    buyQuantity: "3",
    getQuantity: "1",
    getDiscountPercent: "100",
  },
  {
    id: "bogo_2_1_half",
    ruleKind: "bogo",
    buyQuantity: "2",
    getQuantity: "1",
    getDiscountPercent: "50",
  },
  {
    // The "Ultimate Trio" shape: a fixed price for a group, repeating per
    // group. Major units — 650 is the price of the whole trio.
    id: "multibuy_3_for_650",
    ruleKind: "multibuy",
    multibuyQuantity: "3",
    multibuyPrice: "650",
  },
  {
    id: "multibuy_2_for_500",
    ruleKind: "multibuy",
    multibuyQuantity: "2",
    multibuyPrice: "500",
  },
  {
    id: "spend_1000_off_10",
    ruleKind: "tiered",
    tiers: [{ threshold: "1000", percent: "10" }],
  },
  {
    id: "spend_2000_off_20",
    ruleKind: "tiered",
    tiers: [{ threshold: "2000", percent: "20" }],
  },
  {
    id: "tiered_3_step",
    ruleKind: "tiered",
    tiers: [
      { threshold: "500", percent: "5" },
      { threshold: "1000", percent: "10" },
      { threshold: "2000", percent: "15" },
    ],
  },
];

/**
 * Amounts a chip's LABEL needs to name, in major units.
 *
 * The chip copy quotes money ("3 for 650", "Spend 1,000 → 10% off"), and that
 * money must carry the store's own currency — the label can't hardcode EGP or
 * a Saudi merchant reads a price in the wrong currency. Derived from the
 * template itself so the label and the values it applies can never disagree.
 */
function labelAmounts(
  tpl: RuleTemplate,
  locale: "ar" | "en",
): Record<string, string> {
  const money = (major?: string) =>
    major == null ? "" : formatMoney(Number(major), { locale });
  if (tpl.ruleKind === "multibuy") return { price: money(tpl.multibuyPrice) };
  if (tpl.ruleKind === "tiered" && tpl.tiers?.length)
    return { threshold: money(tpl.tiers[0].threshold) };
  if (tpl.ruleKind === "fixed") return { amount: money(tpl.valueAmount) };
  return {};
}

interface Props {
  onApply: (template: RuleTemplate) => void;
}

export function RuleTemplateRow({ onApply }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar" : "en";
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("promotions.form.templates_title")}
      </p>
      <div className="flex flex-wrap gap-2">
        {RULE_TEMPLATES.map((tpl) => (
          <Button
            key={tpl.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs"
            onClick={() => onApply(tpl)}
            data-testid={`rule-template-${tpl.id}`}
          >
            {t(`promotions.form.template.${tpl.id}`, labelAmounts(tpl, locale))}
          </Button>
        ))}
      </div>
    </div>
  );
}
