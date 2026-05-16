import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  DateRangePicker,
  useDateRangeUrlState,
  type DateRange,
} from "@/components/filters/DateRangePicker";

/** Pages register a callback so the layout's Export button knows what
 *  CSV to build. Returning `null` from the callback disables the
 *  button (e.g. while data is still loading). */
type ExportHandler = () => void | Promise<void> | null;

interface AnalyticsContextValue {
  /** Selected date range from the Shopify-style picker. Drives every
   *  analytics query on every page that wraps in AnalyticsLayout. */
  range: DateRange;
  formatCurrency: (cents: number) => string;
  registerExport: (handler: ExportHandler | null) => void;
}

// Lazy default so importers calling useAnalyticsContext outside the
// provider don't crash on first render. The provider always
// overrides with a real range derived from the URL.
const fallbackRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return {
    start,
    end: now,
    preset: "last-n",
    lastN: { n: 30, unit: "day" },
    granularity: "day",
    includeToday: true,
  };
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  range: fallbackRange(),
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

  const { range, setRange } = useDateRangeUrlState();

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

  const formatCurrency = useCallback(
    (cents: number) => {
      const val = cents / 100;
      return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
    },
    [isAr],
  );

  const ctxValue = useMemo<AnalyticsContextValue>(
    () => ({ range, formatCurrency, registerExport }),
    [range, formatCurrency, registerExport],
  );

  return (
    <AnalyticsContext.Provider value={ctxValue}>
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
              <DateRangePicker
                value={range}
                onChange={setRange}
                size="sm"
                align="end"
              />
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
