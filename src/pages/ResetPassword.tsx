/**
 * Reset password page — sets a new password via the link token.
 *
 * Brand-surface treatment matching the landing-page kit.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { resetPassword } from "@/services/authApi";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) { setError(t("auth.passwordMinLength", "Password must be at least 12 characters")); return; }
    if (password !== confirmPassword) { setError(t("auth.passwordsMismatch", "Passwords don't match")); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "brand-input h-11 placeholder:text-[var(--b-ink-soft)]/55 transition-colors";

  const Brand = () => (
    <Link
      to="/"
      className="flex items-center gap-2.5 justify-center mb-7"
      aria-label={isAr ? "نُمُو — الرئيسية" : "numu — home"}
    >
      <img
        src="/numu-mark.webp"
        alt=""
        className="h-9 w-auto object-contain"
        width="36"
        height="36"
        fetchPriority="high"
      />
      {isAr ? (
        <span className="auth-wordmark text-xl font-bold tracking-tight text-[var(--b-ink)]">نُمُو</span>
      ) : (
        <span className="auth-wordmark text-xl font-semibold tracking-tight text-[var(--b-ink)] lowercase">numu</span>
      )}
    </Link>
  );

  if (!token) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="min-h-screen auth-page auth-dot-grid brand-surface paper-grain flex flex-col items-center justify-center p-4 sm:p-6"
      >
        <div className="w-full max-w-[420px] relative z-10">
          <Brand />
          <div className="auth-card auth-enter p-7 sm:p-9 text-center">
            <p className="auth-card-eyebrow mb-4">§ INVALID LINK</p>
            <div className="flex justify-center mb-4">
              <div className="h-11 w-11 rounded-[4px] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-[var(--b-terracotta)]" />
              </div>
            </div>
            <h1 className="brand-display text-xl font-bold tracking-tight text-[var(--b-ink)]">{t("auth.invalidResetLink", "Invalid or expired reset link")}</h1>
            <p className="mt-2 text-sm text-[var(--b-ink-soft)]">{t("auth.requestNewLink", "Please request a new password reset link.")}</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-6 gap-1.5 rounded-[4px] border-[var(--b-line)] text-[var(--b-ink)] hover:bg-[var(--b-cream)]"
            >
              <Link to="/forgot-password">{t("auth.forgotPassword", "Forgot Password")}</Link>
            </Button>
          </div>
        </div>
        <p className="mt-8 text-[11px] text-[var(--b-ink-soft)] relative z-10">&copy; 2026 {isAr ? "نُمُو" : "numu"}</p>
      </div>
    );
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen auth-page auth-dot-grid brand-surface paper-grain flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-[420px] relative z-10">
        <Brand />
        <div className="auth-card auth-enter p-7 sm:p-9">
          {success ? (
            <div className="text-center">
              <p className="auth-card-eyebrow mb-4">§ SUCCESS</p>
              <div className="flex justify-center mb-4">
                <div className="h-11 w-11 rounded-[4px] bg-[var(--b-sage)]/10 border border-[var(--b-sage)]/40 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-[var(--b-sage)]" />
                </div>
              </div>
              <h1 className="brand-display text-2xl font-bold tracking-tight text-[var(--b-ink)]">{t("auth.passwordReset", "Password Reset")}</h1>
              <p className="mt-2 text-sm text-[var(--b-ink-soft)]">{t("auth.canNowLogin", "You can now log in with your new password.")}</p>
              <Button asChild className="brand-btn-primary w-full h-11 text-sm font-semibold rounded-[4px] mt-7">
                <Link to="/login">{t("auth.login")}</Link>
              </Button>
            </div>
          ) : (
            <div>
              <p className="auth-card-eyebrow mb-3">§ NEW PASSWORD</p>
              <h1 className="brand-display text-3xl font-bold tracking-tight text-[var(--b-ink)] leading-tight">{t("auth.newPassword", "Set New Password")}</h1>
              <p className="mt-1.5 text-sm text-[var(--b-ink-soft)] mb-7">{t("auth.newPasswordDesc", "Enter your new password below.")}</p>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[13px] font-medium text-[var(--b-ink)]">{t("auth.newPassword", "New Password")}</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className={`${inputCls} pe-10`} autoFocus />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 end-3 flex items-center text-[var(--b-ink-soft)] hover:text-[var(--b-ink)] transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-[var(--b-ink)]">{t("auth.confirmPassword", "Confirm Password")}</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••••••" className={inputCls} />
                </div>

                {error && (
                  <p className="text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5">{error}</p>
                )}

                <Button type="submit" className="brand-btn-primary w-full h-11 text-sm font-semibold rounded-[4px] mt-1" disabled={loading || !password || !confirmPassword}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.resetPassword", "Reset Password")}
                </Button>

                <Link to="/login" className="flex items-center gap-1.5 text-sm text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors justify-center pt-1">
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  {t("auth.backToLogin", "Back to Login")}
                </Link>
              </form>
            </div>
          )}
        </div>
      </div>
      <p className="mt-8 text-[11px] text-[var(--b-ink-soft)] relative z-10">&copy; 2026 {isAr ? "نُمُو" : "numu"}</p>
    </div>
  );
}
