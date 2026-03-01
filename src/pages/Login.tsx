/**
 * Login / Register page for the NUMU merchant dashboard.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
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
import { Loader2, ArrowRight } from "lucide-react";
import numuLogoDark from "@/assets/numu-logo-dark.png";
import numuIcon from "@/assets/numu-icon.png";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل").max(50, "الاسم الأول طويل جدًا"),
  lastName: z.string().min(2, "اسم العائلة يجب أن يكون حرفين على الأقل").max(50, "اسم العائلة طويل جدًا"),
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
});

type FieldErrors = Record<string, string>;

export default function Login() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = isRegister
      ? registerSchema.safeParse({ firstName, lastName, email, password })
      : loginSchema.safeParse({ email, password });

    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register({ email, password, first_name: firstName, last_name: lastName });
        navigate("/verify-email", { replace: true });
      } else {
        await login(email, password);
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -start-10 h-64 w-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 end-10 h-80 w-80 rounded-full bg-primary-foreground/15 blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12 space-y-6">
          <img src={numuLogoDark} alt="NUMU" className="h-16 mx-auto brightness-0 invert" />
          <h2 className="text-3xl font-bold text-primary-foreground">
            {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
          </h2>
          <p className="text-primary-foreground/70 text-sm max-w-sm mx-auto">
            Build, manage, and grow your online store with NUMU — the all-in-one platform for Egyptian merchants.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <img src={numuIcon} alt="NUMU" className="h-12 w-12" />
          </div>

          <Card className="border-0 shadow-[0_2px_12px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
            <CardHeader className="text-center space-y-2 pb-2">
              <CardTitle className="text-2xl font-bold">
                {isRegister ? t("auth.register") : t("auth.login")}
              </CardTitle>
              <CardDescription>
                {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{t("auth.firstName")}</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={`h-11 ${fieldErrors.firstName ? "border-destructive" : ""}`}
                      />
                      {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">{t("auth.lastName")}</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={`h-11 ${fieldErrors.lastName ? "border-destructive" : ""}`}
                      />
                      {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`h-11 ${fieldErrors.email ? "border-destructive" : ""}`}
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`h-11 ${fieldErrors.password ? "border-destructive" : ""}`}
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-2">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isRegister ? t("auth.register") : t("auth.login")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-sm text-center text-muted-foreground pt-2">
                  {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsRegister(!isRegister); setError(null); setFieldErrors({}); }}
                    className="text-primary font-semibold hover:underline"
                  >
                    {isRegister ? t("auth.login") : t("auth.register")}
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            NUMU © 2026 — All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
