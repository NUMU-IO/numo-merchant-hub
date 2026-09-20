/**
 * Detail screen for a single offer.
 *
 * Two things a merchant opens this page for: "is it live, and what does it
 * do?" and "is it working?". Both used to be missing — the page showed six
 * metric tiles (three of which can only ever read 0 on a discount code) and
 * a schedule block, with no sign of the code itself, the discount, the
 * audience or the limits.
 *
 * Metrics are therefore SURFACE-AWARE: a banner reports impressions and
 * clicks because it records them; a code reports orders and revenue because
 * that is all it can record. Showing a tile that is structurally always zero
 * reads as "this feature is broken", which is exactly the report that led
 * here.
 */

import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
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
import { describeDiscountRule } from "@/lib/describe-discount-rule";
import { formatMoney } from "@/lib/format-money";
import type { Promotion } from "@/services/promotionApi";

const VISUAL_SURFACES = [
  "announcement_bar",
  "popup",
  "floating_widget",
  "cookie_banner",
];

export default function PromotionDetail() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const moneyLocale = language === "ar" ? "ar" : "en";

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
    if (!s) return t("promotions.detail.no_date") as string;
    return new Date(s).toLocaleString(
      language === "ar" ? "ar-EG" : "en-US",
      { dateStyle: "medium", timeStyle: "short" },
    );
  };

  const formatNumber = (n: number) =>
    new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US").format(n);

  // Money in the STORE's currency, never a hardcoded EGP — this page used to
  // print "ج.م" on a Saudi store's offer.
  const money = (cents: number) =>
    formatMoney(cents, {
      fromCents: true,
      locale: moneyLocale,
      currency: currentStore?.default_currency,
    });

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

  const isVisual = VISUAL_SURFACES.includes(promo.surface);
  const isLive = promo.status === "active";
  const rule = promo.discount_rule;
  const audience = promo.targets.find((x) => x.target_kind === "audience");
  const audienceKind =
    ((audience?.target_value as { kind?: string } | undefined)?.kind as
      | string
      | undefined) ?? "all";
  const usageCount = promo.usage_count ?? promo.metrics.redemptions ?? 0;

  // Surface-aware tiles. A code records no impressions and a cookie banner
  // records no revenue; listing both everywhere is what made every offer
  // look dead.
  const tiles: { label: string; value: string }[] = isVisual
    ? [
        {
          label: t("promotions.detail.metric.impressions") as string,
          value: formatNumber(promo.metrics.impressions),
        },
        {
          label: t("promotions.detail.metric.clicks") as string,
          value: formatNumber(promo.metrics.clicks),
        },
        {
          label: t("promotions.detail.metric.dismissals") as string,
          value: formatNumber(promo.metrics.dismissals),
        },
        {
          label: t("promotions.detail.metric.conversions") as string,
          value: formatNumber(promo.metrics.conversions),
        },
      ]
    : [
        {
          label: t("promotions.detail.metric.uses") as string,
          value: formatNumber(usageCount),
        },
        {
          label: t("promotions.detail.metric.paid_orders") as string,
          value: formatNumber(promo.metrics.conversions),
        },
        {
          label: t("promotions.detail.metric.revenue") as string,
          value: money(promo.metrics.revenue_cents),
        },
        {
          label: t("promotions.detail.metric.discount_given") as string,
          value: money(promo.metrics.discount_total_cents ?? 0),
        },
      ];

  const hasActivity =
    usageCount > 0 ||
    promo.metrics.impressions > 0 ||
    promo.metrics.clicks > 0 ||
    promo.metrics.conversions > 0;

  const copyCode = (code: string) => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => toast.success(t("promotions.detail.code_copied") as string));
  };

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
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <PromotionSurfaceLabel surface={promo.surface} />
            <PromotionStatusBadge status={promo.status} />
            {promo.code && (
              <button
                type="button"
                onClick={() => copyCode(promo.code!)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 font-mono text-sm font-bold hover:bg-muted/70"
                title={t("promotions.detail.copy_code") as string}
              >
                {promo.code}
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
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
          {isLive ? (
            <Button
              variant="outline"
              onClick={() =>
                lifecycle.mutate({ promotionId: promo.id, action: "pause" })
              }
            >
              <Pause className="me-2 h-4 w-4" />
              {t("promotions.actions.pause")}
            </Button>
          ) : (
            <Button
              onClick={() =>
                lifecycle.mutate({ promotionId: promo.id, action: "activate" })
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

      {/* An offer that isn't live is the single most common reason a merchant
          reports "my discount does nothing". Say so, and fix it from here. */}
      {!isLive && promo.status !== "archived" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium">
              {t(`promotions.detail.not_live.${promo.status}`, {
                defaultValue: t("promotions.detail.not_live.draft") as string,
              })}
            </p>
          </div>
          {(promo.status === "draft" || promo.status === "paused") && (
            <Button
              size="sm"
              onClick={() =>
                lifecycle.mutate({ promotionId: promo.id, action: "activate" })
              }
            >
              {t("promotions.actions.activate")}
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.detail.summary_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {rule && (
            <Row
              label={t("promotions.detail.summary.discount")}
              value={describeDiscountRule(rule, t, {
                locale: moneyLocale,
                currency: currentStore?.default_currency,
              })}
            />
          )}
          {rule?.min_subtotal_cents ? (
            <Row
              label={t("promotions.detail.summary.min_subtotal")}
              value={money(rule.min_subtotal_cents)}
            />
          ) : null}
          {rule?.max_discount_cents ? (
            <Row
              label={t("promotions.detail.summary.max_discount")}
              value={money(rule.max_discount_cents)}
            />
          ) : null}
          <Row
            label={t("promotions.detail.summary.audience")}
            value={t(`promotions.form.audience.${audienceKind}`) as string}
          />
          <Row
            label={t("promotions.detail.summary.usage")}
            value={usageLabel(promo, usageCount, t, formatNumber)}
          />
          <Row
            label={t("promotions.detail.summary.where")}
            value={t(`promotions.surface_hint.${promo.surface}`) as string}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.detail.metrics_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Metric key={tile.label} label={tile.label} value={tile.value} />
            ))}
          </div>
          {/* Zeros are the normal state of a fresh offer. Say that, rather
              than leaving a wall of noughts to be read as a broken feature. */}
          {!hasActivity && (
            <p className="text-xs text-muted-foreground">
              {isLive
                ? t("promotions.detail.no_activity_live")
                : t("promotions.detail.no_activity_idle")}
            </p>
          )}
          {!isVisual && (
            <p className="text-xs text-muted-foreground">
              {t("promotions.detail.revenue_hint")}
            </p>
          )}
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

/** "12 of 100 used" / "12 used" when the offer is uncapped. */
function usageLabel(
  promo: Promotion,
  used: number,
  t: ReturnType<typeof useTranslation>["t"],
  formatNumber: (n: number) => string,
): string {
  const cap = promo.usage_limit_total;
  if (cap) {
    return t("promotions.detail.usage_capped", {
      used: formatNumber(used),
      cap: formatNumber(cap),
    }) as string;
  }
  return t("promotions.detail.usage_uncapped", {
    used: formatNumber(used),
  }) as string;
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
      <span className="text-end text-foreground">{value}</span>
    </div>
  );
}
