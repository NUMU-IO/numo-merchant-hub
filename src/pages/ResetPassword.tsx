import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="flex justify-center">
            <NumuIcon size={44} />
          </div>
          <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
            <CardContent className="px-6 py-10">
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-sm font-medium">{t("auth.invalidResetLink", "Invalid or expired reset link")}</p>
                <p className="text-xs text-muted-foreground text-center">
                  {t("auth.requestNewLink", "Please request a new password reset link.")}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5 rounded-lg">
                  <Link to="/forgot-password">
                    {t("auth.forgotPassword", "Forgot Password")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex justify-center">
          <NumuIcon size={44} />
        </div>

        <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
          <CardHeader className="text-center space-y-1 pb-1 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {success ? t("auth.passwordReset", "Password Reset") : t("auth.newPassword", "Set New Password")}
            </CardTitle>
            <CardDescription className="text-sm">
              {success
                ? t("auth.passwordResetSuccess", "Your password has been reset successfully.")
                : t("auth.newPasswordDesc", "Enter your new password below.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {success ? (
              <div className="space-y-5 mt-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {t("auth.canNowLogin", "You can now log in with your new password.")}
                  </p>
                </div>
                <Button asChild className="w-full h-12 text-sm font-bold gap-2 rounded-xl">
                  <Link to="/login">
                    {t("auth.login")}
                  </Link>
                </Button>
              </div>
            ) : (
              <form noValidate onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("auth.newPassword", "New Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-primary/20 transition-all pe-10"
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("auth.confirmPassword", "Confirm Password")}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-sm font-bold gap-2 rounded-xl" disabled={loading || !password || !confirmPassword}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("auth.resetPassword", "Reset Password")
                  )}
                </Button>

                <p className="text-sm text-center text-muted-foreground pt-1">
                  <Link to="/login" className="text-primary font-bold hover:underline underline-offset-2 inline-flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t("auth.backToLogin", "Back to Login")}
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60 font-medium tracking-wide">
          NUMU &copy; 2026
        </p>
      </div>
    </div>
  );
}
