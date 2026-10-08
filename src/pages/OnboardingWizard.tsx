/**
 * OnboardingWizard — store-first: opens on the merchant's live store (link,
 * share, phone preview, optional "what do you sell"), then first product,
 * "make it yours", shipping + payment, and go live (confirm the email, the
 * store opens, share it). Everything after the reveal is skippable.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { configureFromWizard, type WizardConfig } from "@/services/storeApi";
import { track } from "@/lib/analytics";
import { createProduct, uploadProductImage } from "@/services/productApi";
import { ApiError, errorMessage } from "@/lib/api-error";
import { getPublicStoreUrl, getStoreFrameUrl } from "@/lib/storefront";
import { resendVerificationEmail, verifyEmailByCode } from "@/services/authApi";
import { updateStore, uploadStoreAsset } from "@/services/storeApi";
import { activateThemeBySlug, getThemeDetail } from "@/services/marketplaceApi";
import { recommendedThemes } from "@/lib/theme-recommendations";
import { applyBrandColor, dominantColor, readableOnWhite } from "@/lib/brand-color";
import { toLatinDigits } from "@/lib/arabic-normalize";
import { ReadinessMeter } from "@/components/onboarding/ReadinessMeter";
import { applyEgypt4ZonePreset } from "@/services/shippingApi";
import StoreLinkShare from "@/components/StoreLinkShare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Truck,
  CreditCard,
  Check,
  SkipForward,
  Upload,
  ImagePlus,
  X,
  Package,
  Globe,
  Store,
  Palette,
  Rocket,
} from "lucide-react";
import { NicheIcon } from "@/components/onboarding/NicheIcon";
import { cn } from "@/lib/utils";
import { clearPrefill, readPrefill } from "@/lib/onboardingPrefill";
import { toNumericInput } from "@/lib/arabic-normalize";

/* ──────────────────────────── Types ──────────────────────────── */

interface NicheOption {
  id: string;
  label: string;
  labelEn: string;
  icon: React.ReactNode;
  /** Category hue: tints the icon well at rest, fills it when selected. */
  hue: string;
}

// A plain labelled chip — used for the qualification questions, which
// need no icon or description.
interface ChoiceOption {
  id: string;
  label: string;
  labelEn: string;
  /** Brand domain, rendered as that company's real logo via favicon. */
  domain?: string;
  /** Fallback for the options that are not a company (own site, a shop). */
  icon?: React.ReactNode;
}

interface ShippingOption {
  id: string;
  label: string;
  desc: string;
}

interface PaymentOption {
  id: string;
  label: string;
  desc: string;
  alwaysOn?: boolean;
}

/* ──────────────────────────── Data ──────────────────────────── */

// Qualification answers. These change nothing about the store — they
// decide whether a human should call this merchant and which pitch they
// get. A Shopify seller doing 200 orders a month is a migration; an
// Instagram seller doing five is a first store.
// Egyptian platforms first — they are who this funnel actually competes
// with. `domain` renders the company's own logo; the three that are not a
// company fall back to an icon.
const SELLS_WHERE: ChoiceOption[] = [
  { id: "instagram", label: "إنستجرام / فيسبوك", labelEn: "Instagram / Facebook", domain: "instagram.com" },
  { id: "easyorders", label: "إيزي أوردرز", labelEn: "EasyOrders", domain: "easy-orders.net" },
  { id: "vondera", label: "فونديرا", labelEn: "Vondera", domain: "vondera.app" },
  { id: "shopify", label: "شوبيفاي", labelEn: "Shopify", domain: "shopify.com" },
  { id: "zid", label: "زد", labelEn: "Zid", domain: "zid.sa" },
  { id: "salla", label: "سلة", labelEn: "Salla", domain: "salla.sa" },
  { id: "own_site", label: "موقع خاص بيا", labelEn: "My own site", icon: <Globe className="h-4 w-4" /> },
  { id: "offline", label: "محل على الأرض", labelEn: "A physical shop", icon: <Store className="h-4 w-4" /> },
  { id: "nowhere", label: "لسه مبدأتش", labelEn: "Not selling yet", icon: <Sparkles className="h-4 w-4" /> },
];

const ORDER_BANDS: ChoiceOption[] = [
  { id: "0", label: "لسه مبدأتش", labelEn: "Not started" },
  { id: "1-50", label: "أقل من ٥٠", labelEn: "Under 50" },
  { id: "51-200", label: "٥٠ - ٢٠٠", labelEn: "50 - 200" },
  { id: "201-1000", label: "٢٠٠ - ١٠٠٠", labelEn: "200 - 1,000" },
  { id: "1000+", label: "أكتر من ١٠٠٠", labelEn: "Over 1,000" },
];

