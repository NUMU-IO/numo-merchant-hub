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
  const ringColor =
    score === null ? "rgba(127,127,127,0.25)" : score >= 70 ? "hsl(var(--sage))" : score >= 40 ? "hsl(var(--saffron))" : "hsl(var(--terracotta))";

  return (
    <NavItemGate navKey="analytics.health">
      <button
        type="button"
        onClick={() => navigate("/health-score")}
        className={cn(
          "mx-2 mt-1 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2 text-start transition-colors hover:bg-sidebar-accent/70",
          "group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-1.5",
        )}
        aria-label={isAr ? "صحة المتجر" : "Store health"}
        title={isAr ? "صحة المتجر" : "Store health"}
      >
        <span
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${ringColor} ${(score ?? 0) * 3.6}deg, hsl(var(--sidebar-border)) 0)` }}
        >
          <span className="absolute inset-[4px] rounded-full bg-sidebar" />
          <span className={cn("relative text-[11px] font-extrabold tabular-nums", score === null && "text-muted-foreground")}>
            {isLoading ? "…" : score === null ? "—" : isAr ? score.toLocaleString("ar-EG") : score}
          </span>
        </span>
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="block truncate text-[13px] font-extrabold leading-tight">{isAr ? "صحة المتجر" : "Store health"}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {score === null
              ? isAr ? "هيظهر بعد أول طلب" : "Shows after your first order"
              : `${isAr ? score.toLocaleString("ar-EG") : score}/${isAr ? "١٠٠" : "100"} · ${isAr ? grade!.ar : grade!.en}`}
          </span>
        </span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-muted-foreground/60 rtl:rotate-180 group-data-[collapsible=icon]:hidden" />
      </button>
    </NavItemGate>
  );
}

export default StoreHealthBanner;
