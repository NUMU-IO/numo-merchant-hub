import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CaretRight } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getHealthScore } from "@/services/analyticsApi";
import { NavItemGate } from "@/components/layout/NavItemGate";
import { cn } from "@/lib/utils";

const GRADE_LABEL: Record<string, { en: string; ar: string }> = {
  A: { en: "Excellent", ar: "ممتاز" },
  B: { en: "Great", ar: "كويس" },
  C: { en: "Okay", ar: "مقبول" },
  D: { en: "Needs work", ar: "محتاج تحسين" },
};

/**
 * Zid-style sidebar footer banner (sits above the store switcher): a
 * small score ring, "Store health" and the grade, chevron → /health-score.
 * Shares the dashboard's health query key so it never double-fetches.
 * Collapsed (icon) sidebar shows just the ring.
 */
export function StoreHealthBanner() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "healthScore", storeId, language],
    queryFn: () => getHealthScore(storeId!, false, language),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 60,
  });

  if (!storeId) return null;
  const hasScore = !!data && !data.insufficient_data && data.score !== null;
  const score = hasScore ? (data!.score as number) : null;
  const grade = hasScore ? GRADE_LABEL[data!.grade ?? "D"] ?? GRADE_LABEL.D : null;
  // Same ring as the old dashboard hero: sage on navy.
  const ringColor = score === null ? "rgba(255,255,255,0.14)" : score >= 40 ? "hsl(var(--sage))" : "hsl(var(--saffron))";

  return (
    <NavItemGate navKey="analytics.health">
      <button
        type="button"
        onClick={() => navigate("/health-score")}
        className={cn(
          "souq-hero-navy hover-lift mx-2 mt-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl p-3 text-start text-white",
          "group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-1.5",
        )}
        aria-label={isAr ? "صحة المتجر" : "Store health"}
        title={isAr ? "صحة المتجر" : "Store health"}
      >
        <span
          className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
          style={{ background: `conic-gradient(${ringColor} ${(score ?? 0) * 3.6}deg, rgba(255,255,255,0.14) 0)` }}
        >
          <span className="absolute inset-[5px] rounded-full bg-navy group-data-[collapsible=icon]:inset-[3px]" />
          <span className={cn("relative text-[15px] font-extrabold tabular-nums leading-none group-data-[collapsible=icon]:text-[11px]", score === null && "text-white/45")}>
            {isLoading ? "…" : score === null ? "—" : isAr ? score.toLocaleString("ar-EG") : score}
          </span>
        </span>
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="souq-eyebrow block" style={{ color: "rgba(255,255,255,0.55)" }}>
            {isAr ? "صحة المتجر" : "Store health"}
          </span>
          {score === null ? (
            <span className="mt-1 block text-[12px] leading-snug text-white/70">
              {isAr ? "هيظهر بعد أول طلب" : "Shows after your first order"}
            </span>
          ) : (
            <>
              <span className="mt-0.5 block text-[14px] font-extrabold leading-tight" style={{ color: "#9FD89C" }}>
                {isAr ? grade!.ar : grade!.en}
              </span>
              <span className="block text-[11.5px] text-white/60 tabular-nums">
                {isAr ? score.toLocaleString("ar-EG") : score}/{isAr ? "١٠٠" : "100"}
              </span>
            </>
          )}
        </span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-white/60 rtl:rotate-180 group-data-[collapsible=icon]:hidden" />
      </button>
    </NavItemGate>
  );
}

export default StoreHealthBanner;
