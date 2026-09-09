/**
 * The one-time welcome that explains the trial.
 *
 * Leads with the number, because the length of the trial is the offer. Then
 * what it includes, then — plainly — what happens on the day after it ends.
 * The lock is stated here rather than discovered later: a merchant who finds
 * out their storefront closed by seeing it closed has been ambushed, and the
 * banner's escalation only reads as fair if this said so on day one.
 *
 * Shown on the first hub load of a trialling tenant, then never again.
 * Acknowledgement lives in localStorage keyed by tenant, the same trade-off
 * `FounderWelcomeDialog` documents: a nicety, not a record. It may show again
 * on a new browser, which harms nobody; a server-side flag is the fix if it
 * ever has to be exactly-once.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const seenKey = (tenantId: string) => `numu.trial.welcomed.${tenantId}`;

function digits(value: number, isAr: boolean): string {
  return isAr
    ? String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])
    : String(value);
}

export function TrialWelcomeDialog() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);

  const onTrial = Boolean(tenant?.is_on_trial) && tenant?.days_remaining !== null;
  const tenantId = tenant?.id ?? null;

  useEffect(() => {
    if (!onTrial || !tenantId) return;

    // `?trial=welcome` forces it open regardless of the seen flag — once-only
    // state is invisible from the outside, so without this there is no way to
    // tell a broken condition from a flag set on a load nobody noticed.
    const forced =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("trial") === "welcome";

    if (!forced) {
      try {
        if (localStorage.getItem(seenKey(tenantId)) === "1") return;
      } catch {
        // Private mode / storage disabled: show it rather than crash.
      }
    }
    setOpen(true);
  }, [onTrial, tenantId]);

  const dismiss = () => {
    setOpen(false);
    if (!tenantId) return;
    try {
      localStorage.setItem(seenKey(tenantId), "1");
    } catch {
      /* nothing to do — it will simply show again */
    }
  };

  if (!onTrial) return null;

  const days = Math.max(0, tenant?.days_remaining ?? 0);
  const included = isAr
    ? ["منتجات ومخزون", "دفع أونلاين وكاش", "شحن بوسطة", "واتساب", "المساعد الذكي"]
    : ["Products & stock", "Online + cash payments", "Bosta shipping", "WhatsApp", "AI assistant"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent
        className="max-w-md overflow-hidden border-0 p-0"
        aria-label={isAr ? "أهلاً بيك في نُمُو" : "Welcome to NUMU"}
      >
        <div className="relative bg-gradient-to-b from-navy to-navy-900 px-6 pb-6 pt-8 text-center text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(115% 130% at 92% -10%, hsl(var(--saffron) / 0.22), transparent 58%)",
            }}
          />
          <div className="relative">
            <p className="text-[62px] font-bold leading-none tracking-tight text-saffron tabular-nums">
              {digits(days, isAr)}
            </p>
            <p className="mt-1.5 text-[13px] text-white/70">
              {isAr
                ? "يوم تجربة مجانية — كل المميزات مفتوحة"
                : "days of free trial — every feature open"}
            </p>
          </div>
        </div>

        <div className="px-6 pb-2 pt-5">
          <h2 className="text-lg font-bold">
            {isAr ? "أهلاً بيك في نُمُو" : "Welcome to NUMU"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isAr
              ? "ابني متجرك، ضيف منتجاتك، اربط الدفع والشحن، وابدأ تبيع. من غير بطاقة ائتمان."
              : "Build your store, add products, connect payments and shipping, and start selling. No credit card."}
          </p>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {included.map((item) => (
              <span
                key={item}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>

          {/* Said on day one, so the lock is never a surprise on day 38. */}
          <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "بعد ما التجربة تخلص، المتجر بيتقفل قدام الزباين وشغلك كله بيفضل محفوظ. تختار باقة أو «ادفع وأنت تنمو» وتفتح تاني في ثانية."
              : "When the trial ends, your storefront closes to shoppers and everything you built is kept. Pick a plan or Pay as you Grow and it reopens instantly."}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-3.5">
          <button
            type="button"
            onClick={() => {
              dismiss();
              navigate("/billing");
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {isAr ? "شوف الباقات" : "See plans"}
          </button>
          <Button
            onClick={dismiss}
            className="bg-saffron font-semibold text-[#3a2405] hover:bg-saffron/90"
          >
            {isAr ? "يلا نبدأ" : "Let's start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TrialWelcomeDialog;
