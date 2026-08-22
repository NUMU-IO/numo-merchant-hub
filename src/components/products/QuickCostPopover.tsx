import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateProduct } from "@/services/productApi";
import { formatMoney } from "@/lib/format-money";
import { showError } from "@/lib/show-error";

interface QuickCostPopoverProps {
  storeId: string;
  productId: string;
  /** Selling price in MAJOR units (what the products list carries). */
  price: number;
  currentCost?: number | null;
  onSaved: (cost: number) => void;
  children?: ReactNode;
}

/* Inline "Set cost" for the products list.

   The reviewer called the scattered "Set cost" link "valuable but should be a
   guided profit-readiness workflow". The old link navigated to the TOP of a
   long editor with no focus target. This lets the merchant type the cost
   right in the row, see the resulting profit/margin before saving, and
   PATCHes only cost_price — the list updates without a reload. The editor
   is still one click away (with ?focus=cost so it lands on the field). */
export function QuickCostPopover({
  storeId,
  productId,
  price,
  currentCost,
  onSaved,
  children,
}: QuickCostPopoverProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const locale = language === "ar" ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentCost != null ? String(currentCost) : "");
  const [saving, setSaving] = useState(false);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const profit = valid ? price - parsed : null;
  const margin = valid && price > 0 ? ((price - parsed) / price) * 100 : null;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await updateProduct(storeId, productId, { cost_price: parsed.toFixed(2) });
      onSaved(parsed);
      toast.success(t("products.quickCost.saved"));
      setOpen(false);
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children ?? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground/70 hover:text-primary underline-offset-2 hover:underline"
          >
            {t("products.setCost")}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3.5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{t("products.quickCost.title")}</Label>
          <p className="text-[11px] text-muted-foreground">{t("products.quickCost.hint")}</p>
        </div>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          className="h-9 rounded-lg"
          aria-label={t("products.quickCost.title")}
        />
        <p className="text-[11px] tabular-nums text-muted-foreground min-h-[1em]">
          {profit !== null && margin !== null
            ? t("products.quickCost.preview", {
                profit: formatMoney(profit, { locale }),
                margin: margin.toFixed(1),
              })
            : ""}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => navigate(`/products/${productId}/edit?focus=cost`)}
          >
            {t("products.quickCost.openEditor")}
          </button>
          <Button size="sm" className="h-8 text-xs px-3" disabled={!valid || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("common.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
