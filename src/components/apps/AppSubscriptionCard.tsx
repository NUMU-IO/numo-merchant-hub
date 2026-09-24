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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format-money";
import { showError } from "@/lib/show-error";
import {
  type AppInstallation,
  cancelAppSubscription,
  getAppSubscription,
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
    mutationFn: (_intent: "subscribe" | "resume") => subscribeApp(storeId, install.slug),
    onMutate: () => setShort(null),
    onSuccess: ({ sub: next, charged }, intent) => {
      queryClient.setQueryData(queryKey, next);
      // The header's wallet chip shows the balance this just moved.
      if (charged) void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(
        charged
          ? t("appBilling.subscribedToast", { amount: money(next.subscribed_price_cents ?? 0) })
          : intent === "resume"
            ? t("appBilling.resumedToast", {
                date: next.current_period_end ? day(next.current_period_end) : "",
              })
            : t("appBilling.alreadyActive"),
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "insufficient_wallet_balance") {
        const d = (err.body as { error?: { needed_cents?: number; balance_cents?: number } } | null)
          ?.error;
        setShort({ balance: d?.balance_cents ?? 0, needed: d?.needed_cents ?? 0 });
        return;
      }
      const conflict =
        err instanceof ApiError && err.status === 409 ? CONFLICTS[err.serverDetail ?? ""] : undefined;
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

  const state = sub?.status ?? "none";
  const ending = state === "active" && Boolean(sub?.cancel_at_period_end);
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
        : state === "active"
          ? blocked
            ? t("appBilling.wontRenew")
            : t("appBilling.active")
          : state === "past_due"
            ? sub?.entitled
              ? t("appBilling.pastDueGrace")
              : t("appBilling.pastDueStopped")
            : t("appBilling.cancelled");
  const spinner = <Loader2 className="me-2 h-4 w-4 animate-spin" />;

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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("appBilling.how", { days })}
            </p>
            {sub.current_period_end && (
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("appBilling.paidThrough")}</dt>
                <dd className="font-medium">
                  <bdi dir="ltr">{day(sub.current_period_end)}</bdi>
                </dd>
              </dl>
            )}
            <p className="text-sm leading-relaxed">{message}</p>
            {/* Renewals keep the price the store subscribed at. */}
            {state === "active" &&
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
              {state === "active" && !ending ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const date = sub.current_period_end ? day(sub.current_period_end) : "";
                    if (window.confirm(t("appBilling.cancelConfirm", { name, date }))) cancel.mutate();
                  }}
                >
                  {cancel.isPending && spinner}
                  {t("appBilling.cancel")}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={busy || Boolean(blocked)}
                    onClick={() => subscribe.mutate(ending ? "resume" : "subscribe")}
                  >
                    {subscribe.isPending && spinner}
                    {ending ? t("appBilling.resume") : t("appBilling.subscribe", { price })}
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
