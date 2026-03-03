/**
 * Email verification page — shown after registration.
 * Supports two verification methods:
 *   1. Entering a 6-digit code from the email
 *   2. Clicking the verification link in the email (handled via ?token= query param)
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  verifyEmailByCode,
  verifyEmailByToken,
  resendVerificationEmail,
} from "@/services/authApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import numuIcon from "@/assets/numu-icon.png";

export default function VerifyEmail() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If user is already verified, redirect away
  useEffect(() => {
    if (user?.is_verified) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // Handle token-based verification from email link
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      handleTokenVerification(token);
    }
  }, [searchParams]);

  // Cooldown timer for resend
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
      setError(err.message || "Verification link is invalid or expired");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(codeOverride?: string[]) {
    const fullCode = (codeOverride ?? code).join("");
    if (fullCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
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
      setError(err.message || "Invalid or expired code");
      // Clear code on error
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
      setError(err.message || "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  }

  function handleCodeChange(index: number, value: string) {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newCode.every((d) => d !== "")) {
      setTimeout(() => handleCodeSubmit(newCode), 100);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleCodeSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setCode(newCode);

    // Focus the next empty input or the last one
    const nextEmpty = newCode.findIndex((d) => d === "");
    inputRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();

    // Auto-submit if complete
    if (pasted.length === 6) {
      setTimeout(() => handleCodeSubmit(newCode), 100);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-0 shadow-[0_2px_12px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.04)]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Email Verified!</h2>
            <p className="text-sm text-muted-foreground">
              Your email has been verified successfully. Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={numuIcon} alt="NUMU" className="h-12 w-12" />
        </div>

        <Card className="border-0 shadow-[0_2px_12px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription className="text-sm">
              We sent a 6-digit verification code to{" "}
              <span className="font-semibold text-foreground">{user?.email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Code input */}
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
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
                  className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg
                    bg-background text-foreground
                    border-border focus:border-primary focus:ring-2 focus:ring-primary/20
                    outline-none transition-all"
                  disabled={loading}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-2">
                {error}
              </p>
            )}

            {/* Verify button */}
            <Button
              onClick={handleCodeSubmit}
              className="w-full h-11 text-sm font-semibold"
              disabled={loading || code.some((d) => d === "")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify Email"
              )}
            </Button>

            {/* Resend */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-primary font-semibold gap-1.5"
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </Button>
            </div>

            {/* Info */}
            <p className="text-xs text-center text-muted-foreground">
              You can also click the verification link in the email
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          NUMU © 2026 — All rights reserved
        </p>
      </div>
    </div>
  );
}
