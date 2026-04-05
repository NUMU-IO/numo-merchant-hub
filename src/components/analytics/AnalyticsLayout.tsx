import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Period = 7 | 30 | 90;

interface AnalyticsContextValue {
  period: Period;
  formatCurrency: (cents: number) => string;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  period: 30,
  formatCurrency: () => "",
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

interface AnalyticsLayoutProps {
  children: React.ReactNode;
  title?: { en: string; ar: string };
  subtitle?: { en: string; ar: string };
  showPeriod?: boolean;
}

export function AnalyticsLayout({
  children,
  title = { en: "Analytics", ar: "التحليلات" },
  subtitle = { en: "Your store reports and statistics", ar: "تقارير وإحصائيات متجرك" },
  showPeriod = true,
}: AnalyticsLayoutProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>(30);
  const [isRefetching, setIsRefetching] = useState(false);

  const handleRefresh = async () => {
    setIsRefetching(true);
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setIsRefetching(false);
  };

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const periodLabels: Record<Period, string> = {
    7: isAr ? "٧ أيام" : "7 days",
    30: isAr ? "٣٠ يوم" : "30 days",
    90: isAr ? "٩٠ يوم" : "90 days",
  };

  return (
    <AnalyticsContext.Provider value={{ period, formatCurrency }}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isAr ? title.ar : title.en}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {isAr ? subtitle.ar : subtitle.en}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {showPeriod && (
              <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
                {([7, 30, 90] as Period[]).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? "default" : "ghost"}
                    size="sm"
                    className={`h-7 text-[11px] px-2.5 rounded-md ${period === p ? "" : "text-muted-foreground"}`}
                    onClick={() => setPeriod(p)}
                  >
                    {periodLabels[p]}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleRefresh} disabled={isRefetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {children}
      </div>
    </AnalyticsContext.Provider>
  );
}
