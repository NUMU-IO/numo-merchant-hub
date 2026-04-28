/**
 * Email verification page — shown after registration. Supports 6-digit
 * code entry and token-based verification from the email link.
 *
 * Brand-surface treatment matching the landing-page kit.
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  verifyEmailByCode, verifyEmailByToken, resendVerificationEmail,
} from "@/services/authApi";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Mail, RefreshCw, ArrowLeft } from "lucide-react";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user?.is_verified) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) handleTokenVerification(token);
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleTokenVerification(token: string) {
    setLoading(true);
    setError(null);
    try {
      await verifyEmailByToken(token);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification link is invalid or expired");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(codeOverride?: string[]) {
    const fullCode = (codeOverride ?? code).join("");
    if (fullCode.length !== 6) { setError(t("auth.invalidCode")); return; }
    setLoading(true);
    setError(null);
    try {
      await verifyEmailByCode(fullCode);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  }

  function handleGoBack() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleCodeChange(index: number, value: string) {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5 && newCode.every((d) => d !== "")) {
      setTimeout(() => handleCodeSubmit(newCode), 100);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "Enter") handleCodeSubmit();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted.length) return;
    const newCode = [...code];
    for (let i = 0; i < 6; i++) newCode[i] = pasted[i] || "";
    setCode(newCode);
    const nextEmpty = newCode.findIndex((d) => d === "");
    inputRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();
    if (pasted.length === 6) setTimeout(() => handleCodeSubmit(newCode), 100);
  }

  const Brand = () => (
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
  );

  if (success) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="min-h-screen auth-page auth-dot-grid brand-surface paper-grain flex flex-col items-center justify-center p-4 sm:p-6"
      >
        <div className="w-full max-w-[420px] relative z-10">
          <Brand />
          <div className="auth-card auth-enter p-9 text-center">
            <p className="auth-card-eyebrow mb-4">§ VERIFIED</p>
            <div className="flex justify-center mb-4">
              <div className="h-11 w-11 rounded-[4px] bg-[var(--b-sage)]/10 border border-[var(--b-sage)]/40 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[var(--b-sage)]" />
              </div>
            </div>
            <h1 className="brand-display text-2xl font-bold tracking-tight text-[var(--b-ink)]">{t("auth.emailVerified")}</h1>
            <p className="mt-2 text-sm text-[var(--b-ink-soft)]">{t("auth.verifiedRedirect")}</p>
          </div>
        </div>
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
          {/* Header */}
          <p className="auth-card-eyebrow mb-3">§ VERIFY EMAIL</p>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-[4px] bg-[var(--b-navy)]/10 border border-[var(--b-navy)]/20 flex items-center justify-center">
              <Mail className="h-[18px] w-[18px] text-[var(--b-navy)]" />
            </div>
            <h1 className="brand-display text-2xl font-bold tracking-tight text-[var(--b-ink)]">{t("auth.verifyEmail")}</h1>
          </div>
          <p className="text-sm text-[var(--b-ink-soft)] mb-7">
            {t("auth.verifyEmailDesc")}
            {user?.email && <span className="block font-medium text-[var(--b-ink)] mt-1">{user.email}</span>}
          </p>

          {/* Code inputs */}
          <div className="flex justify-center gap-2.5 mb-5" dir="ltr" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="brand-input w-11 h-12 text-center text-xl font-semibold outline-none transition-colors"
                disabled={loading}
                autoFocus={i === 0}
                aria-label={isAr ? `الرقم ${i + 1} من رمز التحقق` : `Verification code digit ${i + 1}`}
                placeholder="0"
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-[var(--b-terracotta)] bg-[var(--b-terracotta)]/[0.08] border border-[var(--b-terracotta)]/30 rounded-[4px] px-3 py-2.5 mb-4">{error}</p>
          )}

          <Button onClick={() => handleCodeSubmit()} className="brand-btn-primary w-full h-11 text-sm font-semibold rounded-[4px]" disabled={loading || code.some((d) => d === "")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.verifyButton")}
          </Button>

          {/* Resend */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-[var(--b-ink-soft)]">{t("auth.didntReceive")}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-[var(--b-navy)] font-semibold gap-1.5 hover:bg-[var(--b-navy)]/[0.06]"
            >
              {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {cooldown > 0 ? `${t("auth.resendIn")} ${cooldown}s` : t("auth.resendCode")}
            </Button>
          </div>

          {/* Go back */}
          <div className="mt-6 pt-5 border-t border-[var(--b-line)]">
            <button type="button" onClick={handleGoBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-[var(--b-ink-soft)] hover:text-[var(--b-navy)] transition-colors">
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t("auth.goBackChangeEmail")}
            </button>
          </div>

          <p className="text-xs text-center text-[var(--b-ink-soft)]/70 mt-4">{t("auth.orClickLink")}</p>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-[var(--b-ink-soft)] relative z-10">&copy; 2026 {isAr ? "نُمُو" : "numu"}</p>
    </div>
  );
}
