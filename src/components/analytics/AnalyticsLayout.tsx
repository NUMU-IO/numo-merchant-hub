import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

type Period = 7 | 30 | 90;

const VALID_PERIODS: readonly Period[] = [7, 30, 90] as const;

/** Pages register a callback so the layout's Export button knows what
 *  CSV to build. Returning `null` from the callback disables the
 *  button (e.g. while data is still loading). */
type ExportHandler = () => void | Promise<void> | null;

interface AnalyticsContextValue {
  period: Period;
  formatCurrency: (cents: number) => string;
  registerExport: (handler: ExportHandler | null) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  period: 30,
  formatCurrency: () => "",
  registerExport: () => {},
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

  // Period lives in the URL so it survives back/forward navigation,
  // deep links, and tab switches between analytics pages.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPeriod = Number(searchParams.get("period"));
  const period: Period = (
    VALID_PERIODS.includes(rawPeriod as Period) ? rawPeriod : 30
  ) as Period;
  const setPeriod = (next: Period) => {
    const params = new URLSearchParams(searchParams);
    if (next === 30) {
      params.delete("period");
    } else {
      params.set("period", String(next));
    }
    setSearchParams(params, { replace: true });
  };

  const [isRefetching, setIsRefetching] = useState(false);
  const exportHandlerRef = useRef<ExportHandler | null>(null);
  const [hasExport, setHasExport] = useState(false);

  const registerExport = useCallback((handler: ExportHandler | null) => {
    exportHandlerRef.current = handler;
    setHasExport(handler !== null);
  }, []);

  const handleRefresh = async () => {
    setIsRefetching(true);
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setIsRefetching(false);
  };

  const handleExport = async () => {
    const fn = exportHandlerRef.current;
    if (fn) await fn();
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
    <AnalyticsContext.Provider value={{ period, formatCurrency, registerExport }}>
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
            {hasExport && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={handleExport}
                title={isAr ? "تصدير CSV" : "Export CSV"}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
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
