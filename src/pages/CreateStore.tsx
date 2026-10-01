/**
 * CreateStore — onboarding page for merchants to create their first store.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createStore, checkSubdomain } from "@/services/storeApi";
import { updateProfile } from "@/services/authApi";
import { activateDefaultTheme } from "@/services/marketplaceApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, isValidE164 } from "@/components/forms/PhoneInput";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Globe } from "lucide-react";
import { getStoreDomainSuffix } from "@/lib/storefront";
import { getStoreSubdomainSuffix, withEnvSuffix } from "@/lib/env";
import { toStoreSlug } from "@/lib/store-slug";
import { ApiError, errorMessage } from "@/lib/api-error";
import { z } from "zod";

const createStoreSchema = z.object({
  name: z.string().min(3, "اسم المتجر يجب أن يكون 3 أحرف على الأقل").max(60, "اسم المتجر يجب ألا يتجاوز 60 حرفًا"),
  subdomain: z.string().min(3, "رابط المتجر لازم يكون 3 حروف على الأقل").max(30, "رابط المتجر لازم ميزيدش عن 30 حرف").regex(/^[a-z0-9-]+$/, "رابط المتجر لازم يكون حروف إنجليزي صغيرة وأرقام وشرطات بس"),
});

type FieldErrors = Record<string, string>;

export default function CreateStore() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { refetchStores, hasStores } = useDashboardStore();
  const isAr = language === "ar";

  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  // Market the store operates in — drives base currency (SAR/EGP), VAT
  // (15%/14%) and the payment-gateway allow-list on the backend. Read from
  // the phone's country code instead of asked; the picker stays one tap away.
  const [pickedCountry, setPickedCountry] = useState<string | null>(null);
  const [showMarkets, setShowMarkets] = useState(false);
  const country = pickedCountry ?? (phone.startsWith("+966") ? "SA" : "EG");
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const slug = toStoreSlug(name);
    if (slug.length >= 3) setSubdomain(slug);
  }, [name]);

  useEffect(() => {
    if (subdomain.length < 3) { setSubdomainStatus("idle"); return; }
    setSubdomainStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        // Check the env-suffixed value — that's what's actually written to
        // the DB and what other test stores would collide with.
        const result = await checkSubdomain(withEnvSuffix(subdomain));
        setSubdomainStatus(result.available ? "available" : "taken");
      } catch { setSubdomainStatus("invalid"); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const result = createStoreSchema.safeParse({ name, subdomain });
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    if (!user?.phone && !phone) {
      setFieldErrors({ phone: isAr ? "رقم الموبايل مطلوب" : "Phone number is required" });
      return;
    }
    if (!user?.phone && !isValidE164(phone)) {
      setFieldErrors({ phone: isAr ? "رقم الموبايل غير صحيح" : "Please enter a valid phone number" });
      return;
    }
    if (subdomainStatus !== "available") return;
    setError(null);
    setLoading(true);
    try {
      // Google does not provide a phone number. Collect it during first-store
      // setup and persist it before the store can reach STORE_CREATED.
      if (!user?.phone) {
        await updateProfile({ phone });
        await refreshUser();
      }
      // Save the env-suffixed subdomain (e.g. `dev-shop-test` on the test
      // env), so it matches the host the storefront SSR app extracts from
      // <store>-test.numueg.app. On prod the suffix is empty, so user
      // input is saved as-is.
      // The signup phone doubles as the store's support number, so the
      // checklist's "confirm support number" step opens pre-filled.
      const created = await createStore({
        name,
        subdomain: withEnvSuffix(subdomain),
        country,
        contact_phone: user?.phone || phone || undefined,
        // The storefront opens in the language the merchant signed up in.
        default_language: language,
      });
      // Default the new store to the luxury-minimal V3 theme so the
      // onboarding preview (and live storefront) show a polished theme
      // instead of the legacy green/modern default. Fire-and-forget like
      // the demo seed — the merchant passes through several wizard steps
      // before the preview step, by which point activation has landed.
      if (created?.id) {
        void activateDefaultTheme(created.id).catch(() => {});
      }
      // Select the just-created store so onboarding (preview, URL, currency)
      // reflects IT, not the previously-active store.
      await refetchStores(created?.id);
      navigate("/onboarding-wizard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.toUserMessage(language));
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setError(errorMessage(err, language));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field: string) =>
    `h-11 rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors ${
      fieldErrors[field] ? "border-destructive focus:border-destructive" : ""
    }`;

  const subdomainIcon =
    subdomainStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
    subdomainStatus === "available" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
    subdomainStatus === "taken" || subdomainStatus === "invalid" ? <XCircle className="h-4 w-4 text-destructive" /> : null;

  const storeHost = `${subdomain}${getStoreSubdomainSuffix()}${getStoreDomainSuffix() ?? ""}`;
  const subdomainNote =
    subdomainStatus === "checking" ? (isAr ? "بنشوف الرابط…" : "Checking the link…") :
    subdomainStatus === "available" ? (isAr ? `متاح! رابط متجرك: ${storeHost}` : `Available! Your link: ${storeHost}`) :
    subdomainStatus === "taken" ? (isAr ? "الرابط ده مش متاح. جرّب واحد من دول:" : "This link isn't available. Try one of these:") :
    subdomainStatus === "invalid" ? (isAr ? "مقدرناش نتأكد من الرابط، جرّب تاني." : "Couldn't check this link, try again.") :
    subdomainStatus === "idle" && (name.trim() || subdomain) ? (isAr ? "اكتب الرابط بحروف إنجليزي صغيرة أو أرقام، 3 على الأقل." : "Type at least 3 lowercase English letters or numbers.") :
    null;

  return (
    <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <button
        type="button"
        onClick={() => setLanguage(isAr ? "en" : "ar")}
        className="fixed top-4 end-4 z-20 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--b-line)] bg-[var(--b-paper)] px-3 py-1.5 text-xs font-medium text-[var(--b-ink-soft)] hover:text-[var(--b-ink)] hover:border-[var(--b-navy)] transition-colors shadow-xs"
      >
        <Globe className="h-3.5 w-3.5" />
        {isAr ? "English" : "العربية"}
      </button>
      {/* ── Brand text — lg+. Souq auth surface is warm cream, so the
          old `text-primary-foreground` (white) was invisible. Switched
          to navy ink with graduated opacity. ── */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[320px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="souq-wordmark text-base font-black tracking-[0.18em]">NUMU</span>
          <div className="max-w-[280px]">
            <h2 className="text-[1.85rem] font-extrabold text-navy leading-[1.25] tracking-tight">
              {isAr ? <>اعمل متجرك<br />النهارده.</> : <>Launch your<br />store today.</>}
            </h2>
            <div className="w-8 h-px bg-navy/20 mt-6 mb-5" />
            <p className="text-ink-soft text-[13px] leading-relaxed">{t("createStore.subtitle")}</p>
          </div>
          <p className="text-ink-faint text-[11px]">&copy; 2026 NUMU</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="w-full max-w-[460px] lg:ms-auto lg:me-[8%] xl:me-[12%]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          <div className="lg:hidden mb-6 flex justify-center">
            <span className="souq-wordmark text-base font-black tracking-[0.18em]">NUMU</span>
          </div>

          {hasStores && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              ← {isAr ? "رجوع" : "Back"}
            </button>
          )}

          <h1 className="text-xl font-semibold tracking-tight">{t("createStore.title")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground mb-7">{t("createStore.subtitle")}</p>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            {!user?.phone && (
              <div className="space-y-2">
                <Label htmlFor="owner-phone" className="text-[13px] font-medium">
                  {isAr ? "رقم الموبايل" : "Phone number"}
                </Label>
                <PhoneInput
                  id="owner-phone"
                  value={phone}
                  onChange={setPhone}
                  defaultCountry={country === "SA" ? "SA" : "EG"}
                  required
                  errorMessage={fieldErrors.phone}
                />
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "هنستخدمه لمساعدتك أثناء إعداد المتجر وتنبيهات الحساب المهمة."
                    : "We'll use it for setup help and important account alerts."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{t("createStore.storeName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createStore.storeNamePlaceholder")} className={inputCls("name")} autoFocus />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{t("createStore.subdomain")}</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={subdomain}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSubdomain(/[\u0600-\u06FF]/.test(v) ? toStoreSlug(v) : v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    placeholder="mystore"
                    dir="ltr"
                    className={`${inputCls("subdomain")} pe-9`}
                  />
                  {subdomainIcon && <div className="absolute inset-y-0 end-3 flex items-center">{subdomainIcon}</div>}
                </div>
                {getStoreDomainSuffix() && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
                    {getStoreSubdomainSuffix()}{getStoreDomainSuffix()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr ? "ده العنوان اللي هتبعته لعملائك." : "This is the address you'll share with customers."}
              </p>
              {subdomainNote && (
                <p aria-live="polite" className={`text-xs ${subdomainStatus === "available" ? "text-emerald-600" : subdomainStatus === "checking" ? "text-muted-foreground" : "text-destructive"}`}>{subdomainNote}</p>
              )}
              {subdomainStatus === "taken" && (
                <div className="flex flex-wrap gap-2">
                  {[`${subdomain}-store`, `${subdomain}-eg`].map((alt) => (
                    <button key={alt} type="button" onClick={() => setSubdomain(alt.slice(0, 30))} className="rounded-md border px-2 py-1 text-xs font-mono hover:border-foreground/40" dir="ltr">
                      {alt.slice(0, 30)}
                    </button>
                  ))}
                </div>
              )}
              {fieldErrors.subdomain && <p className="text-xs text-destructive">{fieldErrors.subdomain}</p>}
            </div>

            {/* Market selector — drives base currency, VAT rate and the
                payment-gateway allow-list. Defaults to Egypt. */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium">
                {isAr ? "السوق" : "Market"}
              </Label>
              {!showMarkets && (
                <p className="text-sm">
                  {country === "SA" ? (isAr ? "🇸🇦 السعودية · ريال" : "🇸🇦 Saudi Arabia · SAR") : (isAr ? "🇪🇬 مصر · جنيه" : "🇪🇬 Egypt · EGP")}{" "}
                  <button type="button" onClick={() => setShowMarkets(true)} className="text-xs font-semibold underline underline-offset-2 text-muted-foreground hover:text-foreground">
                    {isAr ? "تغيير" : "Change"}
                  </button>
                </p>
              )}
              {showMarkets && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: "EG", flag: "🇪🇬", en: "Egypt", ar: "مصر", ccy: "EGP" },
                  { code: "SA", flag: "🇸🇦", en: "Saudi Arabia", ar: "السعودية", ccy: "SAR" },
                ].map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => setPickedCountry(m.code)}
                    className={`flex items-center justify-between rounded-lg border px-3 h-11 text-sm transition-colors ${
                      country === m.code
                        ? "border-foreground ring-1 ring-foreground/5 bg-muted/40"
                        : "border-border/70 hover:border-foreground/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{m.flag}</span>
                      <span className="font-medium">{isAr ? m.ar : m.en}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{m.ccy}</span>
                  </button>
                ))}
              </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "نضبط العملة وضريبة القيمة المضافة ووسائل الدفع تلقائياً حسب السوق."
                  : "We auto-set currency, VAT and payment methods for this market."}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg mt-1" disabled={loading || subdomainStatus !== "available"}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("createStore.create")}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></>}
            </Button>
          </form>
        </div>

        <p className="lg:hidden text-center text-[11px] text-primary-foreground/30 mt-6">&copy; 2026 NUMU</p>
      </div>
    </div>
  );
}
