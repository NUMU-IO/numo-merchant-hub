/**
 * Login / Register page for the NUMU merchant dashboard.
 *
 * Visual rebrand to match the numu-design merchant-hub UI kit:
 *   • near-white page (was deep navy with ambient orbs)
 *   • clean white form card with Stripe-style shadow (was liquid glass)
 *   • brand mark + Reem Kufi "نُمو" wordmark on the left, no shimmer
 *   • § eyebrow markers per brand-kit editorial language
 *   • Inter base font (already loaded), Reem Kufi for the brand mark
 *
 * Form logic, validation, i18n, OAuth, and 2FA flow are unchanged.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, ShieldCheck, Globe } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { TwoFactorRequiredError } from "@/services/authApi";
import { ApiError } from "@/lib/api-error";
import { PhoneInput, isValidE164 } from "@/components/forms/PhoneInput";
import { z } from "zod";
import AnimatedCharacters from "@/components/AnimatedCharacters";

const loginSchema = z.object({
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل").max(50, "الاسم الأول طويل جدًا"),
  lastName: z.string().min(2, "اسم العائلة يجب أن يكون حرفين على الأقل").max(50, "اسم العائلة طويل جدًا"),
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
  // Phone is validated via libphonenumber-js inside the PhoneInput
  // component; the schema just accepts an optional string here so that
  // typing an in-progress (not-yet-valid) number doesn't trip Zod before
  // the user has finished. We re-check validity at submit time.
  phone: z.string().optional().or(z.literal("")),
});

type FieldErrors = Record<string, string>;

// Read the Google OAuth client ID once at module load. Empty string when
// the env var is unset → the Google block on the login form is hidden.
// (App.tsx still mounts `<GoogleOAuthProvider clientId="">`, but with the
// button hidden it never renders an iframe so Google's 400-on-empty-id
// request never fires.)
const GOOGLE_SIGN_IN_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function Login() {
  const { t } = useTranslation();
  const { login, complete2FALogin, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusingEmail, setIsFocusingEmail] = useState(false);

  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const alreadyRedeemed = searchParams.get("already_redeemed") === "1";

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFACode, setTwoFACode] = useState("");

  const { language, setLanguage, isRTL } = useLanguage();
  const isAr = language === "ar";

  // Form-panel cursor tracker — drives the --mx/--my CSS vars that the
  // dot-grid spotlight masks against. Pointer events are cheap; we just
  // mutate two CSS custom properties per move.
  const formPanelRef = useRef<HTMLDivElement>(null);
  const handleFormPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = formPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };
  const handleFormPointerLeave = () => {
    const el = formPanelRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "-9999px");
    el.style.setProperty("--my", "-9999px");
  };

  const taglines = [
    t("auth.heroTagline1"),
    t("auth.heroTagline2"),
    t("auth.heroTagline3"),
    t("auth.heroTagline4"),
  ];
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [taglineAnim, setTaglineAnim] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineAnim("exit");
      setTimeout(() => {
        setTaglineIdx((i) => (i + 1) % taglines.length);
        setTaglineAnim("enter");
      }, 350);
    }, 3500);
    return () => clearInterval(interval);
  }, [taglines.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = isRegister
      ? registerSchema.safeParse({ firstName, lastName, email, password, phone })
      : loginSchema.safeParse({ email, password });

    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    if (isRegister && phone && !isValidE164(phone)) {
      setFieldErrors({ phone: isAr ? "رقم الهاتف غير صحيح" : "Please enter a valid phone number" });
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register({ email, password, first_name: firstName, last_name: lastName, phone: phone || undefined });
        navigate("/verify-email", { replace: true });
      } else {
        await login(email, password);
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof TwoFactorRequiredError) {
        setChallengeToken(err.challengeToken);
      } else if (err instanceof ApiError) {
        setError(err.toUserMessage(language));
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken || !twoFACode) return;
    setError(null);
    setLoading(true);
    try {
      await complete2FALogin(challengeToken, twoFACode);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.toUserMessage(language));
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field: string) =>
    `brand-input h-11 placeholder:text-[var(--b-ink-soft)]/55 transition-colors ${
      fieldErrors[field] ? "!border-[var(--b-terracotta)]" : ""
    }`;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen auth-page brand-surface paper-grain relative flex items-stretch"
    >
      {/* Language toggle — fixed, top-right */}
      <button
        type="button"
        onClick={() => setLanguage(language === "en" ? "ar" : "en")}
        className="fixed top-4 end-4 z-20 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--b-line)] bg-[var(--b-paper)] px-3 py-1.5 text-xs font-medium text-[var(--b-ink-soft)] hover:text-[var(--b-ink)] hover:border-[var(--b-navy)] transition-colors shadow-xs"
      >
        <Globe className="h-3.5 w-3.5" />
        {language === "en" ? "العربية" : "English"}
      </button>

      {/* Left hero panel — cream paper ground with the four-character
          ensemble. Characters track the cursor, blink, glance at one
          another while the email field is focused, and avert their
          gaze when the password is revealed. Hidden on small screens;
          the form column carries everything on mobile. */}
      <div className="hidden lg:flex flex-1 max-w-[640px] flex-col p-12 xl:p-16 relative overflow-hidden auth-bright-panel border-e border-[var(--b-line)]">
        {/* Character ensemble — absolute, bottom-anchored, scaled to fit
            the panel at every desktop breakpoint. `pointer-events-none`
            so the characters never block clicks on the brand mark or
            footer links sitting above them. Eye-tracking still works
            via the global mousemove listener. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-20 xl:bottom-24 2xl:bottom-28 z-0 flex items-end justify-center pointer-events-none"
        >
          <div className="origin-bottom scale-[0.62] xl:scale-75 2xl:scale-[0.88]">
            <AnimatedCharacters
              isFocusing={isFocusingEmail}
              hasPassword={password.length > 0}
              passwordVisible={showPassword}
            />
          </div>
        </div>

        {/* Terracotta → saffron hairline at bottom — brand-kit signature */}
        <span aria-hidden="true" className="absolute bottom-0 start-0 end-0 h-[3px] z-20 auth-hero-hairline" />

        {/* Content sits above the characters. Tagline anchors below the
            brand mark; footer is pushed to the bottom with `mt-auto`
            so the middle space belongs to the animation. */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          <Link
            to="/"
            className="flex items-center gap-3 pointer-events-auto self-start hover:opacity-90 transition-opacity"
            aria-label={isAr ? "نُمُو — الرئيسية" : "numu — home"}
          >
            <img
              src="/numu-mark.webp"
              alt=""
              className="h-10 w-auto object-contain"
              width="40"
              height="40"
              fetchpriority="high"
            />
            {isAr ? (
              <span className="auth-wordmark text-2xl font-bold tracking-tight text-[var(--b-ink)]">
                نُمُو
              </span>
            ) : (
              <span className="auth-wordmark text-2xl font-semibold tracking-tight text-[var(--b-ink)] lowercase">
                numu
              </span>
            )}
          </Link>

          <div className="mt-10 xl:mt-14 max-w-[440px] pointer-events-auto">
            <p className="auth-card-eyebrow mb-4">§ MERCHANT HUB</p>
            <div className="h-[5.5rem] overflow-hidden mb-5">
              <h1
                key={taglineIdx}
                className={`brand-display text-[2.25rem] xl:text-[2.5rem] font-bold tracking-tight leading-[1.1] text-[var(--b-ink)] ${
                  taglineAnim === "enter" ? "auth-tagline-enter" : "auth-tagline-exit"
                }`}
                dir={isRTL ? "rtl" : "ltr"}
              >
                {taglines[taglineIdx]}
              </h1>
            </div>
            <div className="auth-hero-rule mb-5" />
            <p className="text-sm leading-relaxed max-w-[380px] text-[var(--b-ink-soft)]">
              {t("auth.heroSubtitle")}
            </p>
          </div>

          <div className="mt-auto flex items-center gap-6 text-xs text-[var(--b-ink-soft)] pointer-events-auto">
            <span>&copy; 2026 {isAr ? "نُمُو" : "numu"}</span>
            <span aria-hidden="true">·</span>
            <Link to="/" className="transition-colors hover:text-[var(--b-ink)]">
              numueg.app
            </Link>
          </div>
        </div>
      </div>

      {/* Form column */}
      <div
        ref={formPanelRef}
        onPointerMove={handleFormPointerMove}
        onPointerLeave={handleFormPointerLeave}
        className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative z-10 auth-dot-grid-vivid"
      >
        <div className="w-full max-w-[440px]">
          <div className="auth-card auth-enter p-7 sm:p-9">
            {/* Mobile-only brand row */}
            <div className="lg:hidden mb-6 flex items-center gap-2.5">
              <img
                src="/numu-mark.webp"
                alt=""
                className="h-8 w-auto object-contain"
                width="32"
                height="32"
                fetchPriority="high"
              />
              {isAr ? (
                <span className="auth-wordmark text-lg font-bold tracking-tight text-[var(--b-ink)]">
                  نُمُو
                </span>
              ) : (
                <span className="auth-wordmark text-lg font-semibold tracking-tight text-[var(--b-ink)] lowercase">
                  numu
                </span>
              )}
            </div>

            {challengeToken ? (
              /* ── 2FA verification ── */
              <div>
                <p className="auth-card-eyebrow mb-3">§ TWO-FACTOR</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-[4px] bg-[var(--b-navy)]/10 border border-[var(--b-navy)]/20 flex items-center justify-center">
                    <ShieldCheck className="h-[18px] w-[18px] text-[var(--b-navy)]" />
                  </div>
                  <h1 className="brand-display text-xl font-bold tracking-tight text-[var(--b-ink)]">
                    {t("auth.twoFactorTitle")}
                  </h1>
                </div>
                <p className="text-sm text-[var(--b-ink-soft)] mb-7">
                  {t("auth.twoFactorDesc")}
                </p>

                <form noValidate onSubmit={handle2FASubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="twoFACode" className="text-[13px] font-medium">
                      {t("auth.verificationCode")}
                    </Label>
                    <Input
                      id="twoFACode"
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 10))}
                      placeholder="000000"
                      className="brand-input h-11 transition-colors text-center text-lg font-mono tracking-[0.3em]"
                      maxLength={10}
                      dir="ltr"
                      autoFocus
                    />
                    <p className="text-xs text-[var(--b-ink-soft)]">
                      {t("auth.twoFactorHint")}
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="brand-btn-primary w-full h-11 text-sm font-semibold gap-2 rounded-[4px]" disabled={loading || !twoFACode}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("auth.verify")}<ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" /></>}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setChallengeToken(null); setTwoFACode(""); setError(null); }}
                    className="flex items-center gap-1.5 text-sm text-[var(--b-ink-soft)] hover:text-[var(--b-ink)] transition-colors mx-auto pt-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                    {t("auth.backToLogin")}
                  </button>
                </form>
              </div>
            ) : (
              /* ── Login / Register form ── */
              <div>
                <p className="auth-card-eyebrow mb-3">
                  § {isRegister ? "CREATE ACCOUNT" : "SIGN IN"}
                </p>
                <h1 className="brand-display text-3xl font-bold tracking-tight text-[var(--b-ink)] leading-tight">
                  {isRegister ? t("auth.register") : t("auth.login")}
                </h1>
                <p className="mt-1.5 text-sm text-[var(--b-ink-soft)] mb-6">
                  {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
                </p>

                {alreadyRedeemed && !isRegister && (
                  <div className="mb-5 rounded-[4px] border border-[var(--b-sage)]/40 bg-[var(--b-sage)]/[0.08] px-3 py-2.5">
                    <p className="text-[13px] font-medium text-[var(--b-sage)]">
                      {isAr
                        ? "الدعوة دي اتفعّلت قبل كده."
                        : "This invite is already activated."}
                    </p>
                    <p className="text-xs text-[var(--b-ink-soft)] mt-0.5">
                      {isAr
                        ? "سجّل دخولك بالحساب اللي عملته."
                        : "Log in with the account you set up."}
                    </p>
                  </div>
                )}

                <form noValidate onSubmit={handleSubmit} className="space-y-4">
                  {isRegister && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-[13px] font-medium">{t("auth.firstName")}</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls("firstName")} />
                        {fieldErrors.firstName && <p className="text-xs text-[var(--b-terracotta)]">{fieldErrors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-[13px] font-medium">{t("auth.lastName")}</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls("lastName")} />
                        {fieldErrors.lastName && <p className="text-xs text-[var(--b-terracotta)]">{fieldErrors.lastName}</p>}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[13px] font-medium">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setIsFocusingEmail(true)}
                      onBlur={() => setIsFocusingEmail(false)}
                      placeholder="you@company.com"
                      className={inputCls("email")}
                    />
                    {fieldErrors.email && <p className="text-xs text-[var(--b-terracotta)]">{fieldErrors.email}</p>}
                  </div>

                  {isRegister && (
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[13px] font-medium">{t("auth.phone", "Phone (optional)")}</Label>
                      <PhoneInput
                        id="phone"
                        value={phone}
                        onChange={setPhone}
                        defaultCountry="EG"
                        errorMessage={fieldErrors.phone}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[13px] font-medium">{t("auth.password")}</Label>
                      {!isRegister && (
                        <Link to="/forgot-password" className="text-xs text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors">
                          {t("auth.forgotPassword")}
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className={`${inputCls("password")} pe-10`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 end-3 flex items-center text-[var(--b-ink-soft)] hover:text-[var(--b-ink)] transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-xs text-[var(--b-terracotta)]">{fieldErrors.password}</p>}
                  </div>

                  {error && (
                    <p className="text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="brand-btn-primary w-full h-11 text-sm font-semibold gap-2 rounded-[4px] mt-1" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isRegister ? t("auth.register") : t("auth.login")}<ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" /></>}
                  </Button>
                </form>

                {/* Google Sign-In — only render when a Google OAuth client ID
                    is configured. Without `VITE_GOOGLE_CLIENT_ID`, Google's
                    iframe makes a request with an empty `client_id` and the
                    button renders broken (HTTP 400 from accounts.google.com).
                    Hiding the whole block (divider + button) avoids the
                    broken-button visual until the env var is set. */}
                {GOOGLE_SIGN_IN_ENABLED && (
                  <>
                    {/* Divider */}
                    <div className="relative mt-7 mb-5">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--b-line)]" /></div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-[var(--b-paper)] px-3 text-[var(--b-ink-soft)] font-mono uppercase tracking-[0.18em]">
                          {isAr ? "أو" : "or"}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center [&_iframe]:!rounded-md">
                      <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                          if (!credentialResponse.credential) return;
                          setLoading(true);
                          setError(null);
                          try {
                            await googleLogin(credentialResponse.credential);
                            navigate("/", { replace: true });
                          } catch (err: unknown) {
                            if (err instanceof ApiError) {
                              setError(err.toUserMessage(language));
                            } else {
                              setError(err instanceof Error ? err.message : "Google login failed");
                            }
                          } finally {
                            setLoading(false);
                          }
                        }}
                        onError={() => setError(isAr ? "فشل تسجيل الدخول بجوجل" : "Google sign-in failed")}
                        size="large"
                        width="100%"
                        text={isRegister ? "signup_with" : "signin_with"}
                        shape="rectangular"
                        theme="outline"
                      />
                    </div>
                  </>
                )}

                <p className="mt-7 text-sm text-center text-[var(--b-ink-soft)]">
                  {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
                  <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); setFieldErrors({}); }} className="text-[var(--b-navy)] font-semibold hover:underline underline-offset-2">
                    {isRegister ? t("auth.login") : t("auth.register")}
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Mobile footer */}
          <p className="lg:hidden text-center text-[11px] text-[var(--b-ink-soft)] mt-6">
            &copy; 2026 {isAr ? "نُمُو" : "numu"}
          </p>
        </div>
      </div>
    </div>
  );
}
