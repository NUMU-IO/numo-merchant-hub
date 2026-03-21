/**
 * CreateStore — onboarding page for merchants to create their first store.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createStore, checkSubdomain } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Ticket } from "lucide-react";
import { getStoreDomainSuffix } from "@/lib/storefront";
import { ApiError } from "@/lib/api-error";
import { z } from "zod";

const createStoreSchema = z.object({
  name: z.string().min(3, "اسم المتجر يجب أن يكون 3 أحرف على الأقل").max(60, "اسم المتجر يجب ألا يتجاوز 60 حرفًا"),
  subdomain: z.string().min(3, "النطاق الفرعي يجب أن يكون 3 أحرف على الأقل").max(30, "النطاق الفرعي يجب ألا يتجاوز 30 حرفًا").regex(/^[a-z0-9-]+$/, "النطاق الفرعي يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطات"),
  description: z.string().max(500, "الوصف يجب ألا يتجاوز 500 حرف").optional().or(z.literal("")),
});

type FieldErrors = Record<string, string>;

export default function CreateStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetchStores, hasStores, isLoading: storesLoading } = useDashboardStore();

  // Only redirect if user has stores AND didn't intentionally navigate here
  // (e.g. from RequireStore guard, not from "New store" button)

  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("ar");
  const [currency, setCurrency] = useState("EGP");
  const [betaCode, setBetaCode] = useState("");
  const [showBetaCode, setShowBetaCode] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [subdomainMsg, setSubdomainMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (slug.length >= 3) setSubdomain(slug);
  }, [name]);

  useEffect(() => {
    if (subdomain.length < 3) { setSubdomainStatus("idle"); return; }
    setSubdomainStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkSubdomain(subdomain);
        setSubdomainStatus(result.available ? "available" : "taken");
        setSubdomainMsg(result.message);
      } catch { setSubdomainStatus("invalid"); setSubdomainMsg("Could not check subdomain"); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const result = createStoreSchema.safeParse({ name, subdomain, description });
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    if (subdomainStatus !== "available") return;
    setError(null);
    setLoading(true);
    try {
      await createStore({ name, subdomain, description: description || undefined, default_language: language, default_currency: currency, invite_code: betaCode || undefined });
      await refetchStores();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.toUserMessage(language));
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
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

  return (
    <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* ── Brand text — lg+ ── */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[320px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="text-base font-black tracking-[0.18em] text-primary-foreground/70">NUMU</span>
          <div className="max-w-[280px]">
            <h2 className="text-[1.85rem] font-semibold text-primary-foreground leading-[1.25] tracking-tight">
              Launch your<br />store today.
            </h2>
            <div className="w-8 h-px bg-primary-foreground/20 mt-6 mb-5" />
            <p className="text-primary-foreground/40 text-[13px] leading-relaxed">{t("createStore.subtitle")}</p>
          </div>
          <p className="text-primary-foreground/20 text-[11px]">&copy; 2026 NUMU</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="w-full max-w-[460px] lg:ms-auto lg:me-[8%] xl:me-[12%]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          <div className="lg:hidden mb-6 flex justify-center">
            <span className="text-base font-black tracking-[0.18em] text-white/70">NUMU</span>
          </div>

          {hasStores && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              ← {language === "ar" ? "رجوع" : "Back"}
            </button>
          )}

          <h1 className="text-xl font-semibold tracking-tight">{t("createStore.title")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground mb-7">{t("createStore.subtitle")}</p>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{t("createStore.storeName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createStore.storeNamePlaceholder")} className={inputCls("name")} autoFocus />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{t("createStore.subdomain")}</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="mystore" className={`${inputCls("subdomain")} pe-9`} />
                  {subdomainIcon && <div className="absolute inset-y-0 end-3 flex items-center">{subdomainIcon}</div>}
                </div>
                {getStoreDomainSuffix() && <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">{getStoreDomainSuffix()}</span>}
              </div>
              {subdomainStatus !== "idle" && subdomainStatus !== "checking" && (
                <p className={`text-xs ${subdomainStatus === "available" ? "text-emerald-600" : "text-destructive"}`}>{subdomainMsg}</p>
              )}
              {fieldErrors.subdomain && <p className="text-xs text-destructive">{fieldErrors.subdomain}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{t("createStore.description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("createStore.descriptionPlaceholder")} rows={3} className={`rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors ${fieldErrors.description ? "border-destructive" : ""}`} />
              {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">{t("createStore.language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">{t("createStore.currency")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!showBetaCode ? (
              <button
                type="button"
                onClick={() => setShowBetaCode(true)}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Ticket className="h-3.5 w-3.5" />
                {language === "ar" ? "هل لديك كود دعوة؟" : "Have an invite code?"}
              </button>
            ) : (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-amber-500" />
                  {language === "ar" ? "كود الدعوة (بيتا)" : "Beta Invite Code"}
                </Label>
                <Input
                  value={betaCode}
                  onChange={(e) => setBetaCode(e.target.value.toUpperCase().trim())}
                  placeholder={language === "ar" ? "أدخل كود الدعوة" : "Enter your invite code"}
                  className={`${inputCls("invite_code")} font-mono tracking-widest`}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  {language === "ar" ? "اختياري — يتيح لك الوصول الفوري للمنصة" : "Optional — gives you instant access to the platform"}
                </p>
                {fieldErrors.invite_code && <p className="text-xs text-destructive">{fieldErrors.invite_code}</p>}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg mt-1" disabled={loading || subdomainStatus !== "available"}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("createStore.create")}<ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        </div>

        <p className="lg:hidden text-center text-[11px] text-primary-foreground/30 mt-6">&copy; 2026 NUMU</p>
      </div>
    </div>
  );
}
