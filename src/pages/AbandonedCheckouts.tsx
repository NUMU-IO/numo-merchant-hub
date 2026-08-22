import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable, MobileCardList, MobileCard } from "@/components/ui/responsive-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateRangePicker, useDateRange, customRange } from "@/components/filters/DateRangePicker";
import {
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAbandonedCheckoutSummary,
  listAbandonedCheckouts,
  markAbandonedCheckoutRecovered,
  notifyAbandonedCheckoutWhatsApp,
  sendRecoveryEmail,
  type AbandonedCheckout,
} from "@/services/abandonedCheckoutApi";
import { showError } from "@/lib/show-error";
import { formatMoney } from "@/lib/format-money";
import { TrafficSourceIcon } from "@/components/orders/TrafficSourceIcon";
import { AbandonedCheckoutDetailDialog } from "@/components/orders/AbandonedCheckoutDetailDialog";
import { cn } from "@/lib/utils";

type AbandonedFilter = "abandoned" | "recovered";
type ContactFilter = "recoverable" | "any";

const PAGE_SIZE = 20;
const BANNER_KEY = "numu:abandoned-wa-banner-dismissed";

/** "All time" for the analytics strip — the picker has no such preset. */
function allTimeRange() {
  const now = new Date();
  return customRange(new Date(2024, 0, 1), now, now);
}

/** Which checkout step the shopper reached, from what the row carries. */
function phaseOf(c: AbandonedCheckout): "cart" | "contact" | "shipping" | "converted" {
  if (c.recovered_at) return "converted";
  if (c.shipping_address && Object.keys(c.shipping_address).length > 0) return "shipping";
  if (c.email || c.phone) return "contact";
  return "cart";
}

function customerName(c: AbandonedCheckout): string | null {
  const a = (c.shipping_address ?? {}) as Record<string, unknown>;
  const name = [a.first_name, a.last_name].filter((x) => typeof x === "string" && x).join(" ");
  return name || null;
}

