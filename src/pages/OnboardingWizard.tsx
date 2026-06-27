/**
 * OnboardingWizard — multi-step smart onboarding that auto-configures
 * the store based on the merchant's answers, then optionally creates
 * their first product and shows a store preview.
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { configureFromWizard, type WizardConfig } from "@/services/storeApi";
import { createProduct, uploadProductImage } from "@/services/productApi";
import { getStoreUrl } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Shirt,
  Smartphone,
  Sparkles,
  Home,
  UtensilsCrossed,
  Watch,
  Package,
  MapPin,
  Truck,
  CreditCard,
  Check,
  SkipForward,
  Upload,
  ExternalLink,
  ImagePlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────── Types ──────────────────────────── */

interface NicheOption {
  id: string;
  label: string;
  labelEn: string;
  icon: React.ReactNode;
}

interface CountryOption {
  code: string;
  label: string;
  flag: string;
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

const NICHES: NicheOption[] = [
  { id: "fashion", label: "ملابس وأزياء", labelEn: "Fashion & Clothing", icon: <Shirt className="h-7 w-7" /> },
  { id: "electronics", label: "إلكترونيات", labelEn: "Electronics", icon: <Smartphone className="h-7 w-7" /> },
  { id: "beauty", label: "تجميل وعناية", labelEn: "Beauty & Care", icon: <Sparkles className="h-7 w-7" /> },
  { id: "home", label: "مستلزمات منزلية", labelEn: "Home & Living", icon: <Home className="h-7 w-7" /> },
  { id: "food", label: "أطعمة ومشروبات", labelEn: "Food & Drinks", icon: <UtensilsCrossed className="h-7 w-7" /> },
  { id: "accessories", label: "إكسسوارات", labelEn: "Accessories", icon: <Watch className="h-7 w-7" /> },
  { id: "other", label: "أخرى", labelEn: "Other", icon: <Package className="h-7 w-7" /> },
];

const COUNTRIES: CountryOption[] = [
  { code: "EG", label: "مصر", flag: "🇪🇬" },
  { code: "SA", label: "السعودية", flag: "🇸🇦" },
  { code: "AE", label: "الإمارات", flag: "🇦🇪" },
  { code: "JO", label: "الأردن", flag: "🇯🇴" },
  { code: "KW", label: "الكويت", flag: "🇰🇼" },
];

// Egyptian-market options (default).
const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "bosta", label: "بوسطة", desc: "شحن آلي مع تتبع — الأفضل لمصر" },
  { id: "manual", label: "مناطق يدوية", desc: "حدد مناطق الشحن والأسعار بنفسك" },
  { id: "both", label: "الاثنين معاً", desc: "بوسطة + مناطق يدوية كنسخة احتياطية" },
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
  { id: "manual", label: "مناطق يدوية", desc: "حدد مناطق الشحن والأسعار بنفسك" },
];

const PAYMENT_OPTIONS_SA: PaymentOption[] = [
  { id: "cod", label: "الدفع عند الاستلام", desc: "كاش عند التوصيل", alwaysOn: true },
  { id: "moyasar", label: "مدى / بطاقة / Apple Pay (ميسر)", desc: "مدى، فيزا، ماستركارد، Apple Pay" },
];

// Steps: 0 = welcome, 1-4 = config, 5 = first product, 6 = preview
const TOTAL_STEPS = 6;

/* ──────────────────────────── Step Labels ──────────────────────────── */

const STEP_LABELS = [
  { key: "niche", labelAr: "التصنيف", labelEn: "Category" },
  { key: "country", labelAr: "الموقع", labelEn: "Location" },
  { key: "shipping", labelAr: "الشحن", labelEn: "Shipping" },
  { key: "payments", labelAr: "الدفع", labelEn: "Payments" },
  { key: "product", labelAr: "منتج", labelEn: "Product" },
  { key: "preview", labelAr: "معاينة", labelEn: "Preview" },
];

