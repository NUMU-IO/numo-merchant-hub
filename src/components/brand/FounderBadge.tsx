/**
 * Founder-merchant badge.
 *
 * The mark is a khatam — the {8/2} star polygon, two overlapping squares.
 * Not the tick-in-a-circle every platform uses for verification: a tick
 * says "we confirmed who this is", which is a different claim entirely,
 * and letting the two look alike would cost verification its meaning.
 *
 * `cohort` is the merchant's JOIN YEAR, never a rank. A rank tells merchant
 * #42 that 41 came before them, publishing the platform's size to every
 * merchant and — once this reaches a storefront — every shopper. A year
 * carries the same "I was here early" meaning and reveals nothing.
 */

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

/** Computed, not eyeballed: inner radius is cos(45°)/cos(22.5°) × outer. */
const KHATAM_PATH =
  "M50.00 2.00 64.06 16.06 83.94 16.06 83.94 35.94 98.00 50.00 83.94 64.06 " +
  "83.94 83.94 64.06 83.94 50.00 98.00 35.94 83.94 16.06 83.94 16.06 64.06 " +
  "2.00 50.00 16.06 35.94 16.06 16.06 35.94 16.06Z";

export type FounderBadgeSize = "mark" | "chip" | "seal";

interface FounderBadgeProps {
  /** Join year, e.g. "2025". Null/undefined renders nothing. */
  cohort?: string | null;
  size?: FounderBadgeSize;
  className?: string;
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d={KHATAM_PATH} fill="currentColor" />
    </svg>
  );
}

export function FounderBadge({
  cohort,
  size = "chip",
  className,
}: FounderBadgeProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  // No cohort = not a founder. Render nothing rather than an empty shell.
  if (!cohort) return null;

  const label = isAr ? "تاجر مؤسس" : "Founder merchant";

  // Order rows and other tight spots: the mark alone. A title is the only
  // affordance that fits, and the merchant already knows it from the hub.
  if (size === "mark") {
    return (
      <span
        title={label}
        aria-label={label}
        role="img"
        className={cn("inline-flex text-saffron", className)}
      >
        <Mark className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (size === "seal") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-3 rounded-xl bg-navy-900 px-5 py-3 text-cream",
          className,
        )}
      >
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="h-10 w-10 shrink-0"
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
        <span>
          <span className="block font-brand text-[15px] leading-snug">
            {isAr ? "من أوائل التجار على نُمو" : "One of NUMU's first merchants"}
          </span>
          <span className="block text-[11.5px] leading-snug text-cream/70">
            {isAr ? `فوج ${cohort}` : `Class of ${cohort}`}
          </span>
        </span>
      </span>
    );
  }

  // Default chip. A 7px radius, not a full pill: at this size next to a
  // store name a pill reads as a button, and this is a label.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md",
        "border border-saffron/25 bg-saffron/[0.13] px-2 py-0.5",
        "text-[11.5px] font-semibold leading-normal",
        "text-saffron-600 dark:text-saffron",
        className,
      )}
    >
      <Mark className="h-3 w-3" />
      {label}
    </span>
  );
}
