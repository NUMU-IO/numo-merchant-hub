/**
 * Email verification page — shown after registration.
 * Supports 6-digit code entry and token-based verification from email link.
 * Includes "go back to change email" option.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  verifyEmailByCode, verifyEmailByToken, resendVerificationEmail,
} from "@/services/authApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { NumuIcon } from "@/components/NumuLogo";

export default function VerifyEmail() {
  const { t } = useTranslation();
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
    } catch (err: any) {
      setError(err.message || t("auth.invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(codeOverride?: string[]) {
    const fullCode = (codeOverride ?? code).join("");
    if (fullCode.length !== 6) {
      setError(t("auth.invalidCode"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyEmailByCode(fullCode);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: any) {
      setError(err.message || t("auth.invalidCode"));
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
    } catch (err: any) {
      setError(err.message || "Failed to resend");
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] rounded-2xl">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t("auth.emailVerified")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.verifiedRedirect")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <NumuIcon size={44} />
        </div>

        <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
          <CardHeader className="text-center space-y-3 pb-2 pt-8">
            <div className="mx-auto w-14 h-14 bg-primary/8 rounded-2xl flex items-center justify-center">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">{t("auth.verifyEmail")}</CardTitle>
            <CardDescription className="text-sm">
              {t("auth.verifyEmailDesc")}
              {user?.email && (
                <span className="block font-semibold text-foreground mt-1">{user.email}</span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            {/* Code inputs */}
            <div className="flex justify-center gap-2.5" dir="ltr" onPaste={handlePaste}>
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
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl
                    bg-muted/30 text-foreground
                    border-2 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20
                    outline-none transition-all"
                  disabled={loading}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                {error}
              </div>
            )}

            <Button
              onClick={() => handleCodeSubmit()}
              className="w-full h-12 text-sm font-bold rounded-xl"
              disabled={loading || code.some((d) => d === "")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.verifyButton")}
            </Button>

            {/* Resend */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">{t("auth.didntReceive")}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-primary font-semibold gap-1.5"
              >
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {cooldown > 0 ? `${t("auth.resendIn")} ${cooldown}s` : t("auth.resendCode")}
              </Button>
            </div>

            {/* Go back to change email */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={handleGoBack}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("auth.goBackChangeEmail")}
              </button>
            </div>

            <p className="text-xs text-center text-muted-foreground/60">
              {t("auth.orClickLink")}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60 font-medium tracking-wide">
          NUMU © 2026
        </p>
      </div>
    </div>
  );
}
