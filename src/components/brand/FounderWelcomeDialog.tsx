/**
 * One-time congratulations when a merchant is made a founder.
 *
 * Fires on the first hub load after the badge is granted, then never again.
 *
 * Acknowledgement lives in localStorage keyed by tenant, which is honest
 * about what it is: a nicety, not a record. It will show a second time on a
 * new browser or after clearing site data. That tradeoff is deliberate —
 * the alternative is a server-side "seen" flag and a migration for a modal
 * nobody is harmed by seeing twice. If it ever needs to be exactly-once,
 * that flag is the fix, not more client-side bookkeeping.
 */

import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useFounderCohort } from "@/hooks/useFounderCohort";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const KHATAM_PATH =
  "M50.00 2.00 64.06 16.06 83.94 16.06 83.94 35.94 98.00 50.00 83.94 64.06 " +
  "83.94 83.94 64.06 83.94 50.00 98.00 35.94 83.94 16.06 83.94 16.06 64.06 " +
  "2.00 50.00 16.06 35.94 16.06 16.06 35.94 16.06Z";

const seenKey = (tenantId: string) => `numu.founder.welcomed.${tenantId}`;

export function FounderWelcomeDialog() {
  const { tenant } = useAuth();
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);

  const cohort = useFounderCohort();
  const tenantId = tenant?.id ?? null;

  useEffect(() => {
    if (!cohort || !tenantId) return;

    // `?founder=welcome` forces it open regardless of the seen flag.
    // Once-only state is invisible from the outside: when someone reports
    // "the dialog never appeared", there is otherwise no way to tell a
    // broken condition from a flag that was already set on a load they
    // did not notice. This makes it checkable in one URL.
    const forced =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("founder") === "welcome";

    if (!forced) {
      try {
        if (localStorage.getItem(seenKey(tenantId)) === "1") return;
      } catch {
        // Private mode / storage disabled: show it, don't crash. Seeing
        // this once per session beats a blank screen.
      }
    }
    setOpen(true);
  }, [cohort, tenantId]);

  const dismiss = () => {
    setOpen(false);
    if (!tenantId) return;
    try {
      localStorage.setItem(seenKey(tenantId), "1");
    } catch {
      /* nothing to do — it will simply show again */
    }
  };

  if (!cohort) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent
        className="max-w-md overflow-hidden border-0 p-0"
        aria-label={isAr ? "تاجر مؤسس" : "Founder merchant"}
      >
        <div className="relative bg-navy-900 px-8 pb-8 pt-10 text-center text-cream">
          {/* Warm corner light, so the panel reads as a certificate rather
              than a flat dark modal. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(115% 130% at 92% -10%, hsl(var(--saffron) / 0.22), transparent 58%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-xl border border-saffron/30"
          />

          <div className="relative">
            <svg
              viewBox="0 0 100 100"
              aria-hidden="true"
              className="mx-auto mb-5 h-20 w-20"
            >
              <path d={KHATAM_PATH} className="fill-saffron" />
              <circle
                cx="50"
                cy="50"
                r="30"
                className="fill-none stroke-navy-900"
                strokeWidth="1.5"
              />
              <circle cx="50" cy="50" r="7" className="fill-navy-900" />
            </svg>

            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-saffron">
              Founder Merchant
            </p>
            <h2 className="mt-2 font-brand text-3xl font-semibold">
              {isAr ? "تاجر مؤسس" : "Founder merchant"}
            </h2>
            <p className="mt-1 text-[17px] text-cream/90">
              {currentStore?.name}
            </p>

            <p className="mx-auto mt-4 max-w-[34ch] text-[13px] leading-relaxed text-cream/70">
              {isAr
                ? "إنت من أوائل التجار اللي فتحوا على نُمو. الشارة دي هتفضل على متجرك — علامة إنك كنت هنا من البداية."
                : "You are one of the first merchants on NUMU. This badge stays on your store — a mark that you were here from the start."}
            </p>

            <div className="mt-6 flex items-center justify-center gap-8 border-t border-saffron/20 pt-5 text-[12px] text-cream/60">
              <span>
                {isAr ? "الفوج" : "Class of"}
                <b className="block font-mono text-[15px] tabular-nums text-cream ltr:text-left rtl:text-right">
                  {cohort}
                </b>
              </span>
              <span>
                {isAr ? "الصفة" : "Status"}
                <b className="block text-[15px] font-semibold text-cream">
                  {isAr ? "دائمة" : "Permanent"}
                </b>
              </span>
            </div>

            <Button
              onClick={dismiss}
              className="mt-7 w-full bg-saffron text-navy-900 hover:bg-saffron-600"
            >
              {isAr ? "تمام" : "Got it"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
