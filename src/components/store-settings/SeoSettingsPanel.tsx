/**
 * SeoSettingsPanel — the "SEO" tab in StoreSettings.
 *
 * Reads from + writes to the typed `store.settings.seo` block introduced
 * by NUMU-api Phase 4 (StoreSeoSettings model). Eight fields:
 *
 *   - seo_title (≤ 70 chars)         — overrides storefront <title>
 *   - seo_description (≤ 160 chars)  — overrides <meta description>
 *   - social_image_url               — 1200×630 OG / Twitter card image
 *   - robots_indexing_enabled (bool) — flip to false to soft-launch
 *   - google_site_verification       — emitted as <meta name="google-site-verification">
 *   - bing_site_verification         — emitted as <meta name="msvalidate.01">
 *   - business_type                  — Schema.org Organization subtype
 *   - has_return_policy_30d (bool)   — surfaces MerchantReturnPolicy JSON-LD
 *
 * Anything else under `store.settings.*` (tracking, size_chart, etc.) is
 * preserved on save — we merge the SEO block into the existing settings
 * blob rather than replace it.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { updateStore } from "@/services/storeApi";
import { Search } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

// Mirrors NUMU-api StoreSeoSettings (api/v1/schemas/tenant/store_seo.py).
export interface StoreSeoBlock {
  seo_title?: string | null;
  seo_description?: string | null;
  social_image_url?: string | null;
  robots_indexing_enabled?: boolean;
  google_site_verification?: string | null;
  bing_site_verification?: string | null;
  business_type?: string | null;
  has_return_policy_30d?: boolean;
}

const BUSINESS_TYPES: Array<{ value: string; label: string }> = [
  { value: "Organization", label: "Organization (default)" },
  { value: "Store", label: "Store" },
  { value: "FashionStore", label: "Fashion Store" },
  { value: "ClothingStore", label: "Clothing Store" },
  { value: "ShoeStore", label: "Shoe Store" },
  { value: "JewelryStore", label: "Jewelry Store" },
  { value: "BeautySalon", label: "Beauty Salon" },
  { value: "ElectronicsStore", label: "Electronics Store" },
  { value: "FurnitureStore", label: "Furniture Store" },
  { value: "GroceryStore", label: "Grocery Store" },
  { value: "ConvenienceStore", label: "Convenience Store" },
  { value: "Bakery", label: "Bakery" },
  { value: "BookStore", label: "Book Store" },
  { value: "ToyStore", label: "Toy Store" },
  { value: "SportingGoodsStore", label: "Sporting Goods Store" },
  { value: "PetStore", label: "Pet Store" },
  { value: "OfficeEquipmentStore", label: "Office Equipment Store" },
  { value: "MobilePhoneStore", label: "Mobile Phone Store" },
];

interface SeoSettingsPanelProps {
  storeId: string | undefined;
  /** Raw `store.settings` blob — we read .seo from here and merge on save. */
  storeSettings: Record<string, unknown> | null | undefined;
  /** Called after a successful PATCH so the parent can refetch the store. */
  onSaved: () => void | Promise<void>;
}

function readSeoBlock(
  settings: Record<string, unknown> | null | undefined,
): StoreSeoBlock {
  if (!settings || typeof settings !== "object") return {};
  const raw = (settings as { seo?: unknown }).seo;
  if (!raw || typeof raw !== "object") return {};
  return raw as StoreSeoBlock;
}

// ─── Component ────────────────────────────────────────────────────────────