// Each category gets its own hue and an icon that draws the product itself
// (a dress, a lipstick, a sofa) — a grid of grey circles with generic glyphs
// is the look every default icon pack produces.
const NICHES: NicheOption[] = [
  { id: "fashion", label: "ملابس وأزياء", labelEn: "Fashion & Clothing", icon: <NicheIcon kind="fashion" />, hue: "#B94F62" },
  { id: "electronics", label: "إلكترونيات", labelEn: "Electronics", icon: <NicheIcon kind="electronics" />, hue: "#4657B8" },
  { id: "beauty", label: "تجميل وعناية", labelEn: "Beauty & Care", icon: <NicheIcon kind="beauty" />, hue: "#A0489B" },
  { id: "home", label: "مستلزمات منزلية", labelEn: "Home & Living", icon: <NicheIcon kind="home" />, hue: "#BD6538" },
  { id: "food", label: "أطعمة ومشروبات", labelEn: "Food & Drinks", icon: <NicheIcon kind="food" />, hue: "#5F7D24" },
  { id: "accessories", label: "إكسسوارات", labelEn: "Accessories", icon: <NicheIcon kind="accessories" />, hue: "#A67A22" },
  { id: "books", label: "كتب", labelEn: "Books", icon: <NicheIcon kind="books" />, hue: "#3F6E8C" },
  { id: "handmade", label: "شغل يدوي", labelEn: "Handmade", icon: <NicheIcon kind="handmade" />, hue: "#8C5A3F" },
  { id: "other", label: "أخرى", labelEn: "Other", icon: <NicheIcon kind="other" />, hue: "#5B6876" },
];

// Egyptian-market options (default).
const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "manual", label: "أسعار شحن حسب المنطقة", desc: "٤ مناطق تغطي الـ ٢٧ محافظة — تأكد الأسعار دلوقتي" },
  { id: "bosta", label: "بوسطة", desc: "شحن مع تتبع — تربط حسابك في بوسطة من صفحة الشحن بعد الإعداد" },
  { id: "both", label: "الاثنين", desc: "أسعار المناطق دلوقتي + بوسطة لما تربط حسابك" },
];

// The Egypt 4-zone preset, in the order the API takes `rates_cents`.
const EGYPT_ZONES = [
  { ar: "القاهرة الكبرى", en: "Greater Cairo", price: "50" },
  { ar: "الإسكندرية والدلتا", en: "Alexandria & Delta", price: "60" },
  { ar: "القناة وسيناء والصعيد", en: "Canal, Sinai & Upper Egypt", price: "70" },
  { ar: "المناطق النائية", en: "Remote areas", price: "90" },
];

const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: "cod", label: "الدفع عند الاستلام", desc: "كاش عند التوصيل", alwaysOn: true },
  { id: "paymob_card", label: "بطاقة ائتمان (Paymob)", desc: "فيزا / ماستركارد" },
  { id: "paymob_wallet", label: "محفظة إلكترونية (Paymob)", desc: "فودافون كاش وغيرها" },
  { id: "fawry", label: "فوري", desc: "الدفع عبر منافذ فوري" },
  { id: "kashier", label: "كاشير", desc: "بوابة دفع متعددة" },
];

// Saudi-market options. Bosta is Egypt-only and no Saudi carrier is
// integrated yet, so SA gets manual zones (+ COD). Payment is COD +
// Moyasar (mada / Visa / Mastercard / Apple Pay).
const SHIPPING_OPTIONS_SA: ShippingOption[] = [
  { id: "manual", label: "مناطق يدوية", desc: "تضيف مناطقك وأسعارها من صفحة الشحن — الطلب مش هيكمل لحد ما تضيف منطقة بسعر" },
];

const PAYMENT_OPTIONS_SA: PaymentOption[] = [
  { id: "cod", label: "الدفع عند الاستلام", desc: "كاش عند التوصيل", alwaysOn: true },
  { id: "moyasar", label: "مدى / بطاقة / Apple Pay (ميسر)", desc: "مدى، فيزا، ماستركارد، Apple Pay" },
];

