import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { forgotPassword } from "@/services/authApi";

export default function ForgotPassword() {
  const { t } = useTranslation();
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
    <div className="min-h-screen auth-page auth-dot-grid flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          {sent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-11 w-11 rounded-full bg-emerald-500/[0.08] flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t("auth.checkEmail", "Check your email")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
                {t("auth.resetEmailNote", "If an account exists with that email, you'll receive a reset link shortly.")}
              </p>
              <Button asChild variant="outline" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg mt-7">
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4" />
                  {t("auth.backToLogin", "Back to Login")}
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {t("auth.forgotPassword", "Forgot Password")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground mb-7">
                {t("auth.forgotPasswordDesc", "Enter your email and we'll send you a reset link.")}
              </p>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium">{t("auth.email")}</Label>
                  <Input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-11 rounded-lg border-border/70 placeholder:text-muted-foreground/40 focus:border-foreground focus:ring-1 focus:ring-foreground/5 transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">{error}</p>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg" disabled={loading || !email}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t("auth.sendResetLink", "Send Reset Link")}<ArrowRight className="h-4 w-4" /></>}
                </Button>

                <Link to="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors justify-center pt-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("auth.backToLogin", "Back to Login")}
                </Link>
              </form>
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-[11px] text-primary-foreground/25">&copy; 2026 NUMU</p>
    </div>
  );
}
