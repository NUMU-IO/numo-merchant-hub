/**
 * The trial countdown — one navy strip carrying one tick per remaining day.
 *
 * Days are shown as marks rather than only as a number because the bar
 * visibly empties over the month: a merchant who glances at the top of their
 * dashboard every morning sees it shorten without reading anything. The
 * number is there too, for the mornings they do read.
 *
 * Three tones, on the same shape. Loss aversion is the reason the copy moves
 * rather than the layout: by the last week the merchant has built a catalogue,
 * and "don't lose it" lands where "unlock features" does not.
 *
 * - more than 7 days: navy, saffron ticks, "all features open"
 * - 3 to 7 days:      navy, amber ticks, the lock date named
 * - 2 days or fewer:  terracotta, "your storefront closes to shoppers"
 *
 * Renders nothing unless the tenant is genuinely on a trial with an expiry —
 * `is_on_trial` alone is not enough, since a tenant can be mid-conversion
 * with the lifecycle set and the expiry already cleared.
 */

import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/** Arabic-Indic digits, matching how every other number reads in the Arabic hub. */
function digits(value: number, isAr: boolean): string {
  const latin = String(value);
  return isAr ? latin.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]) : latin;
}

function dayWord(days: number, isAr: boolean): string {
  if (!isAr) return days === 1 ? "day" : "days";
  // Arabic counts in categories, not in singular/plural: 1 يوم, 2 يومان,
  // 3-10 أيام, 11+ يوم. Getting this wrong is the tell of a translated UI.
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  if (days <= 10) return "أيام";
  return "يوم";
}

export function TrialBanner() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";

  if (!tenant?.is_on_trial || tenant.days_remaining === null) return null;

  const daysLeft = Math.max(0, tenant.days_remaining ?? 0);
  const urgency: "low" | "mid" | "high" =
    daysLeft <= 2 ? "high" : daysLeft <= 7 ? "mid" : "low";

  // The full length of this merchant's trial, so the bar is their month and
  // not a fixed 37 — the admin can change the trial length at any time, and a
  // merchant who signed up under the old value keeps the bar they were given.
  const totalDays = Math.max(
    daysLeft,
    tenant.expires_at && tenant.trial_started_at
      ? Math.round(
          (new Date(tenant.expires_at).getTime() -
            new Date(tenant.trial_started_at).getTime()) /
            86_400_000,
        )
      : daysLeft,
  );

  const count = `${digits(daysLeft, isAr)} ${dayWord(daysLeft, isAr)}`;

  const copy = {
    low: {
      title: isAr ? `باقي ${count} في تجربتك` : `${count} left in your trial`,
      body: isAr
        ? "كل المميزات مفتوحة. تقدر تشترك في أي وقت."
        : "Every feature is open. You can subscribe whenever you're ready.",
    },
    mid: {
      title: isAr ? `باقي ${count}` : `${count} left`,
      body: isAr
        ? "بعدها المتجر بيتقفل قدام الزباين لحد ما تختار باقة."
        : "After that your storefront closes to shoppers until you pick a plan.",
    },
    high: {
      title: isAr
        ? daysLeft === 0
          ? "تجربتك بتخلص النهاردة"
          : `باقي ${count}`
        : daysLeft === 0
          ? "Your trial ends today"
          : `${count} left`,
      body: isAr
        ? "شغلك كله محفوظ — بس المتجر هيتقفل قدام الزباين لحد ما تشترك."
        : "Everything you built is kept — your storefront just closes to shoppers until you subscribe.",
    },
  }[urgency];

  const hot = urgency === "high";

  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3.5 text-white shadow-sm ${
        hot
          ? "bg-gradient-to-b from-[#8f2d10] to-[#6d1f09]"
          : "bg-gradient-to-b from-navy to-navy-700"
      }`}
      role={hot ? "alert" : undefined}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
            <h2 className="truncate text-[15px] font-bold">{copy.title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-white/70">{copy.body}</p>

          {/* One mark per day of the trial, filled for the days still left.
              aria-hidden: the count is already stated in the heading above,
              and 37 list items would be read out one by one. */}
          <div className="mt-2.5 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: totalDays }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-sm ${
                  i < daysLeft
                    ? hot
                      ? "bg-[#ff8f6b]"
                      : "bg-saffron"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate("/billing")}
          className="shrink-0 bg-saffron font-semibold text-[#3a2405] hover:bg-saffron/90"
        >
          {isAr
            ? urgency === "low"
              ? "شوف الباقات"
              : "اشترك دلوقتي"
            : urgency === "low"
              ? "See plans"
              : "Subscribe now"}
        </Button>
      </div>
    </div>
  );
}

export default TrialBanner;
