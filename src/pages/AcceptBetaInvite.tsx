/**
 * AcceptBetaInvite — landing page for admin-issued beta invite emails.
 *
 * URL: /accept-invite?code=<invite_code>
 *
 * Prefills email + name + store name from the waitlist entry, offers a
 * one-click Google path or an email/password path, and atomically creates
 * the user + their first store. Email is auto-verified on success — clicking
 * the invite link in their inbox already proved email ownership.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { GoogleLogin } from "@react-oauth/google";
import {
  checkBetaInvite,
  redeemBetaInvite,
  redeemBetaInviteGoogle,
  type BetaInviteCheck,
} from "@/services/waitlistApi";
import { checkSubdomain } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Ticket,
} from "lucide-react";
import { getStoreDomainSuffix } from "@/lib/storefront";
import { ApiError } from "@/lib/api-error";
import { z } from "zod";

const passwordPathSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل").max(50),
  lastName: z.string().min(2, "اسم العائلة يجب أن يكون حرفين على الأقل").max(50),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

const storeFieldsSchema = z.object({
  storeName: z.string().min(3, "اسم المتجر يجب أن يكون 3 أحرف على الأقل").max(60),
  subdomain: z
    .string()
    .min(3, "النطاق الفرعي يجب أن يكون 3 أحرف على الأقل")
    .max(30)
    .regex(/^[a-z0-9-]+$/, "النطاق الفرعي يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطات"),
});

type FieldErrors = Record<string, string>;

export default function AcceptBetaInvite() {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage();
  const { refreshUser } = useAuth();
  const { refetchStores } = useDashboardStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAr = language === "ar";

  const code = searchParams.get("code") || "";

  const [checkingInvite, setCheckingInvite] = useState(true);
  const [invite, setInvite] = useState<BetaInviteCheck | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Identity fields (collected only when not using Google)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");

  // Google path: when set, we have a verified Google identity and skip
  // the name + password fields entirely.
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Store fields (always required)
  const [storeName, setStoreName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [subdomainMsg, setSubdomainMsg] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Validate the invite code on mount ──────────────────────────────
  useEffect(() => {
    if (!code) {
      setCheckingInvite(false);
      setInviteError(isAr ? "رابط الدعوة غير صالح" : "Invalid invite link");
      return;
    }

    checkBetaInvite(code)
      .then((data) => {
        if (data.status === "converted") {
          // Already redeemed — bounce to login with the invite email so
          // the merchant doesn't lose the click.
          navigate(
            `/login?email=${encodeURIComponent(data.email)}&already_redeemed=1`,
            { replace: true },
          );
          return;
        }

        if (data.status !== "invited") {
          setInviteError(
            isAr
              ? "الدعوة دي لسه مش جاهزة. تواصل معانا لو دي مشكلة."
              : "This invite isn't active yet. Contact support if this looks wrong.",
          );
          return;
        }

        setInvite(data);

        // Pre-fill name from waitlist entry
        if (data.name) {
          const parts = data.name.trim().split(/\s+/);
          if (parts.length > 0) setFirstName(parts[0]);
          if (parts.length > 1) setLastName(parts.slice(1).join(" "));
        }

        // Pre-fill store name from waitlist company_name (high-conversion win:
        // most merchants signed up with their business name and don't want to
        // retype it)
        if (data.company_name) {
          setStoreName(data.company_name);
        }
      })
      .catch(() => {
        setInviteError(
          isAr
            ? "كود الدعوة ده مش صالح أو انتهت صلاحيته."
            : "This invite code is invalid or expired.",
        );
      })
      .finally(() => setCheckingInvite(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── 2. Auto-derive subdomain from store name (only until user types one) ──
  useEffect(() => {
    if (subdomainTouched) return;
    const slug = storeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (slug.length >= 3) setSubdomain(slug);
  }, [storeName, subdomainTouched]);

  // ── 3. Subdomain availability check (debounced) ───────────────────────
  useEffect(() => {
    if (subdomain.length < 3) {
      setSubdomainStatus("idle");
      return;
    }
    setSubdomainStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkSubdomain(subdomain);
        setSubdomainStatus(result.available ? "available" : "taken");
        setSubdomainMsg(result.message);
      } catch {
        setSubdomainStatus("invalid");
        setSubdomainMsg("Could not check subdomain");
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Always validate store fields
    const storeResult = storeFieldsSchema.safeParse({ storeName, subdomain });

    // Validate identity fields only on the password path
    const identityResult = googleToken
      ? null
      : passwordPathSchema.safeParse({ firstName, lastName, password });

    const errs: FieldErrors = {};
    if (!storeResult.success) {
      for (const issue of storeResult.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
    }
    if (identityResult && !identityResult.success) {
      for (const issue of identityResult.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    if (subdomainStatus !== "available") return;

    setSubmitting(true);
    try {
      if (googleToken) {
        await redeemBetaInviteGoogle({
          invite_code: code,
          id_token: googleToken,
          store_name: storeName,
          subdomain,
        });
      } else {
        await redeemBetaInvite({
          invite_code: code,
          password,
          first_name: firstName,
          last_name: lastName,
          phone: phone || undefined,
          store_name: storeName,
          subdomain,
        });
      }
      // Auth cookies are set — sync the auth + store contexts
      await refreshUser();
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
      setSubmitting(false);
    }
  };

  const inputCls = (field: string) =>
    `h-11 rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors ${
      fieldErrors[field] ? "border-destructive focus:border-destructive" : ""
    }`;

  const subdomainIcon =
    subdomainStatus === "checking" ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : subdomainStatus === "available" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : subdomainStatus === "taken" || subdomainStatus === "invalid" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : null;

  // ── States ────────────────────────────────────────────────────────────

  if (checkingInvite) {
    return (
      <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-[420px]">
          <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight mb-2">
              {isAr ? "رابط دعوة غير صالح" : "Invalid invite link"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{inviteError}</p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full h-11 rounded-lg">
                <Link to="/waitlist">
                  {isAr ? "انضم لقائمة الانتظار" : "Join the waitlist"}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full h-11 rounded-lg">
                <Link to="/login">
                  {isAr ? "تسجيل دخول" : "Log in"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* Language toggle */}
      <button
        type="button"
        onClick={() => setLanguage(language === "en" ? "ar" : "en")}
        className="fixed top-5 end-5 z-20 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white/80 transition-colors bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] backdrop-blur-sm"
      >
        <Globe className="h-3.5 w-3.5" />
        {language === "en" ? "العربية" : "English"}
      </button>

      {/* Hero brand — lg+ */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[360px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="text-base font-black tracking-[0.18em] text-primary-foreground/70">NUMU</span>
          <div className="max-w-[320px]">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1 mb-4">
              <Ticket className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-300 tracking-wide">
                {isAr ? "دعوة بيتا" : "BETA INVITE"}
              </span>
            </div>
            <h2
              className="text-[1.85rem] font-semibold text-primary-foreground leading-[1.25] tracking-tight"
              dir={isRTL ? "rtl" : "ltr"}
            >
              {isAr ? "أهلاً في نُمو." : "Welcome to NUMU."}
              <br />
              {isAr ? "خلّينا نطلق متجرك." : "Let's launch your store."}
            </h2>
            <div className="w-8 h-px bg-primary-foreground/20 mt-6 mb-5" />
            <p className="text-primary-foreground/40 text-[13px] leading-relaxed">
              {isAr
                ? "بنبني حسابك ومتجرك في خطوة واحدة. كل اللي بعد ده تعديلات."
                : "We'll set up your account and store in one step. Everything after this is just polish."}
            </p>
          </div>
          <p className="text-primary-foreground/20 text-[11px]">&copy; 2026 NUMU</p>
        </div>
      </div>

      {/* Form card */}
      <div className="w-full max-w-[460px] lg:ms-auto lg:me-[6%] xl:me-[10%]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          <div className="lg:hidden mb-6 flex justify-center">
            <span className="text-base font-black tracking-[0.18em] text-white/70">NUMU</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            {isAr ? "فعّل دعوتك" : "Activate your invite"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground mb-6">
            {isAr
              ? "أكمل البيانات وهنبني حسابك ومتجرك دلوقتي."
              : "Fill in the details — we'll create your account and store right now."}
          </p>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            {/* Locked email from invite */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">
                {isAr ? "البريد الإلكتروني" : "Email"}
              </Label>
              <Input
                value={invite.email}
                disabled
                className="h-11 rounded-lg border-border/70 bg-muted/30 cursor-not-allowed"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "البريد ده مربوط بالدعوة بتاعتك ومش هيتغير."
                  : "This email is tied to your invite and can't be changed."}
              </p>
            </div>

            {/* Google path indicator OR Google button */}
            {googleToken ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-3 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {isAr ? "اتسجلت بحساب جوجل" : "Signed in with Google"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {invite.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleToken(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAr ? "تغيير" : "Change"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-center [&_iframe]:!rounded-lg">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => {
                      if (credentialResponse.credential) {
                        setGoogleToken(credentialResponse.credential);
                        setError(null);
                      }
                    }}
                    onError={() =>
                      setError(
                        isAr ? "فشل تسجيل الدخول بجوجل" : "Google sign-in failed",
                      )
                    }
                    size="large"
                    width="100%"
                    text="signup_with"
                    shape="pill"
                    theme="filled_black"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-transparent px-3 text-white/40">
                      {isAr ? "أو" : "or"}
                    </span>
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">
                      {isAr ? "الاسم الأول" : "First name"}
                    </Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputCls("firstName")}
                    />
                    {fieldErrors.firstName && (
                      <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">
                      {isAr ? "اسم العائلة" : "Last name"}
                    </Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputCls("lastName")}
                    />
                    {fieldErrors.lastName && (
                      <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Phone (optional) */}
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium">
                    {isAr ? "رقم الهاتف (اختياري)" : "Phone (optional)"}
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="h-11 rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium">
                    {isAr ? "كلمة المرور" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`${inputCls("password")} pe-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive">{fieldErrors.password}</p>
                  )}
                </div>
              </>
            )}

            <hr className="border-border/40" />

            {/* Store name */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">
                {isAr ? "اسم المتجر" : "Store name"}
              </Label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={isAr ? "متجر مصر" : "My store"}
                className={inputCls("storeName")}
              />
              {fieldErrors.storeName && (
                <p className="text-xs text-destructive">{fieldErrors.storeName}</p>
              )}
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">
                {isAr ? "النطاق الفرعي" : "Subdomain"}
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={subdomain}
                    onChange={(e) => {
                      setSubdomainTouched(true);
                      setSubdomain(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      );
                    }}
                    placeholder="mystore"
                    className={`${inputCls("subdomain")} pe-9`}
                    dir="ltr"
                  />
                  {subdomainIcon && (
                    <div className="absolute inset-y-0 end-3 flex items-center">
                      {subdomainIcon}
                    </div>
                  )}
                </div>
                {getStoreDomainSuffix() && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
                    {getStoreDomainSuffix()}
                  </span>
                )}
              </div>
              {subdomainStatus !== "idle" && subdomainStatus !== "checking" && (
                <p
                  className={`text-xs ${
                    subdomainStatus === "available" ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {subdomainMsg}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "تقدر تغيره لاحقًا من إعدادات المتجر."
                  : "You can change this later from store settings."}
              </p>
              {fieldErrors.subdomain && (
                <p className="text-xs text-destructive">{fieldErrors.subdomain}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold gap-2 rounded-lg mt-1"
              disabled={submitting || subdomainStatus !== "available"}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isAr ? "أنشئ حسابي ومتجري" : "Create my account & store"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            {isAr ? "عندك حساب بالفعل؟" : "Already have an account?"}{" "}
            <Link
              to="/login"
              className="text-foreground font-semibold hover:underline underline-offset-2"
            >
              {isAr ? "سجّل دخول" : "Log in"}
            </Link>
          </p>
        </div>

        <p className="lg:hidden text-center text-[11px] text-primary-foreground/30 mt-6">
          &copy; 2026 NUMU
        </p>
      </div>
    </div>
  );
}
