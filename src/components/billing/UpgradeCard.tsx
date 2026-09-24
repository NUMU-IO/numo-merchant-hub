import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlements } from "@/hooks/useEntitlements";

export function UpgradeCard({ feature }: { feature: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reason = useEntitlements().feature(feature)?.reason;
  const kind = reason === "blocked" || reason === "disabled_globally" ? reason : "not_in_plan";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t(`upgrade.${kind}.title`)}</p>
          <p className="text-sm text-muted-foreground">{t(`upgrade.${kind}.body`)}</p>
        </div>
        {kind === "not_in_plan" && (
          <Button size="sm" onClick={() => navigate("/billing")}>
            {t("upgrade.seePlans")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
