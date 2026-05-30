/**
 * UninstallModal — Session D (2026-05-28).
 *
 * Soft-uninstall a marketplace theme from the merchant's library.
 * Backend implements this as
 * `marketplace_theme_installations.uninstalled_at = NOW()` — the
 * underlying customization_v3 stays in `store_themes`, so reinstalling
 * the same theme later restores the merchant's saved settings.
 *
 * The Library row's Uninstall button is **disabled when the row is
 * the active theme** — uninstalling an active theme would orphan the
 * storefront. The guard lives in the calling component; this modal
 * only renders when the call is allowed.
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
import { Loader2, Trash2 } from "lucide-react";

export interface UninstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeName: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function UninstallModal({
  open,
  onOpenChange,
  themeName,
  onConfirm,
  loading,
}: UninstallModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("marketplace.uninstall.title", { theme: themeName })}</DialogTitle>
          <DialogDescription>
            {t("marketplace.uninstall.body", { theme: themeName })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("marketplace.uninstall.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 me-2" />
            )}
            {t("marketplace.uninstall.uninstall")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
