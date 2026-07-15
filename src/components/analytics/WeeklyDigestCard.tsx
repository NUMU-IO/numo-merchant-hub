import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Mail } from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getDigestPreview, getDigestSettings, putDigestSettings,
} from "@/services/analyticsApi";
import { toast } from "sonner";

interface WeeklyDigestCardProps {
  storeId: string;
}

/** Weekly digest: shows the recap the merchant would receive and lets
 *  them turn scheduled email delivery on/off. */
export function WeeklyDigestCard({ storeId }: WeeklyDigestCardProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const previewQuery = useQuery({
    queryKey: ["analytics", "digest-preview", storeId, isAr ? "ar" : "en"],
    queryFn: () => getDigestPreview(storeId, isAr ? "ar" : "en"),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const settingsQuery = useQuery({
    queryKey: ["analytics", "digest-settings", storeId],
    queryFn: () => getDigestSettings(storeId),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const enabled = settingsQuery.data?.enabled ?? false;

  const toggleMutation = useMutation({
    mutationFn: (next: boolean) =>
      putDigestSettings(storeId, {
        enabled: next,
        channels: settingsQuery.data?.channels ?? ["email"],
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["analytics", "digest-settings", storeId], data);
      toast.success(
        data.enabled
          ? (isAr ? "هيوصلك ملخص كل أسبوع" : "You'll get a weekly summary")
          : (isAr ? "اتوقف الملخص الأسبوعي" : "Weekly summary turned off"),
      );
    },
    onError: () => toast.error(isAr ? "فشل الحفظ" : "Couldn't save"),
  });

  const preview = previewQuery.data;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight flex items-center gap-2">
              <Mail className="h-4 w-4 text-ink-faint" strokeWidth={2.2} />
              {isAr ? "الملخص الأسبوعي" : "Weekly Digest"}
            </h2>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              {isAr
                ? "ابعتلي ملخص أداء المتجر بالإيميل كل أسبوع"
                : "Email me a store summary every week"}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
            disabled={toggleMutation.isPending}
            aria-label={isAr ? "تفعيل الملخص الأسبوعي" : "Enable weekly digest"}
          />
        </div>

        {/* Live preview so the merchant sees exactly what they'd receive. */}
        {preview && (
          <div className="rounded-xl bg-muted/40 p-3.5">
            <p className="text-[13px] font-semibold leading-snug">
              {preview.headline}
            </p>
            {preview.highlights.length > 0 && (
              <ul className="mt-2 space-y-1">
                {preview.highlights.map((h, i) => (
                  <li key={i} className="text-[12px] text-muted-foreground flex gap-1.5">
                    <span aria-hidden className="text-foreground/40">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10.5px] text-muted-foreground/70 mt-2.5">
              {isAr ? "معاينة — " : "Preview — "}
              {preview.period_start} → {preview.period_end}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
