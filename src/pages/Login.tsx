/**
 * Login / Register page for the NUMU merchant dashboard.
 * Clean, premium split-panel layout with geometric logo.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { NumuLogo, NumuIcon } from "@/components/NumuLogo";
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
  const [showPassword, setShowPassword] = useState(false);

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

  const inputClass = (field: string) =>
    `h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${
      fieldErrors[field] ? "border-destructive focus:border-destructive" : ""
    }`;

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden items-center justify-center">
        {/* Soft gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-16 -start-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute bottom-16 end-8 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
          <div className="absolute top-1/2 start-1/3 h-48 w-48 rounded-full bg-primary-foreground/8 blur-2xl" />
        </div>
        {/* Content */}
        <div className="relative z-10 text-center px-12 space-y-8 max-w-md">
          {/* Geometric shapes mimicking Mrkoon style */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex gap-2 justify-center mb-2">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20" />
                <div className="w-10 h-10 rounded-lg bg-primary-foreground/15" />
              </div>
              <div className="flex gap-2 justify-center">
                <div className="w-11 h-11 rounded-xl bg-primary-foreground/25" />
                <div className="w-11 h-11 rounded-full bg-primary-foreground/18" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-wider text-primary-foreground">
              NUMU
            </h1>
            <p className="text-primary-foreground/60 text-sm leading-relaxed max-w-xs mx-auto">
              {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
            </p>
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
              <CardTitle className="text-2xl font-bold tracking-tight">
                {isRegister ? t("auth.register") : t("auth.login")}
              </CardTitle>
              <CardDescription className="text-sm">
                {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <form noValidate onSubmit={handleSubmit} className="space-y-5 mt-4">
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("auth.firstName")}
                      </Label>
                      <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass("firstName")} />
                      {fieldErrors.firstName && <p className="text-[11px] text-destructive">{fieldErrors.firstName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("auth.lastName")}
                      </Label>
                      <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass("lastName")} />
                      {fieldErrors.lastName && <p className="text-[11px] text-destructive">{fieldErrors.lastName}</p>}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("auth.email")}
                  </Label>
                  <Input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass("email")}
                  />
                  {fieldErrors.email && <p className="text-[11px] text-destructive">{fieldErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("auth.password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password" type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`${inputClass("password")} pe-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-[11px] text-destructive">{fieldErrors.password}</p>}
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 rounded-xl p-3 border border-destructive/15">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-sm font-bold gap-2 rounded-xl" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isRegister ? t("auth.register") : t("auth.login")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-sm text-center text-muted-foreground pt-1">
                  {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsRegister(!isRegister); setError(null); setFieldErrors({}); }}
                    className="text-primary font-bold hover:underline underline-offset-2"
                  >
                    {isRegister ? t("auth.login") : t("auth.register")}
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground/60 font-medium tracking-wide">
            NUMU © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
