/**
 * Read-only-ish detail screen for a single promotion.
 *
 * v1 shows the headline metrics block returned by the merchant API and
 * surfaces the lifecycle / edit / archive actions. Day-by-day Recharts
 * + recent-events table from the spec land later — they need the
 * step 13 daily rollup table to be cheap on busy stores.
 */

import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Copy,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { PromotionStatusBadge } from "@/components/marketing/PromotionStatusBadge";
import { PromotionSurfaceLabel } from "@/components/marketing/PromotionSurfaceLabel";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useArchivePromotion,
  useDuplicatePromotion,
  useLifecycleAction,
  usePromotion,
} from "@/hooks/usePromotions";
import { showError } from "@/lib/show-error";

export default function PromotionDetail() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const promotionQuery = usePromotion(storeId, id);
  const promo = promotionQuery.data;

  const lifecycle = useLifecycleAction(storeId, {
    onSuccess: () => toast.success(t("promotions.actions.success") as string),
    onError: (err) => showError(err, t("promotions.actions.error") as string),
  });
  const duplicateMutation = useDuplicatePromotion(storeId, {
    onSuccess: (p) => {
      toast.success(t("promotions.actions.duplicated") as string);
      navigate(`/marketing/promotions/${p.id}/edit`);
    },
    onError: (err) =>
      showError(err, t("promotions.actions.duplicate_error") as string),
  });
  const archiveMutation = useArchivePromotion(storeId, {
    onSuccess: () => {
      toast.success(t("promotions.actions.archived") as string);
      navigate("/marketing/promotions");
    },
    onError: (err) =>
      showError(err, t("promotions.actions.archive_error") as string),
  });

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleString(
      language === "ar" ? "ar-EG" : "en-US",
      { dateStyle: "medium", timeStyle: "short" },
    );
  };

  const formatNumber = (n: number) =>
    new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US").format(n);

  const formatCurrency = (cents: number) => {
    const v = cents / 100;
    return language === "ar"
      ? `${v.toLocaleString("ar-EG")} ج.م`
      : `EGP ${v.toLocaleString()}`;
  };

  if (promotionQuery.isLoading) {
    return (
      <div className="px-6 py-10 text-sm text-muted-foreground">
        {t("common.loading")}…
      </div>
    );
  }
  if (!promo) {
    return (
      <div className="px-6 py-10 text-sm text-destructive">
        {t("promotions.detail.not_found")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/marketing/promotions")}
            className="mb-2"
          >
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("promotions.detail.back")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {promo.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <PromotionSurfaceLabel surface={promo.surface} />
            <PromotionStatusBadge status={promo.status} />
            <span className="text-sm text-muted-foreground">
              v{promo.version}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/marketing/promotions/${promo.id}/edit`)}
          >
            <Pencil className="me-2 h-4 w-4" />
            {t("promotions.actions.edit")}
          </Button>
          {promo.status === "active" ? (
            <Button
              variant="outline"
              onClick={() =>
                lifecycle.mutate({
                  promotionId: promo.id,
                  action: "pause",
                })
              }
            >
              <Pause className="me-2 h-4 w-4" />
              {t("promotions.actions.pause")}
            </Button>
          ) : (
            <Button
              onClick={() =>
                lifecycle.mutate({
                  promotionId: promo.id,
                  action: "activate",
                })
              }
            >
              <Play className="me-2 h-4 w-4" />
              {t("promotions.actions.activate")}
            </Button>
          )}
          {promo.surface !== "discount_code" && (
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate(promo.id)}
            >
              <Copy className="me-2 h-4 w-4" />
              {t("promotions.actions.duplicate")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(t("promotions.actions.archive_confirm") as string)) {
                archiveMutation.mutate(promo.id);
              }
            }}
          >
            <Trash2 className="me-2 h-4 w-4" />
            {t("promotions.actions.archive")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.detail.metrics_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label={t("promotions.detail.metric.impressions")}
            value={formatNumber(promo.metrics.impressions)}
          />
          <Metric
            label={t("promotions.detail.metric.clicks")}
            value={formatNumber(promo.metrics.clicks)}
          />
          <Metric
            label={t("promotions.detail.metric.dismissals")}
            value={formatNumber(promo.metrics.dismissals)}
          />
          <Metric
            label={t("promotions.detail.metric.redemptions")}
            value={formatNumber(promo.metrics.redemptions)}
          />
          <Metric
            label={t("promotions.detail.metric.conversions")}
            value={formatNumber(promo.metrics.conversions)}
          />
          <Metric
            label={t("promotions.detail.metric.revenue")}
            value={formatCurrency(promo.metrics.revenue_cents)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.detail.schedule_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row
            label={t("promotions.detail.schedule.starts_at")}
            value={formatDate(promo.starts_at)}
          />
          <Row
            label={t("promotions.detail.schedule.ends_at")}
            value={formatDate(promo.ends_at)}
          />
          <Row
            label={t("promotions.detail.priority")}
            value={String(promo.priority)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
