/**
 * Waitlist — public page for merchants to join the beta waitlist.
 * No auth required.
 */

import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { joinWaitlist, getWaitlistStats } from "@/services/waitlistApi";
import type { WaitlistStatsResponse } from "@/services/waitlistApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  Users,
  Rocket,
  Copy,
  Check,
} from "lucide-react";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email("أدخل بريد إلكتروني صحيح"),
  name: z.string().min(2, "الاسم مطلوب").optional().or(z.literal("")),
});

export default function Waitlist() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resultReferralCode, setResultReferralCode] = useState("");
  const [resultPosition, setResultPosition] = useState(0);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<WaitlistStatsResponse | null>(null);

  // Extract referral code from URL ?ref=XXXX
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams]);

  // Fetch public stats
  useEffect(() => {
    getWaitlistStats().then(setStats).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = waitlistSchema.safeParse({ email, name: name || undefined });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await joinWaitlist({
        email,
        name: name || undefined,
        referral_code: referralCode || undefined,
        source: "waitlist_page",
      });
      setResultReferralCode(res.referral_code);
      setResultPosition(res.position);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message: string }).message));
      } else {
        setError(isAr ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong, try again");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `https://numueg.app/?ref=${resultReferralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (submitted) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4">
        <div className="w-full max-w-[460px]">
          <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {isAr ? "أنت على القائمة!" : "You're on the list!"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {isAr
                ? "هنبعتلك إيميل لما يجيلك الدور. شارك الكود عشان تطلع في القائمة!"
                : "We'll email you when it's your turn. Share your code to move up!"}
            </p>

            {/* Position */}
            <div className="rounded-xl border p-4 mb-4">
              <p className="text-xs text-muted-foreground mb-1">{isAr ? "ترتيبك" : "Your position"}</p>
              <p className="text-3xl font-bold tabular-nums">#{resultPosition}</p>
            </div>

            {/* Referral code + share */}
            <div className="rounded-xl border p-4 mb-6">
              <p className="text-xs text-muted-foreground mb-2">{isAr ? "كود الإحالة الخاص بك" : "Your referral code"}</p>
              <p className="text-xl font-bold font-mono tracking-widest mb-3">{resultReferralCode}</p>
              <Button size="sm" variant="outline" className="gap-2" onClick={copyReferralLink}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? (isAr ? "تم النسخ!" : "Copied!") : (isAr ? "نسخ رابط الإحالة" : "Copy referral link")}
              </Button>
            </div>

            <Link to="/login" className="text-sm text-primary hover:underline">
              {isAr ? "لديك كود دعوة؟ سجّل الآن" : "Have an invite code? Sign up now"} →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen auth-page auth-dot-grid relative flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* ── Brand text — lg+ ── */}
      <div className="hidden lg:block fixed start-10 xl:start-14 top-10 xl:top-14 bottom-10 xl:bottom-14 w-[320px] z-10">
        <div className="h-full flex flex-col justify-between">
          <span className="text-base font-black tracking-[0.18em] text-primary-foreground/70">NUMU</span>
          <div className="max-w-[280px]">
            <h2 className="text-[1.85rem] font-semibold text-primary-foreground leading-[1.25] tracking-tight">
              {isAr ? "متجرك\nبأسلوبك." : "Your store,\nyour way."}
            </h2>
            <div className="w-8 h-px bg-primary-foreground/20 mt-6 mb-5" />
            <p className="text-primary-foreground/40 text-[13px] leading-relaxed">
              {isAr
                ? "نحن في مرحلة البيتا الخاصة. انضم لقائمة الانتظار واحصل على وصول مبكر."
                : "We're in private beta. Join the waitlist for early access to the platform."}
            </p>

            {/* Social proof */}
            {stats && (
              <div className="flex items-center gap-4 mt-6">
                <div className="flex items-center gap-1.5 text-primary-foreground/30">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs">{stats.total_signups} {isAr ? "تاجر مسجل" : "merchants waiting"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-primary-foreground/30">
                  <Rocket className="h-3.5 w-3.5" />
                  <span className="text-xs">{stats.stores_launched} {isAr ? "متجر مفتوح" : "stores launched"}</span>
                </div>
              </div>
            )}
          </div>
          <p className="text-primary-foreground/20 text-[11px]">&copy; 2026 NUMU</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="w-full max-w-[460px] lg:ms-auto lg:me-[8%] xl:me-[12%]">
        <div className="auth-glass rounded-2xl p-7 sm:p-9 auth-enter">
          <div className="lg:hidden mb-6 flex justify-center">
            <span className="text-base font-black tracking-[0.18em] text-white/70">NUMU</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            {isAr ? "انضم لقائمة الانتظار" : "Join the Waitlist"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground mb-7">
            {isAr
              ? "سجّل بريدك واحصل على وصول مبكر لمنصة NUMU."
              : "Sign up to get early access to the NUMU platform."}
          </p>

          {/* Mobile social proof */}
          {stats && (
            <div className="lg:hidden flex items-center gap-4 mb-5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">{stats.total_signups} {isAr ? "مسجل" : "waiting"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Rocket className="h-3.5 w-3.5" />
                <span className="text-xs">{stats.stores_launched} {isAr ? "متجر" : "launched"}</span>
              </div>
            </div>
          )}

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{isAr ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-lg"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{isAr ? "الاسم" : "Name"} <span className="text-muted-foreground">({isAr ? "اختياري" : "optional"})</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isAr ? "اسمك" : "Your name"}
                className="h-11 rounded-lg"
              />
            </div>

            {referralCode && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 border border-emerald-200/30 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {isAr ? `تمت الإحالة بواسطة: ${referralCode}` : `Referred by: ${referralCode}`}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/[0.04] border border-destructive/10 rounded-lg px-3 py-2.5">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2 rounded-lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  {isAr ? "انضم للقائمة" : "Join Waitlist"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/30 text-center">
            <p className="text-sm text-muted-foreground">
              {isAr ? "لديك كود دعوة؟" : "Already have an invite code?"}
              {" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {isAr ? "سجّل الآن" : "Sign up here"} →
              </Link>
            </p>
          </div>
        </div>

        <p className="lg:hidden text-center text-[11px] text-primary-foreground/30 mt-6">&copy; 2026 NUMU</p>
      </div>
    </div>
  );
}
