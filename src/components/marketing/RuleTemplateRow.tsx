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
import type { DiscountRuleKind } from "@/services/promotionApi";

/** A preset configuration that the form can apply with one click. */
export interface RuleTemplate {
  /** Stable id used as React key + i18n suffix. */
  id: string;
  ruleKind: DiscountRuleKind;
  /** Pre-fill values for the matching kind's fields. Strings to match
   *  the form's `FormState` shape exactly; the form's `buildDiscountRule`
   *  parses to numbers. */
  buyQuantity?: string;
  getQuantity?: string;
  getDiscountPercent?: string;
  valuePercent?: string;
  valueCents?: string;
  tiers?: { threshold_cents: string; percent: string }[];
  multibuyQuantity?: string;
  multibuyPriceCents?: string;
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
    // group. Cents, so 65000 = EGP 650 for the whole trio.
    id: "multibuy_3_for_650",
    ruleKind: "multibuy",
    multibuyQuantity: "3",
    multibuyPriceCents: "65000",
  },
  {
    id: "multibuy_2_for_500",
    ruleKind: "multibuy",
    multibuyQuantity: "2",
    multibuyPriceCents: "50000",
  },
  {
    id: "spend_1000_off_10",
    ruleKind: "tiered",
    tiers: [{ threshold_cents: "100000", percent: "10" }],
  },
  {
    id: "spend_2000_off_20",
    ruleKind: "tiered",
    tiers: [{ threshold_cents: "200000", percent: "20" }],
  },
  {
    id: "tiered_3_step",
    ruleKind: "tiered",
    tiers: [
      { threshold_cents: "50000", percent: "5" },
      { threshold_cents: "100000", percent: "10" },
      { threshold_cents: "200000", percent: "15" },
    ],
  },
];

interface Props {
  onApply: (template: RuleTemplate) => void;
}

export function RuleTemplateRow({ onApply }: Props) {
  const { t } = useTranslation();
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
            {t(`promotions.form.template.${tpl.id}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
