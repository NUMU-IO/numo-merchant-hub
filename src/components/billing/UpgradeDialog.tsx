import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUpgradeDialog } from "@/hooks/useUpgradeDialog";
import { planLabel } from "@/lib/planLabel";

export function UpgradeDialog() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const details = useUpgradeDialog((s) => s.details);
  const close = useUpgradeDialog((s) => s.close);

  const locale = isRTL ? "ar-EG" : "en-GB";
  const reason = details?.reason;
  // A limit of 0 means the plan has none of it: say "not in your plan".
  const limit = typeof details?.limit === "number" && details.limit > 0 ? details.limit : null;
  const kind =
    limit !== null
      ? "limit"
      : reason === "blocked" || reason === "disabled_globally"
        ? reason
        : "not_in_plan";
  const via = details?.available_via?.[0];
  const addon = via?.startsWith("addon:") ? via.slice("addon:".length) : null;
  const extra =
    kind === "not_in_plan" && via && !addon
      ? t("upgrade.upgradeTo", { plan: planLabel(via, isRTL) })
      : kind === "limit" && details?.resets_at
        ? t("upgrade.resetsOn", {
            date: new Date(details.resets_at).toLocaleDateString(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })
        : null;

  return (
    <Dialog open={!!details} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pe-10 text-start">
          <DialogTitle>{t(`upgrade.${kind}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`upgrade.${kind}.body`, { limit: limit?.toLocaleString(locale) })}
            {extra && ` ${extra}`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>
            {t("upgrade.notNow")}
          </Button>
          {via && (
            <Button
              onClick={() => {
                close();
                navigate(addon ? `/apps/${addon}` : "/billing");
              }}
            >
              {addon ? t("upgrade.getAddon") : t("upgrade.seePlans")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
