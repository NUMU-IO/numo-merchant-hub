/**
 * Login / Register page for the NUMU merchant dashboard.
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { TwoFactorRequiredError } from "@/services/authApi";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل").max(50, "الاسم الأول طويل جدًا"),
  lastName: z.string().min(2, "اسم العائلة يجب أن يكون حرفين على الأقل").max(50, "اسم العائلة طويل جدًا"),
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

type FieldErrors = Record<string, string>;

export default function Login() {
  const { t } = useTranslation();
  const { login, complete2FALogin, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFACode, setTwoFACode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = isRegister
      ? registerSchema.safeParse({ firstName, lastName, email, password })
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

    setLoading(true);
    try {
      if (isRegister) {
        await register({ email, password, first_name: firstName, last_name: lastName });
        navigate("/verify-email", { replace: true });
      } else {
        await login(email, password);
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof TwoFactorRequiredError) {
        setChallengeToken(err.challengeToken);
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
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field: string) =>
    `h-11 rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors ${
      fieldErrors[field] ? "border-destructive focus:border-destructive" : ""
    }`;

  return (
    <div className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* ── Brand text — visible on lg+ ── */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[320px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="text-base font-black tracking-[0.18em] text-primary-foreground/70">
            NUMU
          </span>

          <div className="max-w-[280px]">
            <h2 className="text-[1.85rem] font-semibold text-primary-foreground leading-[1.25] tracking-tight">
              {isRegister ? (
                <>Start selling<br />online, today.</>
              ) : (
                <>Commerce,<br />simplified.</>
              )}
            </h2>
            <div className="w-8 h-px bg-primary-foreground/20 mt-6 mb-5" />
            <p className="text-primary-foreground/40 text-[13px] leading-relaxed">
              {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
            </p>
          </div>

          <p className="text-primary-foreground/20 text-[11px]">&copy; 2026 NUMU</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="w-full max-w-[420px] lg:ms-auto lg:me-[8%] xl:me-[12%]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          {/* Mobile logo */}
          <div className="lg:hidden mb-6 flex justify-center">
            <span className="text-base font-black tracking-[0.18em] text-white/70">NUMU</span>
          </div>

          {challengeToken ? (
            /* ── 2FA verification ── */
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="h-9 w-9 rounded-full bg-primary/[0.07] flex items-center justify-center">
                  <ShieldCheck className="h-[18px] w-[18px] text-primary" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {t("auth.twoFactorTitle", "Two-Factor Authentication")}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mb-7 ms-12">
                {t("auth.twoFactorDesc", "Enter the 6-digit code from your authenticator app")}
              </p>

              <form noValidate onSubmit={handle2FASubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twoFACode" className="text-[13px] font-medium">
                    {t("auth.verificationCode", "Verification Code")}
                  </Label>
                  <Input
                    id="twoFACode"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 10))}
                    placeholder="000000"
                    className="h-11 rounded-lg border-border/70 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors text-center text-lg font-mono tracking-[0.3em]"
                    maxLength={10}
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground/70">
                    {t("auth.twoFactorHint", "Enter a 6-digit TOTP code or a backup code (XXXX-XXXX)")}
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg" disabled={loading || !twoFACode}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("auth.verify", "Verify")}<ArrowRight className="h-4 w-4" /></>}
                </Button>

                <button
                  type="button"
                  onClick={() => { setChallengeToken(null); setTwoFACode(""); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto pt-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("auth.backToLogin", "Back to Login")}
                </button>
              </form>
            </div>
          ) : (
            /* ── Login / Register form ── */
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {isRegister ? t("auth.register") : t("auth.login")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground mb-7">
                {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
              </p>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-[13px] font-medium">{t("auth.firstName")}</Label>
                      <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls("firstName")} />
                      {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-[13px] font-medium">{t("auth.lastName")}</Label>
                      <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls("lastName")} />
                      {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium">{t("auth.email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls("email")} />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[13px] font-medium">{t("auth.password")}</Label>
                    {!isRegister && (
                      <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {t("auth.forgotPassword", "Forgot Password?")}
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className={`${inputCls("password")} pe-10`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg mt-1" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isRegister ? t("auth.register") : t("auth.login")}<ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>

              <p className="mt-6 text-sm text-center text-muted-foreground">
                {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
                <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); setFieldErrors({}); }} className="text-foreground font-semibold hover:underline underline-offset-2">
                  {isRegister ? t("auth.login") : t("auth.register")}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Mobile footer */}
        <p className="lg:hidden text-center text-[11px] text-primary-foreground/30 mt-6">
          &copy; 2026 NUMU
        </p>
      </div>
    </div>
  );
}
