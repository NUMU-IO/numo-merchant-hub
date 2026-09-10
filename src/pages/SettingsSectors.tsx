/**
 * Settings → Sector & capabilities.
 *
 * Applying a sector preset seeds the store with the typed product fields,
 * starter categories and capabilities that sector normally needs, and can
 * lay out a matching home page in the theme DRAFT (never the live
 * storefront). Everything it creates is ordinary merchant data afterwards —
 * editable, deletable, and never re-applied behind the merchant's back.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import {
  applySectorPreset,
  listCapabilities,
  listSectorPresets,
  setCapability,
  type ApplyPresetReport,
  type SectorPresetSummary,
} from "@/services/sectorPresetsApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Sparkles } from "lucide-react";

const THEME_OUTCOME: Record<string, { en: string; ar: string }> = {
  draft_updated: {
    en: "Home layout saved to your theme draft — review and publish it in the customizer.",
    ar: "تم حفظ تخطيط الصفحة الرئيسية في مسودة الثيم — راجعها وانشرها من المحرر.",
  },
  skipped_no_active_theme: {
    en: "No active theme, so the layout was skipped.",
    ar: "لا يوجد ثيم مفعّل، فتم تخطي التخطيط.",
  },
  skipped_no_section_schema: {
    en: "The active theme did not report its sections, so the layout was skipped.",
    ar: "الثيم المفعّل لم يوفّر أقسامه، فتم تخطي التخطيط.",
  },
  skipped_no_matching_sections: {
    en: "The active theme has none of this sector's sections, so the layout was skipped.",
    ar: "الثيم المفعّل لا يحتوي أقسام هذا القطاع، فتم تخطي التخطيط.",
  },
};

export default function SettingsSectors() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const qc = useQueryClient();

  const [pending, setPending] = useState<SectorPresetSummary | null>(null);
  const [applyCategories, setApplyCategories] = useState(true);
  const [applyTheme, setApplyTheme] = useState(true);
  const [report, setReport] = useState<ApplyPresetReport | null>(null);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["sector-presets", storeId],
    queryFn: () => listSectorPresets(storeId!),
    enabled: !!storeId,
  });

  const { data: capabilities = [] } = useQuery({
    queryKey: ["store-capabilities", storeId],
    queryFn: () => listCapabilities(storeId!),
    enabled: !!storeId,
  });

  const applyMutation = useMutation({
    mutationFn: (preset: SectorPresetSummary) =>
      applySectorPreset(storeId!, preset.key, {
        apply_categories: applyCategories,
        apply_theme: applyTheme,
      }),
    onSuccess: (result) => {
      setReport(result);
      setPending(null);
      qc.invalidateQueries({ queryKey: ["sector-presets", storeId] });
      qc.invalidateQueries({ queryKey: ["store-capabilities", storeId] });
      qc.invalidateQueries({ queryKey: ["metafield-definitions", storeId] });
      qc.invalidateQueries({ queryKey: ["categories", storeId] });
      toast.success(isAr ? "تم تطبيق القطاع" : "Sector applied");
    },
    onError: (err) => showError(err, language),
  });

  const capabilityMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      setCapability(storeId!, key, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-capabilities", storeId] });
    },
    onError: (err) => showError(err, language),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SettingsBreadcrumb
        current={isAr ? "القطاع والإمكانيات" : "Sector & capabilities"}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {isAr ? "قوالب القطاعات" : "Sector presets"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "اختر قطاعك ليضيف نُمو الحقول والأقسام والإمكانيات المناسبة. لا يحذف أو يستبدل أي بيانات موجودة."
              : "Pick your sector and NUMU adds the fields, categories and capabilities it needs. Nothing existing is replaced or deleted."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setReport(null);
                    setPending(preset);
                  }}
                  className="rounded-lg border p-4 text-start transition hover:border-primary hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {isAr ? preset.name_ar : preset.name}
                    </span>
                    {preset.is_applied && (
                      <Badge variant="secondary" className="shrink-0">
                        <Check className="me-1 h-3 w-3" />
                        {isAr ? "مطبَّق" : "Applied"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preset.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isAr
                      ? `${preset.field_count} حقل · ${preset.category_count} تصنيف`
                      : `${preset.field_count} fields · ${preset.category_count} categories`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "الإمكانيات" : "Capabilities"}</CardTitle>
          <CardDescription>
            {isAr
              ? "ما يستطيع هذا المتجر فعله. الإمكانيات المعطّلة إما غير متاحة في باقتك أو لم تُطلق بعد."
              : "What this store can do. A capability that is off is either above your plan or not released yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {capabilities.map((capability) => (
            <div
              key={capability.key}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <Label htmlFor={`cap-${capability.key}`} className="font-medium">
                  {isAr ? capability.name_ar : capability.name}
                </Label>
                {!capability.implemented ? (
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "قريباً" : "Coming soon"}
                  </p>
                ) : capability.min_plan !== "free" ? (
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? `يتطلب باقة ${capability.min_plan}`
                      : `Requires the ${capability.min_plan} plan`}
                  </p>
                ) : null}
              </div>
              <Switch
                id={`cap-${capability.key}`}
                checked={capability.enabled}
                disabled={
                  !capability.implemented || capabilityMutation.isPending
                }
                onCheckedChange={(enabled) =>
                  capabilityMutation.mutate({ key: capability.key, enabled })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr
                ? `تطبيق قالب ${pending?.name_ar ?? ""}`
                : `Apply the ${pending?.name ?? ""} preset`}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "إضافة فقط — لن يتم حذف أو تعديل أي حقل أو تصنيف موجود."
                : "Additive only — no existing field or category is changed or removed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="apply-categories">
                {isAr ? "إنشاء التصنيفات المبدئية" : "Create starter categories"}
              </Label>
              <Switch
                id="apply-categories"
                checked={applyCategories}
                onCheckedChange={setApplyCategories}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="apply-theme">
                  {isAr ? "تخطيط الصفحة الرئيسية" : "Home page layout"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يُحفظ في مسودة الثيم فقط — متجرك المباشر لا يتغير."
                    : "Saved to the theme draft only — your live storefront does not change."}
                </p>
              </div>
              <Switch
                id="apply-theme"
                checked={applyTheme}
                onCheckedChange={setApplyTheme}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => pending && applyMutation.mutate(pending)}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {isAr ? "تطبيق" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "ما تم تطبيقه" : "What was applied"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              {isAr
                ? `الحقول: ${report.fields_created} جديد · ${report.fields_skipped} موجود بالفعل`
                : `Fields: ${report.fields_created} created · ${report.fields_skipped} already existed`}
            </p>
            <p>
              {isAr
                ? `التصنيفات: ${report.categories_created} جديد · ${report.categories_skipped} موجود بالفعل`
                : `Categories: ${report.categories_created} created · ${report.categories_skipped} already existed`}
            </p>
            {report.theme !== "not_requested" && (
              <p className="text-muted-foreground">
                {isAr
                  ? THEME_OUTCOME[report.theme]?.ar
                  : THEME_OUTCOME[report.theme]?.en}
              </p>
            )}
            {report.capabilities_unavailable.length > 0 && (
              <p className="text-muted-foreground">
                {isAr
                  ? `غير متاح بعد: ${report.capabilities_unavailable.join("، ")}`
                  : `Not available yet: ${report.capabilities_unavailable.join(", ")}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