const AbandonedCheckouts = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const locale = isAr ? "ar" : "en";

  const [filter, setFilter] = useState<AbandonedFilter>("abandoned");
  const [contact, setContact] = useState<ContactFilter>("recoverable");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { range, setRange } = useDateRange(allTimeRange());
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [detailSnapshot, setDetailSnapshot] = useState<AbandonedCheckout | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Store-level WhatsApp abandoned-cart reminders (the automation).
  const waSettings = (currentStore?.settings as Record<string, unknown> | undefined)?.whatsapp_notifications as
    | Record<string, unknown>
    | undefined;
  const remindersOn = Boolean(waSettings?.abandoned_cart);

  const summaryQuery = useQuery({
    queryKey: ["abandoned-checkouts", storeId, "summary", range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      getAbandonedCheckoutSummary(storeId!, {
        date_from: range.start.toISOString(),
        date_to: range.end.toISOString(),
      }),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const checkoutsQuery = useQuery({
    queryKey: ["abandoned-checkouts", storeId, filter, contact, page],
    queryFn: () =>
      listAbandonedCheckouts(storeId!, {
        page,
        limit: PAGE_SIZE,
        include_recovered: false,
        only_recovered: filter === "recovered",
        has_contact: filter === "abandoned" && contact === "recoverable" ? true : undefined,
      }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const allItems = useMemo(() => checkoutsQuery.data?.items ?? [], [checkoutsQuery.data]);
  const total = checkoutsQuery.data?.total ?? 0;
  const q = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      q
        ? allItems.filter((c) =>
            [c.email, c.phone, customerName(c)].some((v) => v && v.toLowerCase().includes(q)),
          )
        : allItems,
    [allItems, q],
  );

  const detailCheckout = detailSnapshot
    ? allItems.find((i) => i.id === detailSnapshot.id) ?? detailSnapshot
    : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["abandoned-checkouts", storeId] });
  };

  const sendEmail = useMutation({
    mutationFn: (checkoutId: string) => sendRecoveryEmail(storeId!, checkoutId),
    onSuccess: () => {
      toast.success(isAr ? "تم إرسال بريد الاسترداد" : "Recovery email sent");
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const markRecovered = useMutation({
    mutationFn: (checkoutId: string) => markAbandonedCheckoutRecovered(storeId!, checkoutId),
    onSuccess: () => {
      toast.success(isAr ? "تم تحديد السلة كمستردة" : "Checkout marked as recovered");
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const notifyReason = (reason: string | null): string => {
    switch (reason) {
      case "no_phone":
        return isAr ? "لا يوجد رقم هاتف لهذا العميل" : "No phone number on file";
      case "already_recovered":
        return isAr ? "تم استرداد هذه السلة بالفعل" : "This cart was already recovered";
      case "no_credentials":
      case "credentials_invalid":
        return isAr ? "واتساب غير مُعد لهذا المتجر" : "WhatsApp isn't set up for this store";
      case "template_not_approved":
        return isAr ? "قالب السلة المتروكة غير معتمد بعد" : "Abandoned-cart template not approved yet";
      case "already_notified_recently":
        return isAr ? "تم تنبيه هذا العميل خلال آخر ٢٤ ساعة" : "This customer was already nudged in the last 24 hours";
      default:
        return isAr ? "تعذر إرسال الرسالة" : "Couldn't send the message";
    }
  };

  const notifyWhatsApp = useMutation({
    mutationFn: (checkoutId: string) => notifyAbandonedCheckoutWhatsApp(storeId!, checkoutId),
    onSuccess: (res) => {
      if (res.sent) toast.success(isAr ? "تم إرسال رسالة واتساب" : "WhatsApp message sent");
      else if (res.reason === "already_notified_recently") toast.info(notifyReason(res.reason));
      else toast.error(notifyReason(res.reason));
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const money = (cents: number, currency?: string) =>
    formatMoney(cents, { fromCents: true, currency: currency || summaryQuery.data?.currency, locale });

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(isAr ? "ar-EG" : "en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const phaseBadge = (c: AbandonedCheckout) => {
    const p = phaseOf(c);
    const cls = {
      cart: "bg-muted text-muted-foreground border-border",
      contact: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200/50",
      shipping: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
      converted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50",
    }[p];
    return (
      <Badge variant="outline" className={cn("text-[10.5px] py-0.5 font-semibold", cls)}>
        {p === "converted" && <CheckCircle2 className="h-3 w-3 me-1" />}
        {t(`abandonedCheckouts.phase.${p}`)}
      </Badge>
    );
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const exportCsv = () => {
    const rows = [
      ["customer", "email", "phone", "total", "currency", "items", "phase", "created_at", "updated_at", "recovered_at"],
      ...items.map((c) => [
        customerName(c) ?? "",
        c.email ?? "",
        c.phone ?? "",
        (c.total / 100).toFixed(2),
        c.currency,
        String(c.item_count),
        phaseOf(c),
        c.created_at,
        c.last_activity_at,
        c.recovered_at ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abandoned-carts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = summaryQuery.data;
  const reminderAction = (c: AbandonedCheckout, size: "sm" | "row" = "row") => {
    if (c.recovered_at) {
      return c.recovered_order_id ? (
        <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px]" onClick={() => navigate(`/orders/${c.recovered_order_id}`)}>
          {t("abandonedCheckouts.viewOrder")}
        </Button>
      ) : null;
    }
    const pending = (notifyWhatsApp.isPending && notifyWhatsApp.variables === c.id) || (sendEmail.isPending && sendEmail.variables === c.id);
    if (c.phone) {
      return (
        <Button size="sm" variant="outline" className={cn("rounded-lg text-[12px] gap-1.5", size === "row" ? "h-8" : "h-10")} disabled={pending} onClick={() => notifyWhatsApp.mutate(c.id)}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
          {t("abandonedCheckouts.sendReminder")}
        </Button>
      );
    }
    if (c.email) {
      return (
        <Button size="sm" variant="outline" className={cn("rounded-lg text-[12px] gap-1.5", size === "row" ? "h-8" : "h-10")} disabled={pending} onClick={() => sendEmail.mutate(c.id)}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
          {c.recovery_email_sent_at ? t("abandonedCheckouts.resend") : t("abandonedCheckouts.sendReminder")}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("abandonedCheckouts.title")}
        subtitle={t("abandonedCheckouts.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-full px-4" onClick={() => navigate("/whatsapp")}>
              {t("abandonedCheckouts.manageReminders")}
            </Button>
            <Button size="sm" className="h-9 gap-1.5 rounded-full bg-navy px-4 text-white hover:bg-navy-700" onClick={exportCsv} disabled={items.length === 0}>
              <Download className="h-3.5 w-3.5" />
              {t("abandonedCheckouts.export")}
            </Button>
          </div>
        }
      />

      {/* Promo banner — WhatsApp automation (Zid's yellow card) */}
      {!bannerDismissed && (
        <div className="relative overflow-hidden rounded-2xl bg-saffron-100 px-6 py-5 text-navy-900 dark:bg-saffron/15 dark:text-foreground">
          <button type="button" onClick={dismissBanner} className="absolute end-3 top-3 rounded-md p-1 text-navy-900/60 hover:bg-black/5 dark:text-foreground/70" aria-label={t("nav.close")}>
            <X className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute -end-10 -top-10 h-44 w-44 rounded-full border-[18px] border-saffron/40 opacity-60" aria-hidden />
          <div className="relative max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold">{t("abandonedCheckouts.banner.title")}</h2>
              <Badge variant="outline" className={cn("text-[10px]", remindersOn ? "border-emerald-300 bg-emerald-500/10 text-emerald-700" : "border-terracotta/40 bg-terracotta/10 text-terracotta")}>
                {remindersOn ? t("abandonedCheckouts.banner.active") : t("abandonedCheckouts.banner.inactive")}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-navy-900/80 dark:text-muted-foreground">
              {t("abandonedCheckouts.banner.body", { count: s?.reminders_sent ?? 0 })}
            </p>
            <Button size="sm" className="mt-3 h-9 rounded-full bg-navy px-4 text-white hover:bg-navy-700" onClick={() => navigate("/whatsapp")}>
              {remindersOn ? t("abandonedCheckouts.manageReminders") : t("abandonedCheckouts.banner.cta")}
            </Button>
          </div>
        </div>
      )}

      {/* Analytics strip */}
      <Card className="rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-extrabold">{t("abandonedCheckouts.analytics")}</h2>
          <DateRangePicker value={range} onChange={setRange} size="sm" align="end" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: t("abandonedCheckouts.stat.openValue"),
              tip: t("abandonedCheckouts.stat.openValueTip"),
              value: s ? `${t("abandonedCheckouts.stat.carts", { count: s.open_count })} / ${money(s.open_value_cents, s.currency)}` : null,
            },
            {
              label: t("abandonedCheckouts.stat.recoveredValue"),
              value: s ? money(s.recovered_value_cents, s.currency) : null,
            },
            {
              label: t("abandonedCheckouts.stat.payback"),
              tip: t("abandonedCheckouts.stat.paybackTip"),
              value: s ? `${s.payback_pct}%` : null,
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                {stat.label}
                {stat.tip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/70" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-[12px]">{stat.tip}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {stat.value === null ? (
                <Skeleton className="mt-2 h-6 w-32" />
              ) : (
                <div className="mt-1 text-[18px] font-extrabold tabular-nums">{stat.value}</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Reclaim tip */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200/60 bg-sky-50/70 p-4 dark:border-sky-500/20 dark:bg-sky-950/20">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold">{t("abandonedCheckouts.reclaim.title")}</div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t("abandonedCheckouts.reclaim.body")}</p>
          <Link to="/whatsapp" className="mt-2 inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-[12px] font-semibold hover:bg-muted">
            {t("abandonedCheckouts.manageReminders")}
          </Link>
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" className="flex gap-1 rounded-xl bg-muted/60 p-1">
            {(["abandoned", "recovered"] as AbandonedFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={cn("h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-colors", filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {t(f === "abandoned" ? "abandonedCheckouts.tabAbandoned" : "abandonedCheckouts.tabConverted")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {filter === "abandoned" && (
              <button
                type="button"
                onClick={() => { setContact(contact === "recoverable" ? "any" : "recoverable"); setPage(1); }}
                className={cn("h-8 rounded-lg border px-3 text-[12px] font-semibold transition-colors", contact === "recoverable" ? "border-navy bg-navy text-white dark:border-saffron dark:bg-saffron dark:text-navy-900" : "border-border bg-card text-muted-foreground hover:text-foreground")}
                aria-pressed={contact === "recoverable"}
              >
                {t("abandonedCheckouts.recoverable")}
              </button>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("abandonedCheckouts.searchPlaceholder")} className="h-8 w-[220px] rounded-lg ps-8 text-[12.5px]" />
            </div>
          </div>
        </div>

        {checkoutsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ShoppingBag}
              title={t("abandonedCheckouts.emptyTitle")}
              description={t(
                filter === "recovered"
                  ? "abandonedCheckouts.emptyRecoveredDescription"
                  : q
                    ? "abandonedCheckouts.emptySearch"
                    : contact === "recoverable"
                      ? "abandonedCheckouts.emptyRecoverableHint"
                      : "abandonedCheckouts.emptyDescription",
              )}
              action={
                filter === "abandoned" && contact === "recoverable" && !q ? (
                  <Button variant="outline" size="sm" onClick={() => { setContact("any"); setPage(1); }}>
                    {t("abandonedCheckouts.showAllCarts")}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ResponsiveTable
            mobile={
              <MobileCardList className="p-3">
                {items.map((c) => (
                  <MobileCard
                    key={c.id}
                    onClick={() => { setDetailSnapshot(c); setDetailOpen(true); }}
                    title={customerName(c) ?? c.email ?? c.phone ?? t("abandonedCheckouts.guest")}
                    subtitle={c.phone ?? c.email ?? undefined}
                    trailing={money(c.total, c.currency)}
                    trailingMeta={<span className="tabular-nums">{t("abandonedCheckouts.stat.items", { count: c.item_count })}</span>}
                    badges={phaseBadge(c)}
                    meta={<span>{fmtDate(c.last_activity_at)}</span>}
                    actions={reminderAction(c, "sm")}
                  />
                ))}
              </MobileCardList>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.customer")}<span className="block text-[10px] font-normal text-muted-foreground">{t("abandonedCheckouts.col.email")}</span></TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.phone")}</TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.cartPrice")}<span className="block text-[10px] font-normal text-muted-foreground">{t("abandonedCheckouts.col.currency")}</span></TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.products")}</TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.phase")}</TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.created")}</TableHead>
                    <TableHead className="text-[11px] font-semibold">{t("abandonedCheckouts.col.updated")}</TableHead>
                    <TableHead className="text-end text-[11px] font-semibold"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id} className="group cursor-pointer" onClick={() => { setDetailSnapshot(c); setDetailOpen(true); }}>
                      <TableCell>
                        <div className="max-w-[240px] truncate text-[12.5px] font-semibold">{customerName(c) ?? t("abandonedCheckouts.guest")}</div>
                        <div className="max-w-[240px] truncate text-[11px] text-muted-foreground">{c.email ?? "—"}</div>
                        {c.utm_source && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <TrafficSourceIcon source={c.utm_source} className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.utm_source}{c.utm_campaign ? ` · ${c.utm_campaign}` : ""}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-[12px] tabular-nums" dir="ltr">{c.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-[12.5px] font-semibold tabular-nums">{money(c.total, c.currency)}</div>
                        <div className="text-[10px] text-muted-foreground">{c.currency}</div>
                      </TableCell>
                      <TableCell className="text-[12px] tabular-nums text-muted-foreground">{c.item_count}</TableCell>
                      <TableCell>{phaseBadge(c)}</TableCell>
                      <TableCell className="text-[12px] tabular-nums text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                      <TableCell className="text-[12px] tabular-nums text-muted-foreground">{fmtDate(c.last_activity_at)}</TableCell>
                      <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {reminderAction(c)}
                          {!c.recovered_at && (
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-[12px] gap-1" disabled={markRecovered.isPending && markRecovered.variables === c.id} onClick={() => markRecovered.mutate(c.id)}>
                              <Check className="h-3 w-3" />
                              {t("abandonedCheckouts.markRecovered")}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setDetailSnapshot(c); setDetailOpen(true); }} aria-label={t("abandonedCheckouts.view")}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ResponsiveTable>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 border-t border-border/70 p-3">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {isAr ? "السابق" : "Previous"}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{page} / {Math.ceil(total / PAGE_SIZE)}</span>
            <Button size="sm" variant="outline" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>
              {isAr ? "التالي" : "Next"}
            </Button>
          </div>
        )}
      </Card>

      <AbandonedCheckoutDetailDialog
        storeId={storeId ?? ""}
        checkout={detailCheckout}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onWhatsApp={(id) => notifyWhatsApp.mutate(id)}
        onSendEmail={(id) => sendEmail.mutate(id)}
        onMarkRecovered={(id) => markRecovered.mutate(id)}
        whatsAppPending={notifyWhatsApp.isPending}
        emailPending={sendEmail.isPending}
        recoverPending={markRecovered.isPending}
      />
    </div>
  );
};

export default AbandonedCheckouts;
