/**
 * ActivateModal — Session D (2026-05-28).
 *
 * Distinguished from InstallModal: this is when the merchant is
 * SWITCHING their storefront from one theme to another. Critical to
 * communicate that:
 *   1. The storefront will actually change (visitors see the new
 *      theme on next page load).
 *   2. The current theme's customization is saved (snapshot row), so
 *      switching back later restores everything.
 *
 * Backed by ThemeActivationService.activate() on the server, which
 * snapshots BEFORE any destructive write. The snapshot reassurance
 * copy here is load-bearing — Phase 3a + Session A + B work makes
 * this true.
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
import { CheckCircle2, Loader2 } from "lucide-react";

export interface ActivateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Theme being activated (the destination). */
  themeName: string;
  /** Currently-active theme (the source). Null when no theme is active. */
  currentlyActiveName: string | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function ActivateModal({
  open,
  onOpenChange,
  themeName,
  currentlyActiveName,
  onConfirm,
  loading,
}: ActivateModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("marketplace.activate.title", { theme: themeName })}</DialogTitle>
          <DialogDescription>
            {currentlyActiveName
              ? t("marketplace.activate.switchBody", {
                  from: currentlyActiveName,
                  theme: themeName,
                })
              : t("marketplace.activate.startBody", { theme: themeName })}
          </DialogDescription>
        </DialogHeader>

        {/* Snapshot reassurance. The backend writes
            store_theme_snapshots row BEFORE the swap — this UI sentence
            is the merchant-visible promise that swapping is reversible. */}
        <div className="flex items-start gap-3 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-900 text-sm p-3">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t("marketplace.activate.workSafe")}</p>
            <p className="text-xs mt-1 opacity-90">
              {t("marketplace.activate.workSafeBody")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("marketplace.activate.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : null}
            {t("marketplace.activate.activate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
