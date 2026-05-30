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
  type PromotionListItem,
  type PromotionStatus,
  type PromotionSurface,
} from "@/services/promotionApi";
import { showError } from "@/lib/show-error";

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
      <TableCell>
        <PromotionSurfaceLabel surface={p.surface} />
      </TableCell>
      <TableCell>
        <PromotionStatusBadge status={p.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(p.starts_at)}
        {" — "}
        {formatDate(p.ends_at)}
      </TableCell>
      <TableCell className="text-sm tabular-nums text-muted-foreground">
        {p.priority}
      </TableCell>
      <TableCell className="w-12">
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
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {t("promotions.list.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("promotions.list.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={!storeId}>
            <ExternalLink className="me-2 h-4 w-4" />
            {t("promotions.list.preview_cta")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="me-2 h-4 w-4" />
                {t("promotions.list.create_cta")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {t("promotions.list.create_label")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SURFACE_OPTIONS.map(({ value, icon: Icon }) => (
                <DropdownMenuItem key={value} onClick={() => handleNew(value)}>
                  <Icon className="me-2 h-4 w-4" />
                  {t(`promotions.surface.${value}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
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
              <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-44">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("promotions.list.column_name")}</TableHead>
                  <TableHead>
                    {t("promotions.list.column_surface")}
                  </TableHead>
                  <TableHead>{t("promotions.list.column_status")}</TableHead>
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
