import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getHealthScore } from "@/services/analyticsApi";

const GRADE_LABEL: Record<string, { en: string; ar: string }> = {
  A: { en: "Excellent", ar: "ممتاز" },
  B: { en: "Great", ar: "كويس" },
  C: { en: "Okay", ar: "مقبول" },
  D: { en: "Needs work", ar: "محتاج تحسين" },
};

/**
 * The navy Store-health hero from the dashboard's NEEDS YOU row. Today it
 * is the swiper's fallback — it comes back when the merchant has dismissed
 * every promo slide — and shares the sidebar banner's query key.
 */
export function StoreHealthCard({ className }: { className?: string }) {
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

  const hasScore = !!data && !data.insufficient_data && data.score !== null;
  const score = hasScore ? (data!.score as number) : null;
  const grade = hasScore ? (GRADE_LABEL[data!.grade ?? "D"] ?? GRADE_LABEL.D) : null;

  return (
    <button
      type="button"
      onClick={() => navigate("/health-score")}
      className={`souq-hero-navy text-start p-5 hover-lift flex flex-col items-center text-center gap-2 min-h-[170px] ${className ?? ""}`}
    >
      <div className="souq-eyebrow self-start" style={{ color: "rgba(255,255,255,0.55)" }}>
        {isAr ? "صحة المتجر" : "Store health"}
      </div>
      {isLoading ? (
        <div className="py-8 flex items-center justify-center flex-1">
          <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
        </div>
      ) : score !== null ? (
        <>
          <div
            className="souq-health-ring on-navy my-1"
            style={{ background: `conic-gradient(hsl(var(--sage)) ${score * 3.6}deg, rgba(255,255,255,0.12) 0)` }}
          >
            <div className="hole" />
            <div className="score">
              <b>{isAr ? score.toLocaleString("ar-EG") : score}</b>
              <span>/{isAr ? "١٠٠" : "100"}</span>
            </div>
          </div>
          <div className="text-sm font-extrabold" style={{ color: "#9FD89C" }}>
            {isAr ? grade!.ar : grade!.en}
          </div>
          <p className="text-[11.5px] text-white/55 max-w-[180px]">
            {isAr ? "الشحن والدفع شغّالين تمام" : "Shipping & payments are healthy"}
          </p>
        </>
      ) : (
        <div className="py-6 flex flex-col items-center gap-1.5 flex-1 justify-center">
          <div className="souq-health-ring on-navy" style={{ background: "rgba(255,255,255,0.10)" }}>
            <div className="hole" />
            <div className="score">
              <b className="text-white/40">—</b>
            </div>
          </div>
          <p className="text-[11.5px] text-white/55 max-w-[180px] mt-2">
            {isAr ? "هيظهر بعد أول طلب" : "Shows after your first order"}
          </p>
        </div>
      )}
    </button>
  );
}

export default StoreHealthCard;
