/**
 * Merchant Promotions list — replaces the legacy Marketing.tsx.
 *
 * Lists every offer (all six surfaces) with status / surface filters,
 * pagination, and per-row lifecycle actions (activate / pause / archive
 * / duplicate). The "Create" dropdown drives users into the per-surface
 * editor pages.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Percent,
  Play,
  Plus,
  Shield,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/ui/empty-state";
import {
  MobileCard,
  MobileCardList,
  ResponsiveTable,
} from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PromotionStatusBadge } from "@/components/marketing/PromotionStatusBadge";
import { PromotionSurfaceLabel } from "@/components/marketing/PromotionSurfaceLabel";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useArchivePromotion,
  useDuplicatePromotion,
  useLifecycleAction,
  usePromotions,
} from "@/hooks/usePromotions";
import {
  issuePreviewToken,
  type DiscountRule,
  type PromotionListItem,
  type PromotionStatus,
  type PromotionSurface,
} from "@/services/promotionApi";
import { showError } from "@/lib/show-error";
import { describeDiscountRule } from "@/lib/describe-discount-rule";

const PAGE_SIZE = 25;

const SURFACE_OPTIONS: { value: PromotionSurface; icon: typeof Tag }[] = [
  { value: "discount_code", icon: Tag },
  { value: "automatic", icon: Sparkles },
  { value: "announcement_bar", icon: Megaphone },
  { value: "popup", icon: MessageSquare },
  { value: "floating_widget", icon: Percent },
  { value: "cookie_banner", icon: Shield },
];

const STATUS_OPTIONS: PromotionStatus[] = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "expired",
  "archived",
];

export default function PromotionsList() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const moneyLocale = language === "ar" ? "ar" : "en";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">(
    "all",
  );
  const [surfaceFilter, setSurfaceFilter] = useState<PromotionSurface | "all">(
    "all",
  );

  const params = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(surfaceFilter !== "all" ? { surface: surfaceFilter } : {}),
    }),
    [page, statusFilter, surfaceFilter],
  );

  const promotionsQuery = usePromotions(storeId, params);
  const items = promotionsQuery.data?.items ?? [];
  const total = promotionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const lifecycle = useLifecycleAction(storeId, {
    onSuccess: () => {
      toast.success(t("promotions.actions.success") as string);
    },
    onError: (err) => showError(err, t("promotions.actions.error") as string),
  });
  const duplicateMutation = useDuplicatePromotion(storeId, {
    onSuccess: (promo) => {
      toast.success(t("promotions.actions.duplicated") as string);
      navigate(`/marketing/promotions/${promo.id}/edit`);
    },
    onError: (err) =>
      showError(err, t("promotions.actions.duplicate_error") as string),
  });
  const archiveMutation = useArchivePromotion(storeId, {
    onSuccess: () => {
      toast.success(t("promotions.actions.archived") as string);
    },
    onError: (err) =>
      showError(err, t("promotions.actions.archive_error") as string),
  });

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString(
      language === "ar" ? "ar-EG" : "en-US",
      { year: "numeric", month: "short", day: "numeric" },
    );
  };

  const handleNew = (surface: PromotionSurface) => {
    navigate(`/marketing/promotions/new?surface=${surface}`);
  };

  const handlePreview = async () => {
    if (!storeId || !currentStore) return;
    try {
      const { token } = await issuePreviewToken(storeId);
      // Build the storefront URL from the store's subdomain. Custom
      // domains are intentionally not used for preview — preview only
      // makes sense on the canonical numueg.app subdomain so the
      // backend's tenant + middleware resolution is unambiguous.
      const subdomain = currentStore.subdomain;
      const protocol = window.location.protocol;
      const host = window.location.host.includes("localhost")
        ? `${subdomain}.localhost:3000`
        : `${subdomain}.numueg.app`;
      const url = `${protocol}//${host}/?_npt=${encodeURIComponent(token)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showError(err, t("promotions.preview.error") as string);
    }
  };

  // Human-readable discount value for the table, e.g. "17% off" /
  // "50 EGP off" / "Free shipping". Null rule (visual surfaces) → em dash.
  const discountLabel = (rule: DiscountRule | null | undefined): string =>
    describeDiscountRule(rule, t, {
      locale: moneyLocale,
      currency: currentStore?.default_currency,
    });

  // The row's ⋯ menu — one definition, used by the desktop table and the
  // phone card alike, so the two can never offer different actions.
  const renderActions = (p: PromotionListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("promotions.list.row_actions") as string}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => navigate(`/marketing/promotions/${p.id}/edit`)}
        >
          {t("promotions.actions.edit")}
        </DropdownMenuItem>
        {p.status === "active" ? (
          <DropdownMenuItem
            onClick={() =>
              lifecycle.mutate({ promotionId: p.id, action: "pause" })
            }
          >
            <Pause className="me-2 h-4 w-4" /> {t("promotions.actions.pause")}
          </DropdownMenuItem>
        ) : p.status === "draft" ||
          p.status === "paused" ||
          p.status === "scheduled" ? (
          <DropdownMenuItem
            onClick={() =>
              lifecycle.mutate({ promotionId: p.id, action: "activate" })
            }
          >
            <Play className="me-2 h-4 w-4" />{" "}
            {t("promotions.actions.activate")}
          </DropdownMenuItem>
        ) : null}
        {p.surface !== "discount_code" && (
          <DropdownMenuItem onClick={() => duplicateMutation.mutate(p.id)}>
            <Copy className="me-2 h-4 w-4" />{" "}
            {t("promotions.actions.duplicate")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            if (
              confirm(t("promotions.actions.archive_confirm") as string)
            ) {
              archiveMutation.mutate(p.id);
            }
          }}
        >
          <Trash2 className="me-2 h-4 w-4" />{" "}
          {t("promotions.actions.archive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Phones get a card per offer instead of a 9-column table: at 375px the
  // table squeezed each name to one word per line and ran 327px off-screen.
  const renderCard = (p: PromotionListItem) => (
    <MobileCard
      key={p.id}
      onClick={() => navigate(`/marketing/promotions/${p.id}`)}
      title={p.name}
      // The discount goes UNDER the name, not beside it: descriptions like
      // "Buy 2 get 1 at 100% off" are long, and as a trailing value they
      // truncated the offer's name to a few letters.
      subtitle={discountLabel(p.discount_rule)}
      badges={
        <>
          <PromotionStatusBadge status={p.status} />
          <span className="text-[12px] text-muted-foreground">
            <PromotionSurfaceLabel surface={p.surface} />
          </span>
          {p.code && (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[12px] font-bold text-navy" dir="ltr">
              {p.code}
            </span>
          )}
        </>
      }
      meta={
        <>
          <span>
            {t("promotions.list.column_used")}: {p.usage_count ?? 0}
          </span>
          <span>
            {formatDate(p.starts_at)} — {formatDate(p.ends_at)}
          </span>
        </>
      }
      actions={renderActions(p)}
    />
  );

  const renderRow = (p: PromotionListItem) => (
    <TableRow key={p.id} className="hover:bg-muted/30">
      <TableCell className="font-medium">
        <Link
          to={`/marketing/promotions/${p.id}`}
          className="hover:underline"
        >
          {p.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-[13px] font-bold text-navy">
        {p.code ? (
          <span className="inline-flex items-center gap-1.5">
            {p.code}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(p.code!).then(() =>
                  toast.success(language === "ar" ? "تم نسخ الكود" : "Code copied"),
                );
              }}
              className="text-muted-foreground/50 hover:text-navy transition-colors"
              aria-label={language === "ar" ? "نسخ الكود" : "Copy code"}
              title={language === "ar" ? "نسخ الكود" : "Copy code"}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-sm font-medium">
        {discountLabel(p.discount_rule)}
      </TableCell>
      <TableCell>
        <PromotionSurfaceLabel surface={p.surface} />
      </TableCell>
      <TableCell>
        <PromotionStatusBadge status={p.status} />
      </TableCell>
      <TableCell className="text-sm tabular-nums text-muted-foreground">
        {p.usage_count ?? 0}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(p.starts_at)}
        {" — "}
        {formatDate(p.ends_at)}
      </TableCell>
      <TableCell className="text-sm tabular-nums text-muted-foreground">
        {p.priority}
      </TableCell>
      <TableCell className="w-12">{renderActions(p)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {t("promotions.list.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("promotions.list.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!storeId}
            className="flex-1 sm:flex-none"
          >
            <ExternalLink className="me-2 h-4 w-4" />
            {t("promotions.list.preview_cta")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Plus className="me-2 h-4 w-4" />
                {t("promotions.list.create_cta")}
              </Button>
            </DropdownMenuTrigger>
            {/* Each type carries the one line that says what it does and
                where it shows. The bare six-name list left a merchant
                guessing what "floating widget" even was. */}
            <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
              <DropdownMenuLabel>
                {t("promotions.list.create_label")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SURFACE_OPTIONS.map(({ value, icon: Icon }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => handleNew(value)}
                  className="items-start gap-3 py-2.5"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium leading-none">
                      {t(`promotions.surface.${value}`)}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground whitespace-normal">
                      {t(`promotions.surface_hint.${value}`)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <CardTitle className="text-base">
            {total > 0 ? t("promotions.list.count", { count: total }) : ""}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as PromotionStatus | "all");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue
                  placeholder={t("promotions.list.filter_status") as string}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("promotions.list.filter_all_statuses")}
                </SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`promotions.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={surfaceFilter}
              onValueChange={(v) => {
                setSurfaceFilter(v as PromotionSurface | "all");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue
                  placeholder={t("promotions.list.filter_surface") as string}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("promotions.list.filter_all_surfaces")}
                </SelectItem>
                {SURFACE_OPTIONS.map(({ value }) => (
                  <SelectItem key={value} value={value}>
                    {t(`promotions.surface.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {promotionsQuery.isLoading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">
              {t("common.loading")}…
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                icon={BadgePercent}
                title={t("promotions.list.empty_title")}
                description={t("promotions.list.empty_body")}
              />
            </div>
          ) : (
            <ResponsiveTable
              mobile={
                <MobileCardList className="px-3 pb-3">{items.map(renderCard)}</MobileCardList>
              }
            >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("promotions.list.column_name")}</TableHead>
                  <TableHead>{t("promotions.list.column_code")}</TableHead>
                  <TableHead>
                    {t("promotions.list.column_discount")}
                  </TableHead>
                  <TableHead>
                    {t("promotions.list.column_surface")}
                  </TableHead>
                  <TableHead>{t("promotions.list.column_status")}</TableHead>
                  <TableHead>{t("promotions.list.column_used")}</TableHead>
                  <TableHead>
                    {t("promotions.list.column_schedule")}
                  </TableHead>
                  <TableHead>
                    {t("promotions.list.column_priority")}
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>{items.map(renderRow)}</TableBody>
            </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
