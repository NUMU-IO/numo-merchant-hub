import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAbandonedCheckouts,
  markAbandonedCheckoutRecovered,
  notifyAbandonedCheckoutWhatsApp,
  sendRecoveryEmail,
  type AbandonedCheckout,
} from "@/services/abandonedCheckoutApi";
import { showError } from "@/lib/show-error";

type AbandonedFilter = "abandoned" | "recovered" | "all";
type ContactFilter = "recoverable" | "browse" | "any";

const AbandonedCheckouts = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAr = language === "ar";

  const [filter, setFilter] = useState<AbandonedFilter>("abandoned");
  // Defaults to "recoverable" — these are the rows with email/phone the
  // merchant can actually act on (send a recovery email / WhatsApp). The
  // "browse" view shows carts that left items but never typed contact info
  // (still useful for analytics, not for outreach).
  const [contact, setContact] = useState<ContactFilter>("recoverable");
  const [page, setPage] = useState(1);

  const checkoutsQuery = useQuery({
    queryKey: ["abandoned-checkouts", storeId, filter, contact, page],
    queryFn: () =>
      listAbandonedCheckouts(storeId!, {
        page,
        limit: 20,
        include_recovered: filter === "all",
        only_recovered: filter === "recovered",
        has_contact:
          contact === "recoverable" ? true : contact === "browse" ? false : undefined,
      }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const items = checkoutsQuery.data?.items ?? [];
  const total = checkoutsQuery.data?.total ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["abandoned-checkouts", storeId],
    });
  };

  const sendEmail = useMutation({
    mutationFn: (checkoutId: string) =>
      sendRecoveryEmail(storeId!, checkoutId),
    onSuccess: () => {
      toast.success(isAr ? "تم إرسال بريد الاسترداد" : "Recovery email sent");
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const markRecovered = useMutation({
    mutationFn: (checkoutId: string) =>
      markAbandonedCheckoutRecovered(storeId!, checkoutId),
    onSuccess: () => {
      toast.success(
        isAr ? "تم تحديد السلة كمستردة" : "Checkout marked as recovered",
      );
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  // Maps the backend's machine-readable skip reason to a human message.
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
        return isAr
          ? "قالب السلة المتروكة غير معتمد بعد"
          : "Abandoned-cart template not approved yet";
      case "already_notified_recently":
        // Not an error: WhatsApp caps marketing messages per customer, so we
        // block a repeat nudge within 24h (whether sent here or by the
        // scheduled job) instead of firing a send Meta would silently drop.
        return isAr
          ? "تم تنبيه هذا العميل خلال آخر ٢٤ ساعة"
          : "This customer was already nudged in the last 24 hours";
      default:
        return isAr ? "تعذر إرسال الرسالة" : "Couldn't send the message";
    }
  };

  const notifyWhatsApp = useMutation({
    mutationFn: (checkoutId: string) =>
      notifyAbandonedCheckoutWhatsApp(storeId!, checkoutId),
    onSuccess: (res) => {
      if (res.sent) {
        toast.success(isAr ? "تم إرسال رسالة واتساب" : "WhatsApp message sent");
      } else if (res.reason === "already_notified_recently") {
        // Benign cooldown, not a failure — use an info toast, not an error.
        toast.info(notifyReason(res.reason));
      } else {
        toast.error(notifyReason(res.reason));
      }
    },
    onError: (err) => showError(err, language),
  });

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr
      ? `${val.toLocaleString("ar-EG")} ج.م`
      : `EGP ${val.toLocaleString()}`;
  };

  const fmtRelative = (iso: string | null) => {
    if (!iso) return "—";
    const date = new Date(iso);
    const ms = date.getTime();
    if (Number.isNaN(ms)) return "—";
    const diffMs = Date.now() - ms;
    const minutes = Math.floor(diffMs / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    // Use `>= 1` so a row that's been idle for exactly one hour shows
    // "1h ago" rather than falling through to the noisy "60m ago".
    if (days >= 1) return isAr ? `منذ ${days} يوم` : `${days}d ago`;
    if (hours >= 1) return isAr ? `منذ ${hours} ساعة` : `${hours}h ago`;
    if (minutes >= 1) return isAr ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    return isAr ? "للتو" : "just now";
  };

  const contactDisplay = (c: AbandonedCheckout) => {
    if (c.email && c.phone) return `${c.email} · ${c.phone}`;
    return c.email || c.phone || (isAr ? "زائر بدون بيانات" : "Guest, no contact");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("abandonedCheckouts.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("abandonedCheckouts.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as AbandonedFilter);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="abandoned">
              {t("abandonedCheckouts.abandoned")}
            </TabsTrigger>
            <TabsTrigger value="recovered">
              {t("abandonedCheckouts.recovered")}
            </TabsTrigger>
            <TabsTrigger value="all">
              {t("abandonedCheckouts.all")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs
          value={contact}
          onValueChange={(v) => {
            setContact(v as ContactFilter);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="recoverable">
              {t("abandonedCheckouts.recoverable")}
            </TabsTrigger>
            <TabsTrigger value="browse">
              {t("abandonedCheckouts.browseOnly")}
            </TabsTrigger>
            <TabsTrigger value="any">
              {t("abandonedCheckouts.allContact")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {checkoutsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title={t("abandonedCheckouts.emptyTitle")}
            description={t(
              filter === "recovered"
                ? "abandonedCheckouts.emptyRecoveredDescription"
                : "abandonedCheckouts.emptyDescription",
            )}
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "العميل" : "Customer"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "العناصر" : "Items"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "القيمة" : "Value"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "وقت الترك" : "Abandoned"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "الحالة" : "Status"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <div className="text-xs font-medium truncate max-w-[220px]">
                        {contactDisplay(c)}
                      </div>
                      {c.utm_source && (
                        <div className="text-[10px] text-muted-foreground">
                          {c.utm_source}
                          {c.utm_campaign ? ` · ${c.utm_campaign}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.item_count}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold tabular-nums">
                        {formatCurrency(c.total)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {/* Show the customer's last activity, not the lazy-set
                          abandoned_at. The merchant cares about "how long
                          have they been idle"; abandoned_at is just the
                          status-flip marker. */}
                      {fmtRelative(c.last_activity_at)}
                    </TableCell>
                    <TableCell>
                      {c.recovered_at ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-200/50"
                        >
                          <CheckCircle2 className="h-3 w-3 me-1" />
                          {t("abandonedCheckouts.recovered")}
                        </Badge>
                      ) : c.recovery_email_sent_at ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 bg-blue-500/10 text-blue-600 border-blue-200/50"
                        >
                          {t("abandonedCheckouts.emailSent")}
                        </Badge>
                      ) : c.abandoned_at ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 bg-amber-500/10 text-amber-600 border-amber-200/50"
                        >
                          {t("abandonedCheckouts.abandoned")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50"
                        >
                          <span className="relative flex h-1.5 w-1.5 me-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
                          </span>
                          {t("abandonedCheckouts.inProgress")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!c.recovered_at && c.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 text-emerald-600 border-emerald-200/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            disabled={
                              notifyWhatsApp.isPending &&
                              notifyWhatsApp.variables === c.id
                            }
                            onClick={() => notifyWhatsApp.mutate(c.id)}
                          >
                            {notifyWhatsApp.isPending &&
                            notifyWhatsApp.variables === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3 w-3" />
                            )}
                            {isAr ? "واتساب" : "WhatsApp"}
                          </Button>
                        )}
                        {!c.recovered_at && c.email && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1"
                            disabled={
                              sendEmail.isPending && sendEmail.variables === c.id
                            }
                            onClick={() => sendEmail.mutate(c.id)}
                          >
                            {sendEmail.isPending && sendEmail.variables === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            {c.recovery_email_sent_at
                              ? t("abandonedCheckouts.resend")
                              : t("abandonedCheckouts.sendRecovery")}
                          </Button>
                        )}
                        {!c.recovered_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] gap-1"
                            disabled={
                              markRecovered.isPending &&
                              markRecovered.variables === c.id
                            }
                            onClick={() => markRecovered.mutate(c.id)}
                          >
                            <Check className="h-3 w-3" />
                            {t("abandonedCheckouts.markRecovered")}
                          </Button>
                        )}
                        {c.recovered_order_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              navigate(`/orders/${c.recovered_order_id}`)
                            }
                            aria-label={t("abandonedCheckouts.viewOrder")}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {isAr ? "السابق" : "Previous"}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page} / {Math.ceil(total / 20)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {isAr ? "التالي" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AbandonedCheckouts;