// What the landing page's onboarding chat may pre-select (Egyptian options;
// a Saudi store keeps only the niche and qualification answers).
const PREFILL_OPTIONS = {
  niche: NICHES.map((n) => n.id),
  sellsWhere: SELLS_WHERE.map((o) => o.id),
  ordersBand: ORDER_BANDS.map((o) => o.id),
  payments: PAYMENT_OPTIONS.map((o) => o.id),
  shipping: SHIPPING_OPTIONS.map((o) => o.id),
};

// Steps: 0 = your store is live (+ optional category), 1 = first product,
// 2 = make it yours, 3 = shipping + payment, 4 = go live & share.
// Everything after 0 is skippable.
const TOTAL_STEPS = 4;

/* ──────────────────────────── Step Labels ──────────────────────────── */

const STEP_LABELS = [
  { key: "product", labelAr: "منتج", labelEn: "Product" },
  { key: "look", labelAr: "الشكل", labelEn: "Look" },
  { key: "ship", labelAr: "الشحن والدفع", labelEn: "Ship & pay" },
  { key: "live", labelAr: "افتح", labelEn: "Go live" },
];

/** Phone-sized live preview with a spinner until the store has painted, so
 *  the frame is never an empty box. */
function StorePhonePreview({ src, isAr }: { src: string; isAr: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative mx-auto w-[260px] h-[460px] rounded-[28px] border-[6px] border-[var(--b-ink)] bg-white overflow-hidden shadow-lg">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-xs text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {isAr ? "بنجهز المعاينة..." : "Loading your store..."}
        </div>
      )}
      <iframe src={src} onLoad={() => setLoaded(true)} className="w-full h-full" title={isAr ? "معاينة المتجر" : "Store preview"} />
    </div>
  );
}

