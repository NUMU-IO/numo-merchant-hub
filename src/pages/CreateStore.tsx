/**
 * CreateStore — onboarding page for merchants to create their first store.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createStore, checkSubdomain, seedDemoCatalog } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { getStoreDomainSuffix } from "@/lib/storefront";
import { getStoreSubdomainSuffix, withEnvSuffix } from "@/lib/env";
import { ApiError } from "@/lib/api-error";
import { z } from "zod";

const createStoreSchema = z.object({
  name: z.string().min(3, "اسم المتجر يجب أن يكون 3 أحرف على الأقل").max(60, "اسم المتجر يجب ألا يتجاوز 60 حرفًا"),
  subdomain: z.string().min(3, "النطاق الفرعي يجب أن يكون 3 أحرف على الأقل").max(30, "النطاق الفرعي يجب ألا يتجاوز 30 حرفًا").regex(/^[a-z0-9-]+$/, "النطاق الفرعي يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطات"),
});

type FieldErrors = Record<string, string>;

export default function CreateStore() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { refetchStores, hasStores } = useDashboardStore();
  const isAr = language === "ar";

  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [subdomainMsg, setSubdomainMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Phase 5.11 — opt-in demo catalog. Default ON because most
  // first-time merchants benefit from seeing something on their
  // storefront immediately. Power users (importers / migrators) can
  // untick to skip.
  const [seedDemo, setSeedDemo] = useState(true);
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
        // Check the env-suffixed value — that's what's actually written to
        // the DB and what other test stores would collide with.
        const result = await checkSubdomain(withEnvSuffix(subdomain));
        setSubdomainStatus(result.available ? "available" : "taken");
        setSubdomainMsg(result.message);
      } catch { setSubdomainStatus("invalid"); setSubdomainMsg("Could not check subdomain"); }
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
    if (subdomainStatus !== "available") return;
    setError(null);
    setLoading(true);
    try {
      // Save the env-suffixed subdomain (e.g. `dev-shop-test` on the test
      // env), so it matches the host the storefront SSR app extracts from
      // <store>-test.numueg.app. On prod the suffix is empty, so user
      // input is saved as-is.
      const created = await createStore({ name, subdomain: withEnvSuffix(subdomain) });
      // Phase 5.11 — fire-and-forget seed. We don't block navigation
      // on it because the catalog inserts can take a couple of
      // seconds and the merchant gets to the dashboard sooner.
      // Failure is silent: the dashboard's onboarding nudge "Add
      // your first product" still surfaces if the seed didn't land,
      // so the merchant has a path forward either way.
      if (seedDemo && created?.id) {
        void seedDemoCatalog(created.id).catch(() => {});
      }
      await refetchStores();
      navigate("/onboarding-wizard", { replace: true });
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
      {/* ── Brand text — lg+. Souq auth surface is warm cream, so the
          old `text-primary-foreground` (white) was invisible. Switched
          to navy ink with graduated opacity. ── */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[320px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="souq-wordmark text-base font-black tracking-[0.18em]">NUMU</span>
          <div className="max-w-[280px]">
            <h2 className="text-[1.85rem] font-extrabold text-navy leading-[1.25] tracking-tight">
              Launch your<br />store today.
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
            <span className="text-base font-black tracking-[0.18em] text-white/70">NUMU</span>
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
                {getStoreDomainSuffix() && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
                    {getStoreSubdomainSuffix()}{getStoreDomainSuffix()}
                  </span>
                )}
              </div>
              {subdomainStatus !== "idle" && subdomainStatus !== "checking" && (
                <p className={`text-xs ${subdomainStatus === "available" ? "text-emerald-600" : "text-destructive"}`}>{subdomainMsg}</p>
              )}
              {fieldErrors.subdomain && <p className="text-xs text-destructive">{fieldErrors.subdomain}</p>}
            </div>

            {/* Phase 5.11 — demo seed toggle.
                On by default; one click off for merchants who already
                have their catalog ready to import. We use a real
                <input type="checkbox"> with proper label association
                instead of a custom switch so screen readers + Tab key
                Just Work. */}
            <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={seedDemo}
                onChange={(e) => setSeedDemo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span className="text-xs leading-relaxed">
                <span className="font-medium block mb-0.5">
                  {isAr
                    ? "أضف 5 منتجات تجريبية"
                    : "Add 5 sample products"}
                </span>
                <span className="text-muted-foreground">
                  {isAr
                    ? "يساعدك على معاينة متجرك قبل رفع كتالوجك. يمكنك حذفها لاحقًا بنقرة واحدة."
                    : "Helps you preview your storefront before uploading your catalog. Delete them later with one click."}
                </span>
              </span>
            </label>

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
