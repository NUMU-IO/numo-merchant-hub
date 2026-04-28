/**
 * Forgot password page — sends a reset link.
 *
 * Brand-surface treatment: cream ground, navy primary, saffron arrow,
 * real logo image, Reem Kufi headlines, brand-input form fields.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { forgotPassword } from "@/services/authApi";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen auth-page auth-dot-grid brand-surface paper-grain flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-[420px] relative z-10">
        {/* Brand row — real logo image + Reem Kufi wordmark */}
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-7" aria-label={isAr ? "نُمُو — الرئيسية" : "numu — home"}>
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

        <div className="auth-card auth-enter p-7 sm:p-9">
          {sent ? (
            <div className="text-center">
              <p className="auth-card-eyebrow mb-4">§ EMAIL SENT</p>
              <div className="flex justify-center mb-4">
                <div className="h-11 w-11 rounded-[4px] bg-[var(--b-sage)]/10 border border-[var(--b-sage)]/40 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-[var(--b-sage)]" />
                </div>
              </div>
              <h1 className="brand-display text-2xl font-bold tracking-tight text-[var(--b-ink)]">
                {t("auth.checkEmail", "Check your email")}
              </h1>
              <p className="mt-2 text-sm text-[var(--b-ink-soft)] leading-relaxed max-w-[300px] mx-auto">
                {t("auth.resetEmailNote", "If an account exists with that email, you'll receive a reset link shortly.")}
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full h-11 text-sm font-semibold gap-2 rounded-[4px] mt-7 border-[var(--b-line)] text-[var(--b-ink)] hover:bg-[var(--b-cream)]"
              >
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  {t("auth.backToLogin", "Back to Login")}
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <p className="auth-card-eyebrow mb-3">§ RESET PASSWORD</p>
              <h1 className="brand-display text-3xl font-bold tracking-tight text-[var(--b-ink)] leading-tight">
                {t("auth.forgotPassword", "Forgot Password")}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--b-ink-soft)] mb-7">
                {t("auth.forgotPasswordDesc", "Enter your email and we'll send you a reset link.")}
              </p>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium text-[var(--b-ink)]">{t("auth.email")}</Label>
                  <Input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="brand-input h-11 placeholder:text-[var(--b-ink-soft)]/55 transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5">{error}</p>
                )}

                <Button type="submit" className="brand-btn-primary w-full h-11 text-sm font-semibold gap-2 rounded-[4px]" disabled={loading || !email}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("auth.sendResetLink", "Send Reset Link")}<ArrowRight className="brand-btn-arrow h-4 w-4 rtl:rotate-180" /></>}
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
