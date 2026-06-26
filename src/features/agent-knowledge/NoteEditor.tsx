/**
 * NoteEditor — create/edit a merchant note in a dialog (RHF + Zod, RTL-aware).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

import type { MerchantNote, NoteInput, NoteLocale } from "./api";

const schema = z.object({
  title: z.string().min(1).max(512),
  body: z.string().min(1).max(8000),
  locale: z.enum(["en", "ar"]),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: MerchantNote & { body?: string };
  saving?: boolean;
  onSubmit: (input: NoteInput) => void;
}

export function NoteEditor({ open, onOpenChange, initial, saving, onSubmit }: Props) {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();

  const form = useForm<NoteInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      body: initial?.body ?? "",
      locale: (initial?.locale ?? (language as NoteLocale)) || "en",
    },
  });

  useEffect(() => {
    form.reset({
      title: initial?.title ?? "",
      body: initial?.body ?? "",
      locale: (initial?.locale ?? (language as NoteLocale)) || "en",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {initial ? t("agentNotes.editTitle") : t("agentNotes.newTitle")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
        >
          <div className="space-y-1">
            <Label htmlFor="note-title">{t("agentNotes.fieldTitle")}</Label>
            <Input id="note-title" {...form.register("title")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="note-body">{t("agentNotes.fieldBody")}</Label>
            <Textarea id="note-body" rows={6} {...form.register("body")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
