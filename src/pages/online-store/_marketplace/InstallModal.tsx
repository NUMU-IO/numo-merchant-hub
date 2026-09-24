/**
 * InstallModal — Session D (2026-05-28).
 *
 * Shopify-style "add to library" modal. Surfaced when the merchant
 * clicks Install on a catalog card. Distinguishes install from activate
 * in copy — the merchant is told the theme goes to their library AND
 * their current storefront stays unchanged.
 *
 * A paid theme (price_cents > 0) is bought here instead: the modal shows
 * the price plus VAT on NUMU's fee, charges the store's wallet once and
 * installs it. A store that already owns it just installs.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Download } from "lucide-react";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format-money";
import { buyTheme, getThemePurchase } from "@/services/marketplaceApi";

export interface InstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeName: string;
  currentlyActiveName: string | null;
  priceCents: number;
  currency?: string;
  onConfirm: () => void;
  loading?: boolean;
  /** Both set: a paid theme is bought from the wallet here. */
  storeId?: string | null;
  themeId?: string;
}

export function InstallModal({
  open,
  onOpenChange,
  themeName,
  currentlyActiveName,
  priceCents,
  currency = "USD",
  onConfirm,
  loading,
  storeId,
  themeId,
}: InstallModalProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isFree = priceCents === 0;
  const buying = !isFree && Boolean(storeId && themeId);
  const [short, setShort] = useState<{ needed: number; balance: number } | null>(null);
  const money = (cents: number) =>
    formatMoney(cents, {
      fromCents: true,
      currency: "EGP",
      locale: i18n.language === "ar" ? "ar" : "en",
      fixed: true,
    });
  const quote = useQuery({
    queryKey: ["theme-purchase", storeId, themeId],
    queryFn: () => getThemePurchase(storeId as string, themeId as string),
    enabled: open && buying,
  });
  const buy = useMutation({
    mutationFn: () => buyTheme(storeId as string, themeId as string),
    onMutate: () => setShort(null),
    onSuccess: ({ charged }) => {
      toast.success(t(charged ? "marketplace.install.bought" : "marketplace.catalog.addedToLibrary"));
      void queryClient.invalidateQueries({ queryKey: ["marketplace-installed", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["theme-purchase", storeId, themeId] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        const d = (err.body as { detail?: { needed_cents?: number; balance_cents?: number } } | null)?.detail;
        setShort({ needed: d?.needed_cents ?? 0, balance: d?.balance_cents ?? 0 });
        return;
      }
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });
  const q = quote.data;
  const busy = loading || buy.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("marketplace.install.title", { theme: themeName })}</DialogTitle>
          <DialogDescription>
            {t("marketplace.install.addsToLibrary", { theme: themeName })}{" "}
            {currentlyActiveName
              ? t("marketplace.install.staysOn", { current: currentlyActiveName })
              : t("marketplace.install.notAffected")}
          </DialogDescription>
        </DialogHeader>

        {buying && (
          <div className="space-y-1 rounded-md border p-3 text-sm">
            {quote.isLoading || !q ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : q.purchased ? (
              <p>{t("marketplace.install.owned")}</p>
            ) : (
              <>
                <p>{t("marketplace.install.priceLine", { amount: money(q.list_price_cents) })}</p>
                <p className="text-muted-foreground">
                  {t("marketplace.install.vatLine", { amount: money(q.vat_cents) })}
                </p>
                <p className="font-semibold">
                  {t("marketplace.install.totalLine", { amount: money(q.total_cents) })}
                </p>
                <p className="text-xs text-muted-foreground">{t("marketplace.install.oneTime")}</p>
              </>
            )}
          </div>
        )}
        {!isFree && !buying && (
          <div className="rounded-md border text-sm p-3">
            {t("marketplace.install.priceLine", { amount: `${Math.round(priceCents / 100)} ${currency}` })}
          </div>
        )}
        {short && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <span>{t("marketplace.install.short", { balance: money(short.balance), needed: money(short.needed) })}</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/wallet")}>
              {t("marketplace.install.topUp")}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("marketplace.install.cancel")}
          </Button>
          <Button
            onClick={() => (buying ? buy.mutate() : onConfirm())}
            disabled={busy || (buying && !q)}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 me-2" />
            )}
            {buying && q && !q.purchased
              ? t("marketplace.install.buy", { amount: money(q.total_cents) })
              : t("marketplace.install.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
