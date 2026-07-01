import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStore, updateStore, uploadStoreAsset } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Search, Share2, BarChart3, Save, Loader2, Info,
  Eye, EyeOff, ShieldCheck, ShieldOff, Upload, Image as ImageIcon, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import { ImageCropDialog, fileFromCropBlob } from "@/components/ImageCropDialog";
interface PrefsState {
  seo_title: string;
  seo_description: string;
  social_image_url: string;
  favicon_url: string;
  password_enabled: boolean;
  password: string;
  ga_tracking_id: string;
  meta_pixel_id: string;
}

// Character count indicator colour
function charColor(len: number, max: number) {
  const pct = len / max;
  if (pct < 0.7) return "bg-emerald-500";
  if (pct < 0.9) return "bg-amber-400";
  return "bg-red-500";
}

// Simple password strength (0-4)
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_LABEL: Record<number, { en: string; ar: string; cls: string }> = {
  0: { en: "Too short", ar: "قصيرة جدًا", cls: "text-muted-foreground" },
  1: { en: "Weak",      ar: "ضعيفة",      cls: "text-red-500" },
  2: { en: "Fair",      ar: "مقبولة",     cls: "text-amber-500" },
  3: { en: "Good",      ar: "جيدة",       cls: "text-blue-500" },
  4: { en: "Strong",    ar: "قوية",       cls: "text-emerald-500" },
};