/* ──────────────────────────── Component ──────────────────────────── */

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  // Wizard state. Country seeds from the store's market (chosen at store
  // creation) so a Saudi store lands on the SA options without re-picking.
  const [step, setStep] = useState(0); // 0 = welcome
  const [businessType, setBusinessType] = useState<string>("");
  const [country, setCountry] = useState<string>(
    (currentStore?.country || "EG").toUpperCase(),
  );
  const [shippingPref, setShippingPref] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cod"]);

  // Market-aware option lists: a Saudi store sees Moyasar + manual shipping;
  // an Egyptian store sees Paymob/Fawry/Kashier + Bosta.
  const paymentOptions = country === "SA" ? PAYMENT_OPTIONS_SA : PAYMENT_OPTIONS;
  const shippingOptions = country === "SA" ? SHIPPING_OPTIONS_SA : SHIPPING_OPTIONS;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product step state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progressValue = step === 0 ? 0 : (step / TOTAL_STEPS) * 100;

  const canAdvance = useCallback(() => {
    switch (step) {
      case 0: return true; // welcome
      case 1: return !!businessType;
      case 2: return !!country;
      case 3: return !!shippingPref;
      case 4: return paymentMethods.length > 0;
      case 5: return true; // product step is skippable
      case 6: return true; // preview is always passable
      default: return false;
    }
  }, [step, businessType, country, shippingPref, paymentMethods]);

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
    const defaults: Partial<{
      businessType: string;
      country: string;
      shippingPref: string;
      paymentMethods: string[];
    }> = {};
    if (!businessType) defaults.businessType = "other";
    if (!country) defaults.country = "EG";
    if (!shippingPref) defaults.shippingPref = "manual";
    if (paymentMethods.length === 0) defaults.paymentMethods = ["cod"];

    handleSubmitConfig(defaults);
  };

  const handleSubmitConfig = async (
    defaults: Partial<{
      businessType: string;
      country: string;
      shippingPref: string;
      paymentMethods: string[];
    }> = {}
  ) => {
    if (!currentStore?.id) return;

    setLoading(true);
    setError(null);

    const config: WizardConfig = {
      business_type: defaults.businessType || businessType || "other",
      country: defaults.country || country || "EG",
      shipping_preference: defaults.shippingPref || shippingPref || "manual",
      payment_methods: defaults.paymentMethods || paymentMethods,
      store_language: isAr ? "ar" : "en",
    };

    try {
      await configureFromWizard(currentStore.id, config);
      // If skipping, go straight to dashboard
      if (Object.keys(defaults).length > 0) {
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isAr ? "حدث خطأ أثناء إعداد المتجر" : "Error configuring store");
      setLoading(false);
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
      const priceInCents = String(Math.round(parseFloat(productPrice) * 100));
      const product = await createProduct(currentStore.id, {
        name: productName,
        price: priceInCents,
        status: "active",
      });
      // Upload image if provided
      if (productImage && product.id) {
        try {
          await uploadProductImage(currentStore.id, product.id, productImage);
        } catch {
          // Image upload failure shouldn't block onboarding
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isAr ? "حدث خطأ أثناء إضافة المنتج" : "Error adding product");
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep(TOTAL_STEPS); // Go to preview
  };

  const handleFinish = () => {
    navigate("/", { replace: true });
  };

  // When advancing from step 4 (payments), submit config first
  const handleStepTransition = async () => {
    if (step === 4) {
      // Submit configuration, then advance to product step
      setLoading(true);
      setError(null);
      try {
        await handleSubmitConfig();
        setStep(5);
      } catch {
        // Error already handled in handleSubmitConfig
      } finally {
        setLoading(false);
      }
    } else if (step === 5 && productName && productPrice) {
      // Submit product, then advance to preview
      await handleProductSubmit();
    } else {
      handleNext();
    }
  };

  /* ──────── Step renderers ──────── */

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-[14px] bg-[var(--b-saffron)]/15 border border-[var(--b-saffron)]/40 flex items-center justify-center">
        <Sparkles className="h-10 w-10 text-[var(--b-saffron)]" />
      </div>
      <div>
        <h1 className="brand-display text-3xl font-bold tracking-tight text-[var(--b-ink)] leading-tight">
          {isAr ? `أهلاً ${user?.first_name || ""}!` : `Welcome, ${user?.first_name || ""}!`}
        </h1>
        <p className="text-lg text-[var(--b-ink-soft)] mt-2">
          {isAr ? "خلينا نجهز متجرك في دقائق" : "Let's get your store ready in minutes"}
        </p>
      </div>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button size="lg" onClick={() => setStep(1)} className="brand-btn-primary gap-2 rounded-[4px]">
          {isAr ? "يلا نبدأ" : "Let's go!"}
          <ArrowLeft className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
        </Button>
        <button type="button" className="text-sm text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors" onClick={handleSkip}>
          {isAr ? "تخطي الإعداد" : "Skip setup"}
        </button>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "ايه نوع منتجاتك؟" : "What do you sell?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "اختار التصنيف الأقرب — هنضبط المتجر على أساسه" : "Pick the closest category — we'll optimize your store for it"}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {NICHES.map((niche) => (
          <button
            key={niche.id}
            type="button"
            onClick={() => setBusinessType(niche.id)}
            className={cn(
              "flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200",
              "hover:border-foreground/30 hover:bg-accent/50",
              businessType === niche.id
                ? "border-foreground bg-accent shadow-sm"
                : "border-border/50 bg-card"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-xl transition-colors",
                businessType === niche.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {niche.icon}
            </div>
            <span className="text-sm font-medium">{isAr ? niche.label : niche.labelEn}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <MapPin className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "فين متجرك؟" : "Where's your store?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "هنضبط العملة ومناطق الشحن تلقائياً" : "We'll auto-set currency and shipping zones"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCountry(c.code)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
              "hover:border-foreground/30 hover:bg-accent/50",
              country === c.code
                ? "border-foreground bg-accent shadow-sm"
                : "border-border/50 bg-card"
            )}
          >
            <span className="text-3xl">{c.flag}</span>
            <span className="text-base font-medium">{c.label}</span>
            {country === c.code && (
              <Check className="h-5 w-5 ms-auto text-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <Truck className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "إزاي بتشحن؟" : "How do you ship?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "اختار طريقة الشحن المناسبة ليك" : "Choose your preferred shipping method"}
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
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-muted">
            <CreditCard className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{isAr ? "إزاي بتقبض؟" : "How do you get paid?"}</h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "اختار طرق الدفع — تقدر تغيرها بعدين" : "Choose payment methods — you can change these later"}
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
              {opt.alwaysOn && (
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
                  {isAr ? "تلقائي" : "Auto"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep5 = () => (
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
              type="number"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="199"
              className="h-11 rounded-lg pe-16"
              min="0"
              step="0.01"
            />
            <span className="absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
              {currentStore?.default_currency || "EGP"}
            </span>
          </div>
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

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-xl bg-emerald-500/10">
            <Check className="h-7 w-7 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isAr ? "متجرك جاهز!" : "Your store is ready!"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isAr ? "شوف شكل متجرك — تقدر تعدل أي وقت من لوحة التحكم" : "See how your store looks — you can customize anytime from the dashboard"}
        </p>
      </div>
      {currentStore?.subdomain && (
        <div className="rounded-xl border overflow-hidden max-w-lg mx-auto">
          <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b">
            <span className="text-xs text-muted-foreground font-mono truncate">{getStoreUrl(currentStore.subdomain)}</span>
            <button
              type="button"
              onClick={() => window.open(getStoreUrl(currentStore.subdomain), "_blank")}
              className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              {isAr ? "فتح" : "Open"}
            </button>
          </div>
          <iframe
            src={getStoreUrl(currentStore.subdomain)}
            className="w-full h-[350px]"
            title="Store Preview"
          />
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderWelcome();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
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
                <ArrowRight className="h-4 w-4" />
                {isAr ? "رجوع" : "Back"}
              </Button>

              {step === 5 && (!productName || !productPrice) ? (
                // On product step with empty fields — show skip + add later
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(TOTAL_STEPS)}
                  className="gap-2 rounded-[4px] border-[var(--b-line)] text-[var(--b-ink)] hover:bg-[var(--b-cream)]"
                >
                  {isAr ? "تخطي — أضيف بعدين" : "Skip — add later"}
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
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
                      {isAr ? "ابدأ البيع" : "Start Selling"}
                      <Check className="brand-btn-arrow h-4 w-4" />
                    </>
                  ) : step === 5 ? (
                    <>
                      {isAr ? "أضف المنتج" : "Add Product"}
                      <Package className="brand-btn-arrow h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {isAr ? "التالي" : "Next"}
                      <ArrowLeft className="brand-btn-arrow h-4 w-4 rtl:rotate-180" />
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
