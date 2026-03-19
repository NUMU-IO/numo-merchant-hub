import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { NumuIcon } from "@/components/NumuLogo";
import { resetPassword } from "@/services/authApi";

export default function ResetPassword() {
  const { t } = useTranslation();
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

    if (password.length < 12) {
      setError(t("auth.passwordMinLength", "Password must be at least 12 characters"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch", "Passwords don't match"));
      return;
    }

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

  const inputCls =
    "h-11 rounded-lg bg-transparent border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors";

  /* ── Invalid / expired token ── */
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-[380px] auth-enter text-center">
          <div className="flex justify-center mb-10">
            <NumuIcon size={36} />
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-11 w-11 rounded-full bg-destructive/[0.06] flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("auth.invalidResetLink", "Invalid or expired reset link")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.requestNewLink", "Please request a new password reset link.")}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-6 gap-1.5 rounded-lg">
            <Link to="/forgot-password">
              {t("auth.forgotPassword", "Forgot Password")}
            </Link>
          </Button>
        </div>
        <p className="mt-auto pt-10 text-[11px] text-muted-foreground/40">
          &copy; 2026 NUMU
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-[380px] auth-enter">
        <div className="flex justify-center mb-10">
          <NumuIcon size={36} />
        </div>

        {success ? (
          /* ── Success state ── */
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-11 w-11 rounded-full bg-emerald-500/[0.08] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("auth.passwordReset", "Password Reset")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("auth.canNowLogin", "You can now log in with your new password.")}
            </p>
            <Button asChild className="w-full h-11 text-sm font-semibold rounded-lg mt-7">
              <Link to="/login">
                {t("auth.login")}
              </Link>
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("auth.newPassword", "Set New Password")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground mb-7">
              {t("auth.newPasswordDesc", "Enter your new password below.")}
            </p>

            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  {t("auth.newPassword", "New Password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`${inputCls} pe-10`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[13px] font-medium">
                  {t("auth.confirmPassword", "Confirm Password")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-lg mt-1"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("auth.resetPassword", "Reset Password")
                )}
              </Button>

              <Link
                to="/login"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors justify-center pt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("auth.backToLogin", "Back to Login")}
              </Link>
            </form>
          </div>
        )}
      </div>

      <p className="mt-auto pt-10 text-[11px] text-muted-foreground/40">
        &copy; 2026 NUMU
      </p>
    </div>
  );
}
