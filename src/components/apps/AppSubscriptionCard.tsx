/**
 * A paid app's subscription, on the app's page (apps plan, Phase 7): price,
 * status, paid-through date, and subscribe / cancel / resume.
 *
 * The store's NUMU wallet pays, one period at a time (monthly = 30 days,
 * annual = 365), and renews on its own. Nothing here talks to a payment
 * gateway: a wallet that can't cover the price answers 402 with both amounts,
 * and the merchant tops up on the Wallet page and presses Subscribe again.
 * Never retried automatically, because every POST can move money.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format-money";
import { showError } from "@/lib/show-error";
import {
  type AppChargeQuote,
  type AppInstallation,
  cancelAppSubscription,
  getAppSubscription,
  quoteAppSubscription,
  subscribeApp,
} from "@/services/appsApi";

/** The API's 409 details are English sentences; these are the hub's words. */
const CONFLICTS: Record<string, string> = {
  "Finish installing or enable the app first.": "appBilling.finishFirst",
  "This app is not available.": "appBilling.unavailable",
  "This app is free.": "appBilling.free",
  "The store's wallet is suspended.": "appBilling.walletSuspended",
};

const BADGE = {
  none: "secondary",
  active: "success",
  trial: "success",
  past_due: "warning",
  cancelled: "outline",
} as const;

