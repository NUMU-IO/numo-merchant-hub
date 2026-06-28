/**
 * InstallModal — Session D (2026-05-28).
 *
 * Shopify-style "add to library" modal. Surfaced when the merchant
 * clicks Install on a catalog card. Distinguishes install from activate
 * in copy — the merchant is told the theme goes to their library AND
 * their current storefront stays unchanged.
 *
 * For paid themes (price_cents > 0) the copy + CTA are the same in
 * v1 because the marketplace doesn't have paid themes yet. A TODO
 * marker is left for Session F (Reviews + paid-theme polish).
 */

import { useTranslation } from "react-i18next";
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

export interface InstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeName: string;
  currentlyActiveName: string | null;
  priceCents: number;
  currency?: string;
  onConfirm: () => void;
  loading?: boolean;
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
}: InstallModalProps) {
  const { t } = useTranslation();
  const isFree = priceCents === 0;

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

        {!isFree && (
          // Paid-theme polish (purchase + license copy) is deferred post-v1.
          // For now we accept any non-zero price and proceed to install
          // because no paid themes exist yet.
          <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-900 text-sm p-3">
            {t("marketplace.install.paidNotice", {
              price: Math.round(priceCents / 100),
              currency,
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("marketplace.install.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 me-2" />
            )}
            {t("marketplace.install.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
