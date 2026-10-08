import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStore, updateStore, uploadStoreAsset } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Search, BarChart3, Save, Loader2,
  ShieldCheck, Upload, Image as ImageIcon, X,
} from "lucide-react";
import { HelpTip } from "@/components/ui/help-tip";
import { ImageCropDialog, fileFromCropBlob } from "@/components/ImageCropDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

interface PrefsState {
  favicon_url: string;
  ga_tracking_id: string;
  meta_pixel_id: string;
}

export default function OnlineStorePreferences() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";
  const initializedRef = useRef(false);

  const [form, setForm] = useState<PrefsState>({
    favicon_url: "",
    ga_tracking_id: "", meta_pixel_id: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesGuard(isDirty);

  const { data: storeData, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => getStore(storeId),
    enabled: !!storeId,
  });

  // Seed ONCE — never overwrite user edits on background refetch
  useEffect(() => {
    if (!storeData || initializedRef.current) return;
    initializedRef.current = true;
    const s = (storeData.settings ?? {}) as Record<string, unknown>;
    setForm({
      favicon_url:      (s.favicon_url        as string)  ?? "",
      ga_tracking_id:   (s.ga_tracking_id     as string)  ?? "",
      meta_pixel_id:    (s.meta_pixel_id      as string)  ?? "",
    });
  }, [storeData]);

  function set<K extends keyof PrefsState>(k: K, v: PrefsState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setIsDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateStore(storeId, {
        settings: {
          favicon_url:         form.favicon_url,
          ga_tracking_id:      form.ga_tracking_id,
          meta_pixel_id:       form.meta_pixel_id,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(isRTL ? "تم حفظ التفضيلات" : "Preferences saved");
      setIsDirty(false);
    },
    onError: (err) => showError(err),
  });


  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded bg-muted animate-pulse mt-2" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              <div className="h-9 rounded bg-muted animate-pulse" />
              <div className="h-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isRTL ? "التفضيلات" : "Preferences"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "SEO والتتبع وحماية المتجر" : "SEO, tracking, and store protection"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400">
              {isRTL ? "تغييرات غير محفوظة" : "Unsaved changes"}
            </Badge>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading || !isDirty}
          >
            {saveMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              : <Save className="h-3.5 w-3.5 me-1.5" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>

      {/* Help tip */}
      <HelpTip title={isRTL ? "كيف تستخدم التفضيلات؟" : "How to use Preferences"}>
        <ul className="list-disc list-inside space-y-1">
          <li>{isRTL ? "عنوان الصفحة ووصف الميتا وصورة المشاركة اتنقلوا لصفحة SEO في إعدادات المتجر." : "Homepage title, meta description and social sharing image now live on the SEO page in Store settings."}</li>
          <li>{isRTL ? "أضف Google Analytics و Meta Pixel لتتبع زيارات وتحويلات متجرك." : "Add Google Analytics and Meta Pixel to track your store visits and conversions."}</li>
          <li>{isRTL ? "حماية المتجر بباسورد قبل الإطلاق بتتظبط من صفحة المتجر الأونلاين." : "Pre-launch password protection is set on the Online Store page."}</li>
          <li>{isRTL ? "اضغط «حفظ» بعد أي تغيير لحفظه نهائيًا." : "Click Save after any change to persist it."}</li>
        </ul>
      </HelpTip>

      {/* ── SEO ─────────────────────────────────────────────────────────────── */}
      <Section icon={<Search className="h-4 w-4" />} title={isRTL ? "تحسين محركات البحث" : "Search engine optimization"}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "عنوان الصفحة ووصف الميتا وصورة المشاركة كلها في صفحة SEO — مع نوع النشاط وتوثيق Google والتحكم في الفهرسة."
              : "Homepage title, meta description and social sharing image live on the SEO page — along with business type, Google verification and indexing control."}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/store?section=seo">
              {isRTL ? "افتح إعدادات SEO" : "Open SEO settings"}
            </Link>
          </Button>
        </div>
      </Section>

      {/* ── Favicon ──────────────────────────────────────────────────────────── */}
      <Section icon={<ImageIcon className="h-4 w-4" />} title={isRTL ? "أيقونة المتجر (Favicon)" : "Favicon"}>
        <FaviconField
          value={form.favicon_url}
          onChange={(url) => set("favicon_url", url)}
          isRTL={isRTL}
        />
      </Section>

      {/* ── Tracking pixels ──────────────────────────────────────────────────── */}
      <Section icon={<BarChart3 className="h-4 w-4" />} title={isRTL ? "بكسلات التتبع" : "Tracking pixels"}>
        <div className="space-y-4">
          {/* Google Analytics */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#4285F4] text-white text-[8px] font-bold shrink-0">G</span>
              Google Analytics (GA4)
            </Label>
            <Input
              value={form.ga_tracking_id}
              onChange={(e) => set("ga_tracking_id", e.target.value)}
              placeholder="G-XXXXXXXXXX"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {isRTL ? "يبدأ بـ G- أو UA-" : "Starts with G- (GA4) or UA- (Universal Analytics)"}
            </p>
          </div>

          <div className="border-t" />

          {/* Meta Pixel — legacy one-line input. The full Meta Pixel +
               Conversions API panel now lives at /settings/tracking; the
               storefront's MetaPixel component prefers the namespaced
               settings that panel writes. This flat field stays as the
               fallback path for stores that haven't migrated yet. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#1877F2] text-white text-[9px] font-bold shrink-0">f</span>
              Meta Pixel {isRTL ? "(الإصدار القديم)" : "(legacy)"}
            </Label>
            <Input
              value={form.meta_pixel_id}
              onChange={(e) => set("meta_pixel_id", e.target.value)}
              placeholder="XXXXXXXXXXXXXXXXX"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {isRTL ? (
                <>
                  للحصول على اللوحة الكاملة (Conversions API، أحداث الاختبار،
                  المزامنة)، انتقل إلى{" "}
                  <Link to="/settings/tracking" className="underline hover:text-foreground">
                    الإعدادات ← التتبع والـ Pixels
                  </Link>
                  .
                </>
              ) : (
                <>
                  For the full panel (Conversions API, test events, audience
                  sync), go to{" "}
                  <Link to="/settings/tracking" className="underline hover:text-foreground">
                    Settings → Tracking &amp; Pixels
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </Section>

      {/* ── Password protection lives on the Online Store page ─────────────── */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title={isRTL ? "حماية المتجر بباسورد" : "Password protection"}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "قفل المتجر بباسورد قبل الإطلاق بيتظبط من صفحة المتجر الأونلاين."
              : "Locking your store with a password before launch is set on the Online Store page."}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/online-store">{isRTL ? "افتح المتجر الأونلاين" : "Open Online Store"}</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}

// ─── Reusable section card ────────────────────────────────────────────────────
function Section({
  icon, title, badge, children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/20">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold flex-1">{title}</span>
        {badge}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ─── Favicon uploader ─────────────────────────────────────────────────────────
// The little square icon shown in browser tabs / bookmarks. Square (1:1),
// small file. Writes `settings.favicon_url`; the storefront layout reads it as
// a fallback after the theme customizer's `identity.favicon_url`.
const MAX_FAVICON_BYTES = 1024 * 1024; // 1 MB

function FaviconField({
  value,
  onChange,
  isRTL,
}: {
  value: string;
  onChange: (url: string) => void;
  isRTL: boolean;
}) {
  const { currentStore } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onPickFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(isRTL ? "يجب أن يكون الملف صورة" : "File must be an image");
      return;
    }
    if (file.size > MAX_FAVICON_BYTES) {
      toast.error(isRTL ? "الحد الأقصى لحجم الأيقونة 1 ميجا" : "Favicon must be under 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropDone = async (blob: Blob) => {
    if (!currentStore?.id) return;
    setUploading(true);
    try {
      const file = fileFromCropBlob(blob, "favicon");
      const result = await uploadStoreAsset(currentStore.id, file, "favicon");
      onChange(result.url);
      setCropSrc(null);
      toast.success(isRTL ? "تم رفع الأيقونة" : "Favicon uploaded");
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isRTL
          ? "الأيقونة الصغيرة التي تظهر في تبويب المتصفح والإشارات المرجعية. يُفضّل صورة مربعة 512×512 بكسل."
          : "The small icon shown in the browser tab and bookmarks. A square 512×512 px image works best."}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
        className="hidden"
        data-testid="favicon-file-input"
        aria-label={isRTL ? "رفع أيقونة المتجر" : "Upload favicon"}
        title={isRTL ? "اختر أيقونة" : "Choose a favicon"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted/20 flex items-center justify-center">
          {value ? (
            <img src={value} alt="Favicon" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !currentStore?.id}
            data-testid="favicon-upload-btn"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {value ? (isRTL ? "استبدال" : "Replace") : (isRTL ? "رفع أيقونة" : "Upload favicon")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={() => onChange("")}
              data-testid="favicon-remove-btn"
            >
              <X className="h-3.5 w-3.5 me-1" />
              {isRTL ? "إزالة" : "Remove"}
            </Button>
          )}
        </div>
      </div>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          onClose={() => setCropSrc(null)}
          imageSrc={cropSrc}
          cropShape="rect"
          aspect={1}
          title={isRTL ? "تعديل الأيقونة (مربعة)" : "Edit favicon (square)"}
          loading={uploading}
          onCropComplete={onCropDone}
        />
      )}
    </div>
  );
}