export function AppSubscriptionCard({
  storeId,
  install,
  name,
  priceLabel,
}: {
  storeId: string;
  install: AppInstallation;
  /** The app's name in the viewer's language. */
  name: string;
  /** The listing's price text, already localized ("EGP 99 / month"). */
  priceLabel?: string;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : "en";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ["apps", "subscription", storeId, install.slug];
  const { data: sub, isError } = useQuery({
    queryKey,
    queryFn: () => getAppSubscription(storeId, install.slug),
  });
  /** Set by a 402: what the wallet holds and what one period needs. */
  const [short, setShort] = useState<{ balance: number; needed: number } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<AppChargeQuote | null>(null);

  const couponError = (err: unknown) => {
    const c =
      err instanceof ApiError && err.status === 422
        ? (err.body as { detail?: { code?: string } } | null)?.detail?.code
        : undefined;
    return c && c.startsWith("coupon_") ? `appBilling.${c}` : undefined;
  };

  const applyCoupon = useMutation({
    mutationFn: () => quoteAppSubscription(storeId, install.slug, code.trim()),
    onSuccess: setQuote,
    onError: (err) => {
      const key = couponError(err);
      if (key) toast.error(t(key));
      else showError(err, language);
    },
  });

  const money = (cents: number) =>
    formatMoney(cents, {
      fromCents: true,
      currency: sub?.currency || "EGP",
      locale: lang,
      fixed: true,
    });
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const subscribe = useMutation({
    // "resume" is the same POST; the variable only picks the toast.
    mutationFn: (_intent: "subscribe" | "resume") =>
      subscribeApp(storeId, install.slug, quote?.coupon?.code),
    onMutate: () => setShort(null),
    onSuccess: ({ sub: next, charged }, intent) => {
      queryClient.setQueryData(queryKey, next);
      setQuote(null);
      setCode("");
      // The header's wallet chip shows the balance this just moved.
      if (charged) void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(
        charged && next.is_trial
          ? t("appBilling.trialToast")
          : charged
          ? t("appBilling.subscribedToast", {
              amount: money(quote?.total_cents ?? next.subscribed_price_cents ?? 0),
            })
          : intent === "resume"
            ? t("appBilling.resumedToast", {
                date: next.current_period_end ? day(next.current_period_end) : "",
              })
            : t("appBilling.alreadyActive"),
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        const d = (err.body as { detail?: { needed_cents?: number; balance_cents?: number } } | null)
          ?.detail;
        setShort({ balance: d?.balance_cents ?? 0, needed: d?.needed_cents ?? 0 });
        return;
      }
      const conflict =
        err instanceof ApiError && err.status === 409
          ? CONFLICTS[err.serverDetail ?? ""]
          : couponError(err);
      if (conflict) toast.error(t(conflict));
      else showError(err, language);
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelAppSubscription(storeId, install.slug),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      toast.success(
        t("appBilling.cancelledToast", {
          date: next.current_period_end ? day(next.current_period_end) : "",
        }),
      );
    },
    onError: (err) => showError(err, language),
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          {t("appBilling.loadFailed")}
        </CardContent>
      </Card>
    );
  }

  const state = sub?.status === "active" && sub.is_trial ? "trial" : (sub?.status ?? "none");
  const live = state === "active" || state === "trial";
  const ending = live && Boolean(sub?.cancel_at_period_end);
  // The API refuses to charge an install that isn't live (409), and never
  // renews one: say so up front rather than after a click.
  const blocked =
    install.install_status && install.install_status !== "active"
      ? t("appBilling.needsConnect")
      : !install.is_enabled
        ? t("appBilling.needsEnable")
        : install.app_status && install.app_status !== "published"
          ? t("appBilling.unavailable")
          : null;
  const busy = subscribe.isPending || cancel.isPending;
  const price = priceLabel ?? (sub?.price_cents != null ? money(sub.price_cents) : "");
  const days = (sub?.cycle === "annual" ? 365 : 30).toLocaleString(
    lang === "ar" ? "ar-EG" : "en-US",
  );
  const message =
    state === "none"
      ? t("appBilling.none")
      : ending
        ? t("appBilling.ending")
        : live
          ? blocked
            ? t("appBilling.wontRenew")
            : t(state === "trial" ? "appBilling.trial" : "appBilling.active")
          : state === "past_due"
            ? sub?.entitled
              ? t("appBilling.pastDueGrace")
              : t("appBilling.pastDueStopped")
            : t("appBilling.cancelled");
  const spinner = <Loader2 className="me-2 h-4 w-4 animate-spin" />;
  const charge = quote ?? sub?.next_charge ?? null;

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("appBilling.title")}</h2>
          {sub && (
            <Badge variant={ending ? "outline" : BADGE[state]}>
              {t(`appBilling.st_${ending ? "cancelled" : state}`)}
            </Badge>
          )}
        </div>

        {!sub ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {price && <p className="text-lg font-bold">{price}</p>}
            {charge && charge.vat_cents > 0 && (
              <div className="space-y-0.5 text-sm">
                {charge.discount_cents > 0 && (
                  <p>
                    {t("appBilling.discountLine", {
                      code: quote?.coupon?.code ?? sub.coupon?.code ?? "",
                      amount: money(charge.discount_cents),
                    })}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {t("appBilling.vatLine", { amount: money(charge.vat_cents) })}
                </p>
                <p className="font-medium">
                  {t("appBilling.totalLine", { amount: money(charge.total_cents) })}
                </p>
                {charge.discount_capped && (
                  <p className="text-xs text-muted-foreground">
                    {t("appBilling.couponCapped", { amount: money(charge.discount_cents) })}
                  </p>
                )}
              </div>
            )}
            {sub.coupon && !quote && (
              <p className="text-xs text-muted-foreground">
                {t("appBilling.couponActive", { code: sub.coupon.code })}
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("appBilling.how", { days })}
            </p>
            {sub.current_period_end && (
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">
                  {t(sub.is_trial ? "appBilling.trialEnds" : "appBilling.paidThrough")}
                </dt>
                <dd className="font-medium">
                  <bdi dir="ltr">{day(sub.current_period_end)}</bdi>
                </dd>
              </dl>
            )}
            <p className="text-sm leading-relaxed">{message}</p>
            {sub.usage && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t("appBilling.usageTitle")}</span>
                  <span>
                    {t("appBilling.usageLine", {
                      used: money(sub.usage.used_cents),
                      cap: money(sub.usage.cap_cents),
                    })}
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={sub.usage.cap_cents}
                  aria-valuenow={sub.usage.used_cents}
                >
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, (sub.usage.used_cents / sub.usage.cap_cents) * 100)}%`,
                    }}
                  />
                </div>
                {sub.usage.unit_price_cents != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("appBilling.usageUnit", {
                      price: money(sub.usage.unit_price_cents),
                      unit: sub.usage.unit[lang] ?? sub.usage.unit.en,
                    })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("appBilling.usageHow", { cap: money(sub.usage.cap_cents) })}
                </p>
              </div>
            )}
            {/* Renewals keep the price the store subscribed at. */}
            {live &&
              !ending &&
              sub.subscribed_price_cents != null &&
              sub.price_cents != null &&
              sub.subscribed_price_cents !== sub.price_cents && (
                <p className="text-sm text-muted-foreground">
                  {t("appBilling.oldPrice", { price: money(sub.subscribed_price_cents), label: price })}
                </p>
              )}

            {short && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{t("appBilling.shortTitle")}</p>
                  <p className="text-muted-foreground">
                    {t("appBilling.shortBody", {
                      balance: money(short.balance),
                      needed: money(short.needed),
                    })}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/wallet")}>
                  {t("appBilling.topUp")}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {live && !ending ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(true)}>
                    {cancel.isPending && spinner}
                    {t("appBilling.cancel")}
                  </Button>
                  <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("appBilling.cancel")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("appBilling.cancelConfirm", {
                            name,
                            date: sub.current_period_end ? day(sub.current_period_end) : "",
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancel.mutate()}>{t("appBilling.cancel")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  {!ending && (
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <Input
                        className="h-9 max-w-[12rem] uppercase"
                        aria-label={t("appBilling.couponLabel")}
                        placeholder={t("appBilling.couponLabel")}
                        value={code}
                        maxLength={40}
                        disabled={Boolean(quote)}
                        onChange={(e) => setCode(e.target.value)}
                      />
                      {quote ? (
                        <Button size="sm" variant="ghost" onClick={() => setQuote(null)}>
                          {t("appBilling.couponRemove")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!code.trim() || applyCoupon.isPending}
                          onClick={() => applyCoupon.mutate()}
                        >
                          {applyCoupon.isPending && spinner}
                          {t("appBilling.couponApply")}
                        </Button>
                      )}
                    </div>
                  )}
                  <Button
                    disabled={busy || Boolean(blocked)}
                    onClick={() => subscribe.mutate(ending ? "resume" : "subscribe")}
                  >
                    {subscribe.isPending && spinner}
                    {ending
                      ? t("appBilling.resume")
                      : sub.trial_available && sub.trial_days
                        ? t("appBilling.startTrial", { days: sub.trial_days })
                        : t("appBilling.subscribe", { price })}
                  </Button>
                  {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
