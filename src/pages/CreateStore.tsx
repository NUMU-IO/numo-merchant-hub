/**
 * CreateStore — onboarding page for merchants to create their first store.
 * Premium split-panel layout with geometric branding.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createStore, checkSubdomain } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Store, Rocket, KeyRound } from "lucide-react";
import { NumuIcon } from "@/components/NumuLogo";
import { getStoreDomainSuffix } from "@/lib/storefront";
import { z } from "zod";

const createStoreSchema = z.object({
  name: z.string().min(3, "اسم المتجر يجب أن يكون 3 أحرف على الأقل").max(60, "اسم المتجر يجب ألا يتجاوز 60 حرفًا"),
  subdomain: z.string().min(3, "النطاق الفرعي يجب أن يكون 3 أحرف على الأقل").max(30, "النطاق الفرعي يجب ألا يتجاوز 30 حرفًا").regex(/^[a-z0-9-]+$/, "النطاق الفرعي يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطات"),
  description: z.string().max(500, "الوصف يجب ألا يتجاوز 500 حرف").optional().or(z.literal("")),
  invite_code: z.string().min(1, "رمز الدعوة مطلوب"),
});

type FieldErrors = Record<string, string>;

export default function CreateStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetchStores, hasStores, isLoading: storesLoading } = useDashboardStore();

  useEffect(() => {
    if (!storesLoading && hasStores) navigate("/", { replace: true });
  }, [storesLoading, hasStores, navigate]);

  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") ?? "");
  const [language, setLanguage] = useState("ar");
  const [currency, setCurrency] = useState("EGP");
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
    const result = createStoreSchema.safeParse({ name, subdomain, description, invite_code: inviteCode });
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
      await createStore({ name, subdomain, description: description || undefined, default_language: language, default_currency: currency, invite_code: inviteCode || undefined });
      await refetchStores();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${
      fieldErrors[field] ? "border-destructive" : ""
    }`;

  const subdomainIcon =
    subdomainStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
    subdomainStatus === "available" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
    subdomainStatus === "taken" || subdomainStatus === "invalid" ? <XCircle className="h-4 w-4 text-destructive" /> : null;

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-16 -start-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute bottom-16 end-8 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12 space-y-8 max-w-md">
          <Rocket className="h-16 w-16 text-primary-foreground/80 mx-auto" />
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-primary-foreground">{t("createStore.title")}</h2>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">{t("createStore.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-lg space-y-8">
          <div className="lg:hidden flex justify-center">
            <NumuIcon size={44} />
          </div>

          <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
            <CardHeader className="text-center space-y-1 pb-1 pt-8">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-2">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">{t("createStore.title")}</CardTitle>
              <CardDescription>{t("createStore.subtitle")}</CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <form noValidate onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.inviteCode", "رمز الدعوة")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
                    <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="XXXX-XXXX" className={`${inputClass("invite_code")} ps-9`} />
                  </div>
                  {fieldErrors.invite_code && <p className="text-[11px] text-destructive">{fieldErrors.invite_code}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.storeName")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createStore.storeNamePlaceholder")} className={inputClass("name")} />
                  {fieldErrors.name && <p className="text-[11px] text-destructive">{fieldErrors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.subdomain")}</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="mystore" className={`${inputClass("subdomain")} pe-9`} />
                      {subdomainIcon && <div className="absolute inset-y-0 end-3 flex items-center">{subdomainIcon}</div>}
                    </div>
                    {getStoreDomainSuffix() && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">{getStoreDomainSuffix()}</span>
                    )}
                  </div>
                  {subdomainStatus !== "idle" && subdomainStatus !== "checking" && (
                    <p className={`text-[11px] ${subdomainStatus === "available" ? "text-emerald-600" : "text-destructive"}`}>{subdomainMsg}</p>
                  )}
                  {fieldErrors.subdomain && <p className="text-[11px] text-destructive">{fieldErrors.subdomain}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.description")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("createStore.descriptionPlaceholder")} rows={3} className={`rounded-xl bg-muted/30 border-border/50 ${fieldErrors.description ? "border-destructive" : ""}`} />
                  {fieldErrors.description && <p className="text-[11px] text-destructive">{fieldErrors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.language")}</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("createStore.currency")}</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-sm font-bold gap-2 rounded-xl" disabled={loading || subdomainStatus !== "available"}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("createStore.create")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