/* ──────────────────────────── Component ──────────────────────────── */

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { currentStore, refetchStores } = useDashboardStore();
  const isAr = language === "ar";

  // Wizard state. Country seeds from the store's market (chosen at store
  // creation) so a Saudi store lands on the SA options without re-picking.
  // Answers from the landing page's onboarding chat, if the merchant came
  // that way. Read once; cleared when the configuration is saved.
  const storeCountry = (currentStore?.country || "EG").toUpperCase();
  const [prefill] = useState(() => readPrefill(PREFILL_OPTIONS));
  const egPrefill = storeCountry === "EG" ? prefill : null;
  const [step, setStep] = useState(0); // 0 = your store is live
  const [businessType, setBusinessType] = useState<string>(prefill?.niche ?? "");
  const country = storeCountry;
  const [zoneRates, setZoneRates] = useState<string[]>(EGYPT_ZONES.map((z) => z.price));
  // Asked in the landing chat, if at all — never in the wizard any more.
  const sellsWhereToday = prefill?.sellsWhere ?? "";
  const monthlyOrdersBand = prefill?.ordersBand ?? "";
  const [shippingPref, setShippingPref] = useState<string>(egPrefill?.shipping ?? "");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    egPrefill?.payments ? Array.from(new Set(["cod", ...egPrefill.payments])) : ["cod"],
  );

  // Market-aware option lists: a Saudi store sees Moyasar + manual shipping;
  // an Egyptian store sees Paymob/Fawry/Kashier + Bosta.
  const paymentOptions = country === "SA" ? PAYMENT_OPTIONS_SA : PAYMENT_OPTIONS;
  const shippingOptions = country === "SA" ? SHIPPING_OPTIONS_SA : SHIPPING_OPTIONS;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product step state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // "Make it yours" step
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoColor, setLogoColor] = useState<string | null>(null);
  const [colorApplied, setColorApplied] = useState(false);
  const [themes, setThemes] = useState<{ slug: string; name: string; thumbnail: string | null }[]>([]);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [themeBusy, setThemeBusy] = useState<string | null>(null);

  // Go-live step
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const progressValue = step === 0 ? 0 : (step / TOTAL_STEPS) * 100;
  const storeUrl = getPublicStoreUrl(currentStore);
  const frameUrl = getStoreFrameUrl(currentStore, isAr ? "ar" : "en");
  const usesZonePreset = country === "EG" && (shippingPref === "manual" || shippingPref === "both");

  const canAdvance = useCallback(() => {
    switch (step) {
      case 3: return !!shippingPref && (!usesZonePreset || zoneRates.every((r) => r !== "" && Number(r) >= 0));
      default: return true;
    }
  }, [step, shippingPref, usesZonePreset, zoneRates]);

  const togglePayment = (id: string) => {
    if (id === "cod") return;
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductImage(file);
    setProductImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setProductImage(null);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNext = () => {
    // Fired on leaving a step, so the number for step N reads as "finished
    // N" rather than "saw N". Those differ by exactly the drop-off we are
    // trying to measure.
    track("onboarding_step_completed", { step, business_type: businessType || null });
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSkip = () => {
    track("onboarding_skipped", { step });
    const defaults: Partial<{
      businessType: string;
      country: string;
      shippingPref: string;
      paymentMethods: string[];
    }> = {};
    if (!businessType) defaults.businessType = "other";
    if (!shippingPref) defaults.shippingPref = "manual";
    if (paymentMethods.length === 0) defaults.paymentMethods = ["cod"];

    void handleSubmitConfig(defaults);
  };

  const handleSubmitConfig = async (
    defaults: Partial<{
      businessType: string;
      country: string;
      shippingPref: string;
      paymentMethods: string[];
    }> = {}
  ): Promise<boolean> => {
    if (!currentStore?.id) return false;

    setLoading(true);
    setError(null);

    const config: WizardConfig = {
      business_type: defaults.businessType || businessType || "other",
      country: defaults.country || country || "EG",
      shipping_preference: defaults.shippingPref || shippingPref || "manual",
      payment_methods: defaults.paymentMethods || paymentMethods,
      store_language: isAr ? "ar" : "en",
      // Qualification. Sent as undefined rather than "" when skipped so a
      // half-answered wizard doesn't overwrite a previous full one.
      sells_where_today: sellsWhereToday || undefined,
      monthly_orders_band: monthlyOrdersBand || undefined,
    };

    try {
      await configureFromWizard(currentStore.id, config);
      clearPrefill();
      // The qualification answers ride along as properties so a funnel can
      // be split by merchant type without joining anything.
      track("onboarding_completed", {
        business_type: config.business_type,
        country: config.country,
        sells_where_today: config.sells_where_today ?? null,
        monthly_orders_band: config.monthly_orders_band ?? null,
        skipped: Object.keys(defaults).length > 0,
      });
      // If skipping, go straight to dashboard
      if (Object.keys(defaults).length > 0) {
        navigate("/", { replace: true });
      }
      return true;
    } catch (err: unknown) {
      setError(errorMessage(err, language));
      setLoading(false);
      return false;
    } finally {
      if (Object.keys(defaults).length === 0) {
        setLoading(false);
      }
    }
  };

  const handleProductSubmit = async () => {
    if (!currentStore?.id || !productName || !productPrice) return;

    setLoading(true);
    setError(null);
    try {
      const product = await createProduct(currentStore.id, {
        name: productName,
        price: parseFloat(productPrice).toFixed(2),
        quantity: Math.max(0, parseInt(productQuantity, 10) || 0),
        status: "active",
      });
      // The activation milestone the API stamps as `first_product_at`.
      // Captured here too so the wizard funnel is readable end to end in
      // one place, rather than half in PostHog and half in our database.
      track("product_created", { from: "onboarding", has_image: !!productImage });
      // Upload image if provided
      if (productImage && product.id) {
        try {
          await uploadProductImage(currentStore.id, product.id, productImage);
        } catch {
          // Image upload failure shouldn't block onboarding
        }
      }
    } catch (err: unknown) {
      setError(errorMessage(err, language));
      setLoading(false);
      return;
    }
    setLoading(false);
    toast.success(isAr ? "كده الكلام 🚀 أول منتج عندك بقى على المتجر" : "Nice 🚀 your first product is in your store");
    setStep(2);
  };

  // The prices the merchant just confirmed become the store's zones. A store
  // that already has zones keeps them (409).
  const applyShippingPreset = async (): Promise<boolean> => {
    if (!currentStore?.id || !usesZonePreset) return true;
    try {
      await applyEgypt4ZonePreset(currentStore.id, zoneRates.map((r) => Math.round(Number(r) * 100)));
    } catch (err: unknown) {
      if (!(err instanceof ApiError && err.status === 409)) {
        setError(errorMessage(err, language));
        return false;
      }
    }
    return true;
  };

  const handleFinish = () => {
    navigate("/", { replace: true });
  };

  const handleStepTransition = async () => {
    if (step === 1 && productName && productPrice) {
      await handleProductSubmit();
    } else if (step === 3) {
      // Shipping prices, then the configuration (payments, category, starter
      // copy). A failed save shows its error and keeps the merchant here.
      setLoading(true);
      setError(null);
      const ok = (await applyShippingPreset()) && (await handleSubmitConfig());
      setLoading(false);
      if (ok) {
        await queryClient.invalidateQueries({ queryKey: ["store-readiness", currentStore?.id] });
        setStep(4);
      }
    } else {
      handleNext();
    }
  };

  // "Make it yours": the recommended themes for the category that exist and
  // are free, shown when the merchant reaches that step.
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    Promise.all(
      recommendedThemes(businessType).map((slug) =>
        getThemeDetail(slug)
          .then((d) => {
            const t = (d as unknown as { theme?: { name?: string; name_ar?: string | null; thumbnail_url?: string | null; price_cents?: number } }).theme;
            if (!t || (t.price_cents ?? 0) > 0) return null;
            return {
              slug,
              name: ((isAr && t.name_ar) || t.name || slug).replace(/\s*\(V\d+\)$/i, ""),
              thumbnail: t.thumbnail_url ?? null,
            };
          })
          .catch(() => null),
      ),
    ).then((list) => {
      if (!cancelled) setThemes(list.filter((t): t is NonNullable<typeof t> => !!t));
    });
    return () => { cancelled = true; };
  }, [step, businessType, isAr]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStore?.id) return;
    setLogoUploading(true);
    try {
      const { url } = await uploadStoreAsset(currentStore.id, file, "logo");
      await updateStore(currentStore.id, { logo_url: url });
      await refetchStores(currentStore.id);
      const color = await dominantColor(file);
      setLogoColor(color && readableOnWhite(color) ? color : null);
      toast.success(isAr ? "شكله حلو عليك 👌" : "Looking good 👌");
    } catch (err) {
      setError(errorMessage(err, language));
    } finally {
      setLogoUploading(false);
    }
  };

  const applyLogoColor = async () => {
    if (!currentStore?.id || !logoColor) return;
    try {
      await applyBrandColor(currentStore.id, logoColor);
      setColorApplied(true);
    } catch (err) {
      setError(errorMessage(err, language));
    }
  };

  const pickTheme = async (slug: string) => {
    if (!currentStore?.id) return;
    setThemeBusy(slug);
    try {
      await activateThemeBySlug(currentStore.id, slug);
      setActiveTheme(slug);
      // The colour lives on the theme's customization; a new theme starts
      // without it, so the merchant can apply it again.
      setColorApplied(false);
    } catch (err) {
      setError(errorMessage(err, language));
    } finally {
      setThemeBusy(null);
    }
  };

  const verifyAndOpen = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyEmailByCode(code);
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["store-readiness", currentStore?.id] });
      toast.success(isAr ? "متجرك مفتوح للناس ✅" : "Your store is open ✅");
    } catch (err) {
      setError(errorMessage(err, language));
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    try {
      await resendVerificationEmail();
      setResendIn(60);
    } catch (err) {
      setError(errorMessage(err, language));
    }
  };

  /* ──────── Step renderers ──────── */

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-[14px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>
      <div>
        <h1 className="brand-display text-3xl font-bold tracking-tight text-[var(--b-ink)] leading-tight">
          {isAr ? "متجرك اتعمل!" : "Your store is live!"}
        </h1>
        <p className="text-lg text-[var(--b-ink-soft)] mt-2">
          {currentStore?.name || (isAr ? `أهلاً ${user?.first_name || ""}` : `Welcome, ${user?.first_name || ""}`)}
        </p>
      </div>
      {storeUrl && (
        <div className="max-w-sm mx-auto text-start">
          <StoreLinkShare url={storeUrl} storeName={currentStore?.name} />
        </div>
      )}
      {frameUrl && <StorePhonePreview src={frameUrl} isAr={isAr} />}

      {/* Optional, asked once: picks the product fields, starter copy and
          recommended themes. */}
      <div className="space-y-3 text-start">
        <p className="text-sm font-medium text-center">{isAr ? "بتبيع إيه؟ (اختياري)" : "What do you sell? (optional)"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {NICHES.map((niche) => (
            <button
              key={niche.id}
              type="button"
              onClick={() => setBusinessType(niche.id)}
              aria-pressed={businessType === niche.id}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all duration-200",
                businessType === niche.id ? "border-foreground bg-accent font-medium" : "border-border/50 bg-card hover:border-foreground/30",
              )}
            >
              <span style={{ color: niche.hue }} className="[&_svg]:h-5 [&_svg]:w-5">{niche.icon}</span>
              {isAr ? niche.label : niche.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button size="lg" onClick={() => setStep(1)} className="brand-btn-primary gap-2 rounded-[4px]">
          {isAr ? "ضيف أول منتج" : "Add your first product"}
          <ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
        </Button>
        <button type="button" className="text-sm text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors" onClick={handleSkip}>
          {isAr ? "روح للوحة التحكم" : "Go to the dashboard"}
        </button>
      </div>
    </div>
  );

  const renderShipping = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <Truck className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "إزاي بتشحن؟" : "How do you ship?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "العميل بيشوف سعر الشحن ده وقت الطلب" : "Customers see this shipping price when they order"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {shippingOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setShippingPref(opt.id)}
            className={cn(
              "flex flex-col items-start gap-1.5 p-5 rounded-xl border-2 transition-all duration-200 text-start",
              "hover:border-foreground/30 hover:bg-accent/50",
              shippingPref === opt.id
                ? "border-foreground bg-accent shadow-sm"
                : "border-border/50 bg-card"
            )}
          >
            <div className="flex items-center gap-3 w-full">
              <span className="text-base font-semibold">{opt.label}</span>
              {shippingPref === opt.id && (
                <Check className="h-5 w-5 ms-auto text-foreground" />
              )}
            </div>
            <span className="text-sm text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>
      {usesZonePreset && (
        <div className="max-w-md mx-auto rounded-xl border p-4 space-y-3">
          <p className="text-sm font-medium">
            {isAr ? "أسعار الشحن المقترحة — عدّلها لو تحب:" : "Suggested shipping prices — change any:"}
          </p>
          {EGYPT_ZONES.map((zone, i) => (
            <div key={zone.en} className="flex items-center gap-3">
              <Label htmlFor={`zone-rate-${i}`} className="flex-1 text-sm">{isAr ? zone.ar : zone.en}</Label>
              <div className="relative w-32">
                <Input
                  id={`zone-rate-${i}`}
                  type="text"
                  inputMode="decimal"
                  value={zoneRates[i]}
                  onChange={(e) => {
                    const v = toNumericInput(e.target.value);
                    setZoneRates((rates) => rates.map((r, j) => (j === i ? v : r)));
                  }}
                  className="h-9 pe-12"
                />
                <span className="absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
                  {currentStore?.default_currency || "EGP"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <CreditCard className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "إزاي بتقبض؟" : "How do you get paid?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr
            ? "الدفع عند الاستلام شغال من دلوقتي. البطاقات والمحافظ محتاجة تربط حسابك من صفحة المدفوعات — علّم اللي عايزه ونفكّرك."
            : "Cash on delivery works now. Cards and wallets need your account connected in Payments — tick the ones you want and we'll remind you."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {paymentOptions.map((opt) => {
          const isActive = paymentMethods.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => togglePayment(opt.id)}
              disabled={opt.alwaysOn}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-start",
                "hover:border-foreground/30 hover:bg-accent/50",
                opt.alwaysOn && "cursor-default opacity-80",
                isActive
                  ? "border-foreground bg-accent shadow-sm"
                  : "border-border/50 bg-card"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors",
                  isActive
                    ? "border-foreground bg-foreground"
                    : "border-muted-foreground/30"
                )}
              >
                {isActive && <Check className="h-3.5 w-3.5 text-background" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
                {opt.alwaysOn
                  ? (isAr ? "شغال ✓" : "On ✓")
                  : isActive
                    ? (isAr ? "هنفكّرك" : "We'll remind you")
                    : (isAr ? "عايز ده" : "I want this")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderProduct = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isAr ? "أضف أول منتج" : "Add your first product"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "أضف منتج واحد عشان يبان متجرك — تقدر تزود بعدين" : "Add one product to get started — you can add more later"}
        </p>
      </div>
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{isAr ? "اسم المنتج" : "Product Name"}</Label>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={isAr ? "مثال: تيشيرت قطن" : "e.g. Cotton T-Shirt"}
            className="h-11 rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{isAr ? "السعر" : "Price"}</Label>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              value={productPrice}
              onChange={(e) => setProductPrice(toNumericInput(e.target.value))}
              placeholder="199"
              className="h-11 rounded-lg pe-16"
            />
            <span className="absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
              {currentStore?.default_currency || "EGP"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{isAr ? "الكمية المتاحة" : "Quantity in stock"}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={productQuantity}
            onChange={(e) => setProductQuantity(toNumericInput(e.target.value, false))}
            className="h-11 rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{isAr ? "صورة المنتج" : "Product Image"}</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            title={isAr ? "اختر صورة المنتج" : "Choose product image"}
          />
          {productImagePreview ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border group">
              <img src={productImagePreview} alt="Product" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearImage}
                title={isAr ? "إزالة الصورة" : "Remove image"}
                className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 hover:border-foreground/30 hover:bg-accent/30 transition-colors"
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
              <span className="text-[11px] text-muted-foreground">{isAr ? "اختر صورة" : "Add image"}</span>
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">{isAr ? "اختياري — تقدر تضيف صور بعدين" : "Optional — you can add images later"}</p>
        </div>
      </div>
    </div>
  );

  const renderLook = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <Palette className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "خلّيه شبهك" : "Make it yours"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "لوجو وشكل للمتجر — اختياري، وتقدر تغيّره في أي وقت." : "A logo and a look — optional, change it any time."}
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogo} />
        <Button type="button" variant="outline" className="gap-2" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
          {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {currentStore?.logo_url ? (isAr ? "غيّر اللوجو" : "Change logo") : (isAr ? "ارفع اللوجو" : "Upload your logo")}
        </Button>
        {logoColor && (
          <div className="flex items-center gap-3 text-sm">
            <span className="h-6 w-6 rounded-full border" style={{ background: logoColor }} aria-hidden="true" />
            {colorApplied ? (
              <span>{isAr ? "خدنا اللون من اللوجو ✓" : "Using your logo colour ✓"}</span>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={applyLogoColor}>
                {isAr ? "استخدم لون اللوجو في المتجر" : "Use your logo colour in the store"}
              </Button>
            )}
          </div>
        )}
      </div>

      {themes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">{isAr ? "اختار شكل يناسبك" : "Pick a look"}</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => pickTheme(t.slug)}
                disabled={!!themeBusy}
                aria-pressed={activeTheme === t.slug}
                className={cn(
                  "rounded-xl border-2 overflow-hidden text-start transition-all",
                  activeTheme === t.slug ? "border-foreground" : "border-border/50 hover:border-foreground/30",
                )}
              >
                <div className="aspect-[3/4] bg-muted">
                  {t.thumbnail && <img src={t.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium">
                  {themeBusy === t.slug && <Loader2 className="h-3 w-3 animate-spin" />}
                  {activeTheme === t.slug && <Check className="h-3 w-3" />}
                  <span className="truncate">{t.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {frameUrl && <StorePhonePreview key={`${activeTheme}-${colorApplied}-${currentStore?.logo_url}`} src={frameUrl} isAr={isAr} />}
    </div>
  );

  const renderGoLive = () => {
    const verified = !!user?.is_verified;
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Rocket className="h-7 w-7 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{isAr ? "افتح المتجر للناس" : "Open your store"}</h2>
        </div>

        <div className="max-w-md mx-auto rounded-xl border p-4">
          <ReadinessMeter storeId={currentStore?.id} />
        </div>

        {!verified ? (
          <div className="max-w-md mx-auto space-y-3">
            <p className="text-sm text-center">
              {isAr ? `أكّد إيميلك وبعدها متجرك يفتح للناس. بعتنالك كود من 6 أرقام على ${user?.email ?? ""}` : `Confirm your email and your store opens. We sent a 6-digit code to ${user?.email ?? ""}`}
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                aria-label={isAr ? "كود التأكيد" : "Verification code"}
                className="h-11 text-center tracking-[0.4em] font-semibold"
              />
              <Button type="button" className="h-11 brand-btn-primary rounded-[4px]" onClick={verifyAndOpen} disabled={code.length !== 6 || verifying}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "افتح المتجر" : "Open store"}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {isAr ? "مش لاقيه؟ بص في الـ Spam أو الترويجات. " : "Can't find it? Check Spam or Promotions. "}
              <button type="button" className="underline disabled:no-underline disabled:opacity-60" onClick={resendCode} disabled={resendIn > 0}>
                {resendIn > 0 ? (isAr ? `ابعت تاني بعد ${resendIn} ث` : `Resend in ${resendIn}s`) : (isAr ? "ابعت كود جديد" : "Send a new code")}
              </button>
            </p>
          </div>
        ) : (
          storeUrl && (
            <div className="max-w-sm mx-auto space-y-2">
              <p className="text-sm text-center font-medium">{isAr ? "ابعت الرابط لأول 10 عملاء تعرفهم:" : "Send the link to the first 10 customers you know:"}</p>
              <StoreLinkShare url={storeUrl} storeName={currentStore?.name} />
            </div>
          )
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderWelcome();
      case 1: return renderProduct();
      case 2: return renderLook();
      case 3: return (
        <div className="space-y-10">
          {renderShipping()}
          {renderPayments()}
        </div>
      );
      case 4: return renderGoLive();
      default: return null;
    }
  };

  /* ──────── Main render ──────── */

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen auth-page auth-dot-grid brand-surface paper-grain relative flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10"
    >
      <div className="w-full max-w-[580px] relative z-10">
        {/* ── Brand header — real logo image + Reem Kufi wordmark + § eyebrow ── */}
        <div className="flex flex-col items-center mb-5">
          <div className="flex items-center gap-2.5 mb-2">
            <img
              src="/numu-mark.webp"
              alt=""
              className="h-9 w-auto object-contain"
              width="36"
              height="36"
              fetchPriority="high"
            />
            {isAr ? (
              <span className="auth-wordmark text-xl font-bold tracking-tight text-[var(--b-ink)]">
                نُمُو
              </span>
            ) : (
              <span className="auth-wordmark text-xl font-semibold tracking-tight text-[var(--b-ink)] lowercase">
                numu
              </span>
            )}
          </div>
          <p className="auth-card-eyebrow">§ STORE SETUP</p>
        </div>

        {/* ── Card ── */}
        <div className="auth-card auth-enter p-7 sm:p-9">
          {/* Progress bar + step indicator — only show after welcome */}
          {step > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                {/* Step indicators */}
                <div className="flex items-center gap-1">
                  {STEP_LABELS.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-1">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                        i + 1 < step ? "bg-[var(--b-sage)] text-[var(--b-cream)]" :
                        i + 1 === step ? "bg-[var(--b-navy)] text-[var(--b-cream)]" :
                        "bg-[var(--b-bone)] text-[var(--b-ink-soft)]"
                      )}>
                        {i + 1 < step ? <Check className="h-3 w-3" /> : i + 1}
                      </div>
                      {i < STEP_LABELS.length - 1 && (
                        <div className={cn("w-3 h-px", i + 1 < step ? "bg-[var(--b-sage)]/60" : "bg-[var(--b-bone)]")} />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex items-center gap-1 text-xs text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors"
                >
                  <SkipForward className="h-3 w-3" />
                  {isAr ? "تخطي" : "Skip"}
                </button>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}

          {/* Step content */}
          <div
            key={step}
            className="animate-in fade-in slide-in-from-left-2 duration-300"
          >
            {renderCurrentStep()}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Navigation buttons — only for steps 1+ */}
          {step > 0 && (
            <div className="flex items-center justify-between mt-8 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={step <= 1 || loading}
                className={cn(
                  "gap-2 transition-opacity",
                  step <= 1 && "opacity-0 pointer-events-none"
                )}
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {isAr ? "رجوع" : "Back"}
              </Button>

              {step === 1 && (!productName || !productPrice) ? (
                // On product step with empty fields — show skip + add later
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="gap-2 rounded-[4px] border-[var(--b-line)] text-[var(--b-ink)] hover:bg-[var(--b-cream)]"
                >
                  {isAr ? "تخطي — أضيف بعدين" : "Skip — add later"}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleStepTransition}
                  disabled={!canAdvance() || loading}
                  className="brand-btn-primary gap-2 min-w-[140px] rounded-[4px]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step === TOTAL_STEPS ? (
                    <>
                      {isAr ? "روح للوحة التحكم" : "Go to the dashboard"}
                      <Check className="brand-btn-arrow h-4 w-4" />
                    </>
                  ) : step === 1 ? (
                    <>
                      {isAr ? "ضيفه للمتجر" : "Add to my store"}
                      <Package className="brand-btn-arrow h-4 w-4" />
                    </>
                  ) : step === 2 ? (
                    <>
                      {isAr ? "تمام كده" : "Looks good"}
                      <ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
                    </>
                  ) : step === 3 ? (
                    <>
                      {isAr ? "أكّد" : "Confirm"}
                      <ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
                    </>
                  ) : (
                    <>
                      {isAr ? "التالي" : "Next"}
                      <ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--b-ink-soft)] mt-6">
          &copy; 2026 {isAr ? "نُمُو" : "numu"}
        </p>
      </div>
    </div>
  );
}