export default function OnlineStorePreferences() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";
  const initializedRef = useRef(false);

  const [form, setForm] = useState<PrefsState>({
    seo_title: "", seo_description: "", social_image_url: "", favicon_url: "",
    password_enabled: false, password: "",
    ga_tracking_id: "", meta_pixel_id: "",
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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
      seo_title:        (s.seo_title          as string)  ?? storeData.name        ?? "",
      seo_description:  (s.seo_description    as string)  ?? storeData.description ?? "",
      social_image_url: (s.social_image_url   as string)  ?? "",
      favicon_url:      (s.favicon_url        as string)  ?? "",
      password_enabled: Boolean(s.password_enabled),
      password:         (s.storefront_password as string) ?? "",
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
          seo_title:           form.seo_title,
          seo_description:     form.seo_description,
          social_image_url:    form.social_image_url,
          favicon_url:         form.favicon_url,
          password_enabled:    form.password_enabled,
          // When password protection is disabled, clear the stored password
          // so the storefront gate unblocks even if it checks for a non-empty
          // password as a secondary guard.
          storefront_password: form.password_enabled ? form.password : "",
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

  const seoTitle       = form.seo_title || currentStore?.name || "My Store";
  const storeUrl       = currentStore?.store_url ?? "https://yourstore.numueg.app";
  const pwStrength     = passwordStrength(form.password);
  const pwMeta         = STRENGTH_LABEL[pwStrength];

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
      <div className="flex items-center justify-between gap-4">
        <div>
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
          <li>{isRTL ? "عنوان الصفحة الرئيسية ووصف الميتا يظهران في نتائج بحث Google — اجعلهما واضحين ومختصرين." : "Homepage title and meta description appear in Google search results — keep them clear and concise."}</li>
          <li>{isRTL ? "صورة المشاركة الاجتماعية تظهر عند مشاركة رابط متجرك على فيسبوك وواتساب — يُفضل صورة بحجم 1200×630 بكسل." : "Social sharing image appears when your store link is shared on Facebook/WhatsApp — recommended size is 1200×630px."}</li>
          <li>{isRTL ? "أضف Google Analytics و Meta Pixel لتتبع زيارات وتحويلات متجرك." : "Add Google Analytics and Meta Pixel to track your store visits and conversions."}</li>
          <li>{isRTL ? "حماية المتجر بكلمة مرور تمنع الوصول حتى يُدخل الزائر كلمة المرور — مفيدة قبل الإطلاق الرسمي." : "Password protection blocks access until visitors enter the password — useful before your official launch."}</li>
          <li>{isRTL ? "اضغط «حفظ» بعد أي تغيير لحفظه نهائيًا." : "Click Save after any change to persist it."}</li>
        </ul>
      </HelpTip>

      {/* ── SEO ─────────────────────────────────────────────────────────────── */}
      <Section icon={<Search className="h-4 w-4" />} title={isRTL ? "تحسين محركات البحث" : "Search engine optimization"}>
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{isRTL ? "عنوان الصفحة الرئيسية" : "Homepage title"}</Label>
              <CharBar len={form.seo_title.length} max={70} />
            </div>
            <Input
              value={form.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
              placeholder={currentStore?.name ?? "My Store"}
              maxLength={70}
              dir="auto"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{isRTL ? "وصف الميتا" : "Meta description"}</Label>
              <CharBar len={form.seo_description.length} max={160} />
            </div>
            <Textarea
              value={form.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
              placeholder={isRTL ? "وصف مختصر لمتجرك يظهر في نتائج البحث..." : "A short description of your store shown in search results..."}
              rows={3}
              maxLength={160}
              dir="auto"
            />
          </div>

          {/* Google SERP preview */}
          <div className="rounded-xl border bg-white dark:bg-zinc-950 p-4 space-y-1 select-none">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
              {isRTL ? "معاينة نتيجة البحث" : "Search result preview"}
            </p>
            {/* Favicon + URL bar */}
            <div className="flex items-center gap-2 mb-1" dir={form.seo_title.match(/^[a-zA-Z]/) ? "ltr" : "auto"}>
              <div className="h-4 w-4 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                <span className="text-[7px] font-bold text-muted-foreground">N</span>
              </div>
              <div className="flex flex-col items-start w-full overflow-hidden">
                <p className="text-[11px] text-foreground/80 leading-none" dir="auto">
                  {currentStore?.name ?? "My Store"}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-500 truncate leading-none mt-0.5" dir="ltr">
                  {storeUrl}
                </p>
              </div>
            </div>
            <p className="text-[15px] font-normal text-[#1a0dab] dark:text-[#8ab4f8] leading-snug hover:underline cursor-pointer truncate" dir="auto">
              {seoTitle}
            </p>
            {form.seo_description ? (
              <p className="text-[13px] text-[#4d5156] dark:text-zinc-400 leading-snug line-clamp-2" dir="auto">
                {form.seo_description}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground/40 italic leading-snug" dir="auto">
                {isRTL ? "أضف وصفًا ليظهر هنا..." : "Add a description to see it here..."}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── Social sharing ───────────────────────────────────────────────────── */}
      <Section icon={<Share2 className="h-4 w-4" />} title={isRTL ? "صورة المشاركة الاجتماعية" : "Social sharing image"}>
        <SocialImageField
          value={form.social_image_url}
          onChange={(url) => set("social_image_url", url)}
          storeUrl={storeUrl}
          seoTitle={seoTitle}
          seoDescription={form.seo_description}
          isRTL={isRTL}
        />

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

      {/* ── Password protection ──────────────────────────────────────────────── */}
      <Section
        icon={form.password_enabled
          ? <ShieldCheck className="h-4 w-4 text-amber-500" />
          : <ShieldOff className="h-4 w-4" />}
        title={isRTL ? "حماية المتجر بكلمة مرور" : "Password protection"}
        badge={form.password_enabled
          ? <Badge className="text-[10px] px-1.5 bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-300/60 hover:bg-amber-500/12">
              {isRTL ? "مفعّل" : "Enabled"}
            </Badge>
          : null}
      >
        <div className="space-y-4">
          {/* Toggle row */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isRTL ? "تفعيل كلمة المرور" : "Enable password"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL
                  ? "يحجب المتجر عن الزوار حتى يدخلوا كلمة المرور الصحيحة"
                  : "Hides your store from visitors until they enter the correct password"}
              </p>
            </div>
            <Switch
              checked={form.password_enabled}
              onCheckedChange={(v) => {
                setForm((p) => ({
                  ...p,
                  password_enabled: v,
                  // Clear the password when disabling so it isn't sent on save.
                  password: v ? p.password : "",
                }));
                setIsDirty(true);
              }}
            />
          </div>

          {form.password_enabled && (
            <>
              <div className="border-t" />

              {/* Password input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "كلمة المرور" : "Store password"}</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder={isRTL ? "أدخل كلمة مرور قوية..." : "Enter a strong password..."}
                    className="pe-10"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                {form.password && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={cn(
                            "flex-1 rounded-full transition-all duration-300",
                            pwStrength >= step
                              ? step <= 1 ? "bg-red-500"
                                : step === 2 ? "bg-amber-400"
                                : step === 3 ? "bg-blue-500"
                                : "bg-emerald-500"
                              : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn("text-[11px] font-medium", pwMeta.cls)}>
                      {isRTL ? pwMeta.ar : pwMeta.en}
                    </p>
                  </div>
                )}
              </div>

              {/* Warning banner */}
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 px-3.5 py-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {isRTL
                    ? "تأكد من إلغاء تفعيل كلمة المرور قبل الإطلاق الرسمي لمتجرك للعموم."
                    : "Remember to disable password protection before your public store launch."}
                </p>
              </div>
            </>
          )}
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

// ─── Social (Open Graph) image uploader ───────────────────────────────────────
// OG standard aspect is 1.91:1 (1200×630). We crop to that before upload.
const OG_ASPECT = 1200 / 630;
const MAX_OG_BYTES = 5 * 1024 * 1024; // 5 MB

function SocialImageField({
  value,
  onChange,
  storeUrl,
  seoTitle,
  seoDescription,
  isRTL,
}: {
  value: string;
  onChange: (url: string) => void;
  storeUrl: string;
  seoTitle: string;
  seoDescription: string;
  isRTL: boolean;
}) {
  const { currentStore } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  const onPickFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(isRTL ? "يجب أن يكون الملف صورة" : "File must be an image");
      return;
    }
    if (file.size > MAX_OG_BYTES) {
      toast.error(isRTL ? "الحد الأقصى لحجم الصورة 5 ميجا" : "Image must be under 5 MB");
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
      const file = fileFromCropBlob(blob, "social_image");
      const result = await uploadStoreAsset(currentStore.id, file, "social_image");
      onChange(result.url);
      setCropSrc(null);
      toast.success(isRTL ? "تم رفع الصورة" : "Image uploaded");
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  const hasImage = !!value && !previewError;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isRTL
          ? "تظهر هذه الصورة عند مشاركة رابط متجرك على Facebook أو Twitter أو WhatsApp. الحجم الموصى به 1200×630 بكسل."
          : "Shown when your store link is shared on Facebook, Twitter, or WhatsApp. Recommended size: 1200×630 px."}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="social-image-file-input"
        aria-label={isRTL ? "رفع صورة المشاركة الاجتماعية" : "Upload social sharing image"}
        title={isRTL ? "اختر صورة" : "Choose an image"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />

      {/* Preview card — matches the social-share card layout */}
      {hasImage ? (
        <div className="rounded-xl border overflow-hidden bg-muted/20">
          <div className="relative">
            <img
              src={value}
              alt="OG preview"
              className="w-full aspect-[1.91/1] object-cover bg-muted"
              onError={() => setPreviewError(true)}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-2 end-2 h-7 w-7 rounded-full bg-background/90 backdrop-blur-sm border shadow-sm flex items-center justify-center hover:bg-background text-muted-foreground hover:text-destructive transition-colors"
              aria-label={isRTL ? "إزالة" : "Remove"}
              data-testid="social-image-remove-btn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-3 py-2 border-t bg-muted/30">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/50 truncate">
              {storeUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="text-sm font-semibold leading-tight mt-0.5 line-clamp-1">{seoTitle}</p>
            {seoDescription && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{seoDescription}</p>
            )}
          </div>
          <div className="px-3 py-2 border-t flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground truncate">
              {isRTL ? "معاينة بطاقة المشاركة" : "Share card preview"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !currentStore?.id}
              data-testid="social-image-replace-btn"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {isRTL ? "استبدال" : "Replace"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !currentStore?.id}
          className="group w-full rounded-xl border-2 border-dashed bg-muted/10 hover:bg-muted/20 hover:border-primary/40 transition-colors aspect-[1.91/1] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="social-image-upload-btn"
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs">{isRTL ? "جاري الرفع..." : "Uploading..."}</p>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="text-center px-4">
                <p className="text-xs font-medium">
                  {isRTL ? "اضغط لرفع صورة" : "Click to upload an image"}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {isRTL ? "JPG, PNG, WebP · حتى 5MB" : "JPG, PNG, WebP · up to 5 MB"}
                </p>
              </div>
            </>
          )}
        </button>
      )}

      {previewError && value && (
        <p className="text-[11px] text-destructive">
          {isRTL ? "تعذّر تحميل الصورة السابقة. ارفع واحدة جديدة." : "Couldn't load the previous image. Upload a new one."}
        </p>
      )}

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          onClose={() => setCropSrc(null)}
          imageSrc={cropSrc}
          cropShape="rect"
          aspect={OG_ASPECT}
          title={isRTL ? "تعديل صورة المشاركة (1200×630)" : "Edit share image (1200×630)"}
          loading={uploading}
          onCropComplete={onCropDone}
        />
      )}
    </div>
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

// ─── Character count bar ──────────────────────────────────────────────────────
function CharBar({ len, max }: { len: number; max: number }) {
  const pct = Math.min((len / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-200", charColor(len, max))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[11px] tabular-nums", len > max * 0.9 ? "text-red-500" : "text-muted-foreground")}>
        {len}/{max}
      </span>
    </div>
  );
}
