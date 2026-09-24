import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NUMU_APP_HOME, UNINSTALL_REASONS, type UninstallFeedback } from "@/services/appsApi";

export function UninstallAppDialog({
  app,
  onClose,
  onConfirm,
}: {
  app: { slug: string; name: string; partner: boolean } | null;
  onClose: () => void;
  onConfirm: (feedback: UninstallFeedback) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  return (
    <AlertDialog
      open={!!app}
      onOpenChange={(open) => {
        if (open) return;
        onClose();
        setReason("");
        setText("");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("apps.uninstall")}</AlertDialogTitle>
          <AlertDialogDescription>
            {app &&
              t(NUMU_APP_HOME[app.slug] ? "apps.uninstallConfirm" : "apps.uninstallConfirmSettings", { name: app.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {app?.partner && (
          <div className="space-y-2">
            <Label htmlFor="uninstall-reason">{t("apps.uninstallReason")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="uninstall-reason">
                <SelectValue placeholder={t("apps.uninstallReasonPick")} />
              </SelectTrigger>
              <SelectContent>
                {UNINSTALL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`apps.uninstallReason_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              rows={2}
              maxLength={500}
              value={text}
              aria-label={t("apps.uninstallReasonText")}
              placeholder={t("apps.uninstallReasonText")}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={() => onConfirm({ reason: reason || undefined, reason_text: text.trim() || undefined })}
          >
            {t("apps.uninstall")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
