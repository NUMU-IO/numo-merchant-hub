import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { NumuIcon } from "@/components/NumuLogo";
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex justify-center">
          <NumuIcon size={44} />
        </div>

        <Card className="border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] rounded-2xl">
          <CardHeader className="text-center space-y-1 pb-1 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {sent ? (t("auth.checkEmail", "Check your email")) : (t("auth.forgotPassword", "Forgot Password"))}
            </CardTitle>
            <CardDescription className="text-sm">
              {sent
                ? t("auth.resetLinkSent", "We've sent a password reset link to your email address.")
                : t("auth.forgotPasswordDesc", "Enter your email and we'll send you a reset link.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {sent ? (
              <div className="space-y-5 mt-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    {t("auth.resetEmailNote", "If an account exists with that email, you'll receive a reset link shortly.")}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full h-12 text-sm font-bold gap-2 rounded-xl">
                  <Link to="/login">
                    <ArrowLeft className="h-4 w-4" />
                    {t("auth.backToLogin", "Back to Login")}
                  </Link>
                </Button>
              </div>
            ) : (
              <form noValidate onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("auth.email")}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ps-10"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-sm font-bold gap-2 rounded-xl" disabled={loading || !email}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("auth.sendResetLink", "Send Reset Link")
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