export function SeoSettingsPanel({
  storeId,
  storeSettings,
  onSaved,
}: SeoSettingsPanelProps) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const initialSeo = useMemo(() => readSeoBlock(storeSettings), [storeSettings]);

  const [seoTitle, setSeoTitle] = useState(initialSeo.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initialSeo.seo_description ?? "",
  );
  const [socialImageUrl, setSocialImageUrl] = useState(
    initialSeo.social_image_url ?? "",
  );
  const [robotsIndexing, setRobotsIndexing] = useState(
    initialSeo.robots_indexing_enabled !== false,
  );
  const [googleVerification, setGoogleVerification] = useState(
    initialSeo.google_site_verification ?? "",
  );
  const [bingVerification, setBingVerification] = useState(
    initialSeo.bing_site_verification ?? "",
  );
  const [businessType, setBusinessType] = useState(
    initialSeo.business_type ?? "Organization",
  );
  const [hasReturnPolicy, setHasReturnPolicy] = useState(
    initialSeo.has_return_policy_30d === true,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed when the upstream store changes (e.g. switched merchant).
  useEffect(() => {
    setSeoTitle(initialSeo.seo_title ?? "");
    setSeoDescription(initialSeo.seo_description ?? "");
    setSocialImageUrl(initialSeo.social_image_url ?? "");
    setRobotsIndexing(initialSeo.robots_indexing_enabled !== false);
    setGoogleVerification(initialSeo.google_site_verification ?? "");
    setBingVerification(initialSeo.bing_site_verification ?? "");
    setBusinessType(initialSeo.business_type ?? "Organization");
    setHasReturnPolicy(initialSeo.has_return_policy_30d === true);
  }, [initialSeo]);

  const handleSave = useCallback(async () => {
    if (!storeId) return;
    setIsSaving(true);
    try {
      // Trim and collapse empty strings to null — the backend Pydantic
      // validator does the same; matching here means the dashboard
      // round-trips cleanly without ghost values.
      const trim = (s: string): string | null => {
        const v = s.trim();
        return v ? v : null;
      };
      const newSeo: StoreSeoBlock = {
        seo_title: trim(seoTitle),
        seo_description: trim(seoDescription),
        social_image_url: trim(socialImageUrl),
        robots_indexing_enabled: robotsIndexing,
        google_site_verification: trim(googleVerification),
        bing_site_verification: trim(bingVerification),
        business_type: businessType || null,
        has_return_policy_30d: hasReturnPolicy,
      };

      // Preserve every other settings.* key — tracking, size_chart, etc.
      // Merging here instead of overwriting matches what the backend's
      // _serialize_public_store does on the read side.
      const mergedSettings: Record<string, unknown> = {
        ...(storeSettings && typeof storeSettings === "object"
          ? storeSettings
          : {}),
        seo: newSeo,
      };

      await updateStore(storeId, { settings: mergedSettings });
      await onSaved();
      toast.success(
        language === "ar" ? "تم حفظ إعدادات SEO" : "SEO settings saved",
      );
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [
    storeId,
    storeSettings,
    seoTitle,
    seoDescription,
    socialImageUrl,
    robotsIndexing,
    googleVerification,
    bingVerification,
    businessType,
    hasReturnPolicy,
    onSaved,
    language,
  ]);

  return (
    <div key="seo" className="settings-section-enter space-y-6">
      {/* ─── Search appearance ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            {language === "ar"
              ? "مظهر النتائج في البحث"
              : "Search appearance"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "كيف يبدو متجرك على Google و Facebook. اتركها فارغة لاستخدام اسم المتجر ووصفه."
              : "How your storefront appears on Google and social. Leave blank to fall back to the store's name and description."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seo-title">
              {language === "ar" ? "عنوان SEO" : "SEO title"}
              <span className="text-muted-foreground text-xs ml-2">
                ({seoTitle.length}/70)
              </span>
            </Label>
            <Input
              id="seo-title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value.slice(0, 70))}
              placeholder={
                language === "ar"
                  ? "عنوان مخصص لنتائج البحث"
                  : "Custom title for search results"
              }
              maxLength={70}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seo-description">
              {language === "ar" ? "وصف SEO" : "SEO description"}
              <span className="text-muted-foreground text-xs ml-2">
                ({seoDescription.length}/160)
              </span>
            </Label>
            <Textarea
              id="seo-description"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value.slice(0, 160))}
              placeholder={
                language === "ar"
                  ? "وصف يظهر تحت العنوان في نتائج Google"
                  : "Shown under the title on Google"
              }
              rows={3}
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="social-image">
              {language === "ar"
                ? "صورة المشاركة الاجتماعية"
                : "Social share image"}
            </Label>
            <Input
              id="social-image"
              value={socialImageUrl}
              onChange={(e) => setSocialImageUrl(e.target.value)}
              placeholder="https://… (1200×630)"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              {language === "ar"
                ? "تظهر عند مشاركة رابط المتجر على Facebook أو WhatsApp. الأبعاد الموصى بها 1200×630."
                : "Shown when your storefront link is shared on Facebook or WhatsApp. Recommended 1200×630."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Indexation ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar" ? "الفهرسة" : "Indexation"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "تحكم في ظهور متجرك على محركات البحث."
              : "Control whether search engines may index your storefront."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="robots-toggle" className="text-sm font-medium">
                {language === "ar"
                  ? "السماح لمحركات البحث بفهرسة المتجر"
                  : "Allow search engines to index this store"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar"
                  ? "أوقف التشغيل إذا كنت لا تزال في وضع التجريب — ستحصل على noindex على كل صفحة."
                  : "Turn off while soft-launching — every page gets noindex until you flip back on."}
              </p>
            </div>
            <Switch
              id="robots-toggle"
              checked={robotsIndexing}
              onCheckedChange={setRobotsIndexing}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Verification tokens ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar"
              ? "إثبات ملكية الموقع"
              : "Site verification"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "ألصق رمز التحقق من Google / Bing Search Console هنا."
              : "Paste the verification token from Google / Bing Search Console."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="google-verification">Google Search Console</Label>
            <Input
              id="google-verification"
              value={googleVerification}
              onChange={(e) => setGoogleVerification(e.target.value)}
              placeholder="abc123…"
            />
            <p className="text-xs text-muted-foreground">
              {language === "ar"
                ? "الرمز فقط، بدون <meta>."
                : "Token only — no <meta> wrapper."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bing-verification">Bing Webmaster Tools</Label>
            <Input
              id="bing-verification"
              value={bingVerification}
              onChange={(e) => setBingVerification(e.target.value)}
              placeholder="abc123…"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Rich-results signals ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar"
              ? "إشارات النتائج الغنية"
              : "Rich-results signals"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "تساعد Google في فهم نوع متجرك والسياسات."
              : "Help Google understand your store category and policies."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="business-type">
              {language === "ar" ? "نوع النشاط التجاري" : "Business type"}
            </Label>
            <Select
              value={businessType}
              onValueChange={setBusinessType}
            >
              <SelectTrigger id="business-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {language === "ar"
                ? "اختر النوع الذي يطابق نشاطك. الافتراضي Organization آمن للجميع."
                : "Pick the one that matches your business. Default Organization is safe for everyone."}
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label
                htmlFor="return-policy-toggle"
                className="text-sm font-medium"
              >
                {language === "ar"
                  ? "أعرض سياسة الاسترجاع 30 يوم"
                  : "Advertise 30-day return policy"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar"
                  ? "يُضيف MerchantReturnPolicy إلى كل منتج. فعّلها فقط إذا كانت السياسة فعلية."
                  : "Adds MerchantReturnPolicy to every product. Only enable if the policy is real — Google audits."}
              </p>
            </div>
            <Switch
              id="return-policy-toggle"
              checked={hasReturnPolicy}
              onCheckedChange={setHasReturnPolicy}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !storeId}>
          {isSaving
            ? language === "ar"
              ? "جارٍ الحفظ…"
              : "Saving…"
            : t("store.save")}
        </Button>
      </div>
    </div>
  );
}
