/**
 * OnboardingWizard — multi-step smart onboarding that auto-configures
 * the store based on the merchant's answers.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { configureFromWizard, type WizardConfig } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────── Types ──────────────────────────── */

interface NicheOption {
  id: string;
  label: string;
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
  { id: "fashion", label: "ملابس وأزياء", icon: <Shirt className="h-7 w-7" /> },
  { id: "electronics", label: "إلكترونيات", icon: <Smartphone className="h-7 w-7" /> },
  { id: "beauty", label: "تجميل وعناية", icon: <Sparkles className="h-7 w-7" /> },
  { id: "home", label: "مستلزمات منزلية", icon: <Home className="h-7 w-7" /> },
  { id: "food", label: "أطعمة ومشروبات", icon: <UtensilsCrossed className="h-7 w-7" /> },
  { id: "accessories", label: "إكسسوارات", icon: <Watch className="h-7 w-7" /> },
  { id: "other", label: "أخرى", icon: <Package className="h-7 w-7" /> },
];

const COUNTRIES: CountryOption[] = [
  { code: "EG", label: "مصر", flag: "🇪🇬" },
  { code: "SA", label: "السعودية", flag: "🇸🇦" },
  { code: "AE", label: "الإمارات", flag: "🇦🇪" },
  { code: "JO", label: "الأردن", flag: "🇯🇴" },
  { code: "KW", label: "الكويت", flag: "🇰🇼" },
];

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

const TOTAL_STEPS = 4;

/* ──────────────────────────── Component ──────────────────────────── */

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();

  // Wizard state
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<string>("");
  const [country, setCountry] = useState<string>("EG");
  const [shippingPref, setShippingPref] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cod"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressValue = ((step - 1) / TOTAL_STEPS) * 100;

  const canAdvance = useCallback(() => {
    switch (step) {
      case 1:
        return !!businessType;
      case 2:
        return !!country;
      case 3:
        return !!shippingPref;
      case 4:
        return paymentMethods.length > 0;
      default:
        return false;
    }
  }, [step, businessType, country, shippingPref, paymentMethods]);

  const togglePayment = (id: string) => {
    if (id === "cod") return; // Always on
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSkip = () => {
    // Apply defaults and submit
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

    handleSubmitWithDefaults(defaults);
  };

  const handleSubmitWithDefaults = async (
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
      store_language: "ar",
    };

    try {
      await configureFromWizard(currentStore.id, config);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء إعداد المتجر");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => handleSubmitWithDefaults();

  /* ──────── Step renderers ──────── */

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">ايه نوع منتجاتك؟</h2>
        <p className="text-muted-foreground text-sm">
          اختار التصنيف الأقرب — هنضبط المتجر على أساسه
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
            <span className="text-sm font-medium">{niche.label}</span>
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
        <h2 className="text-2xl font-bold tracking-tight">فين متجرك؟</h2>
        <p className="text-muted-foreground text-sm">
          هنضبط العملة ومناطق الشحن تلقائياً
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
        <h2 className="text-2xl font-bold tracking-tight">إزاي بتشحن؟</h2>
        <p className="text-muted-foreground text-sm">
          اختار طريقة الشحن المناسبة ليك
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {SHIPPING_OPTIONS.map((opt) => (
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
        <h2 className="text-2xl font-bold tracking-tight">إزاي بتقبض؟</h2>
        <p className="text-muted-foreground text-sm">
          اختار طرق الدفع — تقدر تغيرها بعدين
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {PAYMENT_OPTIONS.map((opt) => {
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
                  تلقائي
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  /* ──────── Main render ──────── */

  return (
    <div
      dir="rtl"
      className="min-h-screen auth-page auth-dot-grid relative flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10"
    >
      <div className="w-full max-w-[580px]">
        {/* ── Header ── */}
        <div className="text-center mb-4">
          <span className="text-base font-black tracking-[0.18em] text-primary-foreground/70">
            NUMU
          </span>
        </div>

        {/* ── Card ── */}
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                الخطوة {step} من {TOTAL_STEPS}
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="h-3 w-3" />
                تخطي الإعداد
              </button>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>

          {/* Step content with simple transition */}
          <div
            key={step}
            className="animate-in fade-in slide-in-from-left-2 duration-300"
          >
            {renderCurrentStep()}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1 || loading}
              className={cn(
                "gap-2 transition-opacity",
                step === 1 && "opacity-0 pointer-events-none"
              )}
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance() || loading}
              className="gap-2 min-w-[140px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === TOTAL_STEPS ? (
                <>
                  إعداد المتجر
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-[11px] text-primary-foreground/20 mt-6">
          &copy; 2026 NUMU
        </p>
      </div>
    </div>
  );
}
