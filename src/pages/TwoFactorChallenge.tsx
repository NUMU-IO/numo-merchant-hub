/**
 * Two-Factor Authentication challenge page.
 *
 * Shown after a successful password login when the account has 2FA enabled.
 * The user must enter their TOTP code (or backup code) to receive full auth cookies.
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { completeTwoFactorLogin } from "@/services/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import { NumuIcon } from "@/components/NumuLogo";

export default function TwoFactorChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  // Challenge token is passed via navigate state from Login.tsx
  const challengeToken = (location.state as { challengeToken?: string } | null)
    ?.challengeToken;

  const [otpCode, setOtpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // If no challenge token, redirect to login
  useEffect(() => {
    if (!challengeToken) {
      navigate("/login", { replace: true });
    }
  }, [challengeToken, navigate]);

  useEffect(() => {
    if (useBackup) {
      backupInputRef.current?.focus();
    }
  }, [useBackup]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!challengeToken) return;

    const code = useBackup ? backupCode.trim() : otpCode;
    if (!code || (!useBackup && code.length < 6)) return;

    setLoading(true);
    setError(null);

    try {
      await completeTwoFactorLogin(challengeToken, code);
      // Cookies are now set — load the user
      await refreshUser();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Verification failed. Try again.",
      );
      setOtpCode("");
      setBackupCode("");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 TOTP digits are entered
  const handleOtpChange = (value: string) => {
    setOtpCode(value);
    setError(null);
    if (value.length === 6) {
      // Submit on next tick so state updates first
      setTimeout(() => handleSubmit(), 0);
    }
  };

  if (!challengeToken) return null;

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-16 -start-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute bottom-16 end-8 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
          <div className="absolute top-1/2 start-1/3 h-48 w-48 rounded-full bg-primary-foreground/8 blur-2xl" />
        </div>
        <div className="relative z-10 text-center px-12 space-y-8 max-w-md">
          {/* Animated shield icon */}
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-primary-foreground/15 border border-primary-foreground/20">
              <ShieldCheck className="h-12 w-12 text-primary-foreground/80" />
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-3xl animate-ping bg-primary-foreground/10" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-wider text-primary-foreground">
              NUMU
            </h1>
            <p className="text-primary-foreground/60 text-sm leading-relaxed max-w-xs mx-auto">
              Two-factor authentication keeps your account safe. Enter the code
              from your authenticator app to continue.
            </p>
          </div>
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5 text-primary-foreground/40 text-xs">
              <div className="h-5 w-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold text-primary-foreground/60">
                ✓
              </div>
              Password
            </div>
            <div className="h-px w-6 bg-primary-foreground/20" />
            <div className="flex items-center gap-1.5 text-primary-foreground/80 text-xs font-medium">
              <div className="h-5 w-5 rounded-full bg-primary-foreground/30 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                2
              </div>
              Verification
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <NumuIcon size={44} />
          </div>

          <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
            <CardHeader className="text-center space-y-1 pb-1 pt-8">
              <div className="flex justify-center mb-3">
                <div className="rounded-2xl bg-primary/10 p-3">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Verify your identity
              </CardTitle>
              <CardDescription className="text-sm">
                {useBackup
                  ? "Enter one of your saved backup codes"
                  : "Enter the 6-digit code from your authenticator app"}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {!useBackup ? (
                  /* TOTP OTP input */
                  <div className="flex flex-col items-center gap-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider self-start">
                      Authentication code
                    </Label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={handleOtpChange}
                      disabled={loading}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                        <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                        <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                        <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                        <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="text-xs text-muted-foreground text-center">
                      Code submits automatically when complete
                    </p>
                  </div>
                ) : (
                  /* Backup code input */
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="backupCode"
                      className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Backup code
                    </Label>
                    <Input
                      id="backupCode"
                      ref={backupInputRef}
                      value={backupCode}
                      onChange={(e) => {
                        setBackupCode(e.target.value);
                        setError(null);
                      }}
                      placeholder="XXXX-XXXX or XXXXXXXX"
                      className="h-12 rounded-xl bg-muted/30 border-border/50 font-mono tracking-widest text-center"
                      disabled={loading}
                    />
                  </div>
                )}

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                    {error}
                  </div>
                )}

                {/* Submit button — only shown for backup codes (TOTP auto-submits) */}
                {useBackup && (
                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-bold gap-2 rounded-xl"
                    disabled={loading || backupCode.trim().length < 6}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Verify code
                        <ShieldCheck className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}

                {/* Loading indicator for TOTP auto-submit */}
                {!useBackup && loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </div>
                )}

                {/* Toggle between TOTP and backup code */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackup(!useBackup);
                      setError(null);
                      setOtpCode("");
                      setBackupCode("");
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 font-medium"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {useBackup
                      ? "Use authenticator app instead"
                      : "Use a backup code instead"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Back to login */}
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60 font-medium tracking-wide">
            NUMU © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
